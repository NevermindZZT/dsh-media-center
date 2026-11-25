import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { AnalysisQueue } from '../ai/analysis-queue.js';

export function createMediaCenterApiHandler({ db, mediaEngine, projectExporter, shotSearchService, videoAiAnalyzer, shotAnalysisService, editingWorkflow }) {
  const analysisQueue = new AnalysisQueue(db);
  if (shotAnalysisService?.store) shotAnalysisService.store.isVideoBusy = id => analysisQueue.active.has(id);
  const recordAnalysisFailure = (id, message = '') => {
    // A video may have been removed while the analyzer was awaiting a remote model.
    // Never insert a replacement row when marking a failure.
    try {
      const video = db.getVideoById(id);
      if (!video) return;
      const reason = String(message || 'AI 分析失败').replace(/[\r\n]+/g, ' ').slice(0, 500);
      db.upsertVideo({ id, ...(video.status !== 'analyzed' ? { status: 'error' } : {}), ai_error: reason });
    }
    catch (error) { console.error('[ai-analyze] Unable to save failure status:', error); }
  };
  const analyzeWithRetry = async (id) => {
    const settings = videoAiAnalyzer.getAiSettings?.() || {};
    const retries = Math.max(0, Math.min(3, Number(settings.retry_count) || 0));
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try { return await videoAiAnalyzer.analyzeVideo(id); }
      catch (error) {
        lastError = error;
        if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }
    throw lastError;
  };
  const jsonResponse = (res, data, status = 200) => {
    const body = Buffer.from(JSON.stringify(data));
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': body.length,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(body);
  };
  const binaryResponse = (res, body, contentType, headers = {}) => {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': body.length,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...headers
    });
    res.end(body);
  };

  const parseJsonBody = (req) => {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
        if (data.length > 1024 * 1024) { reject(new Error('Request too large')); req.destroy(); }
      });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  };

  const streamVideoFile = (req, res, filePath) => {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('File not found');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4'
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  };

  const streamMusicFile = (req, res, filePath) => {
    let stat;
    try {
      if (fs.realpathSync(filePath) !== filePath) throw new Error('source changed');
      stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size <= 0) throw new Error('unavailable');
    } catch { return jsonResponse(res, { success:false, error:'音乐文件不可用' }, 404); }
    const mime={'.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.aac':'audio/aac','.ogg':'audio/ogg','.opus':'audio/ogg','.flac':'audio/flac','.aif':'audio/aiff','.aiff':'audio/aiff','.wma':'audio/x-ms-wma'}[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    let start=0, end=stat.size-1, status=200;
    if (req.headers.range) {
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) { res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}); return res.end(); }
      if (!match[1]) { const suffix=Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix<=0) { res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}); return res.end(); } start=Math.max(0,stat.size-suffix); }
      else { start=Number(match[1]); if (match[2]) end=Math.min(Number(match[2]),end); }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start>end || start>=stat.size) { res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}); return res.end(); }
      status=206;
    }
    res.writeHead(status, {'Content-Type':mime,'Content-Length':end-start+1,'Accept-Ranges':'bytes',
      ...(status===206 ? {'Content-Range':`bytes ${start}-${end}/${stat.size}`} : {}), 'Cache-Control':'no-store'});
    const stream=fs.createReadStream(filePath,{start,end});
    stream.on('error',()=>res.destroy());
    stream.pipe(res);
  };

  const streamImageFile = (res, filePath) => {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Image not found');
    }
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': path.extname(filePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg',
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=86400'
    });
    fs.createReadStream(filePath).pipe(res);
  };

  return async function handleRequest(req, res) {
    const origin = req.headers?.origin;
    if (origin !== undefined) {
      let allowed = false;
      try {
        const parsed = new URL(origin);
        const host = req.headers?.host;
        allowed = typeof host === 'string' && ['http:', 'https:'].includes(parsed.protocol) &&
          parsed.host.toLowerCase() === host.toLowerCase() && parsed.origin === origin &&
          !parsed.username && !parsed.password;
      } catch {}
      if (!allowed) {
        const body = Buffer.from(JSON.stringify({ success: false, error: 'Cross-origin request rejected' }));
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
        return res.end(body);
      }
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      return res.end();
    }

    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;
    const method = req.method;

    try {
      // Editing endpoints accept catalog IDs except the explicit local-music import.
      if (pathname.startsWith('/api/media-center/editing/')) {
        if (!editingWorkflow) return jsonResponse(res, { success:false, error:'剪辑工作流不可用' }, 503);
        const base = '/api/media-center/editing';
        const integer = (value, fallback, max) => {
          if (value == null || value === '') return fallback;
          if (!/^\d+$/.test(String(value))) throw new Error('invalid pagination');
          const number = Number(value);
          if (!Number.isSafeInteger(number) || number > max) throw new Error('invalid pagination');
          return number;
        };
        try {
          if (pathname === `${base}/music` && method === 'GET') {
            const result = editingWorkflow.listMusicCatalog({ query:parsedUrl.searchParams.get('query') || '',
              ...(parsedUrl.searchParams.has('license_status') ? {license_status:parsedUrl.searchParams.get('license_status')} : {}),
              ...(parsedUrl.searchParams.has('analysis_status') ? {analysis_status:parsedUrl.searchParams.get('analysis_status')} : {}),
              limit:integer(parsedUrl.searchParams.get('limit'),25,100), offset:integer(parsedUrl.searchParams.get('offset'),0,1000000) });
            return jsonResponse(res,{success:true,...result});
          }
          if (pathname === `${base}/music` && method === 'POST') {
            const body = await parseJsonBody(req);
            if (body.license_status === 'personal_confirmed' && body.license_confirmed !== true)
              return jsonResponse(res,{success:false,error:'个人使用许可须由用户明确确认'},400);
            const result = await editingWorkflow.catalog.importFile({file_path:body.file_path,title:body.title,artist:body.artist,
              source_name:body.source_name,source_url:body.source_url,license_status:body.license_status,
              license_note:body.license_note,license_confirmed:body.license_confirmed});
            return jsonResponse(res,{success:true,...result});
          }
          const musicAnalysisMatch=pathname.match(/^\/api\/media-center\/editing\/music\/(mus_[0-9a-f]{32})\/analysis(?:\/features)?$/);
          if(musicAnalysisMatch&&method==='GET'&&pathname.endsWith('/features')){
            try{
              const result=editingWorkflow.getMusicFeatures(musicAnalysisMatch[1],parsedUrl.searchParams.get('analysis_id'));
              if(!result)return jsonResponse(res,{success:false,error:'音乐特征数据不可用'},404);
              const payload=Buffer.concat([Buffer.from(result.data),Buffer.from(result.waveform)]);
              return binaryResponse(res,payload,'application/octet-stream',{
                'Cache-Control':'private, max-age=3600',
                'X-Feature-Fps':String(result.meta.fps),
                'X-Feature-Bands':String(result.meta.bands),
                'X-Feature-Columns':String(result.meta.columns),
                'X-Waveform-Buckets':String(result.meta.waveform_buckets)
              });
            }catch(error){
              return jsonResponse(res,{success:false,error:'无法读取音乐特征数据'},404);
            }
          }
          if(musicAnalysisMatch&&method==='GET'){
            const analysis=editingWorkflow.getMusicAnalysis(musicAnalysisMatch[1]);
            return jsonResponse(res,{success:true,analysis:analysis||null});
          }
          const musicStreamMatch = pathname.match(/^\/api\/media-center\/editing\/music\/(mus_[0-9a-f]{32})\/stream$/);
          if (musicStreamMatch && method === 'GET') {
            const item=editingWorkflow.catalog.get(musicStreamMatch[1]);
            if (!item) return jsonResponse(res,{success:false,error:'音乐记录不存在'},404);
            if(item.source_status!=='current')return jsonResponse(res,{success:false,error:'音乐源文件不可用或已变化'},409);
            return streamMusicFile(req,res,item.file_path);
          }
          const musicMatch = pathname.match(/^\/api\/media-center\/editing\/music\/(mus_[0-9a-f]{32})(?:\/(confirm-personal|analyze))?$/);
          if (musicMatch && method === 'DELETE' && !musicMatch[2]) {
            return jsonResponse(res,{success:true,removed:editingWorkflow.removeMusic(musicMatch[1])});
          }
          if (musicMatch && method === 'POST' && musicMatch[2] === 'confirm-personal') {
            const body=await parseJsonBody(req);
            if (body.confirmed !== true) return jsonResponse(res,{success:false,error:'须由用户明确确认个人分享使用权限'},400);
            return jsonResponse(res,{success:true,music:editingWorkflow.catalog.confirmPersonalUse(musicMatch[1],{confirmed:true,license_note:body.license_note})});
          }
          if (musicMatch && method === 'POST' && musicMatch[2] === 'analyze') {
            const body=await parseJsonBody(req);
            const analysis=await editingWorkflow.analyzeMusic(musicMatch[1],{durationSeconds:body.durationSeconds});
            return jsonResponse(res,{success:true,analysis});
          }
          if (pathname === `${base}/jamendo/search` && method === 'POST') {
            const body=await parseJsonBody(req);
            const clientId=body.clientId || process.env.JAMENDO_CLIENT_ID;
            if (typeof clientId !== 'string' || !clientId.trim()) return jsonResponse(res,{success:false,error:'请提供 Jamendo Client ID 或设置 JAMENDO_CLIENT_ID'},400);
            const result=await editingWorkflow.searchJamendo({clientId,query:body.query,limit:body.limit,offset:body.offset});
            // Guard against a malicious source echoing the one-time credential in metadata.
            const serialized = JSON.stringify(result);
            if (serialized.includes(clientId) || serialized.includes(JSON.stringify(clientId).slice(1,-1))) throw new Error('sensitive search response');
            return jsonResponse(res,{success:true,...result});
          }
          if (pathname === `${base}/projects/preview` && method === 'POST') {
            const body=await parseJsonBody(req);
            const result=editingWorkflow.previewProject(body.project);
            return jsonResponse(res,{success:true,...result});
          }
          if (pathname === `${base}/projects/commit` && method === 'POST') {
            const body=await parseJsonBody(req);
            if (body.confirmed !== true) return jsonResponse(res,{success:false,error:'必须由用户在 DSH 会话中明确确认项目保存'},400);
            if (typeof body.preview_id !== 'string' || !/^preview_[a-f0-9]{32}$/.test(body.preview_id)) return jsonResponse(res,{success:false,error:'预览标识无效'},400);
            const result=editingWorkflow.commitPreview({previewId:body.preview_id,confirmed:true});
            return jsonResponse(res,result,result.success?200:400);
          }
          if (pathname === `${base}/projects` && method === 'GET') {
            const projects=editingWorkflow.projects.list({limit:integer(parsedUrl.searchParams.get('limit'),30,100),offset:integer(parsedUrl.searchParams.get('offset'),0,1000000)});
            return jsonResponse(res,{success:true,projects});
          }
          const projectMatch=pathname.match(/^\/api\/media-center\/editing\/projects\/(edit_[0-9a-f]{32})$/);
          if (projectMatch && method === 'GET') {
            const project=editingWorkflow.projects.get(projectMatch[1]);
            if (!project) return jsonResponse(res,{success:false,error:'剪辑项目不存在'},404);
            const videoSources={}; const musicSources={};
            for (const clip of project.project?.tracks?.video || []) {
              const id=clip.source?.id;
              if (!id || videoSources[id]) continue;
              const video=db.getVideoById(id);
              if (video) videoSources[id]={id,file_name:video.file_name,width:video.width,height:video.height,duration:video.duration,storyboard_status:video.storyboard_status};
            }
            for (const clip of project.project?.tracks?.music || []) {
              const id=clip.source?.id;
              if (!id || musicSources[id]) continue;
              const music=db.db.prepare('SELECT id,title,file_name,duration FROM local_music_catalog WHERE id = ?').get(id);
              if (music) musicSources[id]=music;
            }
            return jsonResponse(res,{success:true,project:{...project,sources:{videos:videoSources,music:musicSources}}});
          }
          if (projectMatch && method === 'PUT') {
            const body=await parseJsonBody(req);
            if (!Number.isSafeInteger(body.expected_revision) || body.expected_revision < 1) return jsonResponse(res,{success:false,error:'expected_revision 无效'},400);
            const result=editingWorkflow.projects.save(body.project,{id:projectMatch[1],expectedRevision:body.expected_revision});
            return jsonResponse(res,result,result.success?200:409);
          }
          if (projectMatch && method === 'DELETE') {
            const removed=editingWorkflow.projects.delete(projectMatch[1]);
            return removed ? jsonResponse(res,{success:true}) : jsonResponse(res,{success:false,error:'剪辑项目不存在'},404);
          }
          const projectExportMatch=pathname.match(/^\/api\/media-center\/editing\/projects\/(edit_[0-9a-f]{32})\/export$/);
          if (projectExportMatch && method === 'POST') {
            const body=await parseJsonBody(req);
            const project=editingWorkflow.projects.get(projectExportMatch[1]);
            if (!project) return jsonResponse(res,{success:false,error:'剪辑项目不存在'},404);
            if (!projectExporter?.exportProject) return jsonResponse(res,{success:false,error:'工程导出不可用'},503);
            const format=body.format || 'fcpxml';
            const options={ includeSourceAudio:body.include_source_audio !== false, destinationDir:body.destination_dir };
            const result = format === 'prproj'
              ? await projectExporter.exportPRProj(project.project, options)
              : projectExporter.exportProject(project.project,{...options, format});
            return jsonResponse(res,{success:true,export_result:result});
          }
          return jsonResponse(res,{success:false,error:'未知剪辑工作流操作'},404);
        } catch (error) {
          if (error?.name === 'ProjectValidationError' || Array.isArray(error?.errors)) {
            return jsonResponse(res, {
              success: false,
              error: {
                code: error.code || 'PROJECT_VALIDATION_FAILED',
                message: error.message || '剪辑项目校验失败',
                errors: error.errors || [],
                warnings: error.warnings || []
              }
            }, 400);
          }
          const safeMessages = new Set([
            '项目预览已过期，请重新预览','分镜已删除或重建，请重新生成预览','分镜描述已修改，请重新生成预览',
            '剪辑项目至少需要一个视频片段','所引用的视频素材不存在','所引用的素材库分镜不存在',
            '视频源区间超出已选择分镜范围','音乐记录不存在','音乐源文件不可用或已变化',
            '音乐时长与音乐库记录不一致','所选音乐尚未由用户声明可用于个人分享',
            '当前仅有瞬态候选，不能将其作为已确认拍点写入项目','需由用户明确确认剪辑项目',
            '音乐分析已过期或与当前音乐不匹配','须由用户试听后明确确认候选拍点','须由用户明确确认 Agent 风格建议后保存',
            '音乐分析档案已过期','No beat candidates are available to confirm','Music analysis profile not found',
            '须由用户明确确认频谱解读编辑和模型节奏点','频谱图大模型分析不可用','请先运行本地节奏分析','频谱分析提示词无效','模型未返回标准频谱解读 JSON','模型返回的频谱解读结构无效','频谱图不可用','频谱图格式无效或过大','音乐分析档案已过期或与当前音乐不匹配','音乐分析窗口长度无效','频谱图片附件服务不可用',
            '请先分析当前音乐窗口；分析档案已过期或与当前音乐不匹配','音乐分析窗口长度无效','请先完成 AI 模型设置','请选择 DSH 服务商和模型',
            '所选 DSH 服务商不可用','无法获取所选 DSH 服务商的模型列表','所选模型不在该 DSH 服务商的模型列表中',
            '所选 DSH 模型不支持图片输入','无法获取所选 DSH 模型的推理能力，请刷新模型列表','请为所选 DSH 模型明确选择推理档位',
            '所选推理档位不受当前 DSH 模型支持','所选 DSH 模型未声明推理档位，请清空推理档位'
          ]);
          const safeProjectPrefixes = ['剪辑项目无效：','视频源文件不可用：','视频源文件已变化：','音乐源文件不可用：','音乐源文件已变化：','当前项目限制为','PRPROJ_EXPORTER_UNAVAILABLE','.prproj 生成失败：'];
          const safeMusicPrefixes = ['无法生成音频频谱图','频谱图生成失败','DSH 模型请求未成功完成','自定义 AI 服务请求失败'];
          const message=String(error?.message||'');
          const safe=safeMessages.has(message)||safeProjectPrefixes.some(prefix=>message.startsWith(prefix))||safeMusicPrefixes.some(prefix=>message.startsWith(prefix));
          return jsonResponse(res,{success:false,error:safe?message:'音乐资产或剪辑项目操作失败，请检查输入、来源状态和授权'},400);
        }
      }
      // 1. Status & Binaries: GET /api/media-center/status
      if (pathname === '/api/media-center/status' && method === 'GET') {
        const bins = await mediaEngine.getBinaries();
        const settings = {
          ffmpeg_path: db.getSetting('ffmpeg_path'),
          ffprobe_path: db.getSetting('ffprobe_path')
        };
        return jsonResponse(res, {
          success: true,
          db_path: db.dbPath,
          binaries: bins,
          settings
        });
      }

      // 2. Settings: POST /api/media-center/settings
      if (pathname === '/api/media-center/settings' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (body.ffmpeg_path !== undefined) db.setSetting('ffmpeg_path', body.ffmpeg_path);
        if (body.ffprobe_path !== undefined) db.setSetting('ffprobe_path', body.ffprobe_path);
        const bins = await mediaEngine.getBinaries();
        return jsonResponse(res, { success: true, binaries: bins });
      }

      // Cache usage and cleanup: GET/POST /api/media-center/cache, /cache/clear
      if (pathname === '/api/media-center/cache' && method === 'GET') {
        if (typeof mediaEngine?.getCacheUsage !== 'function') return jsonResponse(res,{success:false,error:'缓存统计不可用'},503);
        return jsonResponse(res,{success:true,usage:await mediaEngine.getCacheUsage()});
      }
      if (pathname === '/api/media-center/cache/clear' && method === 'POST') {
        if (typeof mediaEngine?.clearCache !== 'function') return jsonResponse(res,{success:false,error:'缓存清理不可用'},503);
        const body=await parseJsonBody(req);
        const scope=body.scope==='previews'?'previews':'all';
        mediaEngine.clearCache(scope);
        return jsonResponse(res,{success:true,scope,usage:await mediaEngine.getCacheUsage()});
      }

      // 3. Folders Tree: GET /api/media-center/folders
      if (pathname === '/api/media-center/folders' && method === 'GET') {
        const tree = db.getFolderTree();
        return jsonResponse(res, { success: true, folders: tree });
      }

      // 4. Create Folder: POST /api/media-center/folders
      if (pathname === '/api/media-center/folders' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.name) return jsonResponse(res, { success: false, error: 'Folder name is required' }, 400);
        const folder = db.createFolder(body.name, body.parent_id || null, body.source_dir_path || null);
        return jsonResponse(res, { success: true, folder });
      }

      // 5. Delete Folder: DELETE /api/media-center/folders/:id
      const folderDelMatch = pathname.match(/^\/api\/media-center\/folders\/([a-zA-Z0-9_-]+)$/);
      if (folderDelMatch && method === 'DELETE') {
        db.deleteFolder(folderDelMatch[1]);
        return jsonResponse(res, { success: true });
      }

      // Video import job state: GET /api/media-center/import-jobs/:id
      const importJobMatch=pathname.match(/^\/api\/media-center\/import-jobs\/(imp_[a-f0-9]{32})$/);
      if(importJobMatch&&method==='GET'){
        if(typeof mediaEngine?.getImportJob!=='function')return jsonResponse(res,{success:false,error:'导入任务状态不可用'},503);
        const job=mediaEngine.getImportJob(importJobMatch[1]);
        if(!job)return jsonResponse(res,{success:false,error:'导入任务不存在或已过期'},404);
        return jsonResponse(res,{success:true,job});
      }
      if(importJobMatch&&method==='POST'){
        if(typeof mediaEngine?.cancelImportJob!=='function')return jsonResponse(res,{success:false,error:'中断导入不可用'},503);
        const job=mediaEngine.cancelImportJob(importJobMatch[1]);
        if(!job)return jsonResponse(res,{success:false,error:'导入任务不存在或已过期'},404);
        return jsonResponse(res,{success:true,job});
      }

      // 5.1 Rename Folder: PUT /api/media-center/folders/:id
      if (folderDelMatch && method === 'PUT') {
        const body = await parseJsonBody(req);
        if (!body.name) return jsonResponse(res, { success: false, error: 'New folder name is required' }, 400);
        const renamed = db.renameFolder(folderDelMatch[1], body.name);
        return jsonResponse(res, { success: true, folder: renamed });
      }

      // 6. Scan Directory: POST /api/media-center/folders/scan
      if (pathname === '/api/media-center/folders/scan' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (typeof body.directory_path !== 'string' || !path.isAbsolute(body.directory_path)) {
          return jsonResponse(res, { success: false, error: 'directory_path must be an absolute path' }, 400);
        }
        const job=mediaEngine.startImportJob({kind:'directory',directory_path:body.directory_path,folder_id:body.parent_id||null});
        return jsonResponse(res,{success:true,job:job.job,job_id:job.job?.id||null,merged:job.merged,imported_count:0,failed_count:0,videos:[]});
      }

      // Scan multiple direct child directories under the current asset folder.
      if (pathname === '/api/media-center/folders/scan-selected' && method === 'POST') {
        const body=await parseJsonBody(req);
        if (typeof body.parent_directory_path!=='string'||!path.isAbsolute(body.parent_directory_path)||!Array.isArray(body.directory_paths)||body.directory_paths.length<1||body.directory_paths.length>50||body.directory_paths.some(value=>typeof value!=='string'||!path.isAbsolute(value))) {
          return jsonResponse(res,{success:false,error:'parent_directory_path and 1–50 absolute directory_paths are required'},400);
        }
        const job=mediaEngine.startImportJob({kind:'subfolders',directory_paths:body.directory_paths,parent_directory_path:body.parent_directory_path,parent_folder_id:body.parent_id||null});
        return jsonResponse(res,{success:true,job:job.job,job_id:job.job?.id||null,merged:job.merged,scanned_count:0,imported_count:0,failed_count:0,folders:[]});
      }

      // 6.1 Browse Local Filesystem: GET /api/media-center/fs/browse
      if (pathname === '/api/media-center/fs/browse' && method === 'GET') {
        const dir = parsedUrl.searchParams.get('dir') || undefined;
        const result = mediaEngine.browseFileSystem(dir);
        return jsonResponse(res, { success: true, ...result });
      }

      // 6.2 Import Specific Video Files: POST /api/media-center/videos/import-files
      if (pathname === '/api/media-center/videos/import-files' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!Array.isArray(body.file_paths)||body.file_paths.length<1||body.file_paths.length>5000||body.file_paths.some(value=>typeof value!=='string')) {
          return jsonResponse(res, { success: false, error: 'file_paths must contain 1–5000 paths' }, 400);
        }
        const job=mediaEngine.startImportJob({kind:'files',file_paths:body.file_paths,folder_id:body.folder_id||null});
        return jsonResponse(res,{success:true,job:job.job,job_id:job.job?.id||null,merged:job.merged,imported_count:0,duplicates_count:0,failed_count:0,videos:[]});
      }

      // 6.3 Batch Move Videos: POST /api/media-center/videos/batch-move
      if (pathname === '/api/media-center/videos/batch-move' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!Array.isArray(body.video_ids) || body.video_ids.length === 0) {
          return jsonResponse(res, { success: false, error: 'video_ids array is required' }, 400);
        }
        const count = db.batchMoveVideos(body.video_ids, body.target_folder_id || null);
        return jsonResponse(res, { success: true, moved_count: count });
      }

      // 6.4 Batch Delete Videos: POST /api/media-center/videos/batch-delete
      if (pathname === '/api/media-center/videos/batch-delete' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!Array.isArray(body.video_ids) || body.video_ids.length === 0) {
          return jsonResponse(res, { success: false, error: 'video_ids array is required' }, 400);
        }
        for(const id of body.video_ids)mediaEngine.cancelImportForVideo?.(id);
        const count = db.batchDeleteVideos(body.video_ids);
        return jsonResponse(res, { success: true, deleted_count: count });
      }

      // 7. Video List: GET /api/media-center/videos
      if (pathname === '/api/media-center/videos' && method === 'GET') {
        await mediaEngine.ensureCaptureTimes();
        const folderId = parsedUrl.searchParams.get('folder_id') || undefined;
        const query = parsedUrl.searchParams.get('query') || undefined;
        const status = parsedUrl.searchParams.get('status') || undefined;
        const tag = parsedUrl.searchParams.get('tag') || undefined;
        const limit = parsedUrl.searchParams.get('limit') || 100;
        const offset = parsedUrl.searchParams.get('offset') || 0;
        const sortBy = parsedUrl.searchParams.get('sort_by') || undefined;
        const sortDir = parsedUrl.searchParams.get('sort_dir') || undefined;

        const options = { folder_id: folderId, query, tag, sort_by: sortBy, sort_dir: sortDir };
        // Stored status cannot be filtered before applying the runtime overlay.
        // Filter first, then page, so queued/running items are not lost at page boundaries.
        const filtered = status ? db.queryVideos(options).map(v => analysisQueue.overlay(v)).filter(v => v.status === status || (status === 'imported' && analysisQueue.active.has(v.id))) : null;
        const total = filtered ? filtered.length : db.countVideos(options);
        const videos = filtered
          ? filtered.slice(Math.max(0, Number(offset) || 0), Math.max(0, Number(offset) || 0) + Math.max(0, Number(limit) || 100))
          : db.queryVideos({ ...options, limit, offset }).map(v => analysisQueue.overlay(v));
        return jsonResponse(res, { success: true, total, videos });
      }

      // 8. Video Details: GET /api/media-center/videos/:id
      const videoDetailMatch = pathname.match(/^\/api\/media-center\/videos\/([a-zA-Z0-9_-]+)$/);
      if (videoDetailMatch && method === 'GET') {
        await mediaEngine.ensureCaptureTimes();
        const video = db.getVideoById(videoDetailMatch[1], true, true);
        if (!video) return jsonResponse(res, { success: false, error: 'Video not found' }, 404);
        return jsonResponse(res, { success: true, video: analysisQueue.overlay(video) });
      }

      // 9. Update Video: PUT /api/media-center/videos/:id
      if (videoDetailMatch && method === 'PUT') {
        const body = await parseJsonBody(req);
        const updated = db.upsertVideo({
          id: videoDetailMatch[1],
          file_name: body.file_name,
          folder_id: body.folder_id,
          summary: body.summary,
          user_notes: body.user_notes,
          tags: body.tags,
          status: body.status
        });
        return jsonResponse(res, { success: true, video: updated });
      }

      // 10. Delete Video: DELETE /api/media-center/videos/:id
      if (videoDetailMatch && method === 'DELETE') {
        mediaEngine.cancelImportForVideo?.(videoDetailMatch[1]);
        db.deleteVideo(videoDetailMatch[1]);
        return jsonResponse(res, { success: true });
      }

      // 11. Trigger Analysis: POST /api/media-center/videos/:id/analyze
      const analyzeMatch = pathname.match(/^\/api\/media-center\/videos\/([a-zA-Z0-9_-]+)\/analyze$/);
      if (analyzeMatch && method === 'POST') {
        const videoId = analyzeMatch[1];
        const video = db.getVideoById(videoId);
        if (!video) return jsonResponse(res, { success: false, error: 'Video not found' }, 404);

        db.upsertVideo({ id: videoId, status: 'analyzing' });

        // Execute background features
        const storyboardPath = await mediaEngine.generateStoryboard(video);
        let silenceResult;
        try { silenceResult = await mediaEngine.detectSilenceResult(video); }
        catch { silenceResult = { status: 'error', reason: 'silence_detection_failed', intervals: null }; }
        const tempoResult = { status: 'unavailable', reason: 'tempo_detector_not_integrated', bpm: null, beats: null };
        if (silenceResult?.status === 'ok' && Array.isArray(silenceResult.intervals)) {
          db.upsertVideoAudio(videoId, { silence_intervals: silenceResult.intervals });
        }

        const shots = await mediaEngine.detectInitialShots(video);
        db.upsertShots(videoId, shots);

        const updated = db.getVideoById(videoId, true, true);
        return jsonResponse(res, {
          success: true,
          video: updated,
          storyboard_path: storyboardPath,
          audio_analysis: { silence: silenceResult, tempo: tempoResult }
        });
      }

      // 11.1 Directly Trigger Multi-modal AI Video Analysis: POST /api/media-center/videos/:id/ai-analyze
      const aiAnalyzeMatch = pathname.match(/^\/api\/media-center\/videos\/([a-zA-Z0-9_-]+)\/ai-analyze$/);
      if (aiAnalyzeMatch && method === 'POST') {
        const videoId = aiAnalyzeMatch[1];
        const reservation = analysisQueue.reserve([videoId]);
        if (!reservation.ok) return jsonResponse(res, { success: false, error: reservation.error, video_ids: reservation.video_ids }, reservation.status);
        try {
          analysisQueue.start(videoId, reservation.token);
          const result = await analyzeWithRetry(videoId);
          if (result?.success === false) throw new Error(result.error || 'AI analysis failed');
          return jsonResponse(res, result);
        } catch (e) {
          recordAnalysisFailure(videoId, e.message);
          console.error('[ai-analyze] Error:', e);
          return jsonResponse(res, { success: false, error: e.message }, 500);
        } finally {
          analysisQueue.release(videoId, reservation.token);
        }
      }

      // 11.2 Batch Multi-modal AI Video Analysis: POST /api/media-center/videos/batch-ai-analyze
      if (pathname === '/api/media-center/videos/batch-ai-analyze' && method === 'POST') {
        const body = await parseJsonBody(req);
        const reservation = analysisQueue.reserve(body?.video_ids);
        if (!reservation.ok) return jsonResponse(res, { success: false, error: reservation.error, video_ids: reservation.video_ids }, reservation.status);
        const results = new Array(body.video_ids.length);
        let succeeded = 0;
        try {
          const requested = Math.max(1, Math.min(8, Number(videoAiAnalyzer.getAiSettings?.().concurrency) || 3));
          let cursor = 0;
          const worker = async () => {
            while (cursor < body.video_ids.length) {
              const index = cursor++;
              const vid = body.video_ids[index];
              try {
                analysisQueue.start(vid, reservation.token);
                // A queued video can be removed while other videos are processing.
                if (!db.getVideoById(vid)) throw new Error('Video not found');
                const r = await analyzeWithRetry(vid);
                if (r?.success === false) throw new Error(r.error || 'AI analysis failed');
                results[index] = { video_id: vid, success: true, audit: r.audit };
                succeeded++;
              } catch (e) {
                recordAnalysisFailure(vid, e.message);
                results[index] = { video_id: vid, success: false, error: e.message };
              } finally {
                analysisQueue.release(vid, reservation.token);
              }
            }
          };
          await Promise.all(Array.from({ length: Math.min(requested, body.video_ids.length) }, () => worker()));
          return jsonResponse(res, {
            success: true,
            total: body.video_ids.length,
            succeeded,
            concurrency: requested,
            retry_count: Math.max(0, Math.min(3, Number(videoAiAnalyzer.getAiSettings?.().retry_count) || 0)),
            results
          });
        } finally {
          // Also release not-yet-started IDs if an unexpected error aborts the loop.
          for (const vid of body.video_ids) analysisQueue.release(vid, reservation.token);
        }
      }

      // Single-shot deep analysis. Only server-generated paths are ever sent to the model.
      const shotDeepMatch = pathname.match(/^\/api\/media-center\/videos\/([a-zA-Z0-9_-]+)\/shots\/([a-zA-Z0-9_-]+)\/(deep-analysis|deep-analyses)$/);
      if (shotDeepMatch && method === 'POST' && shotDeepMatch[3] === 'deep-analysis') {
        try {
          const run = await shotAnalysisService.analyze(shotDeepMatch[1], shotDeepMatch[2]);
          return jsonResponse(res, { success: true, run });
        } catch (error) {
          const status = /正在分析中/.test(error.message) ? 409 : 400;
          return jsonResponse(res, { success: false, error: error.message }, status);
        }
      }
      if (shotDeepMatch && method === 'GET' && shotDeepMatch[3] === 'deep-analyses') {
        const runs = shotAnalysisService.store.listRuns({ video_id: shotDeepMatch[1], shot_id: shotDeepMatch[2], limit: 50 });
        return jsonResponse(res, { success: true, runs });
      }
      const shotRunMatch = pathname.match(/^\/api\/media-center\/shot-analysis\/([a-zA-Z0-9_-]+)\/(apply|storyboard)$/);
      if (shotRunMatch && method === 'POST' && shotRunMatch[2] === 'apply') {
        try {
          const body = await parseJsonBody(req);
          const result = shotAnalysisService.store.applyFields(shotRunMatch[1], body.fields);
          return jsonResponse(res, { success: true, ...result });
        } catch (error) {
          const conflict = /changed since analysis|shot not found|not available|video analysis is running/.test(error.message);
          return jsonResponse(res, { success: false, error: /video analysis is running/.test(error.message) ? '全片分析正在排队或运行，请完成后重新核对再应用。' : conflict ? '片段或所选字段已发生变化，请重新分析后再应用。' : '无法应用分析结果，请检查所选字段。' }, conflict ? 409 : 400);
        }
      }
      if (shotRunMatch && method === 'GET' && shotRunMatch[2] === 'storyboard') {
        const storyboard = shotAnalysisService.getStoryboardPath(shotRunMatch[1]);
        if (!storyboard) return jsonResponse(res, { success: false, error: '故事板不可用' }, 404);
        return streamImageFile(res, storyboard);
      }
      if (pathname === '/api/media-center/shot-analysis-settings' && method === 'GET') {
        return jsonResponse(res, { success: true, ...shotAnalysisService.getPromptSettings() });
      }
      if (pathname === '/api/media-center/shot-analysis-settings' && method === 'POST') {
        try {
          const body = await parseJsonBody(req);
          return jsonResponse(res, { success: true, ...shotAnalysisService.savePromptSettings(body.prompt) });
        } catch {
          return jsonResponse(res, { success: false, error: '提示词无效或超过长度限制' }, 400);
        }
      }

      // Return live registered DSH providers/models; no credentials are exposed.
      if (pathname === '/api/media-center/ai-models' && method === 'GET') {
        const catalog = await videoAiAnalyzer.getModelCatalog();
        return jsonResponse(res, { success: true, ...catalog });
      }
      if (pathname === '/api/media-center/ai-settings' && method === 'GET') {
        return jsonResponse(res, { success: true, ...videoAiAnalyzer.getAiSettings() });
      }
      if (pathname === '/api/media-center/ai-settings' && method === 'POST') {
        const body = await parseJsonBody(req);
        try {
          const settings = await videoAiAnalyzer.saveAiSettings(body);
          return jsonResponse(res, { success: true, ...settings });
        } catch (e) {
          return jsonResponse(res, { success: false, error: e.message }, 400);
        }
      }

      // 12. Video Storyboard Image: GET /api/media-center/videos/:id/storyboard
      const storyboardMatch = pathname.match(/^\/api\/media-center\/videos\/([a-zA-Z0-9_-]+)\/storyboard$/);
      if (storyboardMatch && method === 'POST') {
        const video = db.getVideoById(storyboardMatch[1]);
        if (!video) return jsonResponse(res, { success: false, error: 'Video not found' }, 404);
        const result = mediaEngine.regenerateStoryboard(video.id);
        if (!result) return jsonResponse(res, { success: false, error: '故事板重新生成不可用' }, 500);
        return jsonResponse(res, { success: true, storyboard_status: 'generating' });
      }
      if (storyboardMatch && method === 'GET') {
        const video = db.getVideoById(storyboardMatch[1]);
        if (!video || !video.storyboard_path || !fs.existsSync(video.storyboard_path)) {
          // Fallback or 404
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Storyboard not found');
        }
        return streamImageFile(res, video.storyboard_path);
      }

      // 12.2 Open the original media with the operating system's default player
      const openVideoMatch = pathname.match(/^\/api\/media-center\/videos\/([a-zA-Z0-9_-]+)\/open$/);
      if (openVideoMatch && method === 'POST') {
        if (typeof mediaEngine?.openInSystemPlayer !== 'function') return jsonResponse(res, { success:false, error:'系统播放器不可用' }, 503);
        const opened = mediaEngine.openInSystemPlayer(openVideoMatch[1]);
        return jsonResponse(res, opened ? { success:true } : { success:false, error:'源视频不可用或文件不存在' }, opened ? 200 : 404);
      }

      // 12.1 Browser-compatible preview (H.264) for codecs such as HEVC
      const previewMatch = pathname.match(/^\/api\/media-center\/videos\/([a-zA-Z0-9_-]+)\/preview$/);
      if (previewMatch && method === 'DELETE') {
        if (typeof mediaEngine?.clearPreviewCache !== 'function') return jsonResponse(res, { success:false, error:'预览缓存清理不可用' }, 503);
        const removed = mediaEngine.clearPreviewCache(previewMatch[1]);
        return jsonResponse(res, removed ? { success:true } : { success:false, error:'预览缓存不存在' }, removed ? 200 : 404);
      }
      if (previewMatch && (method === 'GET' || method === 'POST')) {
        if (typeof mediaEngine?.getPreviewInfo !== 'function') return jsonResponse(res, { success:false, error:'预览转码不可用' }, 503);
        const video = db.getVideoById(previewMatch[1]);
        if (!video) return jsonResponse(res, { success:false, error:'Video not found' }, 404);
        const info = method === 'POST' ? await mediaEngine.startPreview(video.id) : await mediaEngine.getPreviewInfo(video.id);
        return jsonResponse(res, { success:true, preview: info ? { required:info.required, status:info.status, codec:info.codec, video_profile:info.video_profile, pix_fmt:info.pix_fmt } : null });
      }

      // 13. Video Media Stream: GET /api/media-center/videos/:id/stream
      const streamMatch = pathname.match(/^\/api\/media-center\/videos\/([a-zA-Z0-9_-]+)\/stream$/);
      if (streamMatch && method === 'GET') {
        const video = db.getVideoById(streamMatch[1]);
        if (!video || !fs.existsSync(video.file_path)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Video file not found');
        }
        const wantsPreview = parsedUrl.searchParams.get('preview') === '1';
        const previewPath = wantsPreview ? await mediaEngine.getPreviewPath(video.id) : null;
        if (wantsPreview && !previewPath) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Compatible preview is not ready');
        }
        return streamVideoFile(req, res, previewPath || video.file_path);
      }

      // 14. Keyframe image: GET /api/media-center/keyframes/:file
      const keyframeMatch = pathname.match(/^\/api\/media-center\/keyframes\/([a-zA-Z0-9_.-]+)$/);
      if (keyframeMatch && method === 'GET') {
        const keyframeFile = path.join(db.keyframesDir, keyframeMatch[1]);
        return streamImageFile(res, keyframeFile);
      }

      // 15. Upsert Shots: POST /api/media-center/shots
      if (pathname === '/api/media-center/shots' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.video_id || !Array.isArray(body.shots)) {
          return jsonResponse(res, { success: false, error: 'video_id and shots array required' }, 400);
        }
        const savedIds = db.upsertShots(body.video_id, body.shots);
        return jsonResponse(res, { success: true, saved_shot_ids: savedIds });
      }

      // 16. Upsert Audio: POST /api/media-center/audio
      if (pathname === '/api/media-center/audio' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.video_id) return jsonResponse(res, { success: false, error: 'video_id required' }, 400);
        const audio = db.upsertVideoAudio(body.video_id, body);
        return jsonResponse(res, { success: true, audio });
      }

      // 17. Semantic Shot Search: GET /api/media-center/search/shots
      if (pathname === '/api/media-center/search/shots' && method === 'GET') {
        const q = parsedUrl.searchParams.get('q') || '';
        const shotType = parsedUrl.searchParams.get('shot_type') || undefined;
        const movement = parsedUrl.searchParams.get('camera_movement') || undefined;
        const limit = parsedUrl.searchParams.get('limit') || 20;

        const results = shotSearchService.search(q, { shot_type: shotType, camera_movement: movement, limit });
        return jsonResponse(res, { success: true, count: results.length, shots: results });
      }

      // Unmatched route
      return jsonResponse(res, { error: 'Not found', path: pathname }, 404);
    } catch (err) {
      console.error('[MediaCenterApi] Error:', err);
      return jsonResponse(res, { error: err.message }, 500);
    }
  };
}
