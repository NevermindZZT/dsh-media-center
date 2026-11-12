import fs from 'node:fs';
import path from 'node:path';

export class VideoAiAnalyzer {
  constructor(db, mediaEngine, services = {}) {
    this.db = db;
    this.mediaEngine = mediaEngine;
    this.llm = services.llm;
    this.attachments = services.attachments;
  }

  safeBaseUrl(value) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      url.username = '';
      url.password = '';
      url.search = '';
      url.hash = '';
      return url.toString().replace(/\/$/, '');
    } catch { return ''; }
  }

  getAiSettings() {
    const mode = this.db.getSetting('ai_mode') ||
      (this.db.getSetting('ai_base_url') || this.db.getSetting('ai_api_key') || this.db.getSetting('ai_model') ? 'custom' : 'dsh');
    return {
      mode,
      provider: this.db.getSetting('ai_provider') || '',
      dsh_model: this.db.getSetting('ai_dsh_model') || '',
      custom_model: this.db.getSetting('ai_model') || '',
      reasoning_effort: this.db.getSetting('ai_reasoning_effort') || '',
      model: (mode === 'custom'
        ? this.db.getSetting('ai_model') : this.db.getSetting('ai_dsh_model')) || '',
      base_url: this.safeBaseUrl(this.db.getSetting('ai_base_url') || ''),
      has_api_key: !!this.db.getSetting('ai_api_key'),
      custom_prompt: this.db.getSetting('ai_prompt_template') || '',
      default_prompt: this.getDefaultPromptTemplate()
    };
  }

  // Safe catalog: do not include adapter internals or credentials in the response.
  async getModelCatalog() {
    if (!this.llm) throw new Error('DSH 模型服务不可用');
    const providers = this.llm.listProviders();
    const errors = [];
    const result = await Promise.all(providers.map(async provider => {
      try {
        const models = await this.llm.listModels(provider.id);
        const entries = await Promise.all(models.map(async model => {
          const entry = { provider: provider.id, id: model.id, name: model.name,
            ...(Array.isArray(model.inputModalities) ? { inputModalities: [...model.inputModalities] } : {}) };
          try {
            const info = await this.llm.resolveModelInfo(provider.id, model.id);
            if (info.reasoning !== undefined) {
              if (!Array.isArray(info.reasoning?.efforts)) throw new Error('invalid reasoning metadata');
              entry.reasoning = {
                efforts: info.reasoning.efforts.map(e => ({ id: e.id, name: e.name, ...(e.description ? { description: e.description } : {}) })),
                ...(info.reasoning.defaultEffort ? { defaultEffort: info.reasoning.defaultEffort } : {})
              };
            }
          } catch {
            entry.reasoning_unavailable = true;
          }
          return entry;
        }));
        return { id: provider.id, name: provider.name, models: entries };
      } catch {
        errors.push({ provider: provider.id, message: '无法获取此服务商的模型列表' });
        return { id: provider.id, name: provider.name, models: [] };
      }
    }));
    return { providers: result, errors };
  }

  async validateDshRoute(provider, model, reasoningEffort = '') {
    if (!provider || !model) throw new Error('请选择 DSH 服务商和模型');
    if (!this.llm || !this.attachments) throw new Error('DSH 模型或图片附件服务不可用');
    if (!this.llm.listProviders().some(entry => entry.id === provider)) throw new Error('所选 DSH 服务商不可用');
    let models;
    try { models = await this.llm.listModels(provider); }
    catch { throw new Error('无法获取所选 DSH 服务商的模型列表'); }
    const selected = models.find(entry => entry.id === model && entry.provider === provider);
    if (!selected) throw new Error('所选模型不在该 DSH 服务商的模型列表中');
    if (Array.isArray(selected.inputModalities) && !selected.inputModalities.includes('image')) {
      throw new Error('所选 DSH 模型不支持图片输入');
    }
    if (typeof reasoningEffort !== 'string') throw new Error('推理档位必须为字符串');
    let info;
    try { info = await this.llm.resolveModelInfo(provider, model); }
    catch { throw new Error('无法获取所选 DSH 模型的推理能力，请刷新模型列表'); }
    if (!info || typeof info !== 'object') throw new Error('无法获取所选 DSH 模型的推理能力，请刷新模型列表');
    if (Array.isArray(info.inputModalities) && !info.inputModalities.includes('image')) {
      throw new Error('所选 DSH 模型不支持图片输入');
    }
    if (info.reasoning !== undefined) {
      if (!Array.isArray(info.reasoning?.efforts)) throw new Error('所选 DSH 模型的推理能力无效，请刷新模型列表');
      if (!reasoningEffort) throw new Error('请为所选 DSH 模型明确选择推理档位');
      if (!info.reasoning.efforts.some(e => e.id === reasoningEffort)) throw new Error('所选推理档位不受当前 DSH 模型支持');
    } else if (reasoningEffort) {
      throw new Error('所选 DSH 模型未声明推理档位，请清空推理档位');
    }
    return info;
  }

  async saveAiSettings(patch = {}) {
    const current = this.getAiSettings();
    const mode = patch.mode ?? current.mode;
    if (!['dsh', 'custom'].includes(mode)) throw new Error('无效的 AI 模型模式');
    const provider = patch.provider ?? current.provider;
    const model = patch.model ?? (mode === current.mode ? current.model :
      (mode === 'custom' ? this.db.getSetting('ai_model') : this.db.getSetting('ai_dsh_model'))) ?? '';
    const reasoningEffort = Object.hasOwn(patch, 'reasoning_effort') ? patch.reasoning_effort : current.reasoning_effort;
    if (mode === 'dsh') await this.validateDshRoute(provider, model, reasoningEffort);
    if (mode === 'custom') {
      const baseUrl = patch.base_url ?? current.base_url;
      let url;
      try { url = new URL(baseUrl); } catch { throw new Error('请填写有效的自定义 API 地址'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('自定义 API 地址必须为不含凭据或查询参数的 HTTP(S) 地址');
      if (!model) throw new Error('请填写自定义模型名称');
      if (!patch.api_key && !this.db.getSetting('ai_api_key')) throw new Error('请配置自定义 API Key');
    }
    // Validate the entire patch before writing any values.
    this.db.setSetting('ai_mode', mode);
    if (mode === 'dsh') {
      this.db.setSetting('ai_provider', provider);
      this.db.setSetting('ai_dsh_model', model);
      this.db.setSetting('ai_reasoning_effort', reasoningEffort);
    } else {
      if (patch.base_url !== undefined) this.db.setSetting('ai_base_url', patch.base_url);
      if (patch.api_key !== undefined && patch.api_key !== '') this.db.setSetting('ai_api_key', patch.api_key);
      this.db.setSetting('ai_model', model);
    }
    if (patch.prompt_template !== undefined) this.db.setSetting('ai_prompt_template', patch.prompt_template);
    return this.getAiSettings();
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

    const config = this.getAiSettings();
    if (config.mode === 'dsh') await this.validateDshRoute(config.provider, config.model, config.reasoning_effort);
    else if (config.mode === 'custom') {
      if (!config.base_url || !config.model || !config.has_api_key) throw new Error('请在设置中完整配置自定义 API 地址、模型和 API Key');
    } else throw new Error('无效的 AI 模型模式');

    // 1. Prepare storyboard image
    let storyboardPath = video.storyboard_path;
    if (!storyboardPath || !fs.existsSync(storyboardPath)) {
      storyboardPath = await this.mediaEngine.generateStoryboard(video);
    }
    if (!storyboardPath || !fs.existsSync(storyboardPath)) {
      throw new Error('无法生成故事板大图，请检查 FFmpeg 配置');
    }

    // Silence is written only after a verified successful detection. Tempo is unavailable.
    let silenceResult = { status: 'unavailable', reason: 'silence_detector_unavailable', intervals: null };
    try {
      if (typeof this.mediaEngine.detectSilenceResult === 'function') {
        silenceResult = await this.mediaEngine.detectSilenceResult(video);
      } else {
        const intervals = await this.mediaEngine.detectSilence(video);
        silenceResult = Array.isArray(intervals) ? { status: 'ok', reason: null, intervals } : silenceResult;
      }
    } catch { silenceResult = { status: 'error', reason: 'silence_detection_failed', intervals: null }; }
    const tempoResult = { status: 'unavailable', reason: 'tempo_detector_not_integrated', bpm: null, beats: null };

    const promptText = this.renderPrompt(config.custom_prompt, video);
    const imageBuffer = fs.readFileSync(storyboardPath);
    const startTime = Date.now();
    let content = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    if (config.mode === 'dsh') {
      const image = await this.attachments.saveImage({
        data: imageBuffer, mediaType: 'image/jpeg', name: path.basename(storyboardPath)
      });
      const request = async (reasoningEffort) => {
        let finish = null, text = '', input = 0, output = 0, total = 0;
        try {
          const options = {
            provider: config.provider, model: config.model,
            messages: [{ role: 'user', content: [
              { type: 'text', text: promptText }, { type: 'image', attachment: image }
            ] }],
            temperature: 0.3, maxTokens: 4096,
            ...(reasoningEffort ? { reasoningEffort } : {})
          };
          for await (const chunk of this.llm.stream(options)) {
            if (chunk.type === 'text-delta') text += chunk.text;
            if (chunk.type === 'usage') {
              input = chunk.usage.inputTokens ?? 0;
              output = chunk.usage.outputTokens ?? 0;
              total = chunk.usage.totalTokens ?? (input + output);
            }
            if (chunk.type === 'finish') finish = chunk.reason;
          }
        } catch { throw new Error('DSH 模型请求失败，请检查所选服务商与模型'); }
        return { finish, text, input, output, total };
      };
      const result = await request(config.reasoning_effort);
      const finish = result.finish;
      content = result.text;
      promptTokens = result.input;
      completionTokens = result.output;
      totalTokens = result.total;
      if (!finish || finish.kind !== 'stop') {
        // Provider error messages can contain secrets. Expose only the stable category.
        const code = /^[A-Z][A-Z0-9_]{0,63}$/.test(finish?.failure?.code || '') ? finish.failure.code : '';
        const status = Number.isInteger(finish?.failure?.status) && finish.failure.status >= 100 && finish.failure.status <= 599 ? finish.failure.status : null;
        const message = String(finish?.failure?.message || '');
        const hints = [
          ['temperature', /temperature/i], ['max_tokens', /max[_ -]?(?:output[_ -]?)?tokens/i],
          ['image', /image|vision|图片|图像/i], ['content', /content|message/i],
          ['model', /model/i], ['reasoning', /reasoning|thinking/i],
          ['unsupported', /unsupported|not supported|不支持/i], ['too_large', /too large|length limit|maximum context/i],
          ['authentication', /authentication|unauthorized|credential/i], ['responses', /responses|response_format/i],
          ['reasoning_content', /reasoning_content/i], ['reasoning_effort', /reasoning[_ .-]?effort/i],
          ['input_image', /input_image/i], ['input_text', /input_text/i],
          ['unsupported_parameter', /unsupported[_ -]parameter|unknown parameter/i],
          ['unsupported_value', /unsupported[_ -]value/i], ['image_url', /image_url/i],
          ['invalid_type', /invalid[_ -]type/i], ['max_output_tokens', /max_output_tokens/i],
          ['missing_content', /missing[^\n]{0,80}content|content[^\n]{0,80}missing/i],
          ['reasoning_model', /reasoning[^\n]{0,80}model|model[^\n]{0,80}reasoning/i]
        ].filter(([, pattern]) => pattern.test(message)).map(([label]) => label);
        throw new Error(`DSH 模型请求未成功完成 (${finish?.kind || '无结束信号'}${code ? `, ${code}` : ''}${status ? `, HTTP ${status}` : ''}${hints.length ? `, 参数线索: ${hints.join('/')}` : ''})`);
      }
    } else {
      const apiKey = this.db.getSetting('ai_api_key');
      const endpoint = `${config.base_url.replace(/\/+$/, '')}/chat/completions`;
      let response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: [
              { type: 'text', text: promptText },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}` } }
            ] }],
            temperature: 0.3,
            max_tokens: 4096
          })
        });
      } catch { throw new Error('自定义 AI 服务请求失败，请检查连接'); }
      if (!response.ok) throw new Error(`自定义 AI 服务请求失败 (${response.status})`);
      let data;
      try { data = await response.json(); }
      catch { throw new Error('自定义 AI 服务返回了无效 JSON'); }
      if (data.choices?.[0]?.finish_reason && data.choices[0].finish_reason !== 'stop') {
        throw new Error('自定义 AI 服务未完整返回分析结果');
      }
      content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || {};
      promptTokens = usage.prompt_tokens ?? 0;
      completionTokens = usage.completion_tokens ?? 0;
      totalTokens = usage.total_tokens ?? (promptTokens + completionTokens);
    }
    const latencyMs = Date.now() - startTime;

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
        try { parsedResult = JSON.parse(jsonMatch[0]); }
        catch { throw new Error('AI 未能返回标准 JSON 分镜结构'); }
      } else {
        throw new Error('AI 未能返回标准 JSON 分镜结构');
      }
    }

    if (!parsedResult || !Array.isArray(parsedResult.shots) || !parsedResult.shots.length ||
        parsedResult.shots.some(s => !s || !Number.isFinite(Number(s.start_time)) || !Number.isFinite(Number(s.end_time)) ||
          Number(s.start_time) < 0 || Number(s.end_time) <= Number(s.start_time) ||
          (video.duration > 0 && Number(s.end_time) > video.duration + 0.1))) {
      throw new Error('AI 返回的分镜数据无效，原有标注未更改');
    }
    // 6. Write the complete result in one SQLite transaction.
    const nowIso = new Date().toISOString();
    const sqlite = this.db.db;
    if (sqlite) sqlite.exec('BEGIN IMMEDIATE');
    try {
    // 6.1 Update Shots
    const shotsList = parsedResult.shots;
    this.db.upsertShots(video.id, shotsList);

    // 6.2 Update Audio
    const audioPatch = {
      ...(typeof parsedResult.bgm_mood === 'string' ? { bgm_mood: parsedResult.bgm_mood } : {}),
      ...(silenceResult?.status === 'ok' && Array.isArray(silenceResult.intervals) ? { silence_intervals: silenceResult.intervals } : {})
    };
    if (Object.keys(audioPatch).length) this.db.upsertVideoAudio(video.id, audioPatch);

    // 6.3 Update Video Master with Audit Metrics
    const updatedVideo = this.db.upsertVideo({
      id: video.id,
      ...(typeof parsedResult.summary === 'string' ? { summary: parsedResult.summary } : {}),
      ...(Array.isArray(parsedResult.tags) && parsedResult.tags.every(tag => typeof tag === 'string') ? { tags: parsedResult.tags } : {}),
      ...(typeof parsedResult.user_notes === 'string' ? { user_notes: parsedResult.user_notes } : {}),
      status: 'analyzed',
      storyboard_path: storyboardPath,
      ai_model: config.model,
      ai_prompt_tokens: promptTokens,
      ai_completion_tokens: completionTokens,
      ai_total_tokens: totalTokens,
      ai_latency_ms: latencyMs,
      ai_analyzed_at: nowIso
    });

    if (sqlite) sqlite.exec('COMMIT');
    } catch (error) {
      if (sqlite) sqlite.exec('ROLLBACK');
      throw error;
    }
    return {
      success: true,
      video: this.db.getVideoById(video.id, true, true),
      audio_analysis: { silence: silenceResult, tempo: tempoResult },
      audit: {
        provider: config.mode === 'dsh' ? config.provider : 'custom',
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
