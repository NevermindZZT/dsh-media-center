import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VideoDatabase } from '../src/host/db/database.js';
import { MusicAnalysisStore } from '../src/host/music/music-analysis-store.js';

const MUSIC = 'mus_0123456789abcdef0123456789abcdef';
const identity = { dev: '1', ino: '2', size: '3', mtimeNs: '4' };

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'music-v2-store-'));
  const db = new VideoDatabase({ workspaceRoot: root });
  t.after(() => { db.db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, db, store: new MusicAnalysisStore(db) };
}

function analysis(overrides = {}) {
  return {
    analysis_version: '2', method: 'spectral-flux-autocorr-v2', status: 'ok',
    analysis_window: { start_seconds: 0, duration_seconds: 10 },
    bpm: 120, bpm_confidence: 0.8, tempo_candidates: [{ bpm: 120, confidence: 0.8 }],
    meter: { beats_per_bar: 4, confidence: 0.7, first_downbeat: 0.1 },
    beats: {
      subdivision: 4, times: [0.1, 0.6], strengths: [1, 0.5],
      quarter_times: [0.1, 0.225, 0.35, 0.475], quarter_strengths: [1, 0.5, 0.4, 0.3],
      downbeats: [0.1]
    },
    sections: [{ id: 'sec_1', start: 0, end: 10, label: '稳定中速', energy: 'medium', onset_density: 2, bpm: 120, confidence: 0.8 }],
    cut_candidates: [{ time: 0.1, type: 'downbeat', score: 0.9, section_id: 'sec_1' }],
    features: { data: Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]), fps: 20, bands: 4, columns: 2 },
    waveform: { data: new Int8Array([0, 1, 2, 3]), buckets: 2 },
    ...overrides
  };
}

test('v2 store saves sections, quarter beats and a drawable feature payload', t => {
  const f = fixture(t);
  const saved = f.store.save(MUSIC, identity, analysis());
  assert.equal(saved.bpm, 120);
  assert.equal(saved.beats.quarter_times.length, 4);
  assert.equal(saved.sections[0].label, '稳定中速');
  const summary = f.store.analysisSummary(saved.analysis_id);
  assert.equal(summary.section_count, 1);
  assert.equal(summary.quarter_beat_count, 4);
  const features = f.store.getFeatures(saved.analysis_id);
  assert.equal(features.data.length, 8);
  assert.equal(features.waveform.length, 4);
  assert.equal(features.meta.columns, 2);
  assert.equal(f.store.latest(MUSIC, identity).analysis_id, saved.analysis_id);
  assert.equal(f.store.latest(MUSIC, { ...identity, size: '99' }).status, 'stale');
});

test('v2 store clamps rounded section ends to the analysis window', t => {
  const f = fixture(t);
  const saved = f.store.save(MUSIC, identity, analysis({ sections: [{ id: 'sec_1', start: 0, end: 10.001, label: '稳定中速', energy: 'medium', onset_density: 2, bpm: 120, confidence: 0.8 }] }));
  assert.equal(saved.sections[0].end, 10);
});

test('v2 store drops legacy analysis tables and removes feature files with the music', t => {
  const f = fixture(t);
  f.db.db.exec(`CREATE TABLE IF NOT EXISTS music_analysis_profiles (analysis_id TEXT PRIMARY KEY)`);
  f.db.db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('music_analysis_engine', '1');
  const migrated = new MusicAnalysisStore(f.db);
  const tables = new Set(f.db.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
  assert.equal(tables.has('music_analysis_profiles'), false);
  const saved = migrated.save(MUSIC, identity, analysis());
  const file = migrated.featurePath(saved.analysis_id);
  assert.ok(file && fs.existsSync(file));
  migrated.removeForMusic(MUSIC);
  assert.equal(fs.existsSync(file), false);
  assert.equal(migrated.get(saved.analysis_id), null);
});
