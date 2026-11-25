import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MusicCatalog } from '../music/music-catalog.js';
import { JamendoSearch } from '../music/jamendo.js';
import { analyzeMusicV2, MAX_MUSIC_ANALYSIS_SECONDS } from '../music/music-analysis-v2.js';
import { MusicAnalysisStore } from '../music/music-analysis-store.js';
import { EditProjectStore } from './edit-project-store.js';
import { validateEditProject } from './edit-project.js';

const execFileAsync=promisify(execFile);
const SOURCE_CHECK_NOTICE='仅比较 realpath 和文件系统属性；并非密码学内容校验。';
export class ProjectValidationError extends Error {
  constructor(message, errors = [], warnings = []) {
    super(message);
    this.name = 'ProjectValidationError';
    this.code = 'PROJECT_VALIDATION_FAILED';
    this.errors = Array.isArray(errors) ? errors : [];
    this.warnings = Array.isArray(warnings) ? warnings : [];
  }
}
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
function analysisIdentity(fingerprint){return {dev:fingerprint.dev,ino:fingerprint.ino,size:fingerprint.size,mtimeNs:fingerprint.mtimeNs};}

/** Asset and project service. The DSH conversation Agent authors project data; this service validates and stores it. */
export class EditingWorkflow {
  constructor(db,mediaEngine,videoAiAnalyzer){
    this.db=db;this.mediaEngine=mediaEngine;this.videoAiAnalyzer=videoAiAnalyzer;
    this.catalog=new MusicCatalog(db,{probeAudio:async filePath=>{
      const {ffprobe}=await mediaEngine.getBinaries();if(!ffprobe)throw new Error('FFprobe unavailable');
      const {stdout}=await execFileAsync(ffprobe,['-v','error','-print_format','json','-show_format','-show_streams',filePath],{timeout:15000,maxBuffer:2*1024*1024,windowsHide:true});return JSON.parse(stdout);
    }});
    this.projects=new EditProjectStore(db);this.musicAnalyses=new MusicAnalysisStore(db);this.previews=new Map();
  }
  searchJamendo({clientId,query,limit,offset,signal}){return new JamendoSearch({clientId}).search({query,limit,offset,signal});}
  removeMusic(id){
    const exists=this.db.db.prepare('SELECT id FROM local_music_catalog WHERE id=?').get(id);
    if(!exists)return false;
    this.db.db.exec('BEGIN IMMEDIATE');
    try{
      this.musicAnalyses.removeForMusic(id);
      const removed=this.catalog.remove(id);
      this.db.db.exec('COMMIT');
      return removed;
    }catch(error){try{this.db.db.exec('ROLLBACK');}catch{}throw error;}
  }
  async analyzeMusic(id,{durationSeconds}={}){
    const music=this.catalog.get(id);if(!music)throw new Error('音乐记录不存在');
    if(music.source_status!=='current')throw new Error(`音乐源文件不可用或已变化：${sourceName(music.file_path)}`);
    const before=statFingerprint(music.file_path,'音乐'),bins=await this.mediaEngine.getBinaries();
    const duration=Math.max(0.1,Math.min(Number(durationSeconds)||Number(music.duration)||60,MAX_MUSIC_ANALYSIS_SECONDS));
    const result=!bins.ffmpeg||!bins.ffprobe
      ?{status:'error',method:'spectral-flux-autocorr-v2',analysis_version:'2',bpm:null,bpm_confidence:null,tempo_candidates:[],meter:{beats_per_bar:4,confidence:0,first_downbeat:null},beats:{subdivision:4,times:[],strengths:[],quarter_times:[],quarter_strengths:[],downbeats:[]},sections:[],cut_candidates:[],features:null,waveform:null,analysis_window:{start_seconds:0,duration_seconds:duration},error_code:'TOOLS_UNAVAILABLE'}
      :await analyzeMusicV2({filePath:music.file_path,ffmpeg:bins.ffmpeg,ffprobe:bins.ffprobe,startSeconds:0,durationSeconds:duration});
    if(!sameFingerprint(before,statFingerprint(music.file_path,'音乐'))||this.catalog.get(id)?.source_status!=='current')throw new Error(`音乐源文件已变化：${sourceName(music.file_path)}`);
    const saved=this.musicAnalyses.save(id,analysisIdentity(before),result);
    return {...saved,source_check:{status:'current',note:SOURCE_CHECK_NOTICE}};
  }
  getMusicAnalysis(id){
    const music=this.catalog.get(id);if(!music)throw new Error('音乐记录不存在');
    if(music.source_status!=='current')throw new Error(`音乐源文件不可用或已变化：${sourceName(music.file_path)}`);
    const profile=this.musicAnalyses.latest(id,analysisIdentity(statFingerprint(music.file_path,'音乐')));
    if(!profile)return null;
    const {source_identity,...safe}=profile;
    return safe;
  }
  getMusicFeatures(id,analysisId){
    const music=this.catalog.get(id);if(!music)throw new Error('音乐记录不存在');
    if(music.source_status!=='current')throw new Error(`音乐源文件不可用或已变化：${sourceName(music.file_path)}`);
    const profile=this.musicAnalyses.get(analysisId);
    if(!profile||profile.music_id!==id||JSON.stringify(profile.source_identity)!==JSON.stringify(analysisIdentity(statFingerprint(music.file_path,'音乐'))))throw new Error('音乐分析档案已过期或与当前音乐不匹配');
    return this.musicAnalyses.getFeatures(analysisId);
  }
  listMusicCatalog(options={}){
    const page=this.catalog.list(options);
    const items=page.items.map(music=>{
      if(music.source_status!=='current')return {...music,analysis_summary:{status:'stale'}};
      try{
        const identity=analysisIdentity(statFingerprint(music.file_path,'音乐'));
        const profile=this.musicAnalyses.latest(music.id,identity);
        const summary=!profile?{status:'not_analyzed'}:profile.status==='stale'?{status:'stale',analysis_id:profile.analysis_id}:this.musicAnalyses.analysisSummary(profile.analysis_id);
        return {...music,analysis_summary:summary};
      }catch{return {...music,analysis_summary:{status:'stale'}};}
    });
    const filtered=items.filter(music=>(options.analysis_status===undefined||music.analysis_summary?.status===options.analysis_status));
    return {...page,items:filtered};
  }
  #projectFailure(code, path, message, warnings = []) {
    throw new ProjectValidationError(message, [{ code, path, message }], warnings);
  }
  #prepareProject(input){
    const checked=validateEditProject(input);
    if(!checked.valid)throw new ProjectValidationError('剪辑项目校验失败',checked.errors,checked.warnings);
    const project=checked.project;
    if(project.usage!==undefined&&project.usage!=='个人分享')this.#projectFailure('USAGE_UNSUPPORTED','$.usage','当前工作流只支持个人分享用途');
    if(!project.tracks.video.length)this.#projectFailure('VIDEO_EMPTY','$.tracks.video','剪辑项目至少需要一个视频片段');
    if(project.tracks.video.length>40||project.tracks.music.length!==1)this.#projectFailure('PROJECT_LIMIT','$.tracks','当前项目限制为最多40个视频片段和一条音乐轨道');
    const files=new Map(),shots=[];
    for(const [index,clip] of project.tracks.video.entries()){
      const clipPath=`$.tracks.video[${index}]`,shotPath=`${clipPath}.evidence`;
      const id=clip.source?.id;
      if(typeof id!=='string'||!/^vid_[A-Za-z0-9_-]+$/.test(id)||clip.source?.path!==undefined)this.#projectFailure('SOURCE_ID',`${clipPath}.source`,'视频素材必须引用素材库视频 ID，不能附带客户端路径');
      const video=this.db.getVideoById(id,true,false);if(!video)this.#projectFailure('SOURCE_NOT_FOUND',`${clipPath}.source`,'所引用的视频素材不存在');
      const fingerprint=statFingerprint(video.file_path,'视频');
      if(!Number.isFinite(video.duration)||video.duration<=0)this.#projectFailure('SOURCE_DURATION_UNAVAILABLE',`${clipPath}.source`,'视频时长不可用');
      if(Math.abs(clip.source.duration_seconds-video.duration)>Math.max(0.05,1/(video.fps||30)))this.#projectFailure('SOURCE_DURATION_CHANGED',`${clipPath}.source`,'视频时长信息已变化');
      const evidence=clip.evidence&&typeof clip.evidence==='object'?clip.evidence:{};
      const requestedIds=Array.isArray(evidence.shot_ids)&&evidence.shot_ids.length?evidence.shot_ids:evidence.shot_id?[evidence.shot_id]:[];
      if(!requestedIds.length||requestedIds.some(shotId=>typeof shotId!=='string'||!shotId))this.#projectFailure('SHOT_REQUIRED',shotPath,'每个视频片段都必须引用至少一个素材库分镜 ID（shot_id 或 shot_ids）');
      const clipShots=[];
      for(const shotId of [...new Set(requestedIds)]){
        const shot=video.shots.find(s=>s.id===shotId);
        if(!shot)this.#projectFailure('SHOT_NOT_FOUND',shotPath,'所引用的素材库分镜不存在');
        clipShots.push(shot);
      }
      clipShots.sort((a,b)=>a.start_time-b.start_time||a.end_time-b.end_time);
      const first=clipShots[0],last=clipShots.at(-1);
      if(clip.source_in_seconds<first.start_time||clip.source_out_seconds>last.end_time||clip.source_out_seconds>video.duration){
        this.#projectFailure('SOURCE_RANGE_OUTSIDE_SHOT',`${clipPath}.source_out_seconds`,'视频源区间超出已选择分镜范围');
      }
      let coveredUntil=first.start_time;
      for(const shot of clipShots){
        if(shot.start_time>coveredUntil+1e-6)this.#projectFailure('SHOT_GAP',shotPath,'所选分镜不连续，无法共同覆盖该片段');
        coveredUntil=Math.max(coveredUntil,shot.end_time);
      }
      for(const shot of clipShots){
        shots.push({video_id:id,shot_id:shot.id,snapshot:{start_time:shot.start_time,end_time:shot.end_time,subject:shot.subject||'',visual_description:shot.visual_description||'',shot_type:shot.shot_type||'',camera_movement:shot.camera_movement||'',composition:shot.composition||'',quality_score:shot.quality_score??null,tags:Array.isArray(shot.tags)?shot.tags:[]}});
      }
      files.set(`video:${id}`,{kind:'视频',id,path:video.file_path,fingerprint});
      clip.source={id,duration_seconds:video.duration};
      clip.evidence={...evidence,shot_ids:clipShots.map(shot=>shot.id)};
    }
    const musicClip=project.tracks.music[0],musicId=musicClip.source?.id,musicPath='$.tracks.music[0]';
    if(typeof musicId!=='string'||!/^mus_[0-9a-f]{32}$/.test(musicId)||musicClip.source?.path!==undefined)this.#projectFailure('MUSIC_SOURCE_ID',`${musicPath}.source`,'音乐素材必须引用音乐库 ID，不能附带客户端路径');
    const music=this.catalog.get(musicId);
    if(!music||music.source_status!=='current'||!music.duration)this.#projectFailure('MUSIC_SOURCE_UNAVAILABLE',`${musicPath}.source`,'音乐源文件不可用或已变化，请刷新音乐库');
    if(Math.abs(musicClip.source.duration_seconds-music.duration)>0.05)this.#projectFailure('MUSIC_DURATION_CHANGED',`${musicPath}.source`,'音乐时长与音乐库记录不一致');
    if(music.license_status!=='personal_confirmed')this.#projectFailure('MUSIC_RIGHTS',`${musicPath}.rights`,'所选音乐尚未由用户声明可用于个人分享');
    files.set(`music:${musicId}`,{kind:'音乐',id:musicId,path:music.file_path,fingerprint:statFingerprint(music.file_path,'音乐')});
    musicClip.source={id:musicId,duration_seconds:music.duration};
    // Authorization remains a user assertion, never an independently verified rights grant.
    musicClip.rights={status:'confirmed',scope:'个人分享',note:music.license_note||'',verification:'用户声明，未独立核验'};
    if(musicClip.beats?.length)this.#projectFailure('MUSIC_BEATS_UNVERIFIED',`${musicPath}.beats`,'当前仅有瞬态候选，不能将其作为已确认拍点写入项目');
    for(const clip of project.tracks.video){
      clip.evidence={...clip.evidence,beat_relation:'未由插件验证拍点或瞬态与切点的对应关系'};
    }
    project.evidence={...(project.evidence||{}),beat_evidence:'插件不提供已确认拍点；检测瞬态不一定是节拍或强拍，需用户试听复核。',source_check:SOURCE_CHECK_NOTICE};
    project.usage='个人分享';
    const rechecked=validateEditProject(project);
    if(!rechecked.valid)throw new ProjectValidationError('剪辑项目校验失败',rechecked.errors,rechecked.warnings);
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
  composeProject({ title, rationale, shot_refs, music_id, canvas, fps, usage = '个人分享' } = {}) {
    if (typeof title !== 'string' || !title.trim()) this.#projectFailure('TITLE', '$.title', '项目标题不能为空');
    if (typeof rationale !== 'string' || !rationale.trim()) this.#projectFailure('RATIONALE', '$.rationale', '项目说明不能为空');
    if (!Array.isArray(shot_refs) || shot_refs.length < 1 || shot_refs.length > 40) this.#projectFailure('SHOT_REFS', '$.shot_refs', 'shot_refs 必须包含 1–40 个分镜引用');
    if (typeof music_id !== 'string' || !/^mus_[0-9a-f]{32}$/.test(music_id)) this.#projectFailure('MUSIC_ID', '$.music_id', '音乐 ID 无效');
    const refs = shot_refs.map((ref, index) => {
      if (!ref || typeof ref.shot_id !== 'string' || !ref.shot_id) this.#projectFailure('SHOT_REF', `$.shot_refs[${index}]`, '每个分镜引用必须包含 shot_id');
      const shot = this.db.db.prepare('SELECT s.id,s.video_id,s.start_time,s.end_time FROM video_shots s WHERE s.id = ?').get(ref.shot_id);
      if (!shot) this.#projectFailure('SHOT_NOT_FOUND', `$.shot_refs[${index}]`, '所引用的素材库分镜不存在');
      const video = this.db.getVideoById(shot.video_id, false, false);
      if (!video) this.#projectFailure('SOURCE_NOT_FOUND', `$.shot_refs[${index}]`, '分镜所属视频不存在');
      const sourceIn = ref.source_in_seconds === undefined ? shot.start_time : Number(ref.source_in_seconds);
      const sourceOut = ref.source_out_seconds === undefined ? shot.end_time : Number(ref.source_out_seconds);
      if (!Number.isFinite(sourceIn) || !Number.isFinite(sourceOut) || sourceIn < shot.start_time || sourceOut > shot.end_time || sourceOut <= sourceIn) {
        this.#projectFailure('SOURCE_RANGE_OUTSIDE_SHOT', `$.shot_refs[${index}]`, '分镜修剪区间必须位于该分镜范围内且 out > in');
      }
      return { shot, video, sourceIn, sourceOut };
    });
    const firstVideo = refs[0].video;
    const projectFps = fps && Number.isSafeInteger(fps.num) && Number.isSafeInteger(fps.den) && fps.num > 0 && fps.den > 0
      ? { num: fps.num, den: fps.den } : this.#fpsForVideo(firstVideo);
    let cursor = 0;
    const videos = refs.map((ref, index) => {
      const duration = Math.max(1, Math.round((ref.sourceOut - ref.sourceIn) * projectFps.num / projectFps.den));
      const clip = {
        id: `clip_${index + 1}`,
        source: { id: ref.video.id, duration_seconds: Number(ref.video.duration) },
        source_in_seconds: ref.sourceIn,
        source_out_seconds: ref.sourceOut,
        timeline_start_frame: cursor,
        timeline_end_frame: cursor + duration,
        rationale: ref.shot.subject || `分镜 ${ref.shot.id}`,
        evidence: { shot_ids: [ref.shot.id] }
      };
      cursor += duration;
      return clip;
    });
    const music = this.catalog.get(music_id);
    if (!music || music.source_status !== 'current' || !music.duration) this.#projectFailure('MUSIC_SOURCE_UNAVAILABLE', '$.music_id', '音乐源文件不可用或已变化，请刷新音乐库');
    const projectSeconds = cursor * projectFps.den / projectFps.num;
    const musicSeconds = Math.min(Number(music.duration), projectSeconds);
    const musicFrames = Math.max(1, Math.min(cursor, Math.round(musicSeconds * projectFps.num / projectFps.den)));
    const project = {
      schema_version: 1,
      title: title.trim(),
      rationale,
      usage,
      fps: projectFps,
      canvas: canvas || (Number(firstVideo.width) >= Number(firstVideo.height)
        ? { width: 1920, height: 1080, aspect: '16:9' }
        : { width: 1080, height: 1920, aspect: '9:16' }),
      duration_frames: cursor,
      tracks: {
        video: videos,
        music: [{
          id: 'music_1',
          source: { id: music_id, duration_seconds: Number(music.duration) },
          source_in_seconds: 0,
          source_out_seconds: musicSeconds,
          timeline_start_frame: 0,
          timeline_end_frame: musicFrames,
          rights: { status: music.license_status === 'personal_confirmed' ? 'confirmed' : 'unknown', scope: '个人分享', note: music.license_note || '' },
          rationale: '由 composeProject 按项目时长截取音乐'
        }]
      },
      evidence: { story_arc: [], uncertainties: [], notice: '项目由分镜引用自动组装，切点与节奏仍需用户审阅。' }
    };
    return this.previewProject(project);
  }

  #fpsForVideo(video) {
    const rate = Number(video?.fps) || 30;
    const common = [
      [23.976, 24000, 1001], [29.97, 30000, 1001], [59.94, 60000, 1001],
      [25, 25, 1], [30, 30, 1], [50, 50, 1], [60, 60, 1]
    ];
    const match = common.find(([value]) => Math.abs(rate - value) < 0.01);
    return match ? { num: match[1], den: match[2] } : { num: Math.round(rate * 1000), den: 1000 };
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
