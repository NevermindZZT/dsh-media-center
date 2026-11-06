import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { VideoDatabase } from '../src/host/db/database.js';
import { MediaEngine } from '../src/host/media/engine.js';
import { extractCaptureTime } from '../src/host/media/capture-time.js';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-video-time-test-'));
  const db = new VideoDatabase({ workspaceRoot: root });
  t.after(() => db.db.close());
  return { db, root };
}
const metadata = value => ({ format: { tags: { creation_time: value } } });

test('capture time uses metadata, preserves timezone, rejects absent/invalid dates', () => {
  assert.deepEqual(extractCaptureTime(metadata('2026-10-08T04:33:55.000000Z')), {
    captured_at: '2026-10-08T04:33:55.000Z', captured_at_source: 'metadata:format.creation_time'
  });
  assert.equal(extractCaptureTime(metadata('2026-10-08T12:33:55+08:00')).captured_at, '2026-10-08T04:33:55.000Z');
  assert.equal(extractCaptureTime(metadata('2026-10-08 12:33:55')).captured_at, '2026-10-08T12:33:55');
  assert.equal(extractCaptureTime({}).captured_at, null);
  assert.equal(extractCaptureTime(metadata('2026-02-30T10:00:00Z')).captured_at, null);
  assert.equal(extractCaptureTime(metadata('1904-01-01T00:00:00Z')).captured_at, null);
  assert.equal(extractCaptureTime({ streams: [{ codec_type: 'video', tags: { creation_time: '2026-10-08T04:33:55Z' } }] }).captured_at_source, 'metadata:video.creation_time');
  assert.equal(extractCaptureTime({ format: { tags: { creation_time: 'invalid', 'com.apple.quicktime.creationdate': '2026-10-08T12:33:55+0800' } } }).captured_at, '2026-10-08T04:33:55.000Z');
});

test('migration removes legacy import fallback without altering annotations or import time', t => {
  const { db } = fixture(t);
  const saved = db.upsertVideo({ file_path: 'legacy.mp4', file_name: 'Legacy', summary: 'keep', status: 'analyzed' });
  db.db.exec('ALTER TABLE videos DROP COLUMN captured_at_source');
  db.db.prepare('UPDATE videos SET captured_at = created_at').run();
  db.initDb();
  const migrated = db.getVideoById(saved.id);
  assert.equal(migrated.captured_at, null);
  assert.equal(migrated.captured_at_source, null);
  assert.equal(migrated.created_at, saved.created_at);
  assert.equal(migrated.summary, 'keep');
  assert.equal(migrated.status, 'analyzed');
  const capture = extractCaptureTime(metadata('2026-10-08T04:33:55Z'));
  db.updateCaptureTime(saved.id, capture);
  db.initDb();
  assert.equal(db.getVideoById(saved.id).captured_at, capture.captured_at);
});

test('insert/update never use import time as capture time; explicit unknown clears stale values', t => {
  const { db } = fixture(t);
  const video = db.upsertVideo({ file_path: 'new.mp4', file_name: 'New' });
  assert.equal(video.captured_at, null);
  db.upsertVideo({ id: video.id, ...extractCaptureTime(metadata('2026-10-08T04:33:55Z')) });
  assert.ok(db.getVideoById(video.id).captured_at);
  db.upsertVideo({ id: video.id, summary: 'annotation' });
  assert.ok(db.getVideoById(video.id).captured_at);
  db.upsertVideo({ id: video.id, ...extractCaptureTime({}) });
  assert.equal(db.getVideoById(video.id).captured_at, null);
  assert.equal(db.getVideoById(video.id).captured_at_source, 'unknown');
  assert.equal(db.getVideoById(video.id).created_at, video.created_at);
});

test('sort capture instants chronologically and put unknowns last in either direction', t => {
  const { db } = fixture(t);
  const add = (name, time) => db.upsertVideo({ file_path: name, file_name: name, captured_at: time, captured_at_source: time ? 'metadata:format.creation_time' : 'unknown' });
  add('early', '2026-10-08T04:00:00Z');
  add('late', '2026-10-08T13:00:00+08:00');
  add('unknown', null);
  const names = dir => db.queryVideos({ sort_by: 'captured_at', sort_dir: dir }).map(v => v.file_name);
  assert.deepEqual(names('asc'), ['early', 'late', 'unknown']);
  assert.deepEqual(names('desc'), ['late', 'early', 'unknown']);
  assert.deepEqual(db.queryVideos({ sort_by: 'file_name', sort_dir: 'asc', limit: 1 }).map(v => v.file_name), ['early']);
});

test('backfill coalesces probes, preserves data and import order, distinguishes offline files', async t => {
  const { db } = fixture(t);
  for (const name of ['known', 'no-tags', 'offline']) db.upsertVideo({ file_path: name, file_name: name, summary: 'keep', ai_model: 'model' });
  const before = db.queryVideos({ sort_by: 'created_at' }).map(v => [v.id, v.created_at, v.updated_at]);
  const engine = new MediaEngine(db);
  engine.getBinaries = async () => ({ ffprobe: 'mock' });
  let calls = 0;
  engine.probeCaptureTime = async file => {
    calls++;
    if (file === 'offline') throw new Error('offline');
    return extractCaptureTime(file === 'known' ? metadata('2026-10-08T04:33:55Z') : {});
  };
  await Promise.all([engine.ensureCaptureTimes(), engine.ensureCaptureTimes()]);
  await engine.ensureCaptureTimes();
  assert.equal(calls, 3);
  assert.deepEqual(db.queryVideos({ sort_by: 'created_at' }).map(v => [v.id, v.created_at, v.updated_at]), before);
  assert.equal(db.getVideoByPath('known').summary, 'keep');
  assert.equal(db.getVideoByPath('known').ai_model, 'model');
  assert.equal(db.getVideoByPath('no-tags').captured_at_source, 'unknown');
  assert.equal(db.getVideoByPath('offline').captured_at_source, 'unavailable');
});

test('no ffprobe leaves legacy data pending for a later configured probe', async t => {
  const { db } = fixture(t);
  db.upsertVideo({ file_path: 'pending', file_name: 'pending' });
  const engine = new MediaEngine(db);
  engine.getBinaries = async () => ({});
  await engine.ensureCaptureTimes();
  assert.equal(db.getPendingCaptureTimes().length, 1);
  engine.getBinaries = async () => ({ ffprobe: 'mock' });
  engine.probeCaptureTime = async () => extractCaptureTime(metadata('2026-10-08T04:33:55Z'));
  await engine.ensureCaptureTimes();
  assert.equal(db.getPendingCaptureTimes().length, 0);
});

const client = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const helpers = client.slice(client.indexOf('    function formatDateTime'), client.indexOf('    // --- Main Workbench'));
const initializer = client.slice(client.indexOf('      const [sortRule, setSortRule]'), client.indexOf('      const sortRuleRef'));
function clientContext(storage) {
  const context = vm.createContext({ window: { localStorage: storage }, useState: fn => [fn(), () => {}] });
  vm.runInContext(helpers, context);
  return context;
}
test('sort initializes from the saved preference, rejects corrupt or inaccessible storage', () => {
  for (const [value, expected] of [['file_name_asc', 'file_name_asc'], ['duration_desc', 'duration_desc'], ['bad', 'captured_at_desc'], [null, 'captured_at_desc']]) {
    const context = clientContext({ getItem: () => value });
    vm.runInContext(initializer + '\nglobalThis.rule = sortRule;', context);
    assert.equal(context.rule, expected);
  }
  const context = clientContext({ getItem() { throw new Error('denied'); } });
  vm.runInContext(initializer + '\nglobalThis.rule = sortRule;', context);
  assert.equal(context.rule, 'captured_at_desc');
});
test('UI never labels an import fallback as capture time', () => {
  const context = clientContext({});
  for (const [source, text] of [[null, '拍摄时间待读取'], ['unknown', '拍摄时间未知'], ['unavailable', '拍摄时间不可用']]) {
    context.video = { captured_at_source: source, created_at: '2026-11-05T11:00:00Z' };
    assert.equal(vm.runInContext('captureTimePresentation(video).text', context), text);
  }
  context.video = { ...extractCaptureTime(metadata('2026-10-08T04:33:55Z')) };
  const result = vm.runInContext('captureTimePresentation(video).text', context);
  assert.match(result, /^2026-10-08 /);
  assert.equal(vm.runInContext("formatDateTime('2026-10-08T12:33:55')", context), '2026-10-08 12:33:55');
});
