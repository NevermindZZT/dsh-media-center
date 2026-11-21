import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const VIDEO_EXTENSIONS=new Set(['.mp4','.mov','.mkv','.avi','.webm','.flv','.m4v','.wmv']);
const JOB_RETENTION_MS=24*60*60*1000;
const MAX_RETAINED_JOBS=200;
const MAX_JOB_ITEMS=100;
const MAX_ERRORS=100;
const TERMINAL=new Set(['completed','completed_with_errors','failed','cancelled']);

function pathKey(value){
  const normalized=path.normalize(path.resolve(value));
  return process.platform==='win32'?normalized.toLowerCase():normalized;
}
function identityFromStat(stat){
  return {dev:String(stat.dev),ino:String(stat.ino),size:String(stat.size),mtimeNs:String(stat.mtimeNs),ctimeNs:String(stat.ctimeNs)};
}
function sameIdentity(a,b){
  return !!a&&!!b&&a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;
}
function parseIdentity(raw){
  if(!raw)return null;
  try{const value=JSON.parse(raw);return value&&typeof value==='object'&&!Array.isArray(value)?value:null;}catch{return null;}
}
function safeFileName(value){
  try{return path.basename(String(value||'')).slice(0,255)||'unknown';}catch{return 'unknown';}
}
const yieldLoop=()=>new Promise(resolve=>setImmediate(resolve));

/** Async import coordinator. Sources are probed read-only; only catalog rows and the plugin cache are written. */
export class VideoImportJobManager {
  constructor(engine){
    this.engine=engine;
    this.db=engine.db;
    this.jobs=new Map();
    this.requests=new Map();
    this.tasks=new Map();
    this.inflightFiles=new Map();
    this.pathDeletionTimes=new Map();
    this.pathIndex=null;
  }

  start(request={}){
    const normalized=this.#validateRequest(request);
    this.#pruneJobs();
    const signature=this.#requestSignature(normalized),activeId=this.requests.get(signature),active=activeId?this.jobs.get(activeId):null;
    if(active&&!TERMINAL.has(active.status))return {job:this.#snapshot(active),merged:true};
    const now=new Date().toISOString(),id=`imp_${crypto.randomUUID().replace(/-/g,'')}`;
    const job={id,job_id:id,kind:normalized.kind,status:'queued',phase:'queued',created_at:now,updated_at:now,request_signature:signature,
      requested_count:this.#requestedCount(normalized),total:0,total_known:false,discovered:0,input_duplicates:0,duplicates:0,importable:null,
      processed:0,inserted:0,import_failed:0,failed:0,cancelled:0,scan_errors:0,storyboard_total:0,storyboard_done:0,storyboard_failed:0,      storyboard_cancelled:0,storyboard_pending:0,completed:0,percent:0,scanned_directories:0,items:[],errors:[],error_code:null,error_message:null};
    this.jobs.set(id,job);this.requests.set(signature,id);job.request=normalized;this.#touch(job);
    const task=new Promise(resolve=>{
      setImmediate(()=>{this.#run(id).catch(error=>this.#failJob(id,this.#safeJobError(error))).finally(()=>resolve(this.get(id)));});
    });
    this.tasks.set(id,task);
    return {job:this.#snapshot(job),merged:false};
  }

  get(jobId){
    this.#pruneJobs();
    const job=this.jobs.get(jobId);
    return job?this.#snapshot(job):null;
  }

  async wait(jobId){
    const task=this.tasks.get(jobId);
    if(task)await task;
    return this.get(jobId);
  }

  async runLegacy(request){
    const {job}=this.start(request);
    const final=await this.wait(job.id),internal=this.jobs.get(job.id);
    if(!final||final.status==='failed')throw new Error(final?.error_message||'导入任务失败');
    const videos=internal.items.filter(item=>item.newly_inserted&&item.video_id).map(item=>this.db.getVideoById(item.video_id)).filter(Boolean);
    if(request.kind==='directory')return {scanned_directory:internal.scanned_directory||request.directory_path,imported_count:internal.inserted,failed_count:internal.import_failed,failed_files:internal.items.filter(item=>item.error_code&&item.stage!=='storyboarding').map(item=>item.file_name),videos,duplicates_count:internal.duplicates};
    if(request.kind==='subfolders'){
      const grouped=new Map();
      for(const item of internal.items){
        const name=item.group_name||'unknown';
        if(!grouped.has(name))grouped.set(name,{name,imported_count:0,failed_count:0});
        const group=grouped.get(name);
        if(item.newly_inserted)group.imported_count++;
        if(item.error_code&&item.stage!=='storyboarding'&&item.stage!=='completed')group.failed_count++;
      }
      return {scanned_count:grouped.size,imported_count:internal.inserted,failed_count:internal.import_failed,folders:[...grouped.values()],duplicates_count:internal.duplicates};
    }
    return {imported_count:internal.inserted,duplicates_count:internal.duplicates,failed_count:internal.import_failed,videos};
  }

  cancelJob(jobId){
    const job=this.jobs.get(jobId);if(!job||TERMINAL.has(job.status))return this.get(jobId);
    job.cancel_requested=true;this.#touch(job);return this.#snapshot(job);
  }

  cancelForVideo(videoId){
    const record=this.db.getVideoImportRecord(videoId);if(!record)return false;
    const key=pathKey(record.file_path);this.pathDeletionTimes.set(key,Date.now());
    for(const job of this.jobs.values()){
      if(TERMINAL.has(job.status))continue;
      for(const item of job.items){
        if(item.video_id===videoId||(item.path_key===key))item.cancel_requested=true;
      }
      for(const candidate of job.candidates||[])if(candidate.path_key===key)candidate.item.cancel_requested=true;
    }
    return true;
  }

  #validateRequest(request){
    if(!request||typeof request!=='object')throw Object.assign(new Error('Invalid import request'),{code:'IMPORT_JOB_INVALID'});
    const kind=request.kind;
    if(kind==='directory'){
      if(typeof request.directory_path!=='string'||!path.isAbsolute(request.directory_path))throw Object.assign(new Error('directory_path is required'),{code:'IMPORT_JOB_INVALID'});
      return {kind,directory_path:request.directory_path,folder_id:request.folder_id||null};
    }
    if(kind==='subfolders'){
      if(typeof request.parent_directory_path!=='string'||!path.isAbsolute(request.parent_directory_path))throw Object.assign(new Error('parent_directory_path is required'),{code:'IMPORT_JOB_INVALID'});
      if(!Array.isArray(request.directory_paths)||request.directory_paths.length<1||request.directory_paths.length>50||request.directory_paths.some(value=>typeof value!=='string'||!path.isAbsolute(value)))throw Object.assign(new Error('directory_paths must contain 1–50 absolute paths'),{code:'IMPORT_JOB_INVALID'});
      return {kind,parent_directory_path:request.parent_directory_path,directory_paths:[...request.directory_paths],parent_folder_id:request.parent_folder_id||null};
    }
    if(kind==='files'){
      if(!Array.isArray(request.file_paths)||request.file_paths.length<1||request.file_paths.length>5000||request.file_paths.some(value=>typeof value!=='string'))throw Object.assign(new Error('file_paths must contain 1–5000 paths'),{code:'IMPORT_JOB_INVALID'});
      return {kind,file_paths:[...request.file_paths],folder_id:request.folder_id||null};
    }
    throw Object.assign(new Error('Invalid import kind'),{code:'IMPORT_JOB_INVALID'});
  }

  #requestedCount(request){return request.kind==='files'?request.file_paths.length:request.kind==='subfolders'?request.directory_paths.length:1;}

  #requestSignature(request){
    const folder=request.folder_id||request.parent_folder_id||'';
    if(request.kind==='directory')return `${request.kind}|${pathKey(request.directory_path)}|${folder}`;
    if(request.kind==='subfolders')return `${request.kind}|${pathKey(request.parent_directory_path)}|${[...request.directory_paths].map(pathKey).sort().join('|')}|${folder}`;
    return `${request.kind}|${request.file_paths.map(value=>pathKey(value)).sort().join('|')}|${folder}`;
  }

  #snapshot(job){
    const items=job.items||[],failedItems=items.filter(item=>item.error_code||item.status==='conflict'||item.status==='cancelled'),chosen=new Set(failedItems);
    const ordered=[...failedItems,...items.filter(item=>!chosen.has(item))],visible=ordered.slice(0,MAX_JOB_ITEMS);
    return {id:job.id,job_id:job.id,kind:job.kind,status:job.status,phase:job.phase,created_at:job.created_at,updated_at:job.updated_at,
      requested_count:job.requested_count,total:job.total,total_known:job.total_known,discovered:job.discovered,input_duplicates:job.input_duplicates,
      duplicates:job.duplicates,importable:job.importable,processed:job.processed,inserted:job.inserted,import_failed:job.import_failed,
      failed:job.failed,cancelled:job.cancelled,scan_errors:job.scan_errors||0,storyboard_total:job.storyboard_total,storyboard_done:job.storyboard_done,
      storyboard_failed:job.storyboard_failed,storyboard_cancelled:job.storyboard_cancelled,storyboard_pending:job.storyboard_pending,
      completed:job.completed,percent:job.percent,scanned_directories:job.scanned_directories||0,
      items:visible.map(item=>({video_id:item.video_id||null,file_name:item.file_name,group_name:item.group_name||null,stage:item.stage,status:item.status,
        storyboard_status:item.storyboard_status||null,error_code:item.error_code||null,warning_code:item.warning_code||null,newly_inserted:!!item.newly_inserted})),
      items_omitted:Math.max(0,items.length-visible.length),errors:(job.errors||[]).slice(0,MAX_ERRORS),errors_omitted:Math.max(0,(job.errors||[]).length-MAX_ERRORS),
      error_code:job.error_code||null,error_message:job.error_message||null,cancel_requested:!!job.cancel_requested};
  }

  #touch(job){
    job.updated_at=new Date().toISOString();
    if(TERMINAL.has(job.status)){job.percent=100;return;}
    if(!job.total_known){job.percent=null;return;}
    if(job.status==='importing')job.percent=job.total?Math.round(45*job.processed/job.total):45;
    else if(job.status==='storyboarding'){
      const done=job.storyboard_done+job.storyboard_failed+job.storyboard_cancelled;
      job.percent=job.storyboard_total?45+Math.round(55*done/job.storyboard_total):100;
    }else job.percent=0;
  }

  #pruneJobs(){
    const now=Date.now();
    for(const [id,job] of this.jobs){
      if(TERMINAL.has(job.status)&&now-Date.parse(job.updated_at)>JOB_RETENTION_MS){this.jobs.delete(id);this.tasks.delete(id);if(this.requests.get(job.request_signature)===id)this.requests.delete(job.request_signature);}
    }
    if(this.jobs.size>MAX_RETAINED_JOBS){
      for(const [id,job] of this.jobs){if(this.jobs.size<=MAX_RETAINED_JOBS)break;if(TERMINAL.has(job.status)){this.jobs.delete(id);this.tasks.delete(id);if(this.requests.get(job.request_signature)===id)this.requests.delete(job.request_signature);}}
    }
    for(const [key,deletedAt] of this.pathDeletionTimes)if(now-deletedAt>JOB_RETENTION_MS)this.pathDeletionTimes.delete(key);
  }

  async #buildPathIndex(){
    const rows=this.db.listVideoImportRecords(),index=new Map();
    for(let indexPos=0;indexPos<rows.length;indexPos++){
      const row=rows[indexPos];if(!row.file_path)continue;
      const keys=new Set([pathKey(row.file_path)]);
      try{keys.add(pathKey(await fs.promises.realpath(row.file_path)));}catch{}
      for(const key of keys)if(!index.has(key))index.set(key,row);
      if(indexPos%200===199)await yieldLoop();
    }
    return index;
  }

  async #addCandidate(inputPath,folderId,groupName,job,plan,seen,index){
    if(job.cancel_requested)throw Object.assign(new Error('Import cancelled'),{code:'IMPORT_CANCELLED'});
    const fileName=safeFileName(inputPath);
    const rawKey=typeof inputPath==='string'&&path.isAbsolute(inputPath)?pathKey(inputPath):null;
    if(rawKey&&seen.has(rawKey)){job.input_duplicates++;this.#touch(job);return;}
    let realPath,stat;
    try{
      if(typeof inputPath!=='string'||!path.isAbsolute(inputPath))throw Object.assign(new Error(),{code:'INVALID_PATH'});
      realPath=await fs.promises.realpath(inputPath);
      stat=await fs.promises.stat(realPath,{bigint:true});
      if(!stat.isFile())throw Object.assign(new Error(),{code:'NOT_A_FILE'});
      if(!VIDEO_EXTENSIONS.has(path.extname(realPath).toLowerCase()))throw Object.assign(new Error(),{code:'UNSUPPORTED_FILE_TYPE'});
    }catch(error){
      const code=error?.code==='UNSUPPORTED_FILE_TYPE'?'UNSUPPORTED_FILE_TYPE':error?.code==='INVALID_PATH'?'INVALID_PATH':'SOURCE_UNAVAILABLE';
      const item={file_name:fileName,group_name:groupName||null,video_id:null,path_key:rawKey||`invalid:${crypto.randomUUID()}`,stage:'scanning',status:'failed',storyboard_status:null,error_code:code,warning_code:null,newly_inserted:false};
      plan.push({item,file_path:null,path_key:item.path_key,source_identity:null,folder_id:folderId,group_name:groupName||null,preflight_error:code});
      job.items.push(item);job.discovered++;job.total=job.items.length;this.#touch(job);return;
    }
    const canonicalKey=pathKey(realPath);
    if(seen.has(canonicalKey)){job.input_duplicates++;this.#touch(job);return;}
    seen.add(canonicalKey);if(rawKey)seen.add(rawKey);
    const identity=identityFromStat(stat),existing=index.get(canonicalKey)||index.get(rawKey||'')||null;
    const item={file_name:safeFileName(realPath),group_name:groupName||null,video_id:existing?.id||null,path_key:canonicalKey,stage:'scanning',status:'discovered',storyboard_status:existing?.storyboard_status||null,error_code:null,warning_code:null,newly_inserted:false};
    let preflightError=null;
    if(existing){
      const state=this.#identityState(existing,identity);
      if(state==='changed'){preflightError='SOURCE_CHANGED_SAME_PATH';item.status='conflict';item.error_code=preflightError;}
      else{item.status='duplicate';if(state==='unknown')item.warning_code='SOURCE_IDENTITY_UNVERIFIED';job.duplicates++;}
    }
    const deletionTime=this.pathDeletionTimes.get(canonicalKey);
    if(deletionTime&&deletionTime>job.created_ms)item.cancel_requested=true;
    plan.push({item,file_path:realPath,path_key:canonicalKey,source_identity:identity,existing_id:existing?.id||null,folder_id:folderId,group_name:groupName||null,preflight_error:preflightError});
    job.items.push(item);job.discovered++;job.total=job.items.length;this.#touch(job);
  }

  #identityState(record,currentIdentity){
    const saved=parseIdentity(record?.source_identity_json);
    if(saved)return sameIdentity(saved,currentIdentity)?'same':'changed';
    return Number(record?.file_size)===Number(currentIdentity?.size)?'unknown':'changed';
  }

  async #scanDirectory(rootPath,parentFolderId,groupName,job,plan,seen,index){
    let canonicalRoot;
    try{canonicalRoot=await fs.promises.realpath(rootPath);const stat=await fs.promises.stat(canonicalRoot);if(!stat.isDirectory())throw new Error();await fs.promises.access(canonicalRoot,fs.constants.R_OK);}
    catch{throw Object.assign(new Error('目录不可用或不是文件夹'),{code:'DIRECTORY_UNAVAILABLE'});}
    const rootName=path.basename(canonicalRoot);this.db.ensureFolder(rootName,canonicalRoot,parentFolderId);
    job.scanned_directories++;job.scanned_directory=canonicalRoot;this.#touch(job);
    const walk=async(currentDir,relativeParts)=>{
      let entries;
      try{entries=await fs.promises.readdir(currentDir,{withFileTypes:true});}
      catch{job.failed++;job.scan_errors=(job.scan_errors||0)+1;job.errors.push({file_name:safeFileName(currentDir),error_code:'DIRECTORY_READ_FAILED'});this.#touch(job);return;}
      entries.sort((a,b)=>a.name.localeCompare(b.name));
      for(const entry of entries){
        if(job.cancel_requested)throw Object.assign(new Error('Import cancelled'),{code:'IMPORT_CANCELLED'});
        if(entry.name.startsWith('.')||entry.name.startsWith('$')||entry.isSymbolicLink())continue;
        const fullPath=path.join(currentDir,entry.name);
        if(entry.isDirectory()){
          const nextParts=[...relativeParts,entry.name],relative=nextParts.join('/');
          this.db.ensureFolder(`${rootName}/${relative}`,fullPath,parentFolderId);
          await walk(fullPath,nextParts);
        }else if(entry.isFile()&&VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())){
          const relative=relativeParts.length?`${rootName}/${relativeParts.join('/')}`:rootName;
          const folder=this.db.ensureFolder(relative,currentDir,parentFolderId);
          await this.#addCandidate(fullPath,folder?.id||null,groupName||rootName,job,plan,seen,index);
          if(job.items.length%50===0)await yieldLoop();
        }
      }
      await yieldLoop();
    };
    await walk(canonicalRoot,[]);
  }

  async #buildPlan(request,job,index){
    const plan=[],seen=new Set();
    if(request.kind==='files'){
      if(request.folder_id&&!this.db.db.prepare('SELECT id FROM folders WHERE id=?').get(request.folder_id))throw Object.assign(new Error('目标父分类不存在，请刷新后重试'),{code:'INVALID_PARENT_FOLDER'});
      for(const filePath of request.file_paths)await this.#addCandidate(filePath,request.folder_id,null,job,plan,seen,index);
    }else if(request.kind==='directory'){
      if(request.folder_id&&!this.db.db.prepare('SELECT id FROM folders WHERE id=?').get(request.folder_id))throw Object.assign(new Error('目标父分类不存在，请刷新后重试'),{code:'INVALID_PARENT_FOLDER'});
      await this.#scanDirectory(request.directory_path,request.folder_id,null,job,plan,seen,index);
    }else{
      if(request.parent_folder_id&&!this.db.db.prepare('SELECT id FROM folders WHERE id=?').get(request.parent_folder_id))throw Object.assign(new Error('目标父分类不存在，请刷新后重试'),{code:'INVALID_PARENT_FOLDER'});
      let parentReal;
      try{parentReal=await fs.promises.realpath(request.parent_directory_path);if(!(await fs.promises.stat(parentReal)).isDirectory())throw new Error();await fs.promises.access(parentReal,fs.constants.R_OK);}
      catch{throw Object.assign(new Error('当前浏览目录不可用'),{code:'BROWSE_DIRECTORY_UNAVAILABLE'});}
      const selected=new Set();
      for(const input of request.directory_paths){
        try{
          const lstat=await fs.promises.lstat(input),real=await fs.promises.realpath(input),dirStat=await fs.promises.stat(real),relative=path.relative(parentReal,real);
          if(lstat.isSymbolicLink()||!dirStat.isDirectory()||path.dirname(real)!==parentReal||!relative||relative==='..'||path.isAbsolute(relative)||relative.startsWith(`..${path.sep}`)||relative.includes(path.sep))throw new Error();
          const key=pathKey(real);if(selected.has(key))throw Object.assign(new Error('所选项必须是当前浏览目录中的直接子文件夹'),{code:'INVALID_CHILD_DIRECTORY'});selected.add(key);
          await this.#scanDirectory(real,request.parent_folder_id,path.basename(real),job,plan,seen,index);
        }catch(error){if(error?.code==='INVALID_PARENT_FOLDER'||error?.code==='BROWSE_DIRECTORY_UNAVAILABLE')throw error;throw Object.assign(new Error('所选项必须是当前浏览目录中的直接子文件夹'),{code:'INVALID_CHILD_DIRECTORY'});}
      }
    }
    job.total_known=true;job.total=plan.length;job.importable=plan.filter(candidate=>!candidate.preflight_error&&!candidate.item.cancel_requested&&!candidate.existing_id).length;
    this.#touch(job);return plan;
  }

  async #findExisting(filePath,index){
    const key=pathKey(filePath),known=index.get(key);
    if(known){const current=this.db.getVideoImportRecord(known.id);if(current)return current;index.delete(key);}
    const direct=this.db.db.prepare('SELECT id FROM videos WHERE file_path=?').get(filePath);
    if(direct){const record=this.db.getVideoImportRecord(direct.id);if(record){index.set(key,record);return record;}}
    return null;
  }

  async #insertUnique(candidate,job,index){
    const key=candidate.path_key;
    while(true){
      const existingLock=this.inflightFiles.get(key);
      if(existingLock){const outcome=await existingLock;if(outcome?.record)return {duplicate:true,record:this.db.getVideoImportRecord(outcome.record.id)||outcome.record};continue;}
      let release;const lock=new Promise(resolve=>{release=resolve;});this.inflightFiles.set(key,lock);
      try{
        const deletedAt=this.pathDeletionTimes.get(key);if(deletedAt&&deletedAt>job.created_ms)return {cancelled:true,error_code:'VIDEO_REMOVED_DURING_IMPORT'};
        const existing=await this.#findExisting(candidate.file_path,index);
        if(existing){const state=this.#identityState(existing,candidate.source_identity);release({record:existing});return state==='changed'?{conflict:true,error_code:'SOURCE_CHANGED_SAME_PATH',record:existing}:{duplicate:true,record:existing,warning_code:state==='unknown'?'SOURCE_IDENTITY_UNVERIFIED':null};}
        const before=await fs.promises.stat(candidate.file_path,{bigint:true}).then(identityFromStat).catch(()=>null);
        if(!before||!sameIdentity(candidate.source_identity,before)){release(null);return {conflict:true,error_code:'SOURCE_CHANGED_DURING_IMPORT'};}
        const metadata=await this.engine.probeVideo(candidate.file_path);
        const after=await fs.promises.stat(candidate.file_path,{bigint:true}).then(identityFromStat).catch(()=>null);
        if(!after||!sameIdentity(before,after)){release(null);return {conflict:true,error_code:'SOURCE_CHANGED_DURING_IMPORT'};}
        const inserted=this.db.insertVideoIfAbsent({...metadata,file_path:candidate.file_path,folder_id:candidate.folder_id,status:'imported',storyboard_path:null,storyboard_status:'pending',storyboard_error:null,source_identity_json:JSON.stringify(after)});
        const record=this.db.getVideoImportRecord(inserted.video.id);release({record});
        if(!inserted.created){const state=this.#identityState(record,candidate.source_identity);return state==='changed'?{conflict:true,error_code:'SOURCE_CHANGED_SAME_PATH',record}:{duplicate:true,record,warning_code:state==='unknown'?'SOURCE_IDENTITY_UNVERIFIED':null};}
        index.set(key,record);return {created:true,record,video:inserted.video};
      }finally{
        if(this.inflightFiles.get(key)===lock)this.inflightFiles.delete(key);
      }
    }
  }

  async #run(jobId){
    const job=this.jobs.get(jobId);if(!job)return;
    try{
      job.created_ms=Date.now();job.status='initializing';job.phase='initializing';this.#touch(job);
      this.pathIndex=await this.#buildPathIndex();
      job.status='scanning';job.phase='scanning';this.#touch(job);
      const plan=await this.#buildPlan(job.request,job,this.pathIndex);
      if(job.cancel_requested){this.#finishCancelled(job);return;}
      job.candidates=plan;job.status='importing';job.phase='importing';this.#touch(job);
      const storyboardQueue=[];
      for(const candidate of plan){
        if(job.cancel_requested){this.#finishCancelled(job);return;}
        const item=candidate.item;
        if(item.cancel_requested){this.#markCancelled(job,item,'VIDEO_REMOVED_DURING_IMPORT');continue;}
        if(candidate.preflight_error){this.#markImportFailure(job,item,candidate.preflight_error);continue;}
        const existingId=candidate.existing_id||item.video_id;
        if(existingId){
          const existing=this.db.getVideoImportRecord(existingId);
          if(!existing){this.#markCancelled(job,item,'VIDEO_REMOVED_DURING_IMPORT');continue;}
          const currentIdentity=await fs.promises.stat(candidate.file_path,{bigint:true}).then(identityFromStat).catch(()=>null);
          if(!currentIdentity||!sameIdentity(candidate.source_identity,currentIdentity)){job.duplicates=Math.max(0,job.duplicates-1);this.#markImportFailure(job,item,'SOURCE_CHANGED_SAME_PATH','conflict');continue;}
          const state=this.#identityState(existing,currentIdentity);
          if(state==='changed'){job.duplicates=Math.max(0,job.duplicates-1);this.#markImportFailure(job,item,'SOURCE_CHANGED_SAME_PATH','conflict');continue;}
          item.video_id=existing.id;item.status='duplicate';item.stage='importing';item.warning_code=state==='unknown'?'SOURCE_IDENTITY_UNVERIFIED':null;job.processed++;
          const ready=state==='unknown'||(existing.storyboard_status==='ready'&&existing.storyboard_path&&fs.existsSync(existing.storyboard_path));
          if(ready){item.storyboard_status=state==='unknown'?(existing.storyboard_status||'not_started'):'ready';job.completed++;this.#touch(job);continue;}
          item.storyboard_status='pending';item.stage='storyboarding';job.storyboard_total++;storyboardQueue.push({candidate,record:existing});this.#touch(job);continue;
        }
        const result=await this.#insertUnique(candidate,job,this.pathIndex);
        if(result.cancelled){this.#markCancelled(job,item,result.error_code);continue;}
        if(result.conflict){this.#markImportFailure(job,item,result.error_code,'conflict');continue;}
        if(result.duplicate){
          const record=result.record;item.video_id=record?.id||null;item.status='duplicate';item.stage='importing';item.warning_code=result.warning_code||null;job.duplicates++;job.processed++;
          if(result.warning_code||!record){item.storyboard_status=record?.storyboard_status||'not_started';job.completed++;this.#touch(job);continue;}
          const ready=record.storyboard_status==='ready'&&record.storyboard_path&&fs.existsSync(record.storyboard_path);
          if(ready){item.storyboard_status='ready';job.completed++;this.#touch(job);continue;}
          job.storyboard_total++;item.storyboard_status='pending';item.stage='storyboarding';storyboardQueue.push({candidate,record});this.#touch(job);continue;
        }
        const video=result.video;item.video_id=video.id;item.status='imported';item.stage='importing';item.storyboard_status='pending';item.newly_inserted=true;
        job.inserted++;job.processed++;job.storyboard_total++;storyboardQueue.push({candidate,record:result.record});this.#touch(job);
      }
      if(!storyboardQueue.length){this.#completeJob(job);return;}
      job.status='storyboarding';job.phase='storyboarding';this.#touch(job);
      let cursor=0;
      const worker=async()=>{
        while(cursor<storyboardQueue.length){
          if(job.cancel_requested)return;
          const {candidate,record}=storyboardQueue[cursor++],item=candidate.item;
          if(item.cancel_requested){this.#markStoryboardCancelled(job,item,'VIDEO_REMOVED_DURING_IMPORT');continue;}
          const current=this.db.getVideoImportRecord(record.id);
          if(!current||current.file_path!==candidate.file_path){this.#markStoryboardCancelled(job,item,'VIDEO_REMOVED_DURING_IMPORT');continue;}
          item.stage='storyboarding';item.status=item.status==='duplicate'?'duplicate':'storyboarding';item.storyboard_status='generating';
          this.db.updateStoryboardState(record.id,'generating',null,current.file_path);this.#touch(job);
          await this.engine.generateStoryboard(this.db.getVideoById(record.id)).catch(()=>null);
          const latest=this.db.getVideoImportRecord(record.id);
          if(!latest||latest.file_path!==candidate.file_path){this.#markStoryboardCancelled(job,item,'VIDEO_REMOVED_DURING_IMPORT');continue;}
          if(latest.storyboard_status==='ready'&&latest.storyboard_path&&fs.existsSync(latest.storyboard_path)){
            item.storyboard_status='ready';item.stage='completed';item.status=item.status==='duplicate'?'duplicate':'completed';job.storyboard_done++;job.completed++;
          }else{
            item.storyboard_status=latest.storyboard_status||'failed';item.stage='completed';item.status='failed';item.error_code=latest.storyboard_error||'STORYBOARD_FAILED';
            job.storyboard_failed++;job.failed++;job.completed++;job.errors.push({file_name:item.file_name,error_code:item.error_code});
          }
          this.#touch(job);
        }
      };
      await Promise.all(Array.from({length:Math.min(2,storyboardQueue.length)},()=>worker()));
      if(job.cancel_requested)this.#finishCancelled(job);else this.#completeJob(job);
    }catch(error){
      if(job.cancel_requested||error?.code==='IMPORT_CANCELLED')this.#finishCancelled(job);
      else this.#failJob(jobId,this.#safeJobError(error));
    }finally{
      const latest=this.jobs.get(jobId);
      if(latest&&TERMINAL.has(latest.status)&&this.requests.get(latest.request_signature)===jobId)this.requests.delete(latest.request_signature);
    }
  }

  #markImportFailure(job,item,errorCode,status='failed'){item.stage='completed';item.status=status;item.error_code=errorCode;job.import_failed++;job.failed++;job.processed++;job.completed++;job.errors.push({file_name:item.file_name,error_code:errorCode});this.#touch(job);}
  #markCancelled(job,item,errorCode){item.stage='completed';item.status='cancelled';item.error_code=errorCode;job.cancelled++;job.processed++;job.completed++;this.#touch(job);}
  #markStoryboardCancelled(job,item,errorCode){item.stage='completed';item.status='cancelled';item.storyboard_status='not_started';item.error_code=errorCode;job.cancelled++;job.storyboard_cancelled++;job.completed++;this.#touch(job);}
  #completeJob(job){if(job.cancel_requested){this.#finishCancelled(job);return;}job.status=job.failed?'completed_with_errors':'completed';job.phase='completed';job.storyboard_pending=Math.max(0,job.storyboard_total-job.storyboard_done-job.storyboard_failed-job.storyboard_cancelled);this.#touch(job);}
  #finishCancelled(job){job.status='cancelled';job.phase='cancelled';job.percent=100;job.storyboard_pending=Math.max(0,job.storyboard_total-job.storyboard_done-job.storyboard_failed-job.storyboard_cancelled);this.#touch(job);}
  #failJob(jobId,errorCode){const job=this.jobs.get(jobId);if(!job)return;job.status='failed';job.phase='failed';job.error_code=errorCode;job.error_message=this.#jobErrorMessage(errorCode);job.total_known=true;job.total=job.discovered;job.failed++;job.errors.push({file_name:null,error_code:errorCode});this.#touch(job);}
  #safeJobError(error){const code=error?.code;if(['INVALID_PARENT_FOLDER','DIRECTORY_UNAVAILABLE','DIRECTORY_READ_FAILED','BROWSE_DIRECTORY_UNAVAILABLE','INVALID_CHILD_DIRECTORY','IMPORT_JOB_INVALID'].includes(code))return code;return 'IMPORT_JOB_FAILED';}
  #jobErrorMessage(code){return ({INVALID_PARENT_FOLDER:'目标父分类不存在，请刷新后重试',DIRECTORY_UNAVAILABLE:'目录不可用或不是文件夹',DIRECTORY_READ_FAILED:'读取目录失败',BROWSE_DIRECTORY_UNAVAILABLE:'当前浏览目录不可用',INVALID_CHILD_DIRECTORY:'所选项必须是当前浏览目录中的直接子文件夹',IMPORT_JOB_INVALID:'导入请求无效',IMPORT_JOB_FAILED:'导入任务失败，请检查目录权限和媒体状态'})[code]||'导入任务失败，请检查目录权限和媒体状态';}
}
