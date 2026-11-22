import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { VideoDatabase } from '../src/host/db/database.js';
import { ProjectExporter } from '../src/host/export/project-exporter.js';

const pythonReady = spawnSync('python', ['-c', 'import py_premiere'], { stdio: 'ignore' }).status === 0;
const ffmpegReady = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

test('native .prproj export writes a gzip project with a real timeline', { skip: !pythonReady || !ffmpegReady }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'media-center-prproj-'));
  const videoPath = path.join(root, 'clip.mp4');
  const musicPath = path.join(root, 'music.wav');
  assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-y', videoPath], { stdio: 'ignore' }).status, 0);
  assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'pcm_s16le', '-y', musicPath], { stdio: 'ignore' }).status, 0);
  const db = new VideoDatabase({ workspaceRoot: root });
  t.after(() => { db.db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const video = db.upsertVideo({ file_path: videoPath, file_name: 'clip.mp4', status: 'analyzed', duration: 2, width: 320, height: 180, fps: 25, audio_channels: 2 });
  db.db.exec(`CREATE TABLE IF NOT EXISTS local_music_catalog (id TEXT PRIMARY KEY,file_path TEXT NOT NULL,file_name TEXT NOT NULL,file_size INTEGER NOT NULL,title TEXT NOT NULL,artist TEXT NOT NULL DEFAULT '',duration REAL,codec TEXT NOT NULL DEFAULT '',sample_rate INTEGER,channels INTEGER,metadata_source TEXT NOT NULL,metadata_detail TEXT NOT NULL DEFAULT '{}',source_name TEXT NOT NULL DEFAULT '',source_url TEXT NOT NULL DEFAULT '',license_status TEXT NOT NULL,license_note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)`);
  db.db.prepare('INSERT INTO local_music_catalog (id,file_path,file_name,file_size,title,artist,duration,codec,sample_rate,channels,metadata_source,metadata_detail,source_name,source_url,license_status,license_note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('mus_prproj', musicPath, 'music.wav', 1, 'Music', '', 2, 'pcm_s16le', 48000, 2, 'filename', '{}', '', '', 'unknown', '', new Date().toISOString());
  const project = {
    schema_version: 1, title: 'PR 原生导出测试', rationale: 'test',
    fps: { num: 25, den: 1 }, canvas: { width: 320, height: 180, aspect: '16:9' }, duration_frames: 50,
    tracks: {
      video: [{ id: 'v1', source: { id: video.id, duration_seconds: 2 }, source_in_seconds: 0.2, source_out_seconds: 1.8, timeline_start_frame: 0, timeline_end_frame: 40 }],
      music: [{ id: 'm1', source: { id: 'mus_prproj', duration_seconds: 2 }, source_in_seconds: 0, source_out_seconds: 1.6, timeline_start_frame: 0, timeline_end_frame: 40, rights: { status: 'unknown' } }]
    }
  };
  const destination = path.join(root, 'out');
  const result = await new ProjectExporter(db).exportPRProj(project, { destinationDir: destination });
  assert.equal(result.format, 'prproj');
  assert.equal(fs.existsSync(result.file_path), true);
  const bytes = fs.readFileSync(result.file_path);
  assert.deepEqual([...bytes.subarray(0, 3)], [0x1f, 0x8b, 0x08]);
  assert.ok(bytes.length > 1000);
});
