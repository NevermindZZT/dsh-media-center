import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {VideoDatabase} from '../src/host/db/database.js';
import {EditingWorkflow} from '../src/host/edit/editing-workflow.js';
const exe=name=>process.platform==='win32'?path.join(os.homedir(),'.local','bin',`${name}.exe`):name;
const hasFfmpeg=spawnSync(exe('ffmpeg'),['-version'],{stdio:'ignore'}).status===0&&spawnSync(exe('ffprobe'),['-version'],{stdio:'ignore'}).status===0;
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-edit-asset-'));
 const audioPath=path.join(root,'music.wav'),videoPath=path.join(root,'video.mp4');
 assert.equal(spawnSync(exe('ffmpeg'),['-v','error','-f','lavfi','-i','sine=frequency=440:duration=5','-c:a','pcm_s16le','-n',audioPath],{stdio:'ignore'}).status,0);
 assert.equal(spawnSync(exe('ffmpeg'),['-v','error','-f','lavfi','-i','testsrc2=size=160x90:rate=30','-t','5','-c:v','mpeg4','-n',videoPath],{stdio:'ignore'}).status,0);
 const db=new VideoDatabase({workspaceRoot:root});t.after(()=>{db.db.close();fs.rmSync(root,{recursive:true,force:true});});
 const media={getBinaries:async()=>({ffmpeg:exe('ffmpeg'),ffprobe:exe('ffprobe')})};
 const workflow=new EditingWorkflow(db,media);
 const video=db.upsertVideo({file_path:videoPath,file_name:'video.mp4',duration:5,fps:30});
 const shot=db.upsertShots(video.id,[{start_time:0,end_time:3,subject:'山',visual_description:'已有分镜描述'}])[0];
 return {root,audioPath,videoPath,db,workflow,video,shot};
}
async function projectFixture(f){
 const music=(await f.workflow.catalog.importFile({file_path:f.audioPath,title:'synthetic'})).music;
 f.workflow.catalog.confirmPersonalUse(music.id,{confirmed:true,license_note:'测试声明'});
 const project={schema_version:1,title:'Agent 提案',rationale:'由 DSH 会话讨论后形成',usage:'个人分享',fps:{num:30,den:1},duration_frames:90,
  canvas:{width:1920,height:1080,aspect:'16:9'},tracks:{video:[{id:'clip_0',source:{id:f.video.id,duration_seconds:5},source_in_seconds:0,source_out_seconds:3,timeline_start_frame:0,timeline_end_frame:90,rationale:'引出场景',evidence:{shot_id:f.shot,purpose:'开场',beat_relation:'未确认'}}],
  music:[{id:'music_0',source:{id:music.id,duration_seconds:5},source_in_seconds:0,source_out_seconds:3,timeline_start_frame:0,timeline_end_frame:90,rights:{status:'unknown',scope:'个人分享',note:''},rationale:'由 Agent 选定'}]},
  evidence:{uncertainties:['瞬态非拍点，节奏仍需听审'],approval:'pending user confirmation'}};
 return {music,project};
}

test('Agent-authored project is validated, normalized to catalog IDs, and saved only by preview token',{skip:!hasFfmpeg},async t=>{
 const f=fixture(t),{music,project}=await projectFixture(f);
 const preview=f.workflow.previewProject(project);
 assert.match(preview.preview_id,/^preview_[a-f0-9]{32}$/);assert.equal(preview.project.tracks.video[0].source.id,f.video.id);
 assert.equal(preview.project.tracks.music[0].source.id,music.id);assert.equal(preview.project.tracks.music[0].rights.status,'confirmed');
 assert.equal(f.workflow.projects.list().length,0);
 assert.throws(()=>f.workflow.commitPreview({previewId:preview.preview_id,confirmed:false}),/明确确认/);
 const saved=f.workflow.commitPreview({previewId:preview.preview_id,confirmed:true});
 assert.equal(saved.success,true);assert.equal(saved.record.project.title,'Agent 提案');assert.equal(saved.record.project.tracks.video[0].source.path,undefined);
 assert.equal(f.workflow.projects.list().length,1);assert.throws(()=>f.workflow.commitPreview({previewId:preview.preview_id,confirmed:true}),/过期/);
});

test('project validation rejects arbitrary paths, forged assets, invalid shot bounds, and unconfirmed music',{skip:!hasFfmpeg},async t=>{
 const f=fixture(t),{project}=await projectFixture(f);
 const arbitrary=structuredClone(project);arbitrary.tracks.video[0].source.path=f.videoPath;
 assert.throws(()=>f.workflow.previewProject(arbitrary),/不能附带客户端路径/);
 const forged=structuredClone(project);forged.tracks.video[0].source.id='vid_not_in_catalog';
 assert.throws(()=>f.workflow.previewProject(forged),/所引用的视频素材不存在/);
 const bounds=structuredClone(project);bounds.tracks.video[0].source_in_seconds=2;bounds.tracks.video[0].source_out_seconds=5;
 assert.throws(()=>f.workflow.previewProject(bounds),/超出已选择分镜范围/);
 f.workflow.catalog.remove(project.tracks.music[0].source.id);
 const unknown=(await f.workflow.catalog.importFile({file_path:f.audioPath,title:'unconfirmed'})).music;
 const unauthorized=structuredClone(project);unauthorized.tracks.music[0].source.id=unknown.id;
 await assert.rejects(async()=>f.workflow.previewProject(unauthorized),/尚未由用户声明/);
});

test('source or shot annotation changes between project preview and save invalidate the preview',{skip:!hasFfmpeg},async t=>{
 const f=fixture(t),{project}=await projectFixture(f);
 const preview=f.workflow.previewProject(project);
 f.db.db.prepare('UPDATE video_shots SET visual_description=? WHERE id=?').run('changed',f.shot);
 assert.throws(()=>f.workflow.commitPreview({previewId:preview.preview_id,confirmed:true}),/分镜描述已修改/);
 assert.equal(f.workflow.projects.list().length,0);
 const fresh=f.workflow.previewProject({...project,tracks:{...project.tracks,video:project.tracks.video.map(c=>({...c,evidence:{...c.evidence}}))}});
 const later=new Date(Date.now()+10000);fs.utimesSync(f.audioPath,later,later);
 assert.throws(()=>f.workflow.commitPreview({previewId:fresh.preview_id,confirmed:true}),/音乐源文件已变化/);
 assert.equal(f.workflow.projects.list().length,0);
});

test('source is preflighted, analyzed read-only, and result disclaims content hashing',{skip:!hasFfmpeg},async t=>{
 const f=fixture(t),{music,project}=await projectFixture(f);
 const before=fs.readFileSync(f.audioPath);
 const result=await f.workflow.analyzeMusic(music.id,{startSeconds:0,durationSeconds:5});
 assert.equal(result.status,'low_confidence');assert.equal('onsets' in result,false);assert.equal('transient_onsets' in result,false);assert.deepEqual(result.beats,[]);assert.ok(result.analysis_id);
 assert.match(result.source_check.note,/非密码学内容校验/);assert.deepEqual(fs.readFileSync(f.audioPath),before);
 const preview=f.workflow.previewProject(project);
 const later=new Date(Date.now()+10000);fs.utimesSync(f.audioPath,later,later);
 assert.throws(()=>f.workflow.commitPreview({previewId:preview.preview_id,confirmed:true}),/音乐源文件已变化/);
});
