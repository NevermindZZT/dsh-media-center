import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { generateShotStoryboard } from '../src/host/media/shot-storyboard.js';

const base = {
  video: { file_path: 'source.mp4', duration: 12 },
  shot: { start_time: 0, end_time: 1 },
  outputDir: 'generated-cache', ffmpeg: 'ffmpeg'
};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function locateFfmpeg() {
  const candidates = [process.env.FFMPEG_PATH, 'ffmpeg'];
  if (process.platform === 'win32' && process.env.USERPROFILE) {
    candidates.push(path.join(process.env.USERPROFILE, '.local', 'bin', 'ffmpeg.exe'));
  }
  return candidates.filter(Boolean).find(candidate => {
    const result = spawnSync(candidate, ['-hide_banner', '-version'], { encoding: 'utf8', windowsHide: true });
    return result.status === 0;
  });
}
const ffmpeg = locateFfmpeg();
const integration = ffmpeg ? {} : { skip: 'FFmpeg is not available' };
const filterListing = ffmpeg ? spawnSync(ffmpeg, ['-hide_banner', '-filters'], {encoding:'utf8', windowsHide:true}) : null;
const supportsFilters = filterListing?.status === 0 && /\bdrawtext\b/.test(filterListing.stdout) && /\bxstack\b/.test(filterListing.stdout);
const storyboardIntegration = supportsFilters ? {} : { skip: 'FFmpeg with drawtext and xstack is not available' };

// Invalid input must fail before creating a cache directory or invoking FFmpeg.
test('rejects invalid source, duration, intervals and executable arguments', async () => {
  const invalid = [
    {}, {video: null}, {video: {file_path:'', duration:12}},
    {video: {file_path:'source.mp4', duration:0}},
    ...[NaN, Infinity, -1, '12'].map(duration => ({video: {file_path:'source.mp4', duration}})),
    ...[
      {start_time:-1,end_time:1}, {start_time:1,end_time:1}, {start_time:2,end_time:1},
      {start_time:0,end_time:13}, {start_time:NaN,end_time:1},
      {start_time:0,end_time:Infinity}, {start_time:'0',end_time:1}, {}, null
    ].map(shot => ({shot})),
    {outputDir:''}, {ffmpeg:''}
  ];
  for (const override of invalid) {
    const input = Object.keys(override).length ? { ...base, ...override } : undefined;
    await assert.rejects(generateShotStoryboard(input), /Invalid storyboard input/);
  }
});

test('subprocess failures are redacted and remove only fresh output', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-sheet-error-'));
  t.after(() => fs.rm(root, { recursive:true, force:true }));
  const source = path.join(root, 'private-source.mp4');
  const marker = path.join(root, 'keep.txt');
  const cache = path.join(root, 'cache');
  await fs.writeFile(source, 'source bytes');
  await fs.writeFile(marker, 'do not touch');
  const before = hash(await fs.readFile(source));
  await assert.rejects(generateShotStoryboard({
    video:{file_path:source,duration:10}, shot:{start_time:0,end_time:2},
    outputDir:cache, ffmpeg:path.join(root, 'private-missing-ffmpeg')
  }), error => !error.message.includes(root) && !error.message.includes('private-source'));
  assert.equal(hash(await fs.readFile(source)), before);
  assert.equal(await fs.readFile(marker, 'utf8'), 'do not touch');
  assert.deepEqual(await fs.readdir(cache), []);
});

test('real FFmpeg: adaptive boundaries, true source PTS, safe output, concurrent uniqueness', storyboardIntegration, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-sheet-ffmpeg-'));
  t.after(() => fs.rm(root, { recursive:true, force:true }));
  const source = path.join(root, 'source.mp4');
  const cache = path.join(root, 'generated-cache');
  const created = spawnSync(ffmpeg, ['-hide_banner','-loglevel','error','-nostdin',
    '-f','lavfi','-i','testsrc2=size=320x180:rate=20','-t','10',
    '-c:v','mpeg4','-n',source], {encoding:'utf8', windowsHide:true});
  assert.equal(created.status, 0, 'unable to create synthetic source video');
  const before = hash(await fs.readFile(source));
  const video = {file_path:source,duration:10};
  const ranges = [[0,1.999,4],[0,2,9],[0,7.999,9],[0,8,16],[7,9,9],[1.123,2.987,4]];
  for (const [start,end,count] of ranges) {
    const result = await generateShotStoryboard({video,shot:{start_time:start,end_time:end},outputDir:cache,ffmpeg});
    assert.equal(result.sample_times.length, count);
    assert.equal(path.basename(result.storyboard_path), 'storyboard.jpg');
    assert.ok(path.relative(await fs.realpath(cache), result.storyboard_path).split(path.sep)[0].startsWith('shot-storyboard-'));
    const bytes = await fs.readFile(result.storyboard_path);
    assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8);
    for (let i = 0; i < count; i++) {
      const t = result.sample_times[i];
      const target = start + (end-start)*(i+0.5)/count;
      assert.ok(t >= start && t < end, `PTS ${t} is outside ${start}..${end}`);
      assert.ok(t + 1e-8 >= target, `PTS ${t} precedes target ${target}`);
      assert.ok(t - target <= 0.051, `PTS ${t} is more than one source frame after ${target}`);
      assert.ok(Math.abs(t*20 - Math.round(t*20)) < 1e-7, `PTS ${t} is not an actual source frame`);
      if (i) assert.ok(t >= result.sample_times[i-1]);
    }
  }
  const same = {video,shot:{start_time:1,end_time:2.5},outputDir:cache,ffmpeg};
  const [one,two] = await Promise.all([generateShotStoryboard(same),generateShotStoryboard(same)]);
  assert.notEqual(one.storyboard_path,two.storyboard_path);
  assert.ok((await fs.stat(one.storyboard_path)).size > 0);
  assert.ok((await fs.stat(two.storyboard_path)).size > 0);
  assert.equal(hash(await fs.readFile(source)),before);
});

test('real FFmpeg: low FPS, end-boundary and sub-frame intervals use only real in-range frames', storyboardIntegration, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-sheet-lowfps-'));
  t.after(() => fs.rm(root, { recursive:true, force:true }));
  const source = path.join(root, 'source.mp4');
  const cache = path.join(root, 'cache');
  const created = spawnSync(ffmpeg, ['-hide_banner','-loglevel','error','-nostdin',
    '-f','lavfi','-i','testsrc2=size=320x180:rate=1','-t','3',
    '-c:v','mpeg4','-n',source], {encoding:'utf8',windowsHide:true});
  assert.equal(created.status, 0, 'unable to create synthetic low-FPS video');
  const before = hash(await fs.readFile(source));
  const video = { file_path:source, duration:3 };
  const cases = [
    [0,1,[0,0,0,0]],             // exclusive end rejects frame at 1s
    [0,3,[1,1,1,2,2,2,2,2,2]], // nine cells, including targets after the last PTS
    [1.25,3,[2,2,2,2]],         // targets past last source frame reuse 2s
    [0.9,1.1,[1,1,1,1]],        // sub-frame span containing exactly one frame
    [1.999,2.001,[2,2,2,2]]     // very short span around a real frame
  ];
  for (const [start,end,expected] of cases) {
    const result = await generateShotStoryboard({video,shot:{start_time:start,end_time:end},outputDir:cache,ffmpeg});
    assert.deepEqual(result.sample_times, expected);
    assert.ok((await fs.stat(result.storyboard_path)).size > 0);
    for (const timestamp of result.sample_times) assert.ok(timestamp >= start && timestamp < end);
  }
  const entriesBefore = (await fs.readdir(cache)).sort();
  for (const [start,end] of [[0.1,0.9], [1.001,1.999], [2.1,2.9]]) {
    await assert.rejects(generateShotStoryboard({video,shot:{start_time:start,end_time:end},outputDir:cache,ffmpeg}),
      error => error.message === 'No source frames exist within the shot interval');
  }
  assert.deepEqual((await fs.readdir(cache)).sort(), entriesBefore);
  assert.equal(hash(await fs.readFile(source)), before);
});

test('real FFmpeg preserves fractional frame-rate timestamps', storyboardIntegration, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-sheet-fractional-'));
  t.after(() => fs.rm(root, { recursive:true, force:true }));
  const source = path.join(root, 'source.mp4');
  const created = spawnSync(ffmpeg, ['-hide_banner','-loglevel','error','-nostdin',
    '-f','lavfi','-i','testsrc2=size=320x180:rate=30000/1001','-t','3',
    '-c:v','mpeg4','-n',source], {encoding:'utf8', windowsHide:true});
  assert.equal(created.status, 0);
  const before = hash(await fs.readFile(source));
  const result = await generateShotStoryboard({video:{file_path:source,duration:3},
    shot:{start_time:0.123,end_time:2.123},outputDir:path.join(root,'cache'),ffmpeg});
  assert.equal(result.sample_times.length, 9);
  for (const time of result.sample_times) {
    assert.ok(time >= 0.123 && time < 2.123);
    const frameNumber = time * 30000 / 1001;
    assert.ok(Math.abs(frameNumber - Math.round(frameNumber)) < 1e-7, `not an exact frame PTS: ${time}`);
  }
  assert.equal(hash(await fs.readFile(source)), before);
});

test('real FFmpeg failure cannot remove or modify source and leaves no partial output', integration, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shot-sheet-badvideo-'));
  t.after(() => fs.rm(root, { recursive:true, force:true }));
  const source = path.join(root, 'invalid-secret-path.mp4');
  const cache = path.join(root, 'cache');
  await fs.writeFile(source, 'not a video');
  const before = hash(await fs.readFile(source));
  await assert.rejects(generateShotStoryboard({video:{file_path:source,duration:3},shot:{start_time:0,end_time:1},outputDir:cache,ffmpeg}), e => !e.message.includes(root));
  assert.equal(hash(await fs.readFile(source)),before);
  assert.deepEqual(await fs.readdir(cache),[]);
});
