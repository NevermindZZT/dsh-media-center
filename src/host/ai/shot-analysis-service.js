import fs from 'node:fs';
import path from 'node:path';
import { generateShotStoryboard } from '../media/shot-storyboard.js';
import { ShotAnalyzer } from './shot-analyzer.js';
import { ShotAnalysisStore } from '../db/shot-analysis-store.js';

// The client may customize additional instructions; the analyzer always appends its mandatory safety/schema contract.
export const DEFAULT_SHOT_PROMPT = '请描述画面中可以确认的主体、场景、动作变化、构图及光影，并区分不确定信息与剪辑建议。';
const SAFE_FAILURE = '片段精读失败，请检查视频源文件、FFmpeg 和 AI 模型设置后重试。';

export class ShotAnalysisService {
  constructor(db, mediaEngine, videoAiAnalyzer) {
    this.db = db;
    this.mediaEngine = mediaEngine;
    this.store = new ShotAnalysisStore(db);
    this.analyzer = new ShotAnalyzer(videoAiAnalyzer);
    this.videoAiAnalyzer = videoAiAnalyzer;
    this.active = new Set();
    // Running work cannot survive a process/plugin restart.
    this.db.db.prepare("UPDATE shot_analysis_runs SET status='failed', error_code='INTERRUPTED', error_message='分析被中断，请重新发起', finished_at=? WHERE status='running'")
      .run(new Date().toISOString());
  }

  getPromptSettings() {
    return { prompt: this.db.getSetting('shot_ai_prompt_template') || DEFAULT_SHOT_PROMPT, default_prompt: DEFAULT_SHOT_PROMPT };
  }

  savePromptSettings(prompt) {
    if (typeof prompt !== 'string' || prompt.length > 16000) throw new Error('提示词必须是长度不超过 16000 字符的文本');
    this.db.setSetting('shot_ai_prompt_template', prompt);
    return this.getPromptSettings();
  }

  async analyze(videoId, shotId) {
    if (typeof videoId !== 'string' || typeof shotId !== 'string') throw new Error('无效的视频或片段 ID');
    if (this.active.has(shotId)) throw new Error('该片段正在分析中');
    const video = this.db.getVideoById(videoId);
    const shot = this.db.getVideoShots(videoId).find(item => item.id === shotId);
    if (!video || !shot) throw new Error('视频或片段不存在');
    this.active.add(shotId);
    let run;
    let generated;
    let pipelineStart;
    try {
      const settings = this.videoAiAnalyzer.getAiSettings();
      const customApiKey = settings.mode === 'custom' ? this.db.getSetting('ai_api_key') : undefined;
      if (settings.mode === 'dsh') await this.videoAiAnalyzer.validateDshRoute(settings.provider, settings.model, settings.reasoning_effort);
      else if (settings.mode !== 'custom' || !settings.base_url || !settings.model || !settings.has_api_key) throw new Error('请先完成 AI 模型设置');
      run = this.store.createRun({
        video_id: videoId, shot_id: shotId, start_time: shot.start_time, end_time: shot.end_time,
        provider: settings.mode === 'dsh' ? settings.provider : 'custom', model: settings.model,
        reasoning_effort: settings.mode === 'dsh' ? (settings.reasoning_effort || null) : null
      });
      pipelineStart = Date.now();
      const binaries = await this.mediaEngine.getBinaries();
      if (!binaries.ffmpeg) throw new Error('未检测到 FFmpeg');
      const cacheRoot = fs.realpathSync(this.db.cacheDir);
      const outputDir = path.join(this.db.cacheDir, 'shot-analysis');
      fs.mkdirSync(outputDir, { recursive: true });
      const actualDir = fs.realpathSync(outputDir);
      const relative = path.relative(cacheRoot, actualDir);
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('片段故事板缓存路径无效');
      generated = await generateShotStoryboard({ video, shot, outputDir: actualDir, ffmpeg: binaries.ffmpeg });
      const prompt = this.db.getSetting('shot_ai_prompt_template') || DEFAULT_SHOT_PROMPT;
      const result = await this.analyzer.analyze({ video, shot, ...generated, prompt_template: prompt, config_snapshot: settings, ...(settings.mode === 'custom' ? { custom_api_key: customApiKey } : {}) });
      const candidate = { ...result.candidate };
      // An unknown score is informative, not an applicable replacement.
      if (candidate.quality_score == null) delete candidate.quality_score;
      return this.store.finishRun(run.id, {
        candidate, audit: { ...result.audit, analyzed_at: result.audit.finished_at, total_elapsed_ms: Date.now() - pipelineStart }, sample_times: generated.sample_times,
        storyboard_path: generated.storyboard_path, prompt: result.prompt_snapshot
      });
    } catch (error) {
      if (run) {
        const prior = error?.analysis_audit || {};
        const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
        try { this.store.failRun(run.id, {
          error_code: 'ANALYSIS_FAILED', error_message: SAFE_FAILURE,
          ...(generated ? { sample_times: generated.sample_times, storyboard_path: generated.storyboard_path } : {}),
          audit: { provider: run.provider, model: run.model, reasoning_effort: run.reasoning_effort,
            prompt_tokens: safeCount(prior.prompt_tokens), completion_tokens: safeCount(prior.completion_tokens),
            total_tokens: safeCount(prior.total_tokens), latency_ms: safeCount(prior.latency_ms),
            total_elapsed_ms: pipelineStart == null ? null : Date.now() - pipelineStart,
            analyzed_at: new Date().toISOString() }
        }); } catch {}
      }
      // Never persist or expose provider response text, which may include credentials.
      if (!run && /^(该片段正在分析中|视频或片段不存在|请先完成 AI 模型设置|请选择 DSH|请为所选 DSH|所选 DSH|无法获取所选 DSH|推理档位)/.test(error.message || '')) throw error;
      throw new Error(SAFE_FAILURE);
    } finally {
      this.active.delete(shotId);
    }
  }

  getStoryboardPath(runId) {
    const run = this.store.getRun(runId);
    if (!run?.storyboard_path) return null;
    try {
      const root = fs.realpathSync(path.join(this.db.cacheDir, 'shot-analysis'));
      const target = fs.realpathSync(run.storyboard_path);
      const relative = path.relative(root, target);
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
      if (!fs.statSync(target).isFile() || path.extname(target).toLowerCase() !== '.jpg') return null;
      return target;
    } catch { return null; }
  }
}
