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
    analyzeMusic:async(id,args)=>{calls.push(['analyze',id,args]);return {analysis_id:'ma_0123456789abcdef0123456789abcdef',status:'low_confidence',source:'measured',bpm:null,beats:[],beat_candidates:[1.1]};},
         getMusicAnalysis:id=>{calls.push(['analysis_detail',id]);return {analysis_id:'ma_0123456789abcdef0123456789abcdef',music_id:id,status:'low_confidence',beat_candidates:[1.1],user_confirmed_beats:[],style_tags:[],model_interpretation:{summary:'节奏渐进',tempo_hypotheses:[{bpm:100,confidence:'low'}],beat_time_hypotheses:[{source_seconds:2.1,approximate:true}],style_tags:['夜景慢剪']},model_interpretation_edits:{summary:'用户修订',style_tags:['夜景'],user_confirmed_model_beats:[2.1]}};},
     interpretMusicSpectrogram:(id,args)=>{calls.push(['spectrogram_interpretation',id,args]);return {analysis_id:args.analysisId,model_interpretation:{summary:'音乐逐步展开',rhythm_character:'中速稳定',energy_arc:'逐步增强',scene_suggestions:[],tempo_hypotheses:[],beat_time_hypotheses:[],style_tags:[],uncertainties:[]}};},
     saveMusicInterpretationEdits:(id,args)=>{calls.push(['interpretation_edits',id,args]);return {model_interpretation:{summary:'音乐逐步展开'},model_interpretation_edits:{...args.edits},model_interpretation_edits_provenance:{edited_at:'now'}};},

              confirmMusicBeats:(id,args)=>{calls.push(['confirm_beats',id,args]);return {analysis_id:args.analysisId,user_confirmed_beats:args.beats};},
    saveMusicStyleSuggestions:(id,args)=>{calls.push(['style_suggestions',id,args]);return {analysis_id:args.analysisId,style_tags:args.styleTags};},
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
  return {service,calls,request,defs,tool:name=>defs.find(d=>d.name===name)};
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

test('versioned music analysis detail and user-confirmed beat/style updates',async()=>{
  const f=fixture();
  const measured=await f.request('POST',`${base}/music/${MUSIC}/analyze`,{startSeconds:0,durationSeconds:6});
  assert.equal(measured.body.analysis.analysis_id,'ma_0123456789abcdef0123456789abcdef');
  const detail=await f.request('GET',`${base}/music/${MUSIC}/analysis`);
  assert.equal(detail.body.analysis.analysis_id,'ma_0123456789abcdef0123456789abcdef');
  assert.equal((await f.request('POST',`${base}/music/${MUSIC}/analysis/confirm-beats`,{analysis_id:detail.body.analysis.analysis_id,beats:[1.1],confirmed:false})).status,400);
  const confirmed=await f.request('POST',`${base}/music/${MUSIC}/analysis/confirm-beats`,{analysis_id:detail.body.analysis.analysis_id,beats:[1.1],confirmed:true});
  assert.equal(confirmed.body.analysis.user_confirmed_beats[0],1.1);
  assert.equal((await f.request('POST',`${base}/music/${MUSIC}/analysis/styles`,{analysis_id:detail.body.analysis.analysis_id,style_tags:['mountain landscape'],rationale:'风格适配建议',confirmed:false})).status,400);
  const saved=await f.request('POST',`${base}/music/${MUSIC}/analysis/styles`,{analysis_id:detail.body.analysis.analysis_id,style_tags:['mountain landscape'],rationale:'风格适配建议',confirmed:true});
  assert.equal(saved.body.analysis.style_tags[0],'mountain landscape');
  assert.deepEqual(f.calls.filter(call=>['confirm_beats','style_suggestions'].includes(call[0])).map(call=>call[0]),['confirm_beats','style_suggestions']);
});

test('spectrogram interpretation endpoint uses the selected analysis profile',async()=>{
  const f=fixture(),analysisId='ma_0123456789abcdef0123456789abcdef';
  const result=await f.request('POST',`${base}/music/${MUSIC}/interpret`,{analysis_id:analysisId});
  assert.equal(result.status,200);assert.equal(result.body.model_interpretation.summary,'音乐逐步展开');
  assert.deepEqual(f.calls.find(call=>call[0]==='spectrogram_interpretation'),['spectrogram_interpretation',MUSIC,{analysisId}]);
});

test('spectrogram interpretation edits require explicit confirmation',async()=>{
  const f=fixture(),analysisId='ma_0123456789abcdef0123456789abcdef',edits={summary:'人工修订',rhythm_character:'中速',energy_arc:'渐强',style_tags:['城市慢剪'],user_confirmed_model_beats:[2.4]};
  const url=`${base}/music/${MUSIC}/interpret/edits`;
  assert.equal((await f.request('PUT',url,{analysis_id:analysisId,edits,confirmed:false})).status,400);
  const result=await f.request('PUT',url,{analysis_id:analysisId,edits,confirmed:true});
  assert.equal(result.status,200);assert.deepEqual(result.body.model_interpretation_edits,edits);
  assert.deepEqual(f.calls.find(call=>call[0]==='interpretation_edits'),['interpretation_edits',MUSIC,{analysisId,edits}]);
});

test('multi-folder import tool uses selected parent and safe host service operation',async()=>{
  const f=fixture(),tool=f.tool('media_center_import_subfolders');
  const paths=['C:\\parent\\scene-a','C:\\parent\\scene-b'];
  const result=await tool.execute({parent_directory_path:'C:\\parent',directory_paths:paths,parent_folder_id:'folder_trip'});
  assert.equal(result.success,true);assert.equal(result.imported_count,3);
  assert.deepEqual(f.calls[0],['scan_subfolders',paths,'C:\\parent','folder_trip']);
  assert.equal(tool.parameters.properties.directory_paths.maxItems,50);
});

test('music analysis detail is bounded and user-only confirmation tools share the Host service',async()=>{
  const f=fixture(),detail=f.tool('media_center_edit_music_analysis_detail'),confirm=f.tool('media_center_edit_music_confirm_beats'),styles=f.tool('media_center_edit_music_set_styles'),interpret=f.tool('media_center_edit_music_spectrogram_interpret');
  const analysis=await detail.execute({music_id:MUSIC,limit:10});assert.equal(analysis.analysis.analysis_id,'ma_0123456789abcdef0123456789abcdef');
  assert.equal(analysis.analysis.model_interpretation.tempo_hypotheses[0].bpm,100);assert.deepEqual(analysis.analysis.model_interpretation.style_tags,['夜景慢剪']);
  assert.equal((await interpret.execute({music_id:MUSIC,analysis_id:analysis.analysis.analysis_id,confirmed:false})).success,false);
  const modelResult=await interpret.execute({music_id:MUSIC,analysis_id:analysis.analysis.analysis_id,confirmed:true});assert.equal(modelResult.success,true);assert.equal(modelResult.model_interpretation.summary,'音乐逐步展开');
  assert.deepEqual(analysis.analysis.model_interpretation_edits.user_confirmed_model_beats,[2.1]);assert.equal('transient_onsets' in analysis.analysis,false);
  assert.equal((await confirm.execute({music_id:MUSIC,analysis_id:analysis.analysis.analysis_id,beats:[1.1],confirmed:false})).success,false);
  assert.equal((await styles.execute({music_id:MUSIC,analysis_id:analysis.analysis.analysis_id,style_tags:['山地风光慢剪'],rationale:'依据音乐信号和视频需求',confirmed:false})).success,false);
  assert.equal((await confirm.execute({music_id:MUSIC,analysis_id:analysis.analysis.analysis_id,beats:[1.1],confirmed:true})).success,true);
  assert.equal((await styles.execute({music_id:MUSIC,analysis_id:analysis.analysis.analysis_id,style_tags:['山地风光慢剪'],rationale:'依据音乐信号和视频需求',confirmed:true})).success,true);
  assert.deepEqual(f.calls.filter(call=>['confirm_beats','style_suggestions'].includes(call[0])).map(call=>call[0]),['confirm_beats','style_suggestions']);
});

test('AI music recommendation is absent from plugin tools and API',async()=>{
  const f=fixture();
  assert.equal(f.tool('media_center_edit_music_recommend'),undefined);
  assert.equal((await f.request('POST',`${base}/music-recommendations`,{brief:{prompt:'旅行',duration:30},musicIds:[MUSIC]})).status,404);
  assert.equal(f.calls.length,0);
});

test('music measurement and search do not accept arbitrary source paths, and Jamendo key is not returned',async()=>{
  const f=fixture(), key='secret-client-id';
  const r=await f.request('POST',`${base}/music/${MUSIC}/analyze`,{startSeconds:2,durationSeconds:4,file_path:'forged'});
  assert.equal(r.body.analysis.source,'measured'); assert.deepEqual(f.calls[0],['analyze',MUSIC,{startSeconds:2,durationSeconds:4}]);
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
