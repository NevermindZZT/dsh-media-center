import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { VideoDatabase } from '../src/host/db/database.js';

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-video-source-safety-'));
  const db = new VideoDatabase({ workspaceRoot: root });
  t.after(() => db.db.close());
  const source = path.join(root, 'original.mp4');
  const contents = Buffer.from('irreplaceable source video bytes\0\x01', 'utf8');
  fs.writeFileSync(source, contents);
  const video = db.upsertVideo({ file_name: 'original.mp4', file_path: source, storyboard_path: source });
  const cache = path.join(db.keyframesDir, 'generated.jpg');
  fs.writeFileSync(cache, 'cached bytes');
  db.upsertShots(video.id, [
    { start_time: 0, end_time: 1, keyframe_path: source, subject: 'test' },
    { start_time: 1, end_time: 2, keyframe_path: cache }
  ]);
  db.upsertVideoAudio(video.id, { bgm_mood: 'test' });
  return { db, source, contents, cache, video };
}

function check(t, remove) {
  const { db, source, contents, cache, video } = setup(t);
  const hash = crypto.createHash('sha256').update(contents).digest('hex');
  assert.equal(remove(db, video.id), true);
  assert.deepEqual(fs.readFileSync(source), contents);
  assert.equal(fs.readFileSync(cache, 'utf8'), 'cached bytes');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), hash);
  assert.equal(db.getVideoById(video.id), null);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM video_shots WHERE video_id = ?').get(video.id).n, 0);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM video_audio WHERE video_id = ?').get(video.id).n, 0);
  const ftsExists = db.db.prepare("SELECT name FROM sqlite_master WHERE name = 'video_shots_fts'").get();
  if (ftsExists) assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM video_shots_fts WHERE video_id = ?').get(video.id).n, 0);
}

test('single removal never deletes a source referenced by both cached paths', t => {
  check(t, (db, id) => db.deleteVideo(id));
});

test('batch removal never deletes a source referenced by both cached paths', t => {
  check(t, (db, id) => db.batchDeleteVideos([id]) === 1);
});
