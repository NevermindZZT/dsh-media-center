import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {analyzePcmBeats,analyzeMusicBeats} from '../src/host/music/beat-analysis.js';

const ffmpeg=process.platform==='win32'?path.join(os.homedir(),'.local','bin','ffmpeg.exe'):'ffmpeg';
const ffprobe=process.platform==='win32'?path.join(os.homedir(),'.local','bin','ffprobe.exe'):'ffprobe';
const available=spawnSync(ffmpeg,['-version'],{stdio:'ignore'}).status===0&&spawnSync(ffprobe,['-version'],{stdio:'ignore'}).status===0;
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function clickTrack(bpm,duration=15,rate=11025){
 const samples=new Float32Array(duration*rate);
 for(let t=.2;t<duration;t+=60/bpm){const start=Math.round(t*rate);for(let i=0;i<Math.round(.018*rate)&&start+i<samples.length;i++)samples[start+i]=.8*Math.sin(i*.3)*Math.exp(-i/(rate*.006));}
 return samples;
}
function eventTrack(times,duration=15,rate=11025){
 const samples=new Float32Array(duration*rate);
 for(const t of times){const start=Math.round(t*rate);for(let i=0;i<Math.round(.018*rate)&&start+i<samples.length;i++)samples[start+i]=.8*Math.sin(i*.3)*Math.exp(-i/(rate*.006));}
 return samples;
}
function wav(samples,rate=11025){
 const b=Buffer.alloc(44+samples.length*2);b.write('RIFF',0);b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);
 for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(samples[i]*32767))),44+i*2);return b;
}
function dirFor(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-beat-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}

for(const bpm of [90,120])test(`synthetic ${bpm} BPM click events remain onset-only and mark half/double ambiguity`,()=>{
 const startSeconds=7,result=analyzePcmBeats(clickTrack(bpm),{startSeconds});
 assert.equal(result.status,'low_confidence');assert.equal(result.bpm,null,'ambiguous tempo must not be presented as a unique winner');assert.ok(result.confidence===null||result.confidence<0.75);assert.ok(result.confidence<result.tempo_candidates[0].confidence,'overall confidence reflects runner-up separation');
 assert.equal(result.source,'measured');assert.ok(result.onsets.length>=15);assert.deepEqual(result.beats,[]);assert.ok(Number.isFinite(result.feature_summary.mean_rms));assert.ok(result.feature_summary.dynamic_range_db===null||Number.isFinite(result.feature_summary.dynamic_range_db));assert.ok(Number.isFinite(result.feature_summary.transient_density_per_minute));
 const alternatives=result.tempo_candidates.filter(x=>x.ambiguous);
 assert.ok(alternatives.length>=2);assert.ok(alternatives.every(x=>x.ambiguity_group));
 assert.ok(alternatives.some(x=>Math.abs(x.bpm-bpm)<=2));
 assert.ok(alternatives.some(x=>Math.abs(x.bpm-bpm*2)<=5||Math.abs(x.bpm-bpm/2)<=2));
 assert.ok(result.beat_candidates.length>0&&result.beat_candidates.length<=512);
 for(const candidate of result.beat_candidates){
   assert.equal(candidate.source,'observed_onset');assert.equal(candidate.ambiguous,true);
   assert.ok(candidate.confidence>=.75);assert.ok(Number.isSafeInteger(candidate.onset_index));
   assert.equal(candidate.source_seconds,result.onsets[candidate.onset_index]);
   assert.ok(result.onsets.includes(candidate.source_seconds));
   assert.ok(candidate.source_seconds>=startSeconds&&candidate.source_seconds<startSeconds+15);
 }
});

test('silence, weak, brief, sparse, and syncopated material never fabricate beat candidates',()=>{
 const silence=analyzePcmBeats(new Float32Array(11025*8));
 assert.equal(silence.status,'silence');assert.equal(silence.bpm,null);assert.deepEqual(silence.beats,[]);assert.deepEqual(silence.beat_candidates,[]);
 const weak=clickTrack(120,8);for(let i=0;i<weak.length;i++)weak[i]*=.00001;
 const weakResult=analyzePcmBeats(weak);assert.equal(weakResult.bpm,null);assert.deepEqual(weakResult.beat_candidates,[]);
 const brief=analyzePcmBeats(clickTrack(120,2));assert.equal(brief.status,'low_confidence');assert.equal(brief.bpm,null);assert.deepEqual(brief.beat_candidates,[]);
 const sparse=analyzePcmBeats(clickTrack(30,8));assert.equal(sparse.bpm,null);assert.deepEqual(sparse.beat_candidates,[]);
 const intervals=[.31,.83,.47,1.19,.62,.37,.95,.51,1.27,.42,.73,.34,1.05,.58,.91,.46,1.14,.39,.68,.57,.99,.44,.79,.35,.88];
 let t=.2;const times=[];for(const delta of intervals){times.push(t);t+=delta;}
 const syncopated=analyzePcmBeats(eventTrack(times));assert.equal(syncopated.bpm,null);assert.deepEqual(syncopated.beats,[]);assert.deepEqual(syncopated.beat_candidates,[]);
});

test('600-second candidate output is bounded and every timestamp is an onset event',()=>{
 const result=analyzePcmBeats(clickTrack(180,600));
 assert.equal(result.status,'low_confidence');assert.equal(result.bpm,null);assert.deepEqual(result.beats,[]);
 assert.equal(result.analysis_window.duration_seconds,600);assert.ok(result.beat_candidates.length<=512);assert.throws(()=>analyzePcmBeats(new Float32Array(601),{sampleRate:1}),/exceeds 600 seconds/);
 assert.ok(result.beat_candidates.every(candidate=>candidate.source_seconds===result.onsets[candidate.onset_index]&&result.onsets.includes(candidate.source_seconds)));
});

test('real ffmpeg decodes bounded source-relative window without modifying input',{skip:!available},async t=>{
 const dir=dirFor(t),file=path.join(dir,'clicks.wav');fs.writeFileSync(file,wav(clickTrack(90,18)));const before=hash(file);
 const result=await analyzeMusicBeats({filePath:file,ffmpeg,ffprobe,startSeconds:3,durationSeconds:10});
 assert.equal(result.status,'low_confidence');assert.equal(result.bpm,null);
 assert.ok(result.onsets.length>0);assert.ok(result.onsets.every(x=>x>=3&&x<13));assert.deepEqual(result.beats,[]);
 assert.ok(result.beat_candidates.every(candidate=>result.onsets[candidate.onset_index]===candidate.source_seconds));
 assert.equal(hash(file),before);assert.ok(result.analysis_window.duration_seconds<=10.01);
});

test('no audio, invalid file, invalid executables and aborted decode remain distinct',{skip:!available},async t=>{
 const dir=dirFor(t),video=path.join(dir,'silent-video.mp4');
 const proc=spawnSync(ffmpeg,['-v','error','-f','lavfi','-i','color=s=32x32:r=10','-t','1','-c:v','mpeg4','-an','-y',video],{stdio:'ignore'});
 assert.equal(proc.status,0);const before=hash(video);
 const no=await analyzeMusicBeats({filePath:video,ffmpeg,ffprobe});assert.equal(no.status,'no_audio');assert.equal(no.bpm,null);assert.deepEqual(no.beat_candidates,[]);
 const bad=await analyzeMusicBeats({filePath:path.join(dir,'missing.wav'),ffmpeg,ffprobe});assert.equal(bad.status,'error');assert.equal(bad.error_code,'SOURCE_UNAVAILABLE');assert.equal(bad.bpm,null);assert.deepEqual(bad.beat_candidates,[]);
 const ctrl=new AbortController();ctrl.abort();const aborted=await analyzeMusicBeats({filePath:video,ffmpeg,ffprobe,signal:ctrl.signal});assert.equal(aborted.error_code,'ABORTED');
 const probeError=await analyzeMusicBeats({filePath:video,ffmpeg,ffprobe:path.join(dir,'missing-executable')});assert.equal(probeError.error_code,'PROBE_FAILED');
 assert.equal(hash(video),before);
});

test('bounded arguments reject unbounded requests',async()=>{
 for(const filePath of ['https://example.com/music.mp3','relative.mp3'])await assert.rejects(analyzeMusicBeats({filePath,ffmpeg,ffprobe}),/Invalid/);
 for(const durationSeconds of [0,-1,601,Infinity,NaN])await assert.rejects(analyzeMusicBeats({filePath:'x',ffmpeg:'ffmpeg',ffprobe:'ffprobe',durationSeconds}),/Invalid/);
});
