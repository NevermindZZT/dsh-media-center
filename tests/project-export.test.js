import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VideoDatabase } from '../src/host/db/database.js';
import { ProjectExporter } from '../src/host/export/project-exporter.js';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'media-center-export-'));
  const db = new VideoDatabase({ workspaceRoot: root });
  const videoFile = path.join(root, 'source.mp4');
  const musicFile = path.join(root, 'music.wav');
  fs.writeFileSync(videoFile, 'source');
  fs.writeFileSync(musicFile, 'music');
  const video = db.upsertVideo({ file_path: videoFile, file_name: 'source.mp4', status: 'analyzed', duration: 19, width: 3840, height: 2160, audio_channels: 2, codec: 'HEVC' });
  db.db.exec(`CREATE TABLE IF NOT EXISTS local_music_catalog (
    id TEXT PRIMARY KEY, file_path TEXT NOT NULL, file_name TEXT NOT NULL, file_size INTEGER NOT NULL,
    title TEXT NOT NULL, artist TEXT NOT NULL DEFAULT '', duration REAL, codec TEXT NOT NULL DEFAULT '',
    sample_rate INTEGER, channels INTEGER, metadata_source TEXT NOT NULL, metadata_detail TEXT NOT NULL DEFAULT '{}',
    source_name TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '', license_status TEXT NOT NULL,
    license_note TEXT NOT NULL DEFAULT '', source_status TEXT NOT NULL DEFAULT 'current', created_at TEXT NOT NULL
  )`);  db.db.prepare(`INSERT INTO local_music_catalog (id,file_path,file_name,file_size,title,artist,duration,codec,sample_rate,channels,metadata_source,metadata_detail,source_name,source_url,license_status,license_note,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('mus_export', musicFile, 'music.wav', 5, 'Music', '', 30, 'pcm_s16le', 48000, 2, 'filename', '{}', '', '', 'unknown', '', new Date().toISOString());
  const project = {
    schema_version: 1, title: '测试项目', rationale: '测试导出',
    fps: { num: 30000, den: 1001 }, canvas: { width: 1920, height: 1080, aspect: '16:9' }, duration_frames: 150,
    tracks: {
      video: [{ id: 'v1', source: { id: video.id, duration_seconds: 19 }, source_in_seconds: 1, source_out_seconds: 6, timeline_start_frame: 0, timeline_end_frame: 150 }],
      music: [{ id: 'm1', source: { id: 'mus_export', duration_seconds: 30 }, source_in_seconds: 0, source_out_seconds: 5, timeline_start_frame: 0, timeline_end_frame: 150, rights: { status: 'unknown' } }]
    }
  };
  t.after(() => { db.db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { db, exporter: new ProjectExporter(db), project, videoFile, musicFile };
}

test('project export resolves catalog sources and writes FCPXML with audio', t => {
  const f = fixture(t);
  const result = f.exporter.exportProject(f.project, { format: 'fcpxml' });
  const xml = fs.readFileSync(result.file_path, 'utf8');
  assert.match(xml, /<fcpxml version="1.9">/);
  assert.match(xml, /<media-rep kind="original-media" src="file:\/\/\//);
  assert.match(xml, /<audio ref="r\d+"/);
  assert.match(xml, /<video ref="r\d+"/);
  assert.match(xml, /测试项目/);
  assert.equal(result.file_name.endsWith('.fcpxml'), true);
});

test('project export writes Premiere XML with video and audio tracks', t => {
  const f = fixture(t);
  const result = f.exporter.exportProject(f.project, { format: 'premiere_xml' });
  const xml = fs.readFileSync(result.file_path, 'utf8');
  assert.match(xml, /<xmeml version="4">/);
  assert.match(xml, /<sequence id="sequence-1">/);
  assert.match(xml, /<clipitem id="clipitem-v-v1">/);
  assert.match(xml, /<clipitem id="clipitem-a-m1">/);
  assert.match(xml, /<pathurl>file:\/\/localhost\//);
  assert.equal(result.file_name.endsWith('.xml'), true);
});

test('project export rejects missing media without writing a document', t => {
  const f = fixture(t);
  f.db.db.prepare('DELETE FROM local_music_catalog WHERE id = ?').run('mus_export');
  assert.throws(() => f.exporter.exportProject(f.project, { format: 'fcpxml' }), /音乐素材不可用/);
});
