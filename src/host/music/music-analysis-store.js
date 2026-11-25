import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MAX_MUSIC_ANALYSIS_SECONDS } from './music-analysis-v2.js';

const MUSIC_ID = /^mus_[0-9a-f]{32}$/;
const ANALYSIS_ID = /^ma_[0-9a-f]{32}$/;
const STAT_KEYS = ['dev', 'ino', 'size', 'ctimeMs', 'mtimeMs', 'mtimeNs'];
const STAT_KEY_SET = new Set(STAT_KEYS);
const STAT_PATH_RE = /(?:^|[\s"'`])(?:[a-z]:[\\/]|\\\\|\/(?:Users|home|mnt|media|tmp|private|var|Volumes|root)\/)/i;
const STATUSES = new Set(['ok', 'low_confidence', 'silence', 'no_audio', 'error']);
const MAX_ARRAY = 20000;
const MAX_JSON_BYTES = 4 * 1024 * 1024;

function assertId(value, pattern, label) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`Invalid ${label}`);
}
function boundedText(value, label, max, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || value.length > max || value.includes('\0') || (!allowEmpty && !value.trim())) throw new Error(`Invalid ${label}`);
  const text = value.trim();
  if (STAT_PATH_RE.test(text)) throw new Error(`${label} must not contain an absolute path`);
  return text;
}
function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function number(value, label, min, max, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${label}`);
  return value;
}
function numericIdentityValue(value, key) {
  const allowNegative = key !== 'size';
  const integer = !['mtimeMs', 'ctimeMs'].includes(key);
  if (typeof value === 'number' && Number.isFinite(value) && (allowNegative || value >= 0)) {
    if (integer && !Number.isSafeInteger(value)) throw new Error('Invalid source identity');
    return String(value);
  }
  const pattern = new RegExp(`^${allowNegative ? '-?' : ''}\\d+${integer ? '' : '(?:\\.\\d+)?'}$`);
  if (typeof value === 'string' && value.length <= 80 && pattern.test(value)) return value;
  throw new Error('Invalid source identity');
}
function normalizeSourceIdentity(identity) {
  if (!plainObject(identity)) throw new Error('sourceIdentity must be an object of filesystem fingerprint attributes');
  const keys = Object.keys(identity);
  if (keys.some(key => !STAT_KEY_SET.has(key))) throw new Error('sourceIdentity may contain fingerprint attributes only; paths are not allowed');
  for (const key of ['dev', 'ino', 'size']) if (!Object.hasOwn(identity, key)) throw new Error(`sourceIdentity is missing ${key}`);
  if (!Object.hasOwn(identity, 'mtimeMs') && !Object.hasOwn(identity, 'mtimeNs') && !Object.hasOwn(identity, 'ctimeMs')) throw new Error('sourceIdentity requires a modification or change time');
  const normalized = {};
  for (const key of STAT_KEYS) if (Object.hasOwn(identity, key)) normalized[key] = numericIdentityValue(identity[key], key);
  return normalized;
}
function normalizeTimeArray(value, label, window, { max = MAX_ARRAY, allowEmpty = true } = {}) {
  if (!Array.isArray(value) || value.length > max || (!allowEmpty && !value.length)) throw new Error(`Invalid ${label}`);
  const start = window.start_seconds, end = start + window.duration_seconds;
  let previous = -Infinity;
  return value.map(item => {
    const point = number(item, label, 0, 86400);
    if (point <= previous || point < start - 1e-6 || point > end + 1e-6) throw new Error(`${label} must be increasing and inside the analysis window`);
    previous = point;
    return point;
  });
}
function normalizeSections(value, window) {
  if (!Array.isArray(value) || value.length > 8) throw new Error('Invalid sections');
  const start = window.start_seconds, end = start + window.duration_seconds;
  let previous = start - 1e-6;
  return value.map((section, index) => {
    if (!plainObject(section)) throw new Error('Invalid section');
    const sectionStart = Math.max(start, Math.min(end, number(section.start, 'section start', 0, 86400)));
    const sectionEnd = Math.max(sectionStart + 0.001, Math.min(end, number(section.end, 'section end', 0, 86400)));
    if (sectionStart < previous - 1e-6 || sectionEnd <= sectionStart || sectionEnd > end + 1e-6) throw new Error('Invalid section bounds');
    previous = sectionEnd;
    return {
      id: boundedText(section.id ?? `sec_${index + 1}`, 'section id', 40),
      start: sectionStart,
      end: sectionEnd,
      label: boundedText(section.label ?? '稳定中速', 'section label', 40),
      energy: ['low', 'medium', 'high'].includes(section.energy) ? section.energy : 'medium',
      onset_density: number(section.onset_density ?? 0, 'section onset density', 0, 10000),
      bpm: number(section.bpm, 'section bpm', 1, 400, { nullable: true }),
      confidence: number(section.confidence ?? 0.5, 'section confidence', 0, 1)
    };
  });
}
function normalizeTempo(value) {
  if (!Array.isArray(value) || value.length > 6) throw new Error('Invalid tempo candidates');
  return value.map(item => {
    if (!plainObject(item)) throw new Error('Invalid tempo candidate');
    return { bpm: number(item.bpm, 'tempo bpm', 1, 400), confidence: number(item.confidence ?? 0, 'tempo confidence', 0, 1) };
  });
}
function normalizeCutCandidates(value, window) {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('Invalid cut candidates');
  const end = window.start_seconds + window.duration_seconds;
  return value.map(item => {
    if (!plainObject(item)) throw new Error('Invalid cut candidate');
    const time = number(item.time, 'cut time', 0, 86400);
    if (time < window.start_seconds - 1e-6 || time > end + 1e-6) throw new Error('Cut candidate outside window');
    return {
      time,
      type: ['downbeat', 'beat', 'onset', 'section_boundary'].includes(item.type) ? item.type : 'beat',
      score: number(item.score ?? 0.5, 'cut score', 0, 1),
      section_id: item.section_id == null ? null : boundedText(item.section_id, 'cut section id', 40)
    };
  });
}
function normalizeBeatPayload(value, window) {
  if (!plainObject(value)) throw new Error('Invalid beats');
  const times = normalizeTimeArray(value.times ?? [], 'beat times', window, { max: MAX_ARRAY });
  const strengths = Array.isArray(value.strengths) ? value.strengths : [];
  if (strengths.length !== times.length) throw new Error('Beat strengths must match beat times');
  const quarterTimes = normalizeTimeArray(value.quarter_times ?? [], 'quarter beat times', window, { max: MAX_ARRAY });
  const quarterStrengths = Array.isArray(value.quarter_strengths) ? value.quarter_strengths : [];
  if (quarterStrengths.length !== quarterTimes.length) throw new Error('Quarter strengths must match quarter times');
  return {
    subdivision: 4,
    times, strengths: strengths.map(item => number(item, 'beat strength', 0, 1)),
    quarter_times: quarterTimes, quarter_strengths: quarterStrengths.map(item => number(item, 'quarter strength', 0, 1)),
    downbeats: normalizeTimeArray(value.downbeats ?? [], 'downbeats', window, { max: 2000 })
  };
}
function normalizeFeatureMeta(value) {
  if (!plainObject(value)) throw new Error('Invalid feature metadata');
  return {
    fps: number(value.fps, 'feature fps', 1, 120),
    bands: number(value.bands, 'feature bands', 4, 256),
    columns: number(value.columns, 'feature columns', 1, 30000),
    waveform_buckets: number(value.waveform_buckets, 'waveform buckets', 1, 10000)
  };
}
function parseJson(text, fallback) {
  try { return text ? JSON.parse(text) : fallback; } catch { return fallback; }
}
function decodeRow(row) {
  if (!row) return null;
  return {
    analysis_id: row.analysis_id,
    music_id: row.music_id,
    source_identity: parseJson(row.source_identity_json, {}),
    analysis_version: row.analysis_version,
    method: row.method,
    analysis_window: { start_seconds: row.window_start_seconds, duration_seconds: row.window_duration_seconds },
    status: row.status,
    bpm: row.bpm,
    bpm_confidence: row.bpm_confidence,
    tempo_candidates: parseJson(row.tempo_candidates_json, []),
    meter: parseJson(row.meter_json, { beats_per_bar: 4, confidence: 0, first_downbeat: null }),
    beats: {
      subdivision: 4,
      times: parseJson(row.beat_times_json, []),
      strengths: parseJson(row.beat_strengths_json, []),
      quarter_times: parseJson(row.quarter_times_json, []),
      quarter_strengths: parseJson(row.quarter_strengths_json, []),
      downbeats: parseJson(row.downbeats_json, [])
    },
    sections: parseJson(row.sections_json, []),
    cut_candidates: parseJson(row.cut_candidates_json, []),
    feature_meta: parseJson(row.feature_meta_json, null),
    created_at: row.created_at
  };
}

/** Deterministic music analysis metadata and drawable features. Source media is never modified. */
export class MusicAnalysisStore {
  constructor(videoDb) {
    if (!videoDb?.db) throw new Error('An open VideoDatabase is required');
    this.db = videoDb.db;
    this.cacheDir = videoDb.cacheDir;
    this.featuresDir = path.join(this.cacheDir, 'music-features');
    fs.mkdirSync(this.featuresDir, { recursive: true });
    this.migrate();
    this.tableSql();
  }

  migrate() {
    const version = this.db.prepare('SELECT value FROM settings WHERE key=?').get('music_analysis_engine')?.value;
    if (version === '2') return;
    this.db.exec('DROP TABLE IF EXISTS music_analysis_profiles');
    this.db.exec('DROP TABLE IF EXISTS music_analysis_v2');
    try { fs.rmSync(path.join(this.cacheDir, 'music-spectrograms'), { recursive: true, force: true }); } catch {}
    this.db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('music_analysis_engine', '2');
  }

  tableSql() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS music_analysis_v2 (
      analysis_id TEXT PRIMARY KEY,
      music_id TEXT NOT NULL,
      source_identity_json TEXT NOT NULL,
      analysis_version TEXT NOT NULL,
      method TEXT NOT NULL,
      window_start_seconds REAL NOT NULL,
      window_duration_seconds REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('ok','low_confidence','silence','no_audio','error')),
      bpm REAL,
      bpm_confidence REAL,
      tempo_candidates_json TEXT NOT NULL,
      meter_json TEXT NOT NULL,
      beat_times_json TEXT NOT NULL,
      beat_strengths_json TEXT NOT NULL,
      quarter_times_json TEXT NOT NULL,
      quarter_strengths_json TEXT NOT NULL,
      downbeats_json TEXT NOT NULL,
      sections_json TEXT NOT NULL,
      cut_candidates_json TEXT NOT NULL,
      feature_meta_json TEXT,
      feature_file TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_music_analysis_v2_latest ON music_analysis_v2(music_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_music_analysis_v2_identity ON music_analysis_v2(music_id, source_identity_json, created_at DESC);`);
  }

  save(musicId, sourceIdentity, analysis) {
    this.tableSql();
    assertId(musicId, MUSIC_ID, 'music ID');
    const identity = normalizeSourceIdentity(sourceIdentity);
    if (!plainObject(analysis)) throw new Error('analysis must be an object');
    const status = analysis.status;
    if (!STATUSES.has(status)) throw new Error('Unsupported analysis status');
    if (!plainObject(analysis.analysis_window)) throw new Error('analysis_window is required');
    const window = {
      start_seconds: number(analysis.analysis_window.start_seconds, 'analysis window start', 0, 86400),
      duration_seconds: number(analysis.analysis_window.duration_seconds, 'analysis window duration', 0.001, MAX_MUSIC_ANALYSIS_SECONDS)
    };
    const analysisId = `ma_${crypto.randomUUID().replace(/-/g, '')}`;
    const beats = normalizeBeatPayload(analysis.beats ?? {}, window);
    const sections = normalizeSections(analysis.sections ?? [], window);
    const cuts = normalizeCutCandidates(analysis.cut_candidates ?? [], window);
    const featureMeta = analysis.features ? normalizeFeatureMeta({
      fps: analysis.features.fps, bands: analysis.features.bands, columns: analysis.features.columns,
      waveform_buckets: analysis.waveform?.buckets ?? 0
    }) : null;
    let featureFile = null;
    if (featureMeta && Buffer.isBuffer(analysis.features.data)) {
      const expected = featureMeta.columns * featureMeta.bands + featureMeta.waveform_buckets * 2;
      const payload = Buffer.concat([analysis.features.data, Buffer.from(analysis.waveform?.data || [])]);
      if (payload.length !== expected) throw new Error('Feature payload size does not match metadata');
      featureFile = `${analysisId}.bin`;
      fs.writeFileSync(path.join(this.featuresDir, featureFile), payload);
    }
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO music_analysis_v2
      (analysis_id,music_id,source_identity_json,analysis_version,method,window_start_seconds,window_duration_seconds,status,bpm,bpm_confidence,
       tempo_candidates_json,meter_json,beat_times_json,beat_strengths_json,quarter_times_json,quarter_strengths_json,downbeats_json,sections_json,cut_candidates_json,
       feature_meta_json,feature_file,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      analysisId, musicId, JSON.stringify(identity), boundedText(analysis.analysis_version ?? '2', 'analysis version', 40),
      boundedText(analysis.method ?? 'spectral-flux-autocorr-v2', 'analysis method', 120),
      window.start_seconds, window.duration_seconds, status, number(analysis.bpm, 'bpm', 1, 400, { nullable: true }),
      number(analysis.bpm_confidence, 'bpm confidence', 0, 1, { nullable: true }),
      JSON.stringify(normalizeTempo(analysis.tempo_candidates ?? [])),
      JSON.stringify({
        beats_per_bar: analysis.meter?.beats_per_bar === 3 ? 3 : 4,
        confidence: number(analysis.meter?.confidence ?? 0, 'meter confidence', 0, 1),
        first_downbeat: number(analysis.meter?.first_downbeat, 'first downbeat', 0, 86400, { nullable: true })
      }),
      JSON.stringify(beats.times), JSON.stringify(beats.strengths),
      JSON.stringify(beats.quarter_times), JSON.stringify(beats.quarter_strengths), JSON.stringify(beats.downbeats),
      JSON.stringify(sections), JSON.stringify(cuts),
      featureMeta ? JSON.stringify(featureMeta) : null, featureFile, now
    );
    return this.get(analysisId);
  }

  latest(musicId, sourceIdentity) {
    assertId(musicId, MUSIC_ID, 'music ID');
    const identity = normalizeSourceIdentity(sourceIdentity), identityJson = JSON.stringify(identity);
    const matching = this.db.prepare('SELECT * FROM music_analysis_v2 WHERE music_id=? AND source_identity_json=? ORDER BY created_at DESC LIMIT 1').get(musicId, identityJson);
    if (matching) return decodeRow(matching);
    const newest = this.db.prepare('SELECT analysis_id,analysis_version,method,created_at FROM music_analysis_v2 WHERE music_id=? ORDER BY created_at DESC LIMIT 1').get(musicId);
    return newest ? { status: 'stale', analysis_id: newest.analysis_id, analysis_version: newest.analysis_version, method: newest.method, created_at: newest.created_at } : null;
  }

  get(analysisId) {
    assertId(analysisId, ANALYSIS_ID, 'analysis ID');
    return decodeRow(this.db.prepare('SELECT * FROM music_analysis_v2 WHERE analysis_id=?').get(analysisId));
  }

  featurePath(analysisId) {
    const row = this.db.prepare('SELECT feature_file FROM music_analysis_v2 WHERE analysis_id=?').get(analysisId);
    if (!row?.feature_file) return null;
    const resolved = path.resolve(this.featuresDir, row.feature_file);
    if (path.dirname(resolved) !== path.resolve(this.featuresDir)) throw new Error('Invalid feature path');
    return fs.existsSync(resolved) ? resolved : null;
  }

  getFeatures(analysisId) {
    const profile = this.get(analysisId);
    if (!profile?.feature_meta) return null;
    const filePath = this.featurePath(analysisId);
    if (!filePath) return null;
    const payload = fs.readFileSync(filePath);
    const featureBytes = profile.feature_meta.columns * profile.feature_meta.bands;
    return {
      data: payload.subarray(0, featureBytes),
      waveform: payload.subarray(featureBytes),
      meta: profile.feature_meta
    };
  }

  removeForMusic(musicId) {
    assertId(musicId, MUSIC_ID, 'music ID');
    const rows = this.db.prepare('SELECT feature_file FROM music_analysis_v2 WHERE music_id=?').all(musicId);
    for (const row of rows) {
      if (!row.feature_file) continue;
      try { fs.rmSync(path.join(this.featuresDir, row.feature_file), { force: true }); } catch {}
    }
    return this.db.prepare('DELETE FROM music_analysis_v2 WHERE music_id=?').run(musicId).changes;
  }

  analysisSummary(analysisId) {
    const profile = this.get(analysisId);
    if (!profile) return null;
    return {
      analysis_id: profile.analysis_id,
      music_id: profile.music_id,
      analysis_version: profile.analysis_version,
      method: profile.method,
      analysis_window: profile.analysis_window,
      status: profile.status,
      bpm: profile.bpm,
      bpm_confidence: profile.bpm_confidence,
      tempo_candidates: profile.tempo_candidates,
      meter: profile.meter,
      section_count: profile.sections.length,
      sections: profile.sections,
      beat_count: profile.beats.times.length,
      quarter_beat_count: profile.beats.quarter_times.length,
      downbeat_count: profile.beats.downbeats.length,
      cut_candidate_count: profile.cut_candidates.length,
      cut_candidates: profile.cut_candidates.slice(0, 20),
      feature_meta: profile.feature_meta,
      created_at: profile.created_at
    };
  }
}
