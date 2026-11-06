import crypto from 'node:crypto';

/** Fields whose candidate values can be explicitly applied to the existing shot. */
export const SHOT_ANALYSIS_FIELDS = Object.freeze([
  'subject', 'visual_description', 'composition', 'shot_type', 'camera_movement', 'quality_score', 'tags'
]);
const FIELD_SET = new Set(SHOT_ANALYSIS_FIELDS);
const STRING_FIELDS = new Set(['subject', 'visual_description', 'composition', 'shot_type', 'camera_movement']);
const INFORMATION_FIELDS = new Set(['uncertainty', 'editing_suggestions']);

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${name} must be a plain object`);
  }
}

function jsonObject(value, name) {
  requireObject(value, name);
  let result;
  try {
    result = JSON.stringify(value, (_key, item) => {
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint' ||
          (typeof item === 'number' && !Number.isFinite(item))) throw new Error('non-JSON value');
      return item;
    });
  } catch { throw new Error(`${name} must contain only JSON-compatible values`); }
  return result;
}

function optionalString(value, name) {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  return value;
}

function validateCandidate(candidate) {
  requireObject(candidate, 'candidate');
  const keys = Object.keys(candidate);
  if (!keys.length) throw new Error('candidate must contain at least one field');
  for (const field of keys) {
    if (!FIELD_SET.has(field) && !INFORMATION_FIELDS.has(field)) throw new Error(`unsupported candidate field: ${field}`);
    const value = candidate[field];
    if ((STRING_FIELDS.has(field) || INFORMATION_FIELDS.has(field)) && typeof value !== 'string') throw new Error(`${field} must be a string`);
    if (field === 'quality_score' && (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 5)) {
      throw new Error('quality_score must be a number between 1 and 5');
    }
    if (field === 'tags' && (!Array.isArray(value) || value.some(tag => typeof tag !== 'string'))) {
      throw new Error('tags must be an array of strings');
    }
  }
  return JSON.stringify(candidate);
}

function validateSampleTimes(value, start, end) {
  if (value == null) return '[]';
  if (!Array.isArray(value)) throw new Error('sample_times must be an array');
  let previous = -Infinity;
  for (const time of value) {
    if (typeof time !== 'number' || !Number.isFinite(time) || time < start || time >= end || time < previous) {
      throw new Error('sample_times must be ordered finite timestamps within shot boundaries');
    }
    previous = time;
  }
  return JSON.stringify(value);
}

function parseTags(raw) {
  try {
    const value = JSON.parse(raw || '[]');
    if (Array.isArray(value) && value.every(v => typeof v === 'string')) return value;
  } catch {}
  throw new Error('stored shot tags are invalid');
}

function shotSnapshot(row) {
  return {
    id: row.id, video_id: row.video_id, shot_index: row.shot_index,
    start_time: row.start_time, end_time: row.end_time,
    subject: row.subject, visual_description: row.visual_description,
    composition: row.composition, shot_type: row.shot_type,
    camera_movement: row.camera_movement, quality_score: row.quality_score,
    tags: parseTags(row.tags)
  };
}

/**
 * Persistent candidate analysis for existing video_shots. No operation touches files.
 * Returned runs use snake_case keys; JSON columns are decoded to `shot_snapshot`,
 * `candidate`, `audit`, `sample_times` and `applied_fields`.
 */
export class ShotAnalysisStore {
  constructor(videoDb) {
    if (!videoDb?.db) throw new Error('VideoDatabase with an open SQLite connection is required');
    this.videoDb = videoDb;
    this.db = videoDb.db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS shot_analysis_runs (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      shot_id TEXT NOT NULL,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      shot_snapshot TEXT NOT NULL,
      sample_times TEXT NOT NULL DEFAULT '[]',
      storyboard_path TEXT,
      prompt TEXT,
      provider TEXT,
      model TEXT,
      reasoning_effort TEXT,
      candidate TEXT,
      audit TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL CHECK(status IN ('running','completed','failed','applied')),
      error_code TEXT,
      error_message TEXT,
      applied_fields TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      finished_at TEXT,
      applied_at TEXT,
      FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_shot_analysis_runs_shot_created ON shot_analysis_runs(shot_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_shot_analysis_runs_video_created ON shot_analysis_runs(video_id, created_at DESC, id DESC);`);
  }

  #transaction(fn) {
    const name = `shot_analysis_${crypto.randomUUID().replace(/-/g, '')}`;
    this.db.exec(`SAVEPOINT ${name}`);
    try {
      const result = fn();
      this.db.exec(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (error) {
      try { this.db.exec(`ROLLBACK TO SAVEPOINT ${name}`); } finally { this.db.exec(`RELEASE SAVEPOINT ${name}`); }
      throw error;
    }
  }

  #decode(row) {
    if (!row) return null;
    return {
      ...row,
      shot_snapshot: JSON.parse(row.shot_snapshot),
      baseline: JSON.parse(row.shot_snapshot),
      sample_times: JSON.parse(row.sample_times),
      candidate: row.candidate == null ? null : JSON.parse(row.candidate),
      audit: JSON.parse(row.audit),
      applied_fields: JSON.parse(row.applied_fields)
    };
  }

  /** Snapshot the exact existing shot and requested bounds before any async work. */
  createRun(input) {
    requireObject(input, 'input');
    const { video_id, shot_id, start_time, end_time } = input;
    if (typeof video_id !== 'string' || !video_id || typeof shot_id !== 'string' || !shot_id) throw new Error('video_id and shot_id are required');
    if (typeof start_time !== 'number' || typeof end_time !== 'number' || !Number.isFinite(start_time) || !Number.isFinite(end_time) || start_time < 0 || end_time <= start_time) {
      throw new Error('invalid shot boundaries');
    }
    const sampleTimes = validateSampleTimes(input.sample_times, start_time, end_time);
    const storyboardPath = optionalString(input.storyboard_path, 'storyboard_path');
    const prompt = optionalString(input.prompt, 'prompt');
    const provider = optionalString(input.provider, 'provider');
    const model = optionalString(input.model, 'model');
    const effort = optionalString(input.reasoning_effort, 'reasoning_effort');
    return this.#transaction(() => {
      const shot = this.db.prepare('SELECT * FROM video_shots WHERE id = ? AND video_id = ?').get(shot_id, video_id);
      if (!shot) throw new Error('shot not found for video');
      if (shot.start_time !== start_time || shot.end_time !== end_time) throw new Error('shot boundaries changed');
      const id = `sar_${crypto.randomUUID().replace(/-/g, '')}`;
      const now = new Date().toISOString();
      this.db.prepare(`INSERT INTO shot_analysis_runs
        (id, video_id, shot_id, start_time, end_time, shot_snapshot, sample_times, storyboard_path,
         prompt, provider, model, reasoning_effort, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)`)
        .run(id, video_id, shot_id, start_time, end_time, JSON.stringify(shotSnapshot(shot)), sampleTimes,
          storyboardPath, prompt, provider, model, effort, now);
      return this.getRun(id);
    });
  }

  /** Complete a running analysis; candidate fields remain separate until applyFields. */
  finishRun(runId, input) {
    requireObject(input, 'input');
    const candidate = validateCandidate(input.candidate);
    const audit = jsonObject(input.audit ?? {}, 'audit');
    return this.#transaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error('analysis run not found');
      if (run.status !== 'running') throw new Error('analysis run is not running');
      const times = input.sample_times === undefined ? JSON.stringify(run.sample_times) : validateSampleTimes(input.sample_times, run.start_time, run.end_time);
      const storyboardPath = input.storyboard_path === undefined ? run.storyboard_path : optionalString(input.storyboard_path, 'storyboard_path');
      const prompt = input.prompt === undefined ? run.prompt : optionalString(input.prompt, 'prompt');
      this.db.prepare(`UPDATE shot_analysis_runs SET candidate = ?, audit = ?, sample_times = ?, storyboard_path = ?, prompt = ?,
        status = 'completed', finished_at = ? WHERE id = ? AND status = 'running'`)
        .run(candidate, audit, times, storyboardPath, prompt, new Date().toISOString(), runId);
      return this.getRun(runId);
    });
  }

  failRun(runId, input = {}) {
    requireObject(input, 'input');
    const audit = jsonObject(input.audit ?? {}, 'audit');
    const code = optionalString(input.error_code, 'error_code');
    const message = optionalString(input.error_message, 'error_message');
    return this.#transaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error('analysis run not found');
      if (run.status !== 'running') throw new Error('analysis run is not running');
      const sampleTimes = input.sample_times === undefined ? JSON.stringify(run.sample_times) : validateSampleTimes(input.sample_times, run.start_time, run.end_time);
      const storyboardPath = input.storyboard_path === undefined ? run.storyboard_path : optionalString(input.storyboard_path, 'storyboard_path');
      this.db.prepare(`UPDATE shot_analysis_runs SET status = 'failed', audit = ?, error_code = ?, error_message = ?, sample_times = ?, storyboard_path = ?, finished_at = ? WHERE id = ?`)
        .run(audit, code, message, sampleTimes, storyboardPath, new Date().toISOString(), runId);
      return this.getRun(runId);
    });
  }

  getRun(runId) {
    if (typeof runId !== 'string' || !runId) throw new Error('runId is required');
    return this.#decode(this.db.prepare('SELECT * FROM shot_analysis_runs WHERE id = ?').get(runId));
  }

  listRuns(options = {}) {
    requireObject(options, 'options');
    const limit = options.limit ?? 50, offset = options.offset ?? 0;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500 || !Number.isSafeInteger(offset) || offset < 0) throw new Error('invalid limit or offset');
    const where = [], params = [];
    if (options.video_id !== undefined) { if (typeof options.video_id !== 'string' || !options.video_id) throw new Error('invalid video_id'); where.push('video_id = ?'); params.push(options.video_id); }
    if (options.shot_id !== undefined) { if (typeof options.shot_id !== 'string' || !options.shot_id) throw new Error('invalid shot_id'); where.push('shot_id = ?'); params.push(options.shot_id); }
    return this.db.prepare(`SELECT * FROM shot_analysis_runs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset).map(row => this.#decode(row));
  }

  /** Apply only explicitly selected candidate fields if their baselines and bounds remain unchanged. */
  applyFields(runId, fields) {
    if (!Array.isArray(fields) || fields.length === 0 || fields.some(f => typeof f !== 'string' || !FIELD_SET.has(f)) || new Set(fields).size !== fields.length) {
      throw new Error('fields must be a non-empty array of unique supported field names');
    }
    return this.#transaction(() => {
      const run = this.getRun(runId);
      if (!run) throw new Error('analysis run not found');
      if (this.isVideoBusy?.(run.video_id)) throw new Error('video analysis is running');
      if (run.status !== 'completed' || !run.candidate) throw new Error('analysis run is not available for application');
      for (const field of fields) if (!Object.hasOwn(run.candidate, field)) throw new Error(`candidate is missing field: ${field}`);
      const row = this.db.prepare('SELECT * FROM video_shots WHERE id = ? AND video_id = ?').get(run.shot_id, run.video_id);
      if (!row) throw new Error('shot not found');
      if (row.start_time !== run.start_time || row.end_time !== run.end_time) throw new Error('shot boundaries changed since analysis');
      const current = shotSnapshot(row);
      for (const field of fields) {
        if (JSON.stringify(current[field]) !== JSON.stringify(run.shot_snapshot[field])) throw new Error(`shot field changed since analysis: ${field}`);
      }
      const params = fields.map(field => field === 'tags' ? JSON.stringify(run.candidate[field]) : run.candidate[field]);
      this.db.prepare(`UPDATE video_shots SET ${fields.map(field => `${field} = ?`).join(', ')} WHERE id = ? AND video_id = ?`)
        .run(...params, run.shot_id, run.video_id);
      const updated = this.db.prepare('SELECT * FROM video_shots WHERE id = ? AND video_id = ?').get(run.shot_id, run.video_id);
      const ftsExists = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='video_shots_fts'").get();
      if (ftsExists) {
        this.db.prepare('DELETE FROM video_shots_fts WHERE shot_id = ?').run(run.shot_id);
        this.db.prepare(`INSERT INTO video_shots_fts (shot_id, video_id, subject, visual_description, shot_type, camera_movement, tags)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(updated.id, updated.video_id, updated.subject || '', updated.visual_description || '', updated.shot_type || '', updated.camera_movement || '', updated.tags || '[]');
      }
      this.db.prepare(`UPDATE shot_analysis_runs SET status = 'applied', applied_fields = ?, applied_at = ? WHERE id = ?`)
        .run(JSON.stringify(fields), new Date().toISOString(), runId);
      return { run: this.getRun(runId), shot: shotSnapshot(updated), applied_fields: [...fields] };
    });
  }
}
