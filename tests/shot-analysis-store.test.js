import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VideoDatabase } from '../src/host/db/database.js';
import { ShotAnalysisStore } from '../src/host/db/shot-analysis-store.js';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-shot-analysis-'));
  const db = new VideoDatabase({ workspaceRoot: root });
  t.after(() => { db.db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const video = db.upsertVideo({ file_path: path.join(root, 'source.mp4'), file_name: 'source.mp4', duration: 30 });
  const source = video.file_path;
  fs.writeFileSync(source, 'precious original');
  const [shotId] = db.upsertShots(video.id, [{ start_time: 2, end_time: 8, subject: 'old subject', visual_description: 'old text', composition: 'old composition', shot_type: '中景', camera_movement: '固定', quality_score: 3, tags: ['old'] }]);
  const store = new ShotAnalysisStore(db);
  const create = (options = {}) => store.createRun({video_id: video.id, shot_id: shotId, start_time: 2, end_time: 8, ...options});
  return {root, db, source, video, shotId, store, create};
}

const candidate = {subject: 'new subject', visual_description: 'new text', composition: 'new composition', shot_type:'远景', camera_movement:'推镜头', quality_score:4.5, tags:['new','scene']};

test('create, finish, preview and list snapshots without modifying shot or source', t => {
  const f = fixture(t);
  const run = f.create({sample_times:[2.1,3,7.9], storyboard_path:'cache-only-reference.jpg', prompt:'detail', provider:'p', model:'m', reasoning_effort:'medium'});
  assert.equal(run.status, 'running');
  assert.equal(run.shot_snapshot.visual_description, 'old text');
  assert.deepEqual(run.shot_snapshot.tags, ['old']);
  assert.equal(run.start_time, 2); assert.equal(run.end_time, 8);
  const completed = f.store.finishRun(run.id, {candidate, audit:{input_tokens:7, output_tokens:4, total_tokens:null}});
  assert.equal(completed.status, 'completed'); assert.deepEqual(completed.candidate, candidate);
  assert.deepEqual(completed.sample_times, [2.1,3,7.9]);
  assert.equal(completed.audit.total_tokens, null);
  assert.equal(f.db.getVideoShots(f.video.id)[0].visual_description, 'old text');
  assert.equal(fs.readFileSync(f.source, 'utf8'), 'precious original');
  assert.equal(f.store.listRuns({video_id:f.video.id,shot_id:f.shotId})[0].id, run.id);
  assert.equal(f.store.getRun('absent'), null);
});

test('apply selected fields atomically and update FTS while retaining the original preview', t => {
  const f=fixture(t), run=f.create();
  f.store.finishRun(run.id, {candidate, audit:{model:'test',latency_ms:100}});
  const result=f.store.applyFields(run.id,['visual_description','tags']);
  assert.equal(result.shot.visual_description,'new text');
  assert.deepEqual(result.shot.tags,['new','scene']);
  assert.equal(result.shot.subject,'old subject');
  assert.equal(result.run.status,'applied');
  assert.equal(result.run.shot_snapshot.visual_description,'old text');
  assert.deepEqual(result.run.applied_fields,['visual_description','tags']);
  const fts=f.db.db.prepare('SELECT * FROM video_shots_fts WHERE shot_id = ?').get(f.shotId);
  assert.equal(fts.visual_description,'new text'); assert.equal(fts.subject,'old subject');
  assert.deepEqual(JSON.parse(fts.tags),['new','scene']);
  assert.throws(()=>f.store.applyFields(run.id,['subject']),/not available/);
  assert.equal(fs.readFileSync(f.source,'utf8'),'precious original');
});

test('boundaries or selected-field changes block apply; unrelated field changes survive', t => {
  const f=fixture(t), first=f.create();
  f.store.finishRun(first.id,{candidate});
  f.db.db.prepare('UPDATE video_shots SET subject = ? WHERE id = ?').run('manual subject',f.shotId);
  assert.throws(()=>f.store.applyFields(first.id,['subject','visual_description']),/field changed.*subject/);
  assert.equal(f.db.getVideoShots(f.video.id)[0].visual_description,'old text');
  assert.equal(f.store.getRun(first.id).status,'completed');
  const applied=f.store.applyFields(first.id,['visual_description']);
  assert.equal(applied.shot.subject,'manual subject');
  const second=f.create(); f.store.finishRun(second.id,{candidate});
  f.db.db.prepare('UPDATE video_shots SET end_time = 9 WHERE id = ?').run(f.shotId);
  assert.throws(()=>f.store.applyFields(second.id,['tags']),/boundaries changed/);
  assert.deepEqual(f.db.getVideoShots(f.video.id)[0].tags,['old']);
});

test('FTS failure rolls back shot, FTS, and run state', t => {
  const f=fixture(t), run=f.create(); f.store.finishRun(run.id,{candidate});
  f.db.db.exec("CREATE TRIGGER fail_shot_run_apply BEFORE UPDATE OF status ON shot_analysis_runs WHEN NEW.status = 'applied' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
  assert.throws(()=>f.store.applyFields(run.id,['subject','tags']),/injected failure/);
  assert.equal(f.db.getVideoShots(f.video.id)[0].subject,'old subject');
  assert.deepEqual(f.db.getVideoShots(f.video.id)[0].tags,['old']);
  assert.equal(f.db.db.prepare('SELECT subject FROM video_shots_fts WHERE shot_id = ?').get(f.shotId).subject,'old subject');
  assert.equal(f.store.getRun(run.id).status,'completed');
});

test('run lifecycle and candidate validation reject invalid writes', t => {
  const f=fixture(t);
  assert.throws(()=>f.create({start_time:1}),/boundaries changed/);
  assert.throws(()=>f.create({start_time:8,end_time:8}),/invalid shot boundaries/);
  assert.throws(()=>f.create({sample_times:[2,9]}),/sample_times/);
  assert.throws(()=>f.create({shot_id:'not-found'}),/not found/);
  const run=f.create();
  for (const input of [{candidate:{}},{candidate:{file_path:'source.mp4'}},{candidate:{tags:'bad'}},{candidate:{quality_score:Infinity}},{candidate:{subject:null}},{candidate,audit:{value:NaN}},{candidate,sample_times:[5,3]}]) {
    assert.throws(()=>f.store.finishRun(run.id,input));
    assert.equal(f.store.getRun(run.id).status,'running');
  }
  const failed=f.store.failRun(run.id,{error_code:'TEST',error_message:'safe message',audit:{total_tokens:null}});
  assert.equal(failed.status,'failed'); assert.equal(failed.error_code,'TEST');
  assert.throws(()=>f.store.finishRun(run.id,{candidate}),/not running/);
  assert.throws(()=>f.store.applyFields(run.id,['subject']),/not available/);
});

test('runs survive shot deletion but cannot apply; video removal cascades records only', t => {
  const f=fixture(t), first=f.create();
  f.store.finishRun(first.id,{candidate:{subject:'candidate'}});
  f.db.db.prepare('DELETE FROM video_shots WHERE id = ?').run(f.shotId);
  assert.equal(f.store.getRun(first.id).status,'completed');
  assert.throws(() => f.store.applyFields(first.id,['subject']),/shot not found/);
  const [shotId] = f.db.upsertShots(f.video.id,[{start_time:2,end_time:8}]);
  const second=f.store.createRun({video_id:f.video.id,shot_id:shotId,start_time:2,end_time:8});
  f.db.deleteVideo(f.video.id);
  assert.equal(f.store.getRun(second.id),null);
  assert.equal(fs.readFileSync(f.source,'utf8'),'precious original');
});

test('run operations support existing outer transactions through savepoints', t => {
  const f=fixture(t);
  f.db.db.exec('BEGIN');
  const run=f.create(); f.store.finishRun(run.id,{candidate}); f.store.applyFields(run.id,['subject']);
  f.db.db.exec('ROLLBACK');
  assert.equal(f.store.getRun(run.id),null);
  assert.equal(f.db.getVideoShots(f.video.id)[0].subject,'old subject');
});
