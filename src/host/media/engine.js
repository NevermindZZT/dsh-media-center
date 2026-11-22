import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { extractCaptureTime } from './capture-time.js';
import { VideoImportJobManager } from './import-job-manager.js';

function identityFromStat(stat){return {dev:String(stat.dev),ino:String(stat.ino),size:String(stat.size),mtimeNs:String(stat.mtimeNs),ctimeNs:String(stat.ctimeNs)};}
function sourceIdentity(filePath){return identityFromStat(fs.statSync(filePath,{bigint:true}));}
async function directoryUsage(dir){
  let total=0;
  let entries;try{entries=await fs.promises.readdir(dir,{withFileTypes:true});}catch{return 0;}
  for(const entry of entries){
    const target=path.join(dir,entry.name);
    if(entry.isSymbolicLink())continue;
    if(entry.isDirectory())total+=await directoryUsage(target);
    else if(entry.isFile()){try{total+=(await fs.promises.stat(target)).size;}catch{}}
  }
  return total;
}
function sameIdentity(a,b){return !!a&&!!b&&a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;}

const execFileAsync = promisify(execFile);

export class MediaEngine {
  constructor(db) {
    this.db = db;
    this.storyboardTasks = new Map();
    this.previewTasks = new Map();
    this.previewStates = new Map();
    this.importJobManager = new VideoImportJobManager(this);
    setImmediate(() => { this.recoverPendingStoryboards().catch(error => console.warn('[MediaEngine] Storyboard recovery failed:', error.message)); });
  }

  async recoverPendingStoryboards(){
    let rows;
    try{rows=this.db.getPendingStoryboardVideos();}catch{return;}
    rows=[...rows,...this.db.getReadyStoryboardVideos()];
    let cursor=0;
    const worker=async()=>{
      while(cursor<rows.length){
        const row=rows[cursor++];
        try{
          const video=this.db.getVideoById(row.id);
          if(!video||video.file_path!==row.file_path)continue;
          if(video.storyboard_status==='generating')this.db.updateStoryboardState(video.id,'pending',null,video.file_path);
          if(video.storyboard_status==='ready'){
            const exists=video.storyboard_path?await fs.promises.access(video.storyboard_path).then(()=>true,()=>false):false;
            if(exists)continue;
            this.db.updateStoryboardState(video.id,'pending','STORYBOARD_FILE_MISSING',video.file_path);
          }
          await this.generateStoryboard(video);
        }catch{return;}
      }
    };
    await Promise.all(Array.from({length:Math.min(2,rows.length)},()=>worker()));
  }

  async getBinaries() {
    let ffmpeg = this.db.getSetting('ffmpeg_path');
    let ffprobe = this.db.getSetting('ffprobe_path');

    if (!ffmpeg) {
      ffmpeg = await this.detectCommand('ffmpeg');
    }
    if (!ffprobe) {
      ffprobe = await this.detectCommand('ffprobe');
    }

    const available = !!(ffmpeg && ffprobe);
    return {
      ffmpeg,
      ffprobe,
      available,
      reason: available ? null : '未检测到 ffmpeg 或 ffprobe，请在设置中指定可执行文件路径'
    };
  }

  async detectCommand(name) {
    // Try which / where
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'where.exe' : 'which';
    try {
      const { stdout } = await execFileAsync(cmd, [name]);
      const line = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
      if (line && fs.existsSync(line)) {
        return line;
      }
    } catch {}

    // Check common locations on Windows
    if (isWin) {
      const homeDir = process.env.USERPROFILE || 'C:\\Users\\Default';
      const commonPaths = [
        path.join(homeDir, '.local', 'bin', `${name}.exe`),
        `C:\\ffmpeg\\bin\\${name}.exe`,
        `D:\\ffmpeg\\bin\\${name}.exe`,
        `C:\\Program Files\\ffmpeg\\bin\\${name}.exe`
      ];
      for (const p of commonPaths) {
        if (fs.existsSync(p)) return p;
      }
    }
    return null;
  }

  async probeCaptureTime(filePath, ffprobe) {
    const { stdout } = await execFileAsync(ffprobe, [
      '-v', 'quiet', '-print_format', 'json',
      '-show_entries', 'format_tags:stream=codec_type:stream_tags', filePath
    ], { timeout: 15000, maxBuffer: 1024 * 1024 });
    return extractCaptureTime(JSON.parse(stdout));
  }

  // One coalesced, bounded pass per runtime; failures can retry after the next reload.
  async ensureCaptureTimes() {
    if (this.captureTimeRefresh) return this.captureTimeRefresh;
    this.captureTimeAttempts ||= new Set();
    const run = async () => {
      const pending = this.db.getPendingCaptureTimes().filter(v => !this.captureTimeAttempts.has(v.id));
      if (!pending.length) return;
      const { ffprobe } = await this.getBinaries();
      if (!ffprobe) return; // Do not mark unknown: retry after the executable is configured.
      let index = 0;
      const worker = async () => {
        while (index < pending.length) {
          const video = pending[index++];
          this.captureTimeAttempts.add(video.id);
          try {
            this.db.updateCaptureTime(video.id, await this.probeCaptureTime(video.file_path, ffprobe));
          } catch {
            // Offline/missing sources are distinct from media with no recording tag.
            this.db.updateCaptureTime(video.id, { captured_at: null, captured_at_source: 'unavailable' });
          }
        }
      };
      await Promise.all([worker(), worker()]);
    };
    this.captureTimeRefresh = run();
    try { await this.captureTimeRefresh; }
    finally { this.captureTimeRefresh = null; }
  }

  // Extract video metadata with ffprobe
  async probeVideo(filePath) {
    const bins = await this.getBinaries();
    if (!bins.ffprobe) {
      // Fallback: minimal stat
      const stat = fs.statSync(filePath);

      return {
        file_name: path.basename(filePath),
        file_path: filePath,
        file_size: stat.size,
        duration: 0,
        width: 1920,
        height: 1080,
        fps: 30,
        codec: 'unknown',
        bitrate: 0,
        audio_channels: 2,
        sample_rate: 44100,
        captured_at: null,
        captured_at_source: 'unavailable'
      };
    }

    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const { stdout } = await execFileAsync(bins.ffprobe, args, { maxBuffer: 10 * 1024 * 1024 });
    const meta = JSON.parse(stdout);

    const videoStream = (meta.streams || []).find(s => s.codec_type === 'video') || {};
    const audioStream = (meta.streams || []).find(s => s.codec_type === 'audio') || {};
    const format = meta.format || {};

    let fps = 30;
    if (videoStream.r_frame_rate) {
      const parts = videoStream.r_frame_rate.split('/');
      if (parts.length === 2 && Number(parts[1]) > 0) {
        fps = Math.round((Number(parts[0]) / Number(parts[1])) * 100) / 100;
      }
    }

    const stat = fs.statSync(filePath);

    const captureTime = extractCaptureTime(meta);

    return {
      file_name: path.basename(filePath),
      file_path: filePath,
      file_size: stat.size,
      duration: Math.round(Number(format.duration || videoStream.duration || 0) * 100) / 100,
      width: Number(videoStream.width || 0),
      height: Number(videoStream.height || 0),
      fps,
      codec: String(videoStream.codec_name || '').toUpperCase(),
      video_profile: String(videoStream.profile || ''),
      pix_fmt: String(videoStream.pix_fmt || ''),
      bitrate: Number(format.bit_rate || videoStream.bit_rate || 0),
      audio_channels: Number(audioStream.channels || 0),
      sample_rate: Number(audioStream.sample_rate || 0),
      ...captureTime
    };
  }

  // One single-flight storyboard generation per video id; source files remain read-only.
  async generateStoryboard(video, options={}) {
    if(!video?.id||typeof video.file_path!=='string')return null;
    const active=this.storyboardTasks.get(video.id);if(active)return active;
    const task=this._generateStoryboard(video,options);
    this.storyboardTasks.set(video.id,task);
    try{return await task;}finally{if(this.storyboardTasks.get(video.id)===task)this.storyboardTasks.delete(video.id);}
  }

  regenerateStoryboard(videoId){
    const current=this.db.getVideoById(videoId);if(!current)return null;
    this.db.updateStoryboardState(videoId,'pending',null,current.file_path);
    this.generateStoryboard(current,{force:true}).catch(()=>null);
    return {status:'generating'};
  }

  async _generateStoryboard(video,{force=false}={}) {
    const current=this.db.getVideoById(video.id),importRecord=this.db.getVideoImportRecord(video.id);
    if(!current||current.file_path!==video.file_path)return null;
    let before;
    try{before=sourceIdentity(current.file_path);}catch{this.db.updateStoryboardState(video.id,'failed','source_unavailable',current.file_path);return null;}
    try{
      const savedIdentity=importRecord?.source_identity_json?JSON.parse(importRecord.source_identity_json):null;
      if(savedIdentity&&!sameIdentity(savedIdentity,before)){this.db.updateStoryboardState(video.id,'failed','source_changed',current.file_path);return null;}
    }catch{this.db.updateStoryboardState(video.id,'failed','source_identity_invalid',current.file_path);return null;}
    if(!force&&current.storyboard_path&&fs.existsSync(current.storyboard_path)){
      this.db.updateStoryboardState(video.id,'ready',null,current.file_path);
      return current.storyboard_path;
    }
    let bins;try{bins=await this.getBinaries();}catch{this.db.updateStoryboardState(video.id,'failed','binary_detection_failed',current.file_path);return null;}
    if(!bins.ffmpeg){this.db.updateStoryboardState(video.id,'failed','ffmpeg_missing',current.file_path);return null;}
    if(!Number.isFinite(Number(current.duration))||Number(current.duration)<=0){this.db.updateStoryboardState(video.id,'failed','invalid_duration',current.file_path);return null;}
    this.db.updateStoryboardState(video.id,'generating',null,current.file_path);
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify(before)).digest('hex').slice(0,20);
    const storyboardRoot=fs.realpathSync(this.db.storyboardsDir),safeId=String(video.id).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,80)||'video';
    const outPath=path.join(storyboardRoot,`${safeId}_${fingerprint}_storyboard.jpg`);
    const isUsable=target=>{
      try{return fs.statSync(target).isFile()&&fs.statSync(target).size>32&&fs.readFileSync(target).subarray(0,2).equals(Buffer.from([0xff,0xd8]));}catch{return false;}
    };
    if(force&&fs.existsSync(outPath)){
      try{if(path.dirname(fs.realpathSync(outPath))===storyboardRoot)fs.rmSync(outPath,{force:true});}
      catch{this.db.updateStoryboardState(video.id,'failed','invalid_cache_path',current.file_path);return null;}
    }
    if(isUsable(outPath))return this.db.setVideoStoryboard(video.id,current.file_path,outPath)?outPath:null;
    if(fs.existsSync(outPath)){
      try{if(path.dirname(fs.realpathSync(outPath))!==storyboardRoot){this.db.updateStoryboardState(video.id,'failed','invalid_cache_path',current.file_path);return null;}fs.rmSync(outPath,{force:true});}
      catch{this.db.updateStoryboardState(video.id,'failed','invalid_cache_path',current.file_path);return null;}
    }
    const tempDir=fs.mkdtempSync(path.join(storyboardRoot,`${safeId}_storyboard-`));
    const tempPath=path.join(tempDir,'storyboard.jpg');
    const duration=Math.max(1,Number(current.duration));
    const vf=`fps=16/${duration},scale=320:180,tile=4x4`;
    try{
      const timeout=Math.max(180000,Math.min(900000,Math.round(duration*4000)+60000));
      await execFileAsync(bins.ffmpeg,['-nostdin','-i',current.file_path,'-map','0:v:0','-an','-sn','-dn','-vf',vf,'-frames:v','1','-q:v','3','-n',tempPath],{timeout,maxBuffer:2*1024*1024,windowsHide:true});
      if(!isUsable(tempPath))throw new Error('invalid_storyboard');
      const stillExists=this.db.getVideoById(video.id);
      if(!stillExists||stillExists.file_path!==current.file_path){return null;}
      if(!sameIdentity(before,sourceIdentity(current.file_path))){this.db.updateStoryboardState(video.id,'failed','source_changed',current.file_path);return null;}
      if(!fs.existsSync(outPath))fs.renameSync(tempPath,outPath);
      else if(!isUsable(outPath))throw new Error('invalid_cached_storyboard');
      if(this.db.setVideoStoryboard(video.id,current.file_path,outPath))return outPath;
      // The catalog record was removed or replaced while FFmpeg was running. Remove only our cache output.
      if(fs.existsSync(outPath)&&path.dirname(fs.realpathSync(outPath))===storyboardRoot){try{fs.rmSync(outPath,{force:true});}catch{}}
      return null;
    }catch(error){
      const code=error?.killed?'storyboard_timeout':'storyboard_generation_failed';
      if(this.db.getVideoById(video.id)?.file_path===current.file_path)this.db.updateStoryboardState(video.id,'failed',code,current.file_path);
      return null;
    }finally{try{fs.rmSync(tempDir,{recursive:true,force:true});}catch{}}
  }
  #previewCache(video, identity){
    const root=fs.realpathSync(this.db.previewsDir),safeId=String(video.id).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,80)||'video';
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0,20);
    return {root,path:path.join(root,`${safeId}_${fingerprint}_h264.mp4`)};
  }

  openInSystemPlayer(videoId){
    const video=this.db.getVideoById(videoId);
    if(!video||typeof video.file_path!=='string')return false;
    let stat;try{stat=fs.statSync(video.file_path);}catch{return false;}
    if(!stat.isFile())return false;
    const command=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open';
    const child=spawn(command,[video.file_path],{detached:true,stdio:'ignore',windowsHide:true});
    child.unref();
    return true;
  }

  #cacheDirs(){
    return {
      storyboards:this.db.storyboardsDir,
      previews:this.db.previewsDir,
      keyframes:this.db.keyframesDir,
      music_spectrograms:path.join(this.db.cacheDir,'music-spectrograms')
    };
  }

  async getCacheUsage(){
    const dirs=this.#cacheDirs(),usage={};
    for(const [key,dir] of Object.entries(dirs))usage[key]=await directoryUsage(dir);
    usage.total=Object.values(usage).reduce((sum,value)=>sum+value,0);
    return usage;
  }

  clearCache(scope='all'){
    const dirs=this.#cacheDirs(),selected=scope==='previews'?{previews:dirs.previews}:dirs;
    for(const [key,dir] of Object.entries(selected)){
      let entries;try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{continue;}
      for(const entry of entries){
        try{fs.rmSync(path.join(dir,entry.name),{recursive:true,force:true});}catch{}
      }
    }
    if(scope!=='previews'){
      this.db.resetStoryboardCache();
      this.previewStates.clear();
    }else{
      this.previewStates.clear();
    }
    return true;
  }

  clearPreviewCache(videoId){
    const video=this.db.getVideoById(videoId);if(!video)return false;
    const safeId=String(video.id).replace(/[^A-Za-z0-9_-]/g,'_').slice(0,80)||'video';
    let entries;try{entries=fs.readdirSync(this.db.previewsDir,{withFileTypes:true});}catch{return false;}
    for(const entry of entries)if(entry.isFile()&&entry.name.startsWith(`${safeId}_`)){try{fs.rmSync(path.join(this.db.previewsDir,entry.name),{force:true});}catch{}}
    this.previewStates.delete(video.id);
    return true;
  }

  async probeCodecDetails(filePath){
    const bins=await this.getBinaries();if(!bins.ffprobe)return null;
    try{
      const {stdout}=await execFileAsync(bins.ffprobe,['-v','error','-select_streams','v:0','-show_entries','stream=profile,pix_fmt','-of','json',filePath],{maxBuffer:1024*1024,timeout:30000,windowsHide:true});
      const stream=(JSON.parse(stdout).streams||[])[0]||{};
      return {video_profile:String(stream.profile||''),pix_fmt:String(stream.pix_fmt||'')};
    }catch{return null;}
  }

  async getPreviewInfo(videoId){
    let video=this.db.getVideoById(videoId);if(!video)return null;
    const codec=String(video.codec||'').toUpperCase();
    if(codec==='HEVC'&&(!video.video_profile||!video.pix_fmt)){
      const details=await this.probeCodecDetails(video.file_path);
      if(details){video={...video,...details};this.db.upsertVideo({id:video.id,...details});}
    }
    const required=!['H264','AVC1','AVC'].includes(codec);
    const detail={codec,video_profile:video.video_profile||'',pix_fmt:video.pix_fmt||''};
    if(!required)return {required:false,status:'not_needed',...detail};
    let identity;
    try{identity=sourceIdentity(video.file_path);}catch{return {required:true,status:'source_unavailable',...detail};}
    const cache=this.#previewCache(video,identity);
    try{const stat=fs.statSync(cache.path);if(stat.isFile()&&stat.size>1024)return {required:true,status:'ready',path:cache.path,...detail};}catch{}
    if(this.previewTasks.has(video.id))return {required:true,status:'generating',...detail};
    const failed=this.previewStates.get(video.id);
    return failed==='failed'?{required:true,status:'failed',...detail}:{required:true,status:'missing',...detail};
  }

  async startPreview(videoId){
    const video=this.db.getVideoById(videoId);if(!video)return null;
    const info=await this.getPreviewInfo(videoId);if(!info?.required||['ready','generating','source_unavailable','not_needed'].includes(info.status))return info;
    let identity;try{identity=sourceIdentity(video.file_path);}catch{return info;}
    const cache=this.#previewCache(video,identity);
    this.previewStates.set(video.id,'generating');
    const task=this.#generatePreview(video,identity,cache).finally(()=>{this.previewTasks.delete(video.id);});
    this.previewTasks.set(video.id,task);
    return {...info,status:'generating'};
  }

  async getPreviewPath(videoId){
    const info=await this.getPreviewInfo(videoId);
    return info?.required&&info.status==='ready'?info.path:null;
  }

  async #generatePreview(video,identity,cache){
    const tempDir=fs.mkdtempSync(path.join(cache.root,'preview-'));
    try{
      const bins=await this.getBinaries();if(!bins.ffmpeg)throw new Error('ffmpeg_missing');
      const duration=Math.max(1,Number(video.duration)||1);
      const timeout=Math.max(300000,Math.min(1800000,Math.round(duration*3000)));
      const tempPath=path.join(tempDir,'preview.mp4');
      await execFileAsync(bins.ffmpeg,['-nostdin','-i',video.file_path,'-map','0:v:0','-map','0:a:0?',
        '-vf','scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2',
        '-c:v','libx264','-preset','ultrafast','-crf','28','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k',
        '-movflags','+faststart','-y',tempPath],{timeout,maxBuffer:4*1024*1024,windowsHide:true});
      const stat=fs.statSync(tempPath);if(!stat.isFile()||stat.size<1024)throw new Error('invalid_preview');
      try{if(!sameIdentity(identity,sourceIdentity(video.file_path)))throw new Error('source_changed');}catch(error){throw error;}
      if(fs.existsSync(cache.path))fs.rmSync(cache.path,{force:true});
      fs.renameSync(tempPath,cache.path);
      this.previewStates.set(video.id,'ready');
    }catch{this.previewStates.set(video.id,'failed');}
    finally{try{fs.rmSync(tempDir,{recursive:true,force:true});}catch{}}
  }

  // Extract keyframe for a given timestamp
  async extractKeyframe(video, timestampSec, shotIndex) {
    const bins = await this.getBinaries();
    if (!bins.ffmpeg) return null;

    const outPath = path.join(this.db.keyframesDir, `${video.id}_shot_${shotIndex}.jpg`);
    const args = [
      '-y',
      '-ss', String(Math.max(0, timestampSec)),
      '-i', video.file_path,
      '-vframes', '1',
      '-q:v', '2',
      outPath
    ];

    try {
      await execFileAsync(bins.ffmpeg, args);
      return fs.existsSync(outPath) ? outPath : null;
    } catch {
      return null;
    }
  }

  // Detailed result distinguishes successful empty detection from missing tools/audio/errors.
  async detectSilenceResult(video) {
    let bins;
    try { bins = await this.getBinaries(); }
    catch { return { status: 'unavailable', reason: 'binary_detection_failed', intervals: null }; }
    if (!bins.ffmpeg) return { status: 'unavailable', reason: 'ffmpeg_missing', intervals: null };
    if (!video || typeof video.file_path !== 'string' || !video.file_path) {
      return { status: 'error', reason: 'invalid_video', intervals: null };
    }
    // When available, probing distinguishes a valid no-audio file from a decoding failure.
    if (bins.ffprobe) {
      try {
        const { stdout } = await execFileAsync(bins.ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=index', '-of', 'json', video.file_path], { maxBuffer: 1024 * 1024, timeout: 30000 });
        const parsed = JSON.parse(stdout);
        if (!Array.isArray(parsed.streams)) return { status: 'error', reason: 'probe_invalid_response', intervals: null };
        if (!parsed.streams.length) return { status: 'unavailable', reason: 'no_audio_stream', intervals: null };
      } catch { return { status: 'error', reason: 'audio_probe_failed', intervals: null }; }
    }
    const threshold = this.db.getSetting('silence_threshold_db', '-30');
    const minDuration = this.db.getSetting('silence_duration_s', '0.5');
    const args = ['-nostdin', '-i', video.file_path, '-map', '0:a:0', '-af', `silencedetect=noise=${threshold}dB:d=${minDuration}`, '-f', 'null', '-'];
    return new Promise(resolve => {
      let proc;
      try { proc = spawn(bins.ffmpeg, args, { windowsHide: true }); }
      catch { resolve({ status: 'error', reason: 'ffmpeg_spawn_failed', intervals: null }); return; }
      const intervals = [];
      let stderrRemainder = '', currentStart = null, noAudio = false, spawnFailed = false;
      const processLine = line => {
        if (/Stream map .*matches no streams|does not contain any stream/i.test(line)) noAudio = true;
        const start = line.match(/silence_start:\s*([0-9.]+)/);
        if (start) currentStart = Number(start[1]);
        const end = line.match(/silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/);
        if (end && currentStart !== null) {
          const stop = Number(end[1]), duration = Number(end[2]);
          if (Number.isFinite(currentStart) && Number.isFinite(stop) && Number.isFinite(duration)) {
            intervals.push({ start: Math.round(currentStart * 100) / 100, end: Math.round(stop * 100) / 100, duration: Math.round(duration * 100) / 100 });
          }
          currentStart = null;
        }
      };
      proc.stderr.on('data', data => {
        stderrRemainder += data.toString();
        const lines = stderrRemainder.split(/\r?\n/);
        stderrRemainder = lines.pop().slice(-16384);
        for (const line of lines) processLine(line);
      });
      proc.on('error', () => { spawnFailed = true; });
      proc.on('close', code => {
        processLine(stderrRemainder);
        if (spawnFailed) return resolve({ status: 'error', reason: 'ffmpeg_spawn_failed', intervals: null });
        if (code !== 0) return resolve({ status: noAudio ? 'unavailable' : 'error', reason: noAudio ? 'no_audio_stream' : 'ffmpeg_failed', intervals: null });
        if (currentStart !== null) return resolve({ status: 'error', reason: 'incomplete_silence_output', intervals: null });
        resolve({ status: 'ok', reason: null, intervals });
      });
    });
  }

  // Compatibility: callers expecting an array still get one on success; failure is null, never [].
  async detectSilence(video) {
    const result = await this.detectSilenceResult(video);
    return result.status === 'ok' ? result.intervals : null;
  }

  // No real beat detector is integrated. Do not manufacture a tempo or beat grid.
  async detectBpmAndBeats(_video) {
    return { status: 'unavailable', reason: 'tempo_detector_not_integrated', bpm: null, beats: null };
  }

  // Auto detect initial shots (Scene change or uniform sampling)
  async detectInitialShots(video) {
    const duration = Math.max(1, video.duration || 10);
    const bins = await this.getBinaries();

    // Default shot interval: divide into reasonable 3-8s shots
    const targetShotCount = Math.max(1, Math.min(16, Math.round(duration / 5)));
    const shotDuration = duration / targetShotCount;

    const shots = [];
    for (let i = 0; i < targetShotCount; i++) {
      const startTime = Math.round((i * shotDuration) * 100) / 100;
      const endTime = Math.round(Math.min(duration, (i + 1) * shotDuration) * 100) / 100;
      const midTime = (startTime + endTime) / 2;

      let keyframePath = null;
      if (bins.ffmpeg) {
        keyframePath = await this.extractKeyframe(video, midTime, i + 1);
      }

      shots.push({
        shot_index: i + 1,
        start_time: startTime,
        end_time: endTime,
        duration: Math.round((endTime - startTime) * 100) / 100,
        shot_type: i % 3 === 0 ? '全景' : (i % 3 === 1 ? '中景' : '特写'),
        camera_movement: i % 2 === 0 ? '固定' : '推镜头',
        subject: `镜头 ${i + 1} 画面主体`,
        visual_description: `时间段 ${startTime}s - ${endTime}s 的镜头内容，等待 AI 深度解析`,
        composition: '标准构图',
        tags: ['待深度解析'],
        quality_score: 3.5,
        keyframe_path: keyframePath
      });
    }

    return shots;
  }

  startImportJob(request){return this.importJobManager.start(request);}
  getImportJob(jobId){return this.importJobManager.get(jobId);}
  waitForImportJob(jobId){return this.importJobManager.wait(jobId);}
  cancelImportForVideo(videoId){return this.importJobManager.cancelForVideo(videoId);}
  cancelImportJob(jobId){return this.importJobManager.cancelJob(jobId);}
  async scanAndImportDirectories(directoryPaths,expectedParentPath,targetParentFolderId=null){
    return this.importJobManager.runLegacy({kind:'subfolders',directory_paths:directoryPaths,parent_directory_path:expectedParentPath,parent_folder_id:targetParentFolderId});
  }
  async scanAndImportDirectory(dirPath,targetParentFolderId=null){
    return this.importJobManager.runLegacy({kind:'directory',directory_path:dirPath,folder_id:targetParentFolderId});
  }
  async importFiles(filePaths,folderId=null){
    return this.importJobManager.runLegacy({kind:'files',file_paths:filePaths,folder_id:folderId});
  }
  // Browse local filesystem for folders and video files
  browseFileSystem(requestedPath) {
    const isWin = process.platform === 'win32';
    const homedir = os.homedir();
    const videoExts = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm', '.flv', '.m4v', '.wmv']);
    const audioExts = new Set(['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.aiff', '.aif', '.wma']);

    // Common quick places
    const quickPlaces = [
      { name: '项目工作区', path: this.db.workspaceRoot },
      { name: '用户主目录', path: homedir },
      { name: '桌面', path: path.join(homedir, 'Desktop') },
      { name: '视频目录', path: path.join(homedir, 'Videos') },
      { name: '下载目录', path: path.join(homedir, 'Downloads') }
    ].filter(p => fs.existsSync(p.path));

    // Logical drive roots
    const driveRoots = [];
    if (isWin) {
      for (let i = 65; i <= 90; i++) {
        const d = String.fromCharCode(i) + ':\\';
        try {
          if (fs.existsSync(d)) driveRoots.push({ name: `本地磁盘 (${d})`, path: d });
        } catch {}
      }
    } else {
      driveRoots.push({ name: '根目录 (/)', path: '/' });
    }

    let targetDir = requestedPath ? path.resolve(requestedPath) : this.db.workspaceRoot;
    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
      targetDir = this.db.workspaceRoot;
    }

    let parentDir = path.dirname(targetDir);
    if (parentDir === targetDir) {
      parentDir = null; // reached root
    }

    const folders = [];
    const videoFiles = [];
    const audioFiles = [];

    try {
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      for (const entry of entries) {
        // Skip hidden or system entries
        if (entry.name.startsWith('.') || entry.name.startsWith('$')) continue;

        const fullPath = path.join(targetDir, entry.name);
        try {
          if (entry.isDirectory()) {
            folders.push({
              name: entry.name,
              path: fullPath
            });
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (videoExts.has(ext) || audioExts.has(ext)) {
              const stat = fs.statSync(fullPath);
              const item = { name:entry.name, path:fullPath, size:stat.size, ext:ext.slice(1).toUpperCase() };
              if (videoExts.has(ext)) videoFiles.push(item);
              if (audioExts.has(ext)) audioFiles.push(item);
            }
          }
        } catch {
          // ignore permission errors on single items
        }
      }
    } catch (e) {
      console.warn('[browseFileSystem] Read dir error:', e.message);
    }

    // Sort alphabetically
    folders.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    videoFiles.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    audioFiles.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    return {
      current_path: targetDir,
      parent_path: parentDir,
      quick_places: quickPlaces,
      drive_roots: driveRoots,
      folders,
      video_files: videoFiles,
      audio_files: audioFiles
    };
  }
}
