import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {DatabaseSync} from 'node:sqlite';
import {VideoDatabase} from '../src/host/db/database.js';
import {MediaEngine} from '../src/host/media/engine.js';
import {createMediaCenterApiHandler} from '../src/host/api/router.js';

function deferred(){
  let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};
}
function fixture(t,{blockStoryboards=false}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-import-jobs-'));
  const sourceDir=path.join(root,'media');fs.mkdirSync(sourceDir,{recursive:true});
  const files=[path.join(sourceDir,'a.mp4'),path.join(sourceDir,'b.mov')];
  for(const [index,file] of files.entries())fs.writeFileSync(file,`source-${index}-bytes`);
  const originals=files.map(file=>fs.readFileSync(file));
  const db=new VideoDatabase({workspaceRoot:root});
  const engine=new MediaEngine(db);
  const gates=[];let pendingGate=blockStoryboards?deferred():null;
  engine.probeVideo=async filePath=>({file_path:filePath,file_name:path.basename(filePath),file_size:fs.statSync(filePath).size,duration:3,width:320,height:180,fps:30,codec:'TEST',bitrate:0,audio_channels:0,sample_rate:0,captured_at:null,captured_at_source:'unknown'});
  engine.generateStoryboard=async video=>{
    const gate=engine.__gate;
    if(gate)await gate.promise;
    const record=db.getVideoImportRecord(video.id);
    if(!record)return null;
    const output=path.join(db.storyboardsDir,`${video.id}_stub.jpg`);
    fs.writeFileSync(output,Buffer.from([0xff,0xd8,0xff,0xff,0xd9]));
    db.setVideoStoryboard(video.id,record.file_path,output);
    return output;
  };
  engine.__setGate=gate=>{engine.__gate=gate;};
  if(pendingGate)engine.__setGate(pendingGate);
  t.after(()=>{db.db.close();fs.rmSync(root,{recursive:true,force:true});});
  return {root,sourceDir,files,originals,db,engine,gates,get gate(){return engine.__gate;},setGate:gate=>engine.__setGate(gate)};
}
function request(handler,method,url,body){
  return new Promise((resolve,reject)=>{
    const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);req.method=method;req.url=url;req.headers={};
    const res={writeHead(status){this.status=status;},end(buffer){try{resolve({status:this.status,body:buffer?JSON.parse(buffer.toString()):null});}catch(error){reject(error);}}};
    Promise.resolve(handler(req,res)).catch(reject);
  });
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,{timeout=2000}={}){
  const started=Date.now();
  while(Date.now()-started<timeout){const value=await fn();if(value)return value;await sleep(5);}
  throw new Error('condition timed out');
}

test('import POST returns a queued pollable job, inserts rows before storyboards finish, and exposes storyboard lifecycle',async t=>{
  const gate=deferred(),f=fixture(t),handler=createMediaCenterApiHandler({db:f.db,mediaEngine:f.engine});
  f.setGate(gate);
  const response=await request(handler,'POST','/api/media-center/videos/import-files',{file_paths:f.files});
  assert.equal(response.status,200);assert.ok(response.body.job?.id);assert.equal(response.body.job.status,'queued');assert.equal(response.body.job.total_known,false);
  assert.equal(response.body.job.total,0);assert.equal(response.body.job.percent,null);assert.equal(response.body.job.requested_count,2);assert.equal(response.body.job.importable,null);
  const jobId=response.body.job.id;
  const importing=await until(async()=>{const r=await request(handler,'GET',`/api/media-center/import-jobs/${jobId}`);return r.body.job.inserted===2?r.body.job:null;});
  assert.equal(importing.status,'storyboarding');
  const listed=await request(handler,'GET','/api/media-center/videos?limit=20');
  assert.equal(listed.body.videos.length,2);
  assert.ok(listed.body.videos.every(video=>video.status==='imported'&&['pending','generating'].includes(video.storyboard_status)));
  assert.equal(listed.body.videos.some(video=>video.source_identity_json),false);
  gate.resolve();
  const final=await f.engine.waitForImportJob(jobId);
  assert.equal(final.status,'completed');assert.equal(final.inserted,2);assert.equal(final.storyboard_done,2);
  const ready=await request(handler,'GET','/api/media-center/videos?limit=20');
  assert.ok(ready.body.videos.every(video=>video.storyboard_status==='ready'));
  assert.deepEqual(f.files.map(file=>fs.readFileSync(file)),f.originals);
});

test('deduplicates repeated paths and realpath-equivalent files within and across requests',async t=>{
  const f=fixture(t),manager=f.engine.importJobManager;
  const first=manager.start({kind:'files',file_paths:[f.files[0],f.files[1]]});
  const firstFinal=await f.engine.waitForImportJob(first.job.id);
  assert.equal(firstFinal.inserted,2);assert.equal(firstFinal.duplicates,0);assert.equal(firstFinal.importable,2);
  const lexicalVariant=path.join(f.sourceDir,'nested','..','a.mp4');
  const second=manager.start({kind:'files',file_paths:[f.files[0],lexicalVariant]});
  const secondFinal=await f.engine.waitForImportJob(second.job.id);
  assert.equal(secondFinal.inserted,0);assert.equal(secondFinal.duplicates,1);assert.equal(secondFinal.input_duplicates,1);assert.equal(secondFinal.importable,0);
  assert.equal(f.db.queryVideos({query:'',limit:20}).length,2);
});

test('concurrent identical requests share one in-flight job',async t=>{
  const gate=deferred(),f=fixture(t);
  f.setGate(gate);
  const one=f.engine.startImportJob({kind:'files',file_paths:f.files});
  const two=f.engine.startImportJob({kind:'files',file_paths:[...f.files].reverse()});
  assert.equal(one.job.id,two.job.id);assert.equal(two.merged,true);
  await until(async()=>f.engine.getImportJob(one.job.id)?.inserted===2);
  gate.resolve();
  const final=await f.engine.waitForImportJob(one.job.id);
  assert.equal(final.completed,2);
});

test('deleting a video during an active import does not recreate its row',async t=>{
  const gate=deferred(),f=fixture(t);
  f.setGate(gate);
  const {job}=f.engine.startImportJob({kind:'files',file_paths:[f.files[0]]});
  const inserted=await until(async()=>f.db.queryVideos({query:'',limit:10})[0]);
  f.engine.cancelImportForVideo(inserted.id);f.db.deleteVideo(inserted.id);
  gate.resolve();
  const final=await f.engine.waitForImportJob(job.id);
  assert.equal(f.db.getVideoById(inserted.id),null);
  assert.ok(['completed','completed_with_errors','failed'].includes(final.status));
  assert.equal(final.items[0].status,'cancelled');assert.equal(final.items[0].error_code,'VIDEO_REMOVED_DURING_IMPORT');
});

test('legacy import methods keep their result shape and do not touch source bytes',async t=>{
  const f=fixture(t);
  const result=await f.engine.importFiles(f.files);
  assert.equal(result.imported_count,2);assert.equal(result.duplicates_count,0);assert.equal(result.videos.length,2);assert.ok(result.videos.every(video=>video.status==='imported'));
  const again=await f.engine.importFiles(f.files);
  assert.equal(again.imported_count,0);assert.equal(again.duplicates_count,2);
  assert.deepEqual(f.files.map(file=>fs.readFileSync(file)),f.originals);
});

test('invalid and unsupported inputs are per-item failures and never leak absolute paths',async t=>{
  const f=fixture(t),missing=path.join(f.sourceDir,'missing.mp4'),unsupported=path.join(f.sourceDir,'notes.txt');
  fs.writeFileSync(unsupported,'not a video');
  const {job}=f.engine.startImportJob({kind:'files',file_paths:[missing,unsupported]});
  const final=await f.engine.waitForImportJob(job.id);
  assert.equal(final.inserted,0);assert.equal(final.completed,2);assert.equal(final.failed,2);
  assert.deepEqual(final.items.map(item=>item.error_code).sort(),['SOURCE_UNAVAILABLE','UNSUPPORTED_FILE_TYPE']);
  assert.equal(JSON.stringify(final).includes(f.root),false);
});

test('startup recovery retries pending/generating and missing storyboard files but leaves legacy not_started rows alone',async t=>{
  const f=fixture(t);
  const pending=f.db.upsertVideo({file_path:f.files[0],file_name:'a.mp4',status:'imported',storyboard_status:'pending'});
  const generating=f.db.upsertVideo({file_path:f.files[1],file_name:'b.mov',status:'imported',storyboard_status:'generating'});
  const legacyFile=path.join(f.sourceDir,'legacy.mp4');fs.writeFileSync(legacyFile,'legacy');
  const legacy=f.db.upsertVideo({file_path:legacyFile,file_name:'legacy.mp4',status:'imported'});
  assert.equal(legacy.storyboard_status,'not_started');
  const missing=f.db.upsertVideo({file_path:path.join(f.sourceDir,'cached.mp4'),file_name:'cached.mp4',status:'imported',storyboard_path:path.join(f.db.storyboardsDir,'missing.jpg'),storyboard_status:'ready'});
  fs.writeFileSync(missing.file_path,'cached');
  const calls=[];
  f.engine.generateStoryboard=async video=>{calls.push(video.id);const output=path.join(f.db.storyboardsDir,`${video.id}_recovered.jpg`);fs.writeFileSync(output,Buffer.from([0xff,0xd8,0xff,0xd9]));f.db.setVideoStoryboard(video.id,video.file_path,output);return output;};
  await f.engine.recoverPendingStoryboards();
  assert.deepEqual(calls.sort(),[pending.id,generating.id,missing.id].sort());
  assert.equal(f.db.getVideoImportRecord(missing.id).storyboard_status,'ready');
  assert.equal(f.db.getVideoImportRecord(pending.id).storyboard_status,'ready');
  assert.equal(f.db.getVideoImportRecord(generating.id).storyboard_status,'ready');
  assert.equal(f.db.getVideoImportRecord(legacy.id).storyboard_status,'not_started');
});

test('storyboard state updates only existing rows and insert-only upserts keep a stable shape',t=>{
  const f=fixture(t),source=f.files[0];
  const inserted=f.db.upsertVideo({file_path:source,file_name:'a.mp4',status:'imported'},{insertOnly:true});
  assert.equal(inserted.created,true);
  assert.equal(inserted.video.storyboard_status,'not_started');
  const duplicate=f.db.upsertVideo({file_path:source,file_name:'renamed.mp4',status:'analyzed'},{insertOnly:true});
  assert.equal(duplicate.created,false);assert.equal(duplicate.video.file_name,'a.mp4');assert.equal(duplicate.video.status,'imported');
  f.db.updateStoryboardState(inserted.video.id,'failed','STORYBOARD_FAILED',source);
  assert.equal(f.db.getVideoImportRecord(inserted.video.id).storyboard_status,'failed');
  const output=path.join(f.db.storyboardsDir,'a.jpg');
  assert.equal(f.db.setVideoStoryboard(inserted.video.id,source,output),true);
  const ready=f.db.getVideoImportRecord(inserted.video.id);
  assert.equal(ready.storyboard_status,'ready');assert.equal(ready.storyboard_error,null);assert.equal(ready.storyboard_path,output);
  f.db.deleteVideo(inserted.video.id);
  assert.equal(f.db.updateStoryboardState(inserted.video.id,'ready',null,source),false);
  assert.equal(f.db.setVideoStoryboard(inserted.video.id,source,output),false);
  assert.equal(f.db.getVideoById(inserted.video.id),null);
});


test('an active import job can be interrupted and resumed without touching source files',async t=>{
  const f=fixture(t);
  const {job}=f.engine.startImportJob({kind:'files',file_paths:f.files});
  const cancelled=f.engine.cancelImportJob(job.id);
  assert.equal(cancelled.cancel_requested,true);
  const final=await f.engine.waitForImportJob(job.id);
  assert.equal(final.status,'cancelled');
  const before=f.originals.map(buffer=>Buffer.from(buffer));
  const resumed=f.engine.startImportJob({kind:'files',file_paths:f.files});
  const completed=await f.engine.waitForImportJob(resumed.job.id);
  assert.equal(completed.status,'completed');assert.equal(completed.inserted,2);
  assert.deepEqual(f.originals,f.files.map(file=>fs.readFileSync(file)));
});

test('storyboard regeneration and browser preview detection expose safe states',async t=>{
  const f=fixture(t);
  const h264=path.join(f.sourceDir,'h264.mp4');fs.writeFileSync(h264,'h264');
  const hevc=path.join(f.sourceDir,'hevc.mp4');fs.writeFileSync(hevc,'hevc');
  const a=f.db.upsertVideo({file_path:h264,file_name:'h264.mp4',status:'imported',codec:'H264',duration:3});
  const b=f.db.upsertVideo({file_path:hevc,file_name:'hevc.mp4',status:'imported',codec:'HEVC',duration:3});
  assert.equal(f.engine.getPreviewInfo(a.id).status,'not_needed');
  const info=f.engine.getPreviewInfo(b.id);assert.equal(info.required,true);assert.ok(['missing','failed'].includes(info.status));
  assert.equal(f.engine.getPreviewPath(b.id),null);
  assert.equal(f.engine.regenerateStoryboard(b.id).status,'generating');
  await until(()=>f.db.getVideoImportRecord(b.id).storyboard_status==='ready');
  assert.ok(fs.existsSync(f.db.getVideoImportRecord(b.id).storyboard_path));
});


test('cache usage and one-click cleanup remove only derived files and reset storyboard refs',async t=>{
  const f=fixture(t);
  const source=f.files[0];
  const storyboard=path.join(f.db.storyboardsDir,'cache-test.jpg');fs.writeFileSync(storyboard,Buffer.from([0xff,0xd8,0xff,0xd9]));
  const preview=path.join(f.db.previewsDir,'vid_cache-test_h264.mp4');fs.writeFileSync(preview,'preview');
  const video=f.db.upsertVideo({file_path:source,file_name:'a.mp4',status:'imported',duration:3,storyboard_path:storyboard,storyboard_status:'ready'});
  const usage=await f.engine.getCacheUsage();assert.ok(usage.total>0);assert.ok(usage.storyboards>0);assert.ok(usage.previews>0);
  f.engine.clearCache('all');
  assert.equal(fs.existsSync(storyboard),false);assert.equal(fs.existsSync(preview),false);
  const record=f.db.getVideoImportRecord(video.id);assert.equal(record.storyboard_status,'not_started');assert.equal(record.storyboard_path,null);
});


test('system player endpoint only accepts a catalog video and reports failure safely',async t=>{
  const f=fixture(t),handler=createMediaCenterApiHandler({db:f.db,mediaEngine:f.engine});
  const video=f.db.upsertVideo({file_path:f.files[0],file_name:'a.mp4',status:'imported',duration:3});
  f.engine.openInSystemPlayer=id=>id===video.id;
  const opened=await request(handler,'POST',`/api/media-center/videos/${video.id}/open`);
  assert.equal(opened.status,200);assert.equal(opened.body.success,true);
  f.engine.openInSystemPlayer=()=>false;
  const missing=await request(handler,'POST','/api/media-center/videos/vid_missing/open');
  assert.equal(missing.status,404);assert.equal(missing.body.success,false);
});



test('legacy dsh-video-manager data is migrated to dsh-media-center with rewritten cache paths',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-media-center-migration-'));
  const first=new VideoDatabase({workspaceRoot:root});
  first.db.close();
  const legacyDir=path.join(root,'.dsh-video-manager');
  fs.renameSync(path.join(root,'.dsh-media-center'),legacyDir);
  fs.renameSync(path.join(legacyDir,'media_center.db'),path.join(legacyDir,'video_manager.db'));
  const source=path.join(root,'source.mp4');fs.writeFileSync(source,'source');
  const storyboard=path.join(legacyDir,'cache','storyboards','legacy.jpg');fs.writeFileSync(storyboard,Buffer.from([0xff,0xd8,0xff,0xd9]));
  const oldDb=new DatabaseSync(path.join(legacyDir,'video_manager.db'));
  oldDb.prepare('INSERT INTO videos (id,file_path,file_name,status,storyboard_path,storyboard_status) VALUES (?,?,?,?,?,?)').run('vid_legacy',source,'source.mp4','imported',storyboard,'ready');
  oldDb.close();
  const migrated=new VideoDatabase({workspaceRoot:root});
  t.after(()=>{migrated.db.close();fs.rmSync(root,{recursive:true,force:true});});
  const row=migrated.getVideoById('vid_legacy');
  assert.ok(row.storyboard_path.includes('.dsh-media-center'));
  assert.equal(fs.existsSync(row.storyboard_path),true);
  assert.equal(fs.existsSync(path.join(root,'.dsh-video-manager','video_manager.db')),true);
});
