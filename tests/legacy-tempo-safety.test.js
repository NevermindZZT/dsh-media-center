import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { MediaEngine } from '../src/host/media/engine.js';
import { VideoDatabase } from '../src/host/db/database.js';
import { VideoAiAnalyzer } from '../src/host/ai/video-analyzer.js';
import { createVideoManagerApiHandler } from '../src/host/api/router.js';
import { registerVideoManagerTools } from '../src/host/tools/register-tools.js';

const ffmpeg = process.platform === 'win32' ? path.join(os.homedir(), '.local', 'bin', 'ffmpeg.exe') : 'ffmpeg';
const ffprobe = process.platform === 'win32' ? path.join(os.homedir(), '.local', 'bin', 'ffprobe.exe') : 'ffprobe';
const haveFfmpeg = spawnSync(ffmpeg, ['-version'], {stdio:'ignore'}).status === 0;
const haveFfprobe = spawnSync(ffprobe, ['-version'], {stdio:'ignore'}).status === 0;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tempo-safety-'));
  const db = new VideoDatabase({workspaceRoot:root});
  t.after(() => { db.db.close(); fs.rmSync(root,{recursive:true,force:true}); });
  const source = path.join(root,'source.mp4');
  fs.writeFileSync(source, 'synthetic non-media reference');
  const board = path.join(root,'board.jpg'); fs.writeFileSync(board, Buffer.from([0xff,0xd8,0xff,0xd9]));
  const video = db.upsertVideo({file_path:source,file_name:'source.mp4',duration:5,storyboard_path:board});
  db.upsertVideoAudio(video.id,{bpm:94,beats:[0.3,0.93],silence_intervals:[{start:1,end:2,duration:1}],bgm_mood:'manual mood'});
  return {root,db,video,source};
}

const assertManualPreserved = (db,id) => {
  const audio=db.getVideoAudio(id);
  assert.equal(audio.bpm,94); assert.deepEqual(audio.beats,[0.3,0.93]);
  assert.deepEqual(audio.silence_intervals,[{start:1,end:2,duration:1}]);
};

function request(handler,method,url,body) {
  return new Promise((resolve,reject)=>{
    const req=Readable.from(body === undefined ? [] : [JSON.stringify(body)]); req.method=method; req.url=url; req.headers={};
    const res={writeHead(status){res.status=status;},end(buffer){try{resolve({status:res.status,body:JSON.parse(buffer.toString())});}catch(e){reject(e);}}};
    Promise.resolve(handler(req,res)).catch(reject);
  });
}

function mockedEngine(result) {
  return { ensureCaptureTimes:async()=>{}, generateStoryboard:async()=>null,
    detectSilenceResult:async()=>result, detectBpmAndBeats:async()=>{throw new Error('must not call fake tempo detector');},
    detectInitialShots:async()=>[] };
}

test('tempo detector is explicitly unavailable and never synthesizes 120 or a beat grid',async t=>{
  const f=fixture(t), engine=new MediaEngine(f.db);
  assert.deepEqual(await engine.detectBpmAndBeats(f.video),{status:'unavailable',reason:'tempo_detector_not_integrated',bpm:null,beats:null});
  assert.deepEqual(await engine.detectBpmAndBeats({}),{status:'unavailable',reason:'tempo_detector_not_integrated',bpm:null,beats:null});
  assertManualPreserved(f.db,f.video.id);
});

test('silence distinguishes missing binary, invalid source, and spawn failure',async t=>{
  const f=fixture(t), engine=new MediaEngine(f.db);
  engine.getBinaries=async()=>({ffmpeg:null,ffprobe:null});
  assert.deepEqual(await engine.detectSilenceResult(f.video),{status:'unavailable',reason:'ffmpeg_missing',intervals:null});
  assert.equal(await engine.detectSilence(f.video),null);
  engine.getBinaries=async()=>({ffmpeg:'nonexistent-ffmpeg-tempo-test',ffprobe:null});
  assert.equal((await engine.detectSilenceResult(f.video)).reason,'ffmpeg_spawn_failed');
  engine.getBinaries=async()=>({ffmpeg,ffprobe});
  if(haveFfmpeg && haveFfprobe) assert.equal((await engine.detectSilenceResult(f.video)).reason,'audio_probe_failed');
  assertManualPreserved(f.db,f.video.id);
});

test('real ffmpeg distinguishes no-audio, empty valid detections and nonzero decoding', {skip:!haveFfmpeg||!haveFfprobe}, async t=>{
  const f=fixture(t), engine=new MediaEngine(f.db);
  engine.getBinaries=async()=>({ffmpeg,ffprobe});
  const tone=path.join(f.root,'tone.wav'), silent=path.join(f.root,'silence.wav'), noAudio=path.join(f.root,'noaudio.mp4');
  for (const args of [
    ['-f','lavfi','-i','sine=frequency=440:duration=1','-c:a','pcm_s16le',tone],
    ['-f','lavfi','-i','anullsrc=r=44100:cl=mono','-t','1','-c:a','pcm_s16le',silent],
    ['-f','lavfi','-i','testsrc=size=32x32:rate=5','-t','1','-c:v','mpeg4',noAudio]
  ]) assert.equal(spawnSync(ffmpeg,['-v','error',...args],{stdio:'ignore'}).status,0);
  const toneResult=await engine.detectSilenceResult({file_path:tone});
  assert.equal(toneResult.status,'ok'); assert.deepEqual(toneResult.intervals,[]);
  const silenceResult=await engine.detectSilenceResult({file_path:silent});
  assert.equal(silenceResult.status,'ok'); assert.ok(silenceResult.intervals.length>0);
  const noAudioResult=await engine.detectSilenceResult({file_path:noAudio});
  assert.equal(noAudioResult.status,'unavailable'); assert.equal(noAudioResult.reason,'no_audio_stream'); assert.equal(noAudioResult.intervals,null);
  engine.getBinaries=async()=>({ffmpeg,ffprobe:null});
  const nonzero=await engine.detectSilenceResult({file_path:f.source});
  assert.equal(nonzero.status,'error'); assert.equal(nonzero.reason,'ffmpeg_failed');
  const mappedNoAudio=await engine.detectSilenceResult({file_path:noAudio});
  assert.equal(mappedNoAudio.reason,'no_audio_stream');
});

test('tool analysis reports unavailable tempo and preserves manual fields on detection failure',async t=>{
  const f=fixture(t), tools=new Map(), engine=mockedEngine({status:'error',reason:'ffmpeg_failed',intervals:null});
  registerVideoManagerTools({tools:{register:def=>{tools.set(def.name,def);return()=>{};}}},{db:f.db,mediaEngine:engine});
  const result=await tools.get('video_manager_trigger_analysis').execute({video_id:f.video.id});
  assert.equal(result.success,true); assert.equal(result.estimated_bpm,null); assert.equal(result.audio_analysis.tempo.status,'unavailable');
  assert.equal(result.audio_analysis.silence.status,'error'); assert.equal(result.silence_intervals_count,null);
  assertManualPreserved(f.db,f.video.id);
  const detail=await tools.get('video_manager_get_video').execute({video_id:f.video.id});
  assert.match(detail.audio_tempo_notice,/未确认/);
});

test('HTTP analysis failure does not replace manual BPM, beats or silence; successful empty silence may clear silence',async t=>{
  const f=fixture(t), engine=mockedEngine({status:'unavailable',reason:'no_audio_stream',intervals:null});
  const handler=createVideoManagerApiHandler({db:f.db,mediaEngine:engine});
  let result=await request(handler,'POST',`/api/video-manager/videos/${f.video.id}/analyze`);
  assert.equal(result.status,200); assert.equal(result.body.audio_analysis.tempo.bpm,null); assert.equal(result.body.audio_analysis.silence.reason,'no_audio_stream');
  assertManualPreserved(f.db,f.video.id);
  engine.detectSilenceResult=async()=>({status:'ok',reason:null,intervals:[]});
  result=await request(handler,'POST',`/api/video-manager/videos/${f.video.id}/analyze`);
  assert.equal(result.body.audio_analysis.silence.status,'ok');
  const audio=f.db.getVideoAudio(f.video.id); assert.equal(audio.bpm,94); assert.deepEqual(audio.beats,[0.3,0.93]); assert.deepEqual(audio.silence_intervals,[]);
});

test('AI analysis preserves manual tempo, beats and silence when detection fails or throws',async t=>{
  const f=fixture(t);
  const config=new Map([['ai_mode','dsh'],['ai_provider','p'],['ai_dsh_model','m']]);
  for(const [k,v] of config) f.db.setSetting(k,v);
  const engine=mockedEngine({status:'error',reason:'ffmpeg_failed',intervals:null});
  const llm={listProviders:()=>[{id:'p'}],listModels:async()=>[{provider:'p',id:'m',inputModalities:['text','image']}],resolveModelInfo:async()=>({inputModalities:['text','image']}),
    async *stream(){yield {type:'text-delta',text:'{"shots":[{"start_time":0,"end_time":2}],"bgm_mood":"new"}'};yield {type:'finish',reason:{kind:'stop'}};}};
  const analyzer=new VideoAiAnalyzer(f.db,engine,{llm,attachments:{saveImage:async()=>({attachmentId:'test'})}});
  let result=await analyzer.analyzeVideo(f.video.id);
  assert.equal(result.audio_analysis.tempo.status,'unavailable'); assert.equal(result.audio_analysis.silence.status,'error'); assertManualPreserved(f.db,f.video.id);
  engine.detectSilenceResult=async()=>{throw new Error('broken decoder');};
  result=await analyzer.analyzeVideo(f.video.id);
  assert.equal(result.audio_analysis.silence.reason,'silence_detection_failed'); assertManualPreserved(f.db,f.video.id);
  engine.detectSilenceResult=async()=>({status:'ok',reason:null,intervals:[]});
  result=await analyzer.analyzeVideo(f.video.id);
  assert.equal(result.audio_analysis.silence.status,'ok');
  const audio=f.db.getVideoAudio(f.video.id);
  assert.equal(audio.bpm,94); assert.deepEqual(audio.beats,[0.3,0.93]); assert.deepEqual(audio.silence_intervals,[]);
});
