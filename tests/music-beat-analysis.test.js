import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { analyzePcmBeats, analyzeMusicBeats } from '../src/host/music/beat-analysis.js';

const ffmpeg = process.platform === 'win32' ? path.join(os.homedir(),'.local','bin','ffmpeg.exe') : 'ffmpeg';
const ffprobe = process.platform === 'win32' ? path.join(os.homedir(),'.local','bin','ffprobe.exe') : 'ffprobe';
const available = spawnSync(ffmpeg,['-version'],{stdio:'ignore'}).status === 0 && spawnSync(ffprobe,['-version'],{stdio:'ignore'}).status === 0;
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function clickTrack(bpm, duration=15, rate=11025) {
  const samples = new Float32Array(duration*rate);
  for (let t=0.2; t<duration; t += 60/bpm) {
    const start = Math.round(t*rate);
    for (let i=0; i<Math.round(0.018*rate) && start+i<samples.length; i++) samples[start+i] = 0.8*Math.sin(i*0.3)*Math.exp(-i/(rate*0.006));
  }
  return samples;
}
function wav(samples, rate=11025) {
  const b=Buffer.alloc(44+samples.length*2);
  b.write('RIFF',0); b.writeUInt32LE(b.length-8,4); b.write('WAVEfmt ',8); b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(rate,24); b.writeUInt32LE(rate*2,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(samples.length*2,40);
  for(let i=0;i<samples.length;i++) b.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(samples[i]*32767))),44+i*2);
  return b;
}
function dirFor(t) {const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-beat-test-')); t.after(()=>fs.rmSync(dir,{recursive:true,force:true})); return dir;}
for (const bpm of [90,120]) test(`synthetic ${bpm} BPM click track produces measured onsets and tempo`,()=>{
  const result=analyzePcmBeats(clickTrack(bpm));
  assert.equal(result.status,'ok'); assert.equal(result.source,'measured');
  assert.ok(Math.abs(result.bpm-bpm)<=2,`actual ${result.bpm}; candidates ${JSON.stringify(result.tempo_candidates)}`);
  assert.ok(result.onsets.length>=15); assert.deepEqual(result.beats,[]);
  assert.ok(result.onsets.every(t => Math.abs((t-0.2)/(60/bpm)-Math.round((t-0.2)/(60/bpm))) < 0.05));
  assert.ok(result.confidence > 0.55);
});

test('silence and weak or brief signals do not fabricate BPM',()=>{
  const s=analyzePcmBeats(new Float32Array(11025*8));
  assert.equal(s.status,'silence'); assert.equal(s.bpm,null); assert.deepEqual(s.beats,[]);
  const b=analyzePcmBeats(clickTrack(120,2));
  assert.equal(b.status,'low_confidence'); assert.equal(b.bpm,null);
});

test('real ffmpeg decodes bounded source-relative window without modifying input', {skip:!available}, async t=>{
  const dir=dirFor(t), file=path.join(dir,'clicks.wav'); fs.writeFileSync(file,wav(clickTrack(90,18))); const before=hash(file);
  const r=await analyzeMusicBeats({filePath:file,ffmpeg,ffprobe,startSeconds:3,durationSeconds:10});
  assert.equal(r.status,'ok'); assert.ok(Math.abs(r.bpm-90)<=2,JSON.stringify(r));
  assert.ok(r.onsets.every(x=>x>=3 && x<13)); assert.equal(hash(file),before);
  assert.ok(r.analysis_window.duration_seconds<=10.01);
});

test('no audio, invalid file, invalid executables and aborted decode remain distinct', {skip:!available}, async t=>{
  const dir=dirFor(t), video=path.join(dir,'silent-video.mp4');
  const proc=spawnSync(ffmpeg,['-v','error','-f','lavfi','-i','color=s=32x32:r=10','-t','1','-c:v','mpeg4','-an','-y',video],{stdio:'ignore'});
  assert.equal(proc.status,0); const before=hash(video);
  const no=await analyzeMusicBeats({filePath:video,ffmpeg,ffprobe}); assert.equal(no.status,'no_audio'); assert.equal(no.bpm,null);
  const bad=await analyzeMusicBeats({filePath:path.join(dir,'missing.wav'),ffmpeg,ffprobe}); assert.equal(bad.status,'error'); assert.equal(bad.error_code,'SOURCE_UNAVAILABLE'); assert.equal(bad.bpm,null);
  const ctrl=new AbortController(); ctrl.abort(); const aborted=await analyzeMusicBeats({filePath:video,ffmpeg,ffprobe,signal:ctrl.signal}); assert.equal(aborted.error_code,'ABORTED');
  const probeError=await analyzeMusicBeats({filePath:video,ffmpeg,ffprobe:path.join(dir,'missing-executable')}); assert.equal(probeError.error_code,'PROBE_FAILED');
  assert.equal(hash(video),before);
});

test('bounded arguments reject unbounded requests',async()=>{
  for (const filePath of ['https://example.com/music.mp3','relative.mp3']) await assert.rejects(analyzeMusicBeats({filePath,ffmpeg,ffprobe}),/Invalid/);
  for (const durationSeconds of [0,-1,181,Infinity,NaN]) await assert.rejects(analyzeMusicBeats({filePath:'x',ffmpeg:'ffmpeg',ffprobe:'ffprobe',durationSeconds}),/Invalid/);
});
