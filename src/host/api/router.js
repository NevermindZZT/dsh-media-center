import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { AnalysisQueue } from '../ai/analysis-queue.js';

export function createVideoManagerApiHandler({ db, mediaEngine, projectExporter, shotSearchService, videoAiAnalyzer }) {
  const analysisQueue = new AnalysisQueue(db);
  const recordAnalysisFailure = (id) => {
    // A video may have been removed while the analyzer was awaiting a remote model.
    // Never insert a replacement row when marking a failure.
    try {
      const video = db.getVideoById(id);
      if (video && video.status !== 'analyzed') db.upsertVideo({ id, status: 'error' });
    }
    catch (error) { console.error('[ai-analyze] Unable to save failure status:', error); }
  };
  const jsonResponse = (res, data, status = 200) => {
    const body = Buffer.from(JSON.stringify(data));
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': body.length,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(body);
  };

  const parseJsonBody = (req) => {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
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
        'Content-Type': 'video/mp4',
        'Access-Control-Allow-Origin': '*'
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

  const streamImageFile = (res, filePath) => {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Image not found');
    }
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  };

  return async function handleRequest(req, res) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      return res.end();
    }

    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;
    const method = req.method;

    try {
      // 1. Status & Binaries: GET /api/video-manager/status
      if (pathname === '/api/video-manager/status' && method === 'GET') {
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

      // 2. Settings: POST /api/video-manager/settings
      if (pathname === '/api/video-manager/settings' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (body.ffmpeg_path !== undefined) db.setSetting('ffmpeg_path', body.ffmpeg_path);
        if (body.ffprobe_path !== undefined) db.setSetting('ffprobe_path', body.ffprobe_path);
        const bins = await mediaEngine.getBinaries();
        return jsonResponse(res, { success: true, binaries: bins });
      }

      // 3. Folders Tree: GET /api/video-manager/folders
      if (pathname === '/api/video-manager/folders' && method === 'GET') {
        const tree = db.getFolderTree();
        return jsonResponse(res, { success: true, folders: tree });
      }

      // 4. Create Folder: POST /api/video-manager/folders
      if (pathname === '/api/video-manager/folders' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.name) return jsonResponse(res, { success: false, error: 'Folder name is required' }, 400);
        const folder = db.createFolder(body.name, body.parent_id || null, body.source_dir_path || null);
        return jsonResponse(res, { success: true, folder });
      }

      // 5. Delete Folder: DELETE /api/video-manager/folders/:id
      const folderDelMatch = pathname.match(/^\/api\/video-manager\/folders\/([a-zA-Z0-9_-]+)$/);
      if (folderDelMatch && method === 'DELETE') {
        db.deleteFolder(folderDelMatch[1]);
        return jsonResponse(res, { success: true });
      }

      // 5.1 Rename Folder: PUT /api/video-manager/folders/:id
      if (folderDelMatch && method === 'PUT') {
        const body = await parseJsonBody(req);
        if (!body.name) return jsonResponse(res, { success: false, error: 'New folder name is required' }, 400);
        const renamed = db.renameFolder(folderDelMatch[1], body.name);
        return jsonResponse(res, { success: true, folder: renamed });
      }

      // 6. Scan Directory: POST /api/video-manager/folders/scan
      if (pathname === '/api/video-manager/folders/scan' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.directory_path) {
          return jsonResponse(res, { success: false, error: 'directory_path is required' }, 400);
        }
        const scanResult = await mediaEngine.scanAndImportDirectory(body.directory_path, body.parent_id || null);
        return jsonResponse(res, { success: true, ...scanResult });
      }

      // 6.1 Browse Local Filesystem: GET /api/video-manager/fs/browse
      if (pathname === '/api/video-manager/fs/browse' && method === 'GET') {
        const dir = parsedUrl.searchParams.get('dir') || undefined;
        const result = mediaEngine.browseFileSystem(dir);
        return jsonResponse(res, { success: true, ...result });
      }

      // 6.2 Import Specific Video Files: POST /api/video-manager/videos/import-files
      if (pathname === '/api/video-manager/videos/import-files' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!Array.isArray(body.file_paths) || body.file_paths.length === 0) {
          return jsonResponse(res, { success: false, error: 'file_paths array is required' }, 400);
        }
        const result = await mediaEngine.importFiles(body.file_paths, body.folder_id || null);
        return jsonResponse(res, { success: true, ...result });
      }

      // 6.3 Batch Move Videos: POST /api/video-manager/videos/batch-move
      if (pathname === '/api/video-manager/videos/batch-move' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!Array.isArray(body.video_ids) || body.video_ids.length === 0) {
          return jsonResponse(res, { success: false, error: 'video_ids array is required' }, 400);
        }
        const count = db.batchMoveVideos(body.video_ids, body.target_folder_id || null);
        return jsonResponse(res, { success: true, moved_count: count });
      }

      // 6.4 Batch Delete Videos: POST /api/video-manager/videos/batch-delete
      if (pathname === '/api/video-manager/videos/batch-delete' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!Array.isArray(body.video_ids) || body.video_ids.length === 0) {
          return jsonResponse(res, { success: false, error: 'video_ids array is required' }, 400);
        }
        const count = db.batchDeleteVideos(body.video_ids);
        return jsonResponse(res, { success: true, deleted_count: count });
      }

      // 7. Video List: GET /api/video-manager/videos
      if (pathname === '/api/video-manager/videos' && method === 'GET') {
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
        const videos = status
          ? db.queryVideos(options).filter(v => analysisQueue.overlay(v).status === status ||
                (status === 'imported' && analysisQueue.active.has(v.id)))
              .map(v => analysisQueue.overlay(v))
              .slice(Math.max(0, Number(offset) || 0), Math.max(0, Number(offset) || 0) + Math.max(0, Number(limit) || 100))
          : db.queryVideos({ ...options, limit, offset }).map(v => analysisQueue.overlay(v));
        return jsonResponse(res, { success: true, videos });
      }

      // 8. Video Details: GET /api/video-manager/videos/:id
      const videoDetailMatch = pathname.match(/^\/api\/video-manager\/videos\/([a-zA-Z0-9_-]+)$/);
      if (videoDetailMatch && method === 'GET') {
        await mediaEngine.ensureCaptureTimes();
        const video = db.getVideoById(videoDetailMatch[1], true, true);
        if (!video) return jsonResponse(res, { success: false, error: 'Video not found' }, 404);
        return jsonResponse(res, { success: true, video: analysisQueue.overlay(video) });
      }

      // 9. Update Video: PUT /api/video-manager/videos/:id
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

      // 10. Delete Video: DELETE /api/video-manager/videos/:id
      if (videoDetailMatch && method === 'DELETE') {
        db.deleteVideo(videoDetailMatch[1]);
        return jsonResponse(res, { success: true });
      }

      // 11. Trigger Analysis: POST /api/video-manager/videos/:id/analyze
      const analyzeMatch = pathname.match(/^\/api\/video-manager\/videos\/([a-zA-Z0-9_-]+)\/analyze$/);
      if (analyzeMatch && method === 'POST') {
        const videoId = analyzeMatch[1];
        const video = db.getVideoById(videoId);
        if (!video) return jsonResponse(res, { success: false, error: 'Video not found' }, 404);

        db.upsertVideo({ id: videoId, status: 'analyzing' });

        // Execute background features
        const storyboardPath = await mediaEngine.generateStoryboard(video);
        const silenceIntervals = await mediaEngine.detectSilence(video);
        const { bpm, beats } = await mediaEngine.detectBpmAndBeats(video);

        db.upsertVideoAudio(videoId, {
          silence_intervals: silenceIntervals,
          bpm,
          beats
        });

        const shots = await mediaEngine.detectInitialShots(video);
        db.upsertShots(videoId, shots);

        const updated = db.getVideoById(videoId, true, true);
        return jsonResponse(res, {
          success: true,
          video: updated,
          storyboard_path: storyboardPath
        });
      }

      // 11.1 Directly Trigger Multi-modal AI Video Analysis: POST /api/video-manager/videos/:id/ai-analyze
      const aiAnalyzeMatch = pathname.match(/^\/api\/video-manager\/videos\/([a-zA-Z0-9_-]+)\/ai-analyze$/);
      if (aiAnalyzeMatch && method === 'POST') {
        const videoId = aiAnalyzeMatch[1];
        const reservation = analysisQueue.reserve([videoId]);
        if (!reservation.ok) return jsonResponse(res, { success: false, error: reservation.error, video_ids: reservation.video_ids }, reservation.status);
        try {
          analysisQueue.start(videoId, reservation.token);
          const result = await videoAiAnalyzer.analyzeVideo(videoId);
          if (result?.success === false) throw new Error(result.error || 'AI analysis failed');
          return jsonResponse(res, result);
        } catch (e) {
          recordAnalysisFailure(videoId);
          console.error('[ai-analyze] Error:', e);
          return jsonResponse(res, { success: false, error: e.message }, 500);
        } finally {
          analysisQueue.release(videoId, reservation.token);
        }
      }

      // 11.2 Batch Multi-modal AI Video Analysis: POST /api/video-manager/videos/batch-ai-analyze
      if (pathname === '/api/video-manager/videos/batch-ai-analyze' && method === 'POST') {
        const body = await parseJsonBody(req);
        const reservation = analysisQueue.reserve(body?.video_ids);
        if (!reservation.ok) return jsonResponse(res, { success: false, error: reservation.error, video_ids: reservation.video_ids }, reservation.status);
        const results = [];
        let succeeded = 0;
        try {
          for (const vid of body.video_ids) {
            try {
              analysisQueue.start(vid, reservation.token);
              // A queued video can be removed while an earlier video is processing.
              if (!db.getVideoById(vid)) throw new Error('Video not found');
              const r = await videoAiAnalyzer.analyzeVideo(vid);
              if (r?.success === false) throw new Error(r.error || 'AI analysis failed');
              results.push({ video_id: vid, success: true, audit: r.audit });
              succeeded++;
            } catch (e) {
              recordAnalysisFailure(vid);
              results.push({ video_id: vid, success: false, error: e.message });
            } finally {
              analysisQueue.release(vid, reservation.token);
            }
          }
          return jsonResponse(res, {
            success: true,
            total: body.video_ids.length,
            succeeded,
            results
          });
        } finally {
          // Also release not-yet-started IDs if an unexpected error aborts the loop.
          for (const vid of body.video_ids) analysisQueue.release(vid, reservation.token);
        }
      }

      // Return live registered DSH providers/models; no credentials are exposed.
      if (pathname === '/api/video-manager/ai-models' && method === 'GET') {
        const catalog = await videoAiAnalyzer.getModelCatalog();
        return jsonResponse(res, { success: true, ...catalog });
      }
      if (pathname === '/api/video-manager/ai-settings' && method === 'GET') {
        return jsonResponse(res, { success: true, ...videoAiAnalyzer.getAiSettings() });
      }
      if (pathname === '/api/video-manager/ai-settings' && method === 'POST') {
        const body = await parseJsonBody(req);
        try {
          const settings = await videoAiAnalyzer.saveAiSettings(body);
          return jsonResponse(res, { success: true, ...settings });
        } catch (e) {
          return jsonResponse(res, { success: false, error: e.message }, 400);
        }
      }

      // 12. Video Storyboard Image: GET /api/video-manager/videos/:id/storyboard
      const storyboardMatch = pathname.match(/^\/api\/video-manager\/videos\/([a-zA-Z0-9_-]+)\/storyboard$/);
      if (storyboardMatch && method === 'GET') {
        const video = db.getVideoById(storyboardMatch[1]);
        if (!video || !video.storyboard_path || !fs.existsSync(video.storyboard_path)) {
          // Fallback or 404
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Storyboard not found');
        }
        return streamImageFile(res, video.storyboard_path);
      }

      // 13. Video Media Stream: GET /api/video-manager/videos/:id/stream
      const streamMatch = pathname.match(/^\/api\/video-manager\/videos\/([a-zA-Z0-9_-]+)\/stream$/);
      if (streamMatch && method === 'GET') {
        const video = db.getVideoById(streamMatch[1]);
        if (!video || !fs.existsSync(video.file_path)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('Video file not found');
        }
        return streamVideoFile(req, res, video.file_path);
      }

      // 14. Keyframe image: GET /api/video-manager/keyframes/:file
      const keyframeMatch = pathname.match(/^\/api\/video-manager\/keyframes\/([a-zA-Z0-9_.-]+)$/);
      if (keyframeMatch && method === 'GET') {
        const keyframeFile = path.join(db.keyframesDir, keyframeMatch[1]);
        return streamImageFile(res, keyframeFile);
      }

      // 15. Upsert Shots: POST /api/video-manager/shots
      if (pathname === '/api/video-manager/shots' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.video_id || !Array.isArray(body.shots)) {
          return jsonResponse(res, { success: false, error: 'video_id and shots array required' }, 400);
        }
        const savedIds = db.upsertShots(body.video_id, body.shots);
        return jsonResponse(res, { success: true, saved_shot_ids: savedIds });
      }

      // 16. Upsert Audio: POST /api/video-manager/audio
      if (pathname === '/api/video-manager/audio' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.video_id) return jsonResponse(res, { success: false, error: 'video_id required' }, 400);
        const audio = db.upsertVideoAudio(body.video_id, body);
        return jsonResponse(res, { success: true, audio });
      }

      // 17. Semantic Shot Search: GET /api/video-manager/search/shots
      if (pathname === '/api/video-manager/search/shots' && method === 'GET') {
        const q = parsedUrl.searchParams.get('q') || '';
        const shotType = parsedUrl.searchParams.get('shot_type') || undefined;
        const movement = parsedUrl.searchParams.get('camera_movement') || undefined;
        const limit = parsedUrl.searchParams.get('limit') || 20;

        const results = shotSearchService.search(q, { shot_type: shotType, camera_movement: movement, limit });
        return jsonResponse(res, { success: true, count: results.length, shots: results });
      }

      // 18. Export Project: POST /api/video-manager/export
      if (pathname === '/api/video-manager/export' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { sequence_name = 'My_Edit', format = 'jianying', clips = [], fps = 30 } = body;

        const filledClips = [];
        for (const c of clips) {
          let v = null;
          if (c.video_id) v = db.getVideoById(c.video_id);
          else if (c.file_path) v = db.getVideoByPath(c.file_path);
          filledClips.push({
            ...c,
            file_path: c.file_path || (v ? v.file_path : ''),
            file_name: v ? v.file_name : (c.file_path ? path.basename(c.file_path) : 'clip'),
            file_duration: v ? v.duration : 3600,
            width: v ? v.width : 1920,
            height: v ? v.height : 1080
          });
        }

        let result;
        if (format === 'edl') result = projectExporter.exportEDL(sequence_name, filledClips, { fps });
        else if (format === 'fcpxml') result = projectExporter.exportFCPXML(sequence_name, filledClips, { fps });
        else result = projectExporter.exportJianYingDraft(sequence_name, filledClips, { fps });

        return jsonResponse(res, { success: true, export_result: result });
      }

      // Unmatched route
      return jsonResponse(res, { error: 'Not found', path: pathname }, 404);
    } catch (err) {
      console.error('[VideoManagerApi] Error:', err);
      return jsonResponse(res, { error: err.message }, 500);
    }
  };
}
