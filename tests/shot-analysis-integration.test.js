import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { VideoDatabase } from '../src/host/db/database.js';
import { ShotAnalysisService } from '../src/host/ai/shot-analysis-service.js';
import { createVideoManagerApiHandler } from '../src/host/api/router.js';

const ffmpeg = process.platform === 'win32' ? path.join(os.homedir(), '.local', 'bin', 'ffmpeg.exe') : 'ffmpeg';
const available = spawnSync(ffmpeg, ['-version'], { stdio:'ignore' }).status === 0;
const candidate = { subject:'人物', visual_description:'画面中有人物', composition:'居中', shot_type:'中景', camera_movement:'无法确认', quality_score:null, tags:['人物'], uncertainty:'画面不足以确认连续运动', editing_suggestions:'可作环境展示' };
const digest = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-shot-e2e-'));
  const source = path.join(dir, 'synthetic-source.mp4');
  const ff = spawnSync(ffmpeg, ['-v','error','-f','lavfi','-i','testsrc=size=320x180:rate=30','-t','3','-c:v','mpeg4','-n',source], { stdio:'ignore' });
  assert.equal(ff.status, 0);
  const db = new VideoDatabase({ workspaceRoot:dir });
  t.after(() => { db.db.close(); fs.rmSync(dir,{recursive:true,force:true}); });
  const video = db.upsertVideo({file_name:'synthetic-source.mp4',file_path:source,duration:3});
  const [shotId] = db.upsertShots(video.id,[{start_time:0,end_time:2.5,subject:'原始主体',visual_description:'人工描述',composition:'原构图'}]);
  const modelCalls=[];
  const videoAiAnalyzer = {
    getAiSettings: () => ({mode:'dsh',provider:'test-provider',model:'test-model',reasoning_effort:'medium'}),
    validateDshRoute: async () => {},
    attachments:{saveImage:async input => ({attachmentId:'test',mediaType:input.mediaType,bytes:input.data.length,width:960,height:540})},
    llm:{ async *stream(options) { modelCalls.push(options); yield {type:'text-delta',text:JSON.stringify(candidate)}; yield {type:'usage',usage:{inputTokens:11,outputTokens:22,totalTokens:33}}; yield {type:'finish',reason:{kind:'stop'}}; } }
  };
  const engine={getBinaries:async()=>({ffmpeg}),ensureCaptureTimes:async()=>{}};
  const service=new ShotAnalysisService(db,engine,videoAiAnalyzer);
  const handler=createVideoManagerApiHandler({db,mediaEngine:engine,videoAiAnalyzer,shotAnalysisService:service});
  const request=(method,url,body,headers={}) => new Promise((resolve,reject)=>{
    const req=Readable.from(body === undefined ? [] : [JSON.stringify(body)]); req.method=method; req.url=url; req.headers=headers;
    const res={writeHead(status,headers){res.status=status; res.headers=headers;},end(buffer){ try { resolve({status:res.status,headers:res.headers,body:buffer ? JSON.parse(buffer.toString()) : null}); } catch(e){reject(e);} }};
    Promise.resolve(handler(req,res)).catch(reject);
  });
  return {dir,source,db,video,shotId,service,modelCalls,request};
}

test('cross-origin reads, writes and preflight are blocked before processing', {skip:!available}, async t=>{
  const f=fixture(t), host='127.0.0.1:3080', origin='https://outside.example';
  for (const method of ['GET','POST','OPTIONS']) {
    const result=await f.request(method,'/api/video-manager/shot-analysis-settings', method === 'POST' ? {prompt:'alter'} : undefined,{host,origin});
    assert.equal(result.status,403); assert.equal(result.headers['Access-Control-Allow-Origin'],undefined);
  }
  const sameOrigin=await f.request('GET','/api/video-manager/shot-analysis-settings',undefined,{host,origin:'http://127.0.0.1:3080'});
  assert.equal(sameOrigin.status,200);
});

test('shot prompt settings default, save and reject overlong values', {skip:!available}, async t=>{
  const f=fixture(t);
  const initial=await f.request('GET','/api/video-manager/shot-analysis-settings');
  assert.ok(initial.body.prompt); assert.equal(initial.body.prompt,initial.body.default_prompt);
  const saved=await f.request('POST','/api/video-manager/shot-analysis-settings',{prompt:'关注人物动作'});
  assert.equal(saved.body.prompt,'关注人物动作');
  const rejected=await f.request('POST','/api/video-manager/shot-analysis-settings',{prompt:'x'.repeat(16001)});
  assert.equal(rejected.status,400);
  assert.equal((await f.request('GET','/api/video-manager/shot-analysis-settings')).body.prompt,'关注人物动作');
});

test('single shot candidate pipeline stores timestamps and applies only confirmed fields', {skip:!available}, async t=>{
  const f=fixture(t), before=digest(f.source), base=`/api/video-manager/videos/${f.video.id}/shots/${f.shotId}`;
  const generated=await f.request('POST',`${base}/deep-analysis`);
  assert.equal(generated.status,200); const run=generated.body.run;
  assert.equal(run.status,'completed'); assert.equal(run.sample_times.length,9);
  assert.equal(run.candidate.subject,'人物'); assert.equal(run.candidate.quality_score,undefined);
  assert.equal(run.candidate.uncertainty,candidate.uncertainty);
  assert.equal(run.baseline.subject,'原始主体');
  assert.equal(run.audit.total_tokens,33);
  assert.equal(f.modelCalls.length,1); assert.equal(f.modelCalls[0].reasoningEffort,'medium');
  assert.equal(f.db.getVideoShots(f.video.id)[0].subject,'原始主体');
  assert.ok(f.service.getStoryboardPath(run.id));
  const list=await f.request('GET',`${base}/deep-analyses`); assert.equal(list.body.runs[0].id,run.id);
  const applied=await f.request('POST',`/api/video-manager/shot-analysis/${run.id}/apply`,{fields:['subject']});
  assert.equal(applied.status,200); assert.equal(applied.body.shot.subject,'人物');
  assert.equal(f.db.getVideoShots(f.video.id)[0].visual_description,'人工描述');
  assert.equal(digest(f.source),before);
});

test('candidate apply is rejected during whole-video analysis', {skip:!available}, async t=>{
  const f=fixture(t), url=`/api/video-manager/videos/${f.video.id}/shots/${f.shotId}`;
  const run=(await f.request('POST',`${url}/deep-analysis`)).body.run;
  let release; const gate=new Promise(resolve=>{release=resolve;});
  f.service.videoAiAnalyzer.analyzeVideo=async()=>{ await gate; return {success:true}; };
  const pending=f.request('POST',`/api/video-manager/videos/${f.video.id}/ai-analyze`);
  await new Promise(resolve=>setImmediate(resolve));
  const result=await f.request('POST',`/api/video-manager/shot-analysis/${run.id}/apply`,{fields:['subject']});
  assert.equal(result.status,409); assert.equal(f.db.getVideoShots(f.video.id)[0].subject,'原始主体');
  release(); await pending;
  assert.equal((await f.request('POST',`/api/video-manager/shot-analysis/${run.id}/apply`,{fields:['subject']})).status,200);
});

test('duplicate trigger rejected, errors preserve source and existing shot', {skip:!available}, async t=>{
  const f=fixture(t), before=digest(f.source);
  let release; const gate=new Promise(resolve=>{release=resolve;});
  const original=f.service.analyzer.analyze.bind(f.service.analyzer);
  f.service.analyzer.analyze=async options=>{await gate; return original(options);};
  const url=`/api/video-manager/videos/${f.video.id}/shots/${f.shotId}/deep-analysis`;
  const first=f.request('POST',url);
  // analyze reserves synchronously before first asynchronous media operation.
  await new Promise(resolve=>setTimeout(resolve,10));
  const second=await f.request('POST',url); assert.equal(second.status,409);
  release(); const done=await first; assert.equal(done.status,200);
  assert.equal(f.db.getVideoShots(f.video.id)[0].visual_description,'人工描述');
  assert.equal(digest(f.source),before);
});

test('running shot analysis uses the model settings captured at task start', {skip:!available}, async t=>{
  const f=fixture(t);
  let release; const gate=new Promise(resolve=>{release=resolve;});
  const original=f.service.analyzer.analyze.bind(f.service.analyzer);
  let called; const reached=new Promise(resolve=>{called=resolve;});
  f.service.analyzer.analyze=async options=>{called(); await gate; return original(options);};
  const request=f.service.analyze(f.video.id,f.shotId);
  await reached;
  f.service.videoAiAnalyzer.getAiSettings=()=>({mode:'dsh',provider:'different',model:'different',reasoning_effort:'high'});
  release(); const run=await request;
  assert.equal(run.audit.provider,'test-provider');
  assert.equal(run.audit.model,'test-model');
  assert.equal(f.modelCalls[0].reasoningEffort,'medium');
});

test('failed model response retains reported usage and sampled storyboard', {skip:!available}, async t=>{
  const f=fixture(t), before=digest(f.source);
  f.service.videoAiAnalyzer.llm.stream=async function* () {
    yield {type:'usage',usage:{inputTokens:22,outputTokens:7,totalTokens:29}};
    yield {type:'text-delta',text:'not-json'};
    yield {type:'finish',reason:{kind:'stop'}};
  };
  const url=`/api/video-manager/videos/${f.video.id}/shots/${f.shotId}`;
  assert.equal((await f.request('POST',`${url}/deep-analysis`)).status,400);
  const run=(await f.request('GET',`${url}/deep-analyses`)).body.runs[0];
  assert.equal(run.status,'failed'); assert.equal(run.audit.total_tokens,29);
  assert.equal(run.sample_times.length,9); assert.ok(f.service.getStoryboardPath(run.id));
  assert.equal(f.db.getVideoShots(f.video.id)[0].subject,'原始主体');
  assert.equal(digest(f.source),before);
});

test('failed AI call records a safe failure without changing existing shot or exposing provider text', {skip:!available}, async t=>{
  const f=fixture(t), before=digest(f.source);
  f.service.analyzer.analyze=async()=>{throw new Error('secret-provider-token');};
  const url=`/api/video-manager/videos/${f.video.id}/shots/${f.shotId}`;
  const result=await f.request('POST',`${url}/deep-analysis`);
  assert.equal(result.status,400); assert.doesNotMatch(JSON.stringify(result.body),/secret-provider-token/);
  const runs=(await f.request('GET',`${url}/deep-analyses`)).body.runs;
  assert.equal(runs[0].status,'failed'); assert.doesNotMatch(JSON.stringify(runs),/secret-provider-token/);
  assert.equal(f.db.getVideoShots(f.video.id)[0].subject,'原始主体');
  assert.equal(digest(f.source),before);
});
