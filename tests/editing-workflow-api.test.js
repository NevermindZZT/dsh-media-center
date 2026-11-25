import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createMediaCenterApiHandler } from '../src/host/api/router.js';
import { registerMediaCenterTools } from '../src/host/tools/register-tools.js';
import { apply } from '../index.js';
import { EditingWorkflow } from '../src/host/edit/editing-workflow.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MUSIC='mus_0123456789abcdef0123456789abcdef';
const PROJECT='edit_0123456789abcdef0123456789abcdef';
const PREVIEW='preview_0123456789abcdef0123456789abcdef';
function fixture() {
  const calls=[];
  const service={
    catalog:{
      list:args=>{calls.push(['list',args]);return {items:[{id:MUSIC,license_status:'unknown'}],limit:args.limit,offset:args.offset,has_more:false};},
      importFile:async args=>{calls.push(['import',args]);return {music:{id:MUSIC,file_path:args.file_path},created:true};},
      remove:id=>{calls.push(['remove',id]);return true;},
      confirmPersonalUse:(id,args)=>{calls.push(['confirm',id,args]);return {id,license_status:'personal_confirmed'};}
    },
    listMusicCatalog:args=>({items:[{id:MUSIC,license_status:'unknown',analysis_summary:{status:'not_analyzed'}}],limit:args.limit,offset:args.offset,has_more:false}),
    removeMusic:id=>{calls.push(['remove',id]);return true;},
    projects:{list:args=>{calls.push(['projects',args]);return [{id:PROJECT,title:'x'}];},get:id=>{calls.push(['get',id]);return id===PROJECT?{id,project:{title:'x'}}:null;}},
    analyzeMusic:async(id,args)=>{calls.push(['analyze',id,args]);return {analysis_id:'ma_0123456789abcdef0123456789abcdef',status:'ok',method:'spectral-flux-autocorr-v2',bpm:120,bpm_confidence:0.8,tempo_candidates:[{bpm:120,confidence:0.8}],analysis_window:{start_seconds:0,duration_seconds:10},meter:{beats_per_bar:4,confidence:0.7,first_downbeat:0.1},beats:{subdivision:4,times:[0.1,0.6],strengths:[1,0.5],quarter_times:[0.1,0.225,0.35,0.475],quarter_strengths:[1,0.5,0.4,0.3],downbeats:[0.1]},sections:[{id:'sec_1',start:0,end:10,label:'稳定中速',energy:'medium',onset_density:2,bpm:120,confidence:0.8}],cut_candidates:[{time:0.1,type:'downbeat',score:0.9,section_id:'sec_1'}]};},
    getMusicAnalysis:id=>{calls.push(['analysis_detail',id]);return {analysis_id:'ma_0123456789abcdef0123456789abcdef',music_id:id,status:'ok',method:'spectral-flux-autocorr-v2',bpm:120,bpm_confidence:0.8,tempo_candidates:[{bpm:120,confidence:0.8}],analysis_window:{start_seconds:0,duration_seconds:10},meter:{beats_per_bar:4,confidence:0.7,first_downbeat:0.1},beats:{subdivision:4,times:[0.1,0.6],strengths:[1,0.5],quarter_times:[0.1,0.225,0.35,0.475],quarter_strengths:[1,0.5,0.4,0.3],downbeats:[0.1]},sections:[{id:'sec_1',start:0,end:10,label:'稳定中速',energy:'medium',onset_density:2,bpm:120,confidence:0.8}],cut_candidates:[{time:0.1,type:'downbeat',score:0.9,section_id:'sec_1'}],feature_meta:{fps:20,bands:64,columns:2,waveform_buckets:2}};},
    getMusicFeatures:(id,aid)=>{calls.push(['features',id,aid]);return {data:Buffer.from([0,1,2,3,4,5,6,7]),waveform:Buffer.from([0,1,2,3]),meta:{fps:20,bands:4,columns:2,waveform_buckets:2}};},
    searchJamendo:async args=>{calls.push(['jamendo',args]);return {items:[{source:'jamendo',rights_status:'unverified'}],has_more:false};},
    previewProject:input=>{const project=input?.project??input;if(project?.schema_version!==1)throw new Error('invalid project');calls.push(['preview_project',project]);return {success:true,preview_id:PREVIEW,project:{...project,title:'canonical'}};},
    commitPreview:args=>{calls.push(['commit',args]);return {success:true,record:{id:PROJECT}};}
  };
  const handler=createMediaCenterApiHandler({db:{},mediaEngine:{},editingWorkflow:service});
  const request=(method,url,body,headers={})=>new Promise((resolve,reject)=>{
    const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]); req.method=method;req.url=url;req.headers=headers;
    const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(buffer){try{resolve({status:this.status,body:buffer?JSON.parse(buffer.toString()):null});}catch(e){reject(e);}}};
    Promise.resolve(handler(req,res)).catch(reject);
  });
  const mediaEngine={scanAndImportDirectories:async(paths,parentPath,parentId)=>{calls.push(['scan_subfolders',paths,parentPath,parentId]);return {scanned_count:paths.length,imported_count:3,failed_count:0,folders:[]};}};
  const defs=[];registerMediaCenterTools({tools:{register:def=>{defs.push(def);return()=>{};}}},{editingWorkflow:service,mediaEngine});
  return {service,calls,request,handler,defs,tool:name=>defs.find(d=>d.name===name)};
}
const base='/api/media-center/editing';

test('music CRUD and license confirmation use the shared catalog and reject unconfirmed assertions',async()=>{
  const f=fixture();
  let r=await f.request('POST',`${base}/music`,{file_path:'C:\\music\\a.wav',license_status:'personal_confirmed'});
  assert.equal(r.status,400); assert.equal(f.calls.length,0);
  r=await f.request('POST',`${base}/music`,{file_path:'C:\\music\\a.wav',license_status:'personal_confirmed',license_confirmed:true});
  assert.equal(r.status,200); assert.equal(f.calls[0][1].license_confirmed,true);
  assert.equal((await f.request('POST',`${base}/music/${MUSIC}/confirm-personal`,{confirmed:false})).status,400);
  assert.equal(f.calls.filter(x=>x[0]==='confirm').length,0);
  assert.equal((await f.request('POST',`${base}/music/${MUSIC}/confirm-personal`,{confirmed:true})).status,200);
  assert.equal((await f.request('GET',`${base}/music?limit=1&offset=0`)).body.items[0].id,MUSIC);
  assert.equal((await f.request('DELETE',`${base}/music/${MUSIC}`)).body.removed,true);
});

test('music analysis returns v2 sections, beats and cut candidates',async()=>{
  const f=fixture();
  const measured=await f.request('POST',`${base}/music/${MUSIC}/analyze`,{durationSeconds:6});
  assert.equal(measured.body.analysis.analysis_id,'ma_0123456789abcdef0123456789abcdef');
  assert.equal(measured.body.analysis.beats.quarter_times.length,4);
  assert.equal(measured.body.analysis.sections[0].label,'稳定中速');
  const detail=await f.request('GET',`${base}/music/${MUSIC}/analysis`);
  assert.equal(detail.body.analysis.cut_candidates[0].type,'downbeat');
  assert.equal(f.calls.find(call=>call[0]==='analyze')[2].durationSeconds,6);
});

test('music feature raster is served as binary data with metadata headers',async()=>{
  const f=fixture();
  const result=await new Promise((resolve,reject)=>{
    const req=Readable.from([]);req.method='GET';req.url=`${base}/music/${MUSIC}/analysis/features?analysis_id=ma_0123456789abcdef0123456789abcdef`;req.headers={};
    const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(buffer){resolve({status:this.status,headers:this.headers,body:buffer});}};
    Promise.resolve(f.handler(req,res)).catch(reject);
  });
  assert.equal(result.status,200);assert.equal(result.headers['Content-Type'],'application/octet-stream');
  assert.equal(result.headers['X-Feature-Columns'],'2');assert.equal(result.body.length,12);
  assert.deepEqual(f.calls.find(call=>call[0]==='features'),['features',MUSIC,'ma_0123456789abcdef0123456789abcdef']);
});

test('multi-folder import tool uses selected parent and safe host service operation',async()=>{
  const f=fixture(),tool=f.tool('media_center_import_subfolders');
  const paths=['C:\\parent\\scene-a','C:\\parent\\scene-b'];
  const result=await tool.execute({parent_directory_path:'C:\\parent',directory_paths:paths,parent_folder_id:'folder_trip'});
  assert.equal(result.success,true);assert.equal(result.imported_count,3);
  assert.deepEqual(f.calls[0],['scan_subfolders',paths,'C:\\parent','folder_trip']);
  assert.equal(tool.parameters.properties.directory_paths.maxItems,50);
});

test('music analysis detail tool returns bounded v2 structure',async()=>{
  const f=fixture(),detail=f.tool('media_center_edit_music_analysis_detail');
  const analysis=await detail.execute({music_id:MUSIC,limit:1});
  assert.equal(analysis.analysis.bpm,120);
  assert.equal(analysis.analysis.beats.quarter_times.length,1);
  assert.equal(analysis.analysis.cut_candidates.length,1);
  assert.equal(f.tool('media_center_edit_music_confirm_beats'),undefined);
  assert.equal(f.tool('media_center_edit_music_spectrogram_interpret'),undefined);
  assert.equal(f.tool('media_center_edit_music_set_styles'),undefined);
});

test('AI music recommendation is absent from plugin tools and API',async()=>{
  const f=fixture();
  assert.equal(f.tool('media_center_edit_music_recommend'),undefined);
  assert.equal((await f.request('POST',`${base}/music-recommendations`,{brief:{prompt:'旅行',duration:30},musicIds:[MUSIC]})).status,404);
  assert.equal(f.calls.length,0);
});

test('music measurement and search do not accept arbitrary source paths, and Jamendo key is not returned',async()=>{
  const f=fixture(), key='secret-client-id';
  const r=await f.request('POST',`${base}/music/${MUSIC}/analyze`,{durationSeconds:4,file_path:'forged'});
  assert.equal(r.body.analysis.method,'spectral-flux-autocorr-v2'); assert.deepEqual(f.calls[0],['analyze',MUSIC,{durationSeconds:4}]);
  const search=await f.request('POST',`${base}/jamendo/search`,{clientId:key,query:'travel'});
  assert.equal(search.status,200); assert.doesNotMatch(JSON.stringify(search.body),/secret-client-id/);
  f.service.searchJamendo=async()=>({items:[{title:key}]});
  const echoed=await f.request('POST',`${base}/jamendo/search`,{clientId:key,query:'travel'});
  assert.equal(echoed.status,400); assert.doesNotMatch(JSON.stringify(echoed.body),/secret-client-id/);
  f.service.searchJamendo=async()=>{throw new Error('provider exposed '+key);};
  assert.doesNotMatch(JSON.stringify((await f.request('POST',`${base}/jamendo/search`,{clientId:key,query:'travel'})).body),/secret-client-id/);
});

test('structured project preview is ephemeral and commit requires explicit confirmation',async()=>{
  const f=fixture();
  const project={schema_version:1,title:'旅行',rationale:'Agent 计划',fps:{num:30,den:1},duration_frames:30,tracks:{video:[{id:'c1',source:{id:'vid_a',duration_seconds:10},source_in_seconds:0,source_out_seconds:1,timeline_start_frame:0,timeline_end_frame:30,evidence:{shot_id:'shot_a'}}],music:[{id:'m0',source:{id:MUSIC,duration_seconds:5},source_in_seconds:0,source_out_seconds:1,timeline_start_frame:0,timeline_end_frame:30,rights:{status:'confirmed',scope:'个人分享',note:'用户声明'}}]}};
  let r=await f.request('POST',`${base}/projects/preview`,{project,source_path:'forged'});
  assert.equal(r.status,200); assert.equal(r.body.preview_id,PREVIEW); assert.equal(r.body.project.title,'canonical');
  assert.deepEqual(f.calls[0],['preview_project',project]);
  r=await f.request('POST',`${base}/projects/commit`,{preview_id:PREVIEW,confirmed:false}); assert.equal(r.status,400);
  assert.equal(f.calls.filter(x=>x[0]==='commit').length,0);
  r=await f.request('POST',`${base}/projects/commit`,{preview_id:PREVIEW,confirmed:true,project:{title:'forged'}});
  assert.equal(r.status,200); assert.deepEqual(f.calls.at(-1),['commit',{previewId:PREVIEW,confirmed:true}]);
  assert.equal((await f.request('GET',`${base}/projects`)).body.projects[0].id,PROJECT);
  assert.equal((await f.request('GET',`${base}/projects/${PROJECT}`)).body.project.id,PROJECT);
  assert.equal((await f.request('POST',`${base}/projects/preview`,{project:{schema_version:9}})).status,400);
});

test('origin protection and input failures do not disclose internal exception details',async()=>{
  const f=fixture();
  const blocked=await f.request('POST',`${base}/music`,{file_path:'x'},{host:'localhost:3080',origin:'https://outside.invalid'});
  assert.equal(blocked.status,403); assert.equal(f.calls.length,0);
  f.service.listMusicCatalog=()=>{throw new Error('private secret /home/file');};
  const result=await f.request('GET',`${base}/music`);
  assert.equal(result.status,400);assert.doesNotMatch(JSON.stringify(result.body),/private|secret|home/);
});

test('tools preview an Agent-created project and save only after explicit confirmation',async()=>{
  const f=fixture();
  const confirm=f.tool('media_center_edit_music_confirm_personal');
  const save=f.tool('media_center_edit_save_project');
  const previewTool=f.tool('media_center_edit_preview_project');
  const project={schema_version:1,title:'旅行',rationale:'由当前会话 Agent 编排',fps:{num:30,den:1},duration_frames:30,canvas:{width:1920,height:1080,aspect:'16:9'},tracks:{video:[{id:'clip1',source:{id:'vid_a',duration_seconds:10},source_in_seconds:0,source_out_seconds:1,timeline_start_frame:0,timeline_end_frame:30,evidence:{shot_id:'shot_a'}}],music:[{id:'m0',source:{id:MUSIC,duration_seconds:5},source_in_seconds:0,source_out_seconds:1,timeline_start_frame:0,timeline_end_frame:30,rights:{status:'confirmed',scope:'个人分享',note:'用户声明'}}]}};
  assert.equal((await confirm.execute({music_id:MUSIC,confirmed:false})).success,false);
  assert.equal((await save.execute({preview_id:PREVIEW,confirmed:false})).success,false);
  assert.equal(f.calls.length,0);
  assert.equal(f.tool('media_center_edit_music_recommend'),undefined);
  assert.equal(f.tool('media_center_edit_preview'),undefined);
  assert.equal(f.tool('media_center_edit_save'),undefined);
  const preview=await previewTool.execute({project});
  assert.equal(preview.success,true);
  assert.deepEqual(f.calls[0],['preview_project',project]);
  assert.equal(previewTool.parameters.properties.project.type,'object');
  const schema=previewTool.parameters.properties.project;
  const videoSource=schema.properties.tracks.properties.video.items.properties.source;
  assert.equal(videoSource.properties.path,undefined);assert.equal(videoSource.additionalProperties,false);
  assert.equal(schema.properties.tracks.properties.music.minItems,1);assert.equal(schema.properties.tracks.properties.music.maxItems,1);
  assert.ok(schema.properties.tracks.properties.music.items.required.includes('rights'));
  assert.match(previewTool.description,/不调用模型/);
  const compose=f.tool('media_center_edit_compose_project');
  assert.ok(compose);
  assert.deepEqual(compose.parameters.required,['title','rationale','shot_refs','music_id']);
  assert.equal(compose.parameters.properties.shot_refs.items.properties.shot_id.type,'string');
  await save.execute({preview_id:PREVIEW,confirmed:true});
  assert.deepEqual(f.calls.at(-1),['commit',{previewId:PREVIEW,confirmed:true}]);
  assert.ok(f.defs.every(d=>d.parameters.additionalProperties===false));
});

test('plugin entry binds save to the exact server-held project preview',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'edit-host-test-'));
  const previous=process.cwd(), originalPreview=EditingWorkflow.prototype.previewProject, originalCommit=EditingWorkflow.prototype.commitPreview;
  let saved, dispose; const defs=[], previews=new Map();
  EditingWorkflow.prototype.previewProject=function(project){const id=PREVIEW;previews.set(id,structuredClone(project));return {success:true,preview_id:id,project:structuredClone(project)};};
  EditingWorkflow.prototype.commitPreview=function({previewId,confirmed}){if(confirmed!==true||!previews.has(previewId))return {success:false};saved=structuredClone(previews.get(previewId));previews.delete(previewId);return {success:true,record:{id:PROJECT}};};
  t.after(()=>{ EditingWorkflow.prototype.previewProject=originalPreview;EditingWorkflow.prototype.commitPreview=originalCommit;process.chdir(previous);dispose?.(); });
  process.chdir(root);
  apply({llm:{},attachments:{},webServer:{register:()=>()=>{}},tools:{register:d=>{defs.push(d);return()=>{};}},effect:fn=>{dispose=fn();}},{});
  const project={schema_version:1,title:'trusted',rationale:'Agent authored',fps:{num:30,den:1},duration_frames:30,tracks:{video:[{id:'clip1',source:{id:'vid_a',duration_seconds:10},source_in_seconds:0,source_out_seconds:1,timeline_start_frame:0,timeline_end_frame:30,evidence:{shot_id:'shot_a'}}],music:[{id:'m0',source:{id:MUSIC,duration_seconds:5},source_in_seconds:0,source_out_seconds:1,timeline_start_frame:0,timeline_end_frame:30,rights:{status:'confirmed',scope:'个人分享',note:'用户声明'}}]}};
  const preview=defs.find(d=>d.name==='media_center_edit_preview_project');
  const save=defs.find(d=>d.name==='media_center_edit_save_project');
  const result=await preview.execute({project}); assert.equal(result.success,true); assert.equal(result.preview_id,PREVIEW);
  result.project.title='tampered';
  const denied=await save.execute({preview_id:PREVIEW,confirmed:false});assert.equal(denied.success,false);assert.equal(saved,undefined);
  const committed=await save.execute({preview_id:PREVIEW,confirmed:true});
  assert.equal(committed.success,true);assert.deepEqual(saved,project);
  assert.equal(await save.execute({preview_id:PREVIEW,confirmed:true}).then(r=>r.success),false);
});

test('structured project validation errors are passed through to HTTP and Agent tools',async()=>{
  const f=fixture();
  f.service.previewProject=()=>{
    const error=new Error('剪辑项目校验失败');
    error.name='ProjectValidationError';error.code='PROJECT_VALIDATION_FAILED';
    error.errors=[{code:'TRACK_GAP',path:'$.tracks.video[1]',message:'timeline gap'}];
    error.warnings=[];
    throw error;
  };
  const response=await f.request('POST',`${base}/projects/preview`,{project:{schema_version:1}});
  assert.equal(response.status,400);
  assert.equal(response.body.error.code,'PROJECT_VALIDATION_FAILED');
  assert.equal(response.body.error.errors[0].path,'$.tracks.video[1]');
  const tool=f.tool('media_center_edit_preview_project');
  const result=await tool.execute({project:{schema_version:1}});
  assert.equal(result.success,false);
  assert.equal(result.errors[0].code,'TRACK_GAP');
});

test('Jamendo tool never accepts or exposes client ID in schema or result',async()=>{
  const f=fixture(), old=process.env.JAMENDO_CLIENT_ID;process.env.JAMENDO_CLIENT_ID='secret-jamendo';
  try {
    const tool=f.tool('media_center_edit_jamendo_search');
    assert.equal(tool.parameters.properties.clientId,undefined);
    const result=await tool.execute({query:'travel'},{signal:undefined});
    assert.equal(result.success,true); assert.doesNotMatch(JSON.stringify(result),/secret-jamendo/);
    f.service.searchJamendo=async()=>{throw new Error('secret-jamendo');};
    assert.doesNotMatch(JSON.stringify(await tool.execute({query:'travel'},{})),/secret-jamendo/);
  } finally { if(old===undefined) delete process.env.JAMENDO_CLIENT_ID;else process.env.JAMENDO_CLIENT_ID=old; }
});
