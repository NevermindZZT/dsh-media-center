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
function sameIdentity(a,b){return !!a&&!!b&&a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;}

const execFileAsync = promisify(execFile);

export class MediaEngine {
  constructor(db) {
    this.db = db;
    this.storyboardTasks = new Map();
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
      bitrate: Number(format.bit_rate || videoStream.bit_rate || 0),
      audio_channels: Number(audioStream.channels || 0),
      sample_rate: Number(audioStream.sample_rate || 0),
      ...captureTime
    };
  }

  // One single-flight storyboard generation per video id; source files remain read-only.
  async generateStoryboard(video) {
    if(!video?.id||typeof video.file_path!=='string')return null;
    const active=this.storyboardTasks.get(video.id);if(active)return active;
    const task=this._generateStoryboard(video);
    this.storyboardTasks.set(video.id,task);
    try{return await task;}finally{if(this.storyboardTasks.get(video.id)===task)this.storyboardTasks.delete(video.id);}
  }

  async _generateStoryboard(video) {
    const current=this.db.getVideoById(video.id),importRecord=this.db.getVideoImportRecord(video.id);
    if(!current||current.file_path!==video.file_path)return null;
    let before;
    try{before=sourceIdentity(current.file_path);}catch{this.db.updateStoryboardState(video.id,'failed','source_unavailable',current.file_path);return null;}
    try{
      const savedIdentity=importRecord?.source_identity_json?JSON.parse(importRecord.source_identity_json):null;
      if(savedIdentity&&!sameIdentity(savedIdentity,before)){this.db.updateStoryboardState(video.id,'failed','source_changed',current.file_path);return null;}
    }catch{this.db.updateStoryboardState(video.id,'failed','source_identity_invalid',current.file_path);return null;}
    if(current.storyboard_path&&fs.existsSync(current.storyboard_path)){
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
      await execFileAsync(bins.ffmpeg,['-nostdin','-i',current.file_path,'-vf',vf,'-frames:v','1','-q:v','3','-n',tempPath],{timeout:120000,maxBuffer:2*1024*1024,windowsHide:true});
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
    }catch{
      if(this.db.getVideoById(video.id)?.file_path===current.file_path)this.db.updateStoryboardState(video.id,'failed','storyboard_generation_failed',current.file_path);
      return null;
    }finally{try{fs.rmSync(tempDir,{recursive:true,force:true});}catch{}}
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
