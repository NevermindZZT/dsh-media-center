import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MusicCatalog } from '../music/music-catalog.js';
import { JamendoSearch } from '../music/jamendo.js';
import { analyzeMusicBeats } from '../music/beat-analysis.js';
import { EditProjectStore } from './edit-project-store.js';
import { validateEditProject } from './edit-project.js';

const execFileAsync=promisify(execFile);
const SOURCE_CHECK_NOTICE='仅比较 realpath 和文件系统属性；并非密码学内容校验。';
function sourceName(value){return typeof value==='string'&&value?path.basename(value).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,200):'未知文件';}
function statFingerprint(filePath,kind){
  try {
    if(typeof filePath!=='string'||!path.isAbsolute(filePath)) throw new Error();
    const canonical=fs.realpathSync(filePath),stat=fs.statSync(canonical,{bigint:true});
    if(!stat.isFile()) throw new Error(); fs.accessSync(canonical,fs.constants.R_OK);
    return {canonical,dev:String(stat.dev),ino:String(stat.ino),size:String(stat.size),mtimeNs:String(stat.mtimeNs)};
  } catch {throw new Error(`${kind}源文件不可用：${sourceName(filePath)}`);}
}
function sameFingerprint(a,b){return !!a&&!!b&&['canonical','dev','ino','size','mtimeNs'].every(k=>a[k]===b[k]);}

/** Asset and project service. The DSH conversation Agent authors project data; this service validates and stores it. */
export class EditingWorkflow {
  constructor(db,mediaEngine){
    this.db=db;this.mediaEngine=mediaEngine;
    this.catalog=new MusicCatalog(db,{probeAudio:async filePath=>{
      const {ffprobe}=await mediaEngine.getBinaries();if(!ffprobe)throw new Error('FFprobe unavailable');
      const {stdout}=await execFileAsync(ffprobe,['-v','error','-print_format','json','-show_format','-show_streams',filePath],{timeout:15000,maxBuffer:2*1024*1024,windowsHide:true});return JSON.parse(stdout);
    }});
    this.projects=new EditProjectStore(db);this.previews=new Map();
  }
  searchJamendo({clientId,query,limit,offset,signal}){return new JamendoSearch({clientId}).search({query,limit,offset,signal});}
  async analyzeMusic(id,{startSeconds=0,durationSeconds=60}={}){
    const music=this.catalog.get(id);if(!music)throw new Error('音乐记录不存在');
    if(music.source_status!=='current')throw new Error(`音乐源文件不可用或已变化：${sourceName(music.file_path)}`);
    const before=statFingerprint(music.file_path,'音乐'),bins=await this.mediaEngine.getBinaries();
    if(!bins.ffmpeg||!bins.ffprobe)return {status:'error',source:'measured',bpm:null,confidence:null,beats:[],onsets:[],error_code:'TOOLS_UNAVAILABLE',source_check:{status:'current',note:SOURCE_CHECK_NOTICE}};
    const result=await analyzeMusicBeats({filePath:music.file_path,ffmpeg:bins.ffmpeg,ffprobe:bins.ffprobe,startSeconds,durationSeconds});
    if(!sameFingerprint(before,statFingerprint(music.file_path,'音乐'))||this.catalog.get(id)?.source_status!=='current')throw new Error(`音乐源文件已变化：${sourceName(music.file_path)}`);
    return {...result,source_check:{status:'current',note:SOURCE_CHECK_NOTICE}};
  }
  #prepareProject(input){
    const checked=validateEditProject(input);
    if(!checked.valid)throw new Error(`剪辑项目无效：${checked.errors.slice(0,3).map(e=>e.message).join('；')}`);
    const project=checked.project;
    if(project.usage!==undefined&&project.usage!=='个人分享')throw new Error('当前工作流只支持个人分享用途');
    if(!project.tracks.video.length)throw new Error('剪辑项目至少需要一个视频片段');
    if(project.tracks.video.length>40||project.tracks.music.length!==1)throw new Error('当前项目限制为最多40个视频片段和一条音乐轨道');
    const files=new Map(),shots=[];
    for(const [index,clip] of project.tracks.video.entries()){
      const id=clip.source?.id;
      if(typeof id!=='string'||!/^vid_[A-Za-z0-9_-]+$/.test(id)||clip.source?.path!==undefined)throw new Error('视频素材必须引用素材库视频 ID，不能附带客户端路径');
      const video=this.db.getVideoById(id,true,false);if(!video)throw new Error('所引用的视频素材不存在');
      const fingerprint=statFingerprint(video.file_path,'视频');
      if(!Number.isFinite(video.duration)||video.duration<=0)throw new Error(`视频时长不可用：${sourceName(video.file_path)}`);
      if(Math.abs(clip.source.duration_seconds-video.duration)>Math.max(0.05,1/(video.fps||30)))throw new Error(`视频时长信息已变化：${sourceName(video.file_path)}`);
      const shotId=clip.evidence?.shot_id;
      if(typeof shotId!=='string'||!shotId)throw new Error('每个视频片段都必须引用素材库分镜 ID');
      const shot=video.shots.find(s=>s.id===shotId);if(!shot)throw new Error('所引用的素材库分镜不存在');
      if(clip.source_in_seconds<shot.start_time||clip.source_out_seconds>shot.end_time||clip.source_out_seconds>video.duration)throw new Error('视频源区间超出已选择分镜范围');
      const snap={start_time:shot.start_time,end_time:shot.end_time,subject:shot.subject||'',visual_description:shot.visual_description||'',shot_type:shot.shot_type||'',camera_movement:shot.camera_movement||'',composition:shot.composition||'',quality_score:shot.quality_score??null,tags:Array.isArray(shot.tags)?shot.tags:[]};
      shots.push({video_id:id,shot_id:shotId,snapshot:snap});files.set(`video:${id}`,{kind:'视频',id,path:video.file_path,fingerprint});
      clip.source={id,duration_seconds:video.duration};
    }
    const musicClip=project.tracks.music[0],musicId=musicClip.source?.id;
    if(typeof musicId!=='string'||!/^mus_[0-9a-f]{32}$/.test(musicId)||musicClip.source?.path!==undefined)throw new Error('音乐素材必须引用音乐库 ID，不能附带客户端路径');
    const music=this.catalog.get(musicId);
    if(!music||music.source_status!=='current'||!music.duration)throw new Error('音乐源文件不可用或已变化，请刷新音乐库');
    if(Math.abs(musicClip.source.duration_seconds-music.duration)>0.05)throw new Error('音乐时长与音乐库记录不一致');
    if(music.license_status!=='personal_confirmed')throw new Error('所选音乐尚未由用户声明可用于个人分享');
    files.set(`music:${musicId}`,{kind:'音乐',id:musicId,path:music.file_path,fingerprint:statFingerprint(music.file_path,'音乐')});
    musicClip.source={id:musicId,duration_seconds:music.duration};
    // Authorization remains a user assertion, never an independently verified rights grant.
    musicClip.rights={status:'confirmed',scope:'个人分享',note:music.license_note||'',verification:'用户声明，未独立核验'};
    if(musicClip.beats?.length)throw new Error('当前仅有瞬态候选，不能将其作为已确认拍点写入项目');
    for(const clip of project.tracks.video){
      clip.evidence={...clip.evidence,beat_relation:'未由插件验证拍点或瞬态与切点的对应关系'};
    }
    project.evidence={...(project.evidence||{}),beat_evidence:'插件不提供已确认拍点；检测瞬态不一定是节拍或强拍，需用户试听复核。',source_check:SOURCE_CHECK_NOTICE};
    project.usage='个人分享';
    const rechecked=validateEditProject(project);
    if(!rechecked.valid)throw new Error(`剪辑项目校验失败：${rechecked.errors.slice(0,3).map(e=>e.message).join('；')}`);
    const warnings=rechecked.warnings.filter(w=>!['SOURCES_UNVERIFIED','RIGHTS_UNCONFIRMED'].includes(w.code));
    return {project:rechecked.project,warnings,files:[...files.values()],shots};
  }
  #verify(snapshot){
    for(const item of snapshot.files){
      const rec=item.kind==='视频'?this.db.getVideoById(item.id):this.catalog.get(item.id);
      if(!rec||rec.file_path!==item.path)throw new Error(`${item.kind}素材记录已变化，请重新生成预览`);
      if(item.kind==='音乐'&&rec.source_status!=='current')throw new Error(`音乐源文件已变化：${sourceName(item.path)}`);
      if(!sameFingerprint(item.fingerprint,statFingerprint(item.path,item.kind)))throw new Error(`${item.kind}源文件已变化：${sourceName(item.path)}`);
    }
    for(const item of snapshot.shots){
      const video=this.db.getVideoById(item.video_id,true,false),shot=video?.shots.find(s=>s.id===item.shot_id);
      if(!shot)throw new Error('分镜已删除或重建，请重新生成预览');
      const now={start_time:shot.start_time,end_time:shot.end_time,subject:shot.subject||'',visual_description:shot.visual_description||'',shot_type:shot.shot_type||'',camera_movement:shot.camera_movement||'',composition:shot.composition||'',quality_score:shot.quality_score??null,tags:Array.isArray(shot.tags)?shot.tags:[]};
      if(JSON.stringify(item.snapshot)!==JSON.stringify(now))throw new Error('分镜描述已修改，请重新生成预览');
    }
  }
  previewProject(project){
    const {project:validatedProject,warnings,files,shots}=this.#prepareProject(project);
    const now=Date.now();for(const [id,p] of this.previews)if(p.expires<=now)this.previews.delete(id);
    while(this.previews.size>=100)this.previews.delete(this.previews.keys().next().value);
    const previewId='preview_'+crypto.randomUUID().replaceAll('-',''),expires=now+30*60*1000;
    this.previews.set(previewId,{expires,project:structuredClone(validatedProject),files,shots});
    return {preview_id:previewId,expires_at:new Date(expires).toISOString(),project:validatedProject,warnings,source_check:{status:'current',notice:SOURCE_CHECK_NOTICE}};
  }
  commitPreview({previewId,confirmed}){
    if(confirmed!==true)throw new Error('需由用户明确确认剪辑项目');
    const item=this.previews.get(previewId);if(!item||item.expires<=Date.now()){this.previews.delete(previewId);throw new Error('项目预览已过期，请重新预览');}
    this.#verify(item);
    const saved=this.projects.save(item.project);
    if(saved.success)this.previews.delete(previewId);
    return saved;
  }
}
