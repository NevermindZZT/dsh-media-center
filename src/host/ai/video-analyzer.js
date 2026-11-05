import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export class VideoAiAnalyzer {
  constructor(db, mediaEngine) {
    this.db = db;
    this.mediaEngine = mediaEngine;
  }

  // Read DSH active model and credentials fallback
  resolveAiConfig() {
    let baseUrl = this.db.getSetting('ai_base_url');
    let apiKey = this.db.getSetting('ai_api_key');
    let model = this.db.getSetting('ai_model');

    // Default Fallback from DSH environment
    if (!baseUrl) {
      baseUrl = 'https://api.nevermindzzt.top/v1';
    }
    if (!model) {
      model = 'zero-plus'; // default visual model configured in DSH
    }

    if (!apiKey) {
      // Try process.env
      apiKey = process.env.ZERO_API_RESPONSES_API_KEY || process.env.ZERO_API_API_KEY || '';

      // Try reading ~/.dsh/.credentials.yaml
      if (!apiKey) {
        try {
          const credPath = path.join(os.homedir(), '.dsh', '.credentials.yaml');
          if (fs.existsSync(credPath)) {
            const content = fs.readFileSync(credPath, 'utf8');
            const match = content.match(/ZERO_API_RESPONSES_API_KEY:\s*([a-zA-Z0-9_-]+)/) ||
                          content.match(/ZERO_API_API_KEY:\s*([a-zA-Z0-9_-]+)/);
            if (match) apiKey = match[1];
          }
        } catch {}
      }
    }

    const customPrompt = this.db.getSetting('ai_prompt_template');

    return {
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey,
      model,
      customPrompt
    };
  }

  getDefaultPromptTemplate() {
    return `你是一位资深影视导演、摄影指导与后期剪辑师。
现在有一段视频素材，基本参数如下：
- 文件名：{{video_name}}
- 所属分类：{{folder_name}}
- 总时长：{{duration}} 秒
- 分辨率与帧率：{{resolution}} @ {{fps}} fps

请仔细观察附带的 4x4 故事板大图（从左到右、从上到下按时间顺序排列的 16 个代表性关键画面快照），对视频进行多模态审美与镜头分镜解析。

要求：
1. 结合总时长（{{duration}} 秒），将视频切分为若干个连续的镜头分镜（通常 2-8 个分镜），时间首尾顺畅衔接，起始为 0 秒，结束为 {{duration}} 秒。
2. 准确判断每个镜头的景别（特写 / 大特写 / 中景 / 全景 / 远景 / 大远景）与运镜方式（固定 / 推镜头 / 拉镜头 / 摇镜头 / 移镜头 / 跟镜头 / 航拍俯瞰推镜头 / 升降镜头）。
3. 给出详细生动的画面视觉描述、构图光影色彩分析，并给出 1.0 - 5.0 的素材质量评分。
4. 总结全片画面剧情概要（summary，50-100字）、业务分类标签列表（tags）、剪辑建议备忘（user_notes）及适合的背景音乐情绪（bgm_mood）。

必须严格输出且只输出合法 JSON 格式，禁止包含多余闲聊说明：
{
  "summary": "全片全局画面与情节叙事摘要（50-100字）",
  "tags": ["标签1", "标签2", "标签3"],
  "user_notes": "剪辑构思与搭配建议",
  "bgm_mood": "震撼抒情 / 欢快 / 紧张 / 平静 等",
  "shots": [
    {
      "shot_index": 1,
      "start_time": 0.0,
      "end_time": 4.5,
      "shot_type": "大远景",
      "camera_movement": "航拍俯瞰推镜头",
      "subject": "画面核心主体与动作",
      "visual_description": "画面详细视觉描述与发生的情节",
      "composition": "构图与光影色彩风格",
      "quality_score": 4.8
    }
  ]
}`;
  }

  renderPrompt(template, video) {
    const raw = template || this.getDefaultPromptTemplate();
    return raw
      .replace(/{{video_name}}/g, video.file_name || '视频素材')
      .replace(/{{folder_name}}/g, video.folder_path || video.folder_name || '根目录')
      .replace(/{{duration}}/g, String(video.duration || 10))
      .replace(/{{resolution}}/g, `${video.width || 1920}x${video.height || 1080}`)
      .replace(/{{fps}}/g, String(video.fps || 30));
  }

  // Execute full multi-modal analysis for one video
  async analyzeVideo(videoId) {
    const video = this.db.getVideoById(videoId);
    if (!video) throw new Error(`Video not found: ${videoId}`);

    const config = this.resolveAiConfig();
    if (!config.apiKey) {
      throw new Error('未检测到有效 AI API Key，请在【设置】中配置或在 ~/.dsh/.credentials.yaml 中配置 ZERO_API_RESPONSES_API_KEY');
    }

    // 1. Prepare storyboard image
    let storyboardPath = video.storyboard_path;
    if (!storyboardPath || !fs.existsSync(storyboardPath)) {
      storyboardPath = await this.mediaEngine.generateStoryboard(video);
    }
    if (!storyboardPath || !fs.existsSync(storyboardPath)) {
      throw new Error('无法生成故事板大图，请检查 FFmpeg 配置');
    }

    // 2. Prepare silence & BPM in background
    let silenceIntervals = [];
    let bpm = 120;
    try {
      silenceIntervals = await this.mediaEngine.detectSilence(video);
      const audioBeats = await this.mediaEngine.detectBpmAndBeats(video);
      bpm = audioBeats.bpm;
    } catch {}

    // 3. Assemble prompt & image base64
    const promptText = this.renderPrompt(config.customPrompt, video);
    const imageBuffer = fs.readFileSync(storyboardPath);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          {
            type: 'image_url',
            image_url: {
              url: base64Image
            }
          }
        ]
      }
    ];

    // 4. Request Multi-modal LLM
    const startTime = Date.now();
    const endpoint = `${config.baseUrl}/chat/completions`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.3,
        max_tokens: 4096
      })
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI 请求失败 (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

    // 5. Parse JSON Output
    let parsedResult = null;
    try {
      // Clean possible markdown code fences
      const cleanJson = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsedResult = JSON.parse(cleanJson);
    } catch (e) {
      console.warn('[VideoAiAnalyzer] Direct JSON parse failed, trying regex match:', e.message);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('AI 未能返回标准 JSON 分镜结构：' + content.slice(0, 200));
      }
    }

    // 6. Write back to database atomically
    const nowIso = new Date().toISOString();

    // 6.1 Update Shots
    const shotsList = Array.isArray(parsedResult.shots) ? parsedResult.shots : [];
    this.db.upsertShots(video.id, shotsList);

    // 6.2 Update Audio
    this.db.upsertVideoAudio(video.id, {
      bgm_mood: parsedResult.bgm_mood || '自然',
      bpm,
      silence_intervals: silenceIntervals
    });

    // 6.3 Update Video Master with Audit Metrics
    const updatedVideo = this.db.upsertVideo({
      id: video.id,
      summary: parsedResult.summary || '',
      tags: parsedResult.tags || [],
      user_notes: parsedResult.user_notes || '',
      status: 'analyzed',
      storyboard_path: storyboardPath,
      ai_model: config.model,
      ai_prompt_tokens: promptTokens,
      ai_completion_tokens: completionTokens,
      ai_total_tokens: totalTokens,
      ai_latency_ms: latencyMs,
      ai_analyzed_at: nowIso
    });

    return {
      success: true,
      video: this.db.getVideoById(video.id, true, true),
      audit: {
        model: config.model,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        latency_ms: latencyMs,
        analyzed_at: nowIso
      }
    };
  }
}
