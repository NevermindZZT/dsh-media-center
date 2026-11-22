import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class VideoDatabase {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.dbDir = path.join(this.workspaceRoot, '.dsh-media-center');
    this.legacyDbDir = path.join(this.workspaceRoot, '.dsh-video-manager');
    this.cacheDir = path.join(this.dbDir, 'cache');
    this.storyboardsDir = path.join(this.cacheDir, 'storyboards');
    this.keyframesDir = path.join(this.cacheDir, 'keyframes');
    this.previewsDir = path.join(this.cacheDir, 'previews');
    this.exportsDir = path.join(this.cacheDir, 'exports');

    this.customDbPath = options.databasePath || null;
    this.dbPath = this.customDbPath || path.join(this.dbDir, 'media_center.db');

    this.migrateLegacyData();
    this.ensureDirs();
    this.initDb();
  }

  migrateLegacyData() {
    if (this.customDbPath || fs.existsSync(this.dbPath)) return;
    const legacyDbPath = path.join(this.legacyDbDir, 'video_manager.db');
    if (!fs.existsSync(legacyDbPath)) return;
    try {
      fs.mkdirSync(this.dbDir, { recursive: true });
      const legacyCache = path.join(this.legacyDbDir, 'cache');
      if (fs.existsSync(legacyCache) && !fs.existsSync(this.cacheDir)) {
        fs.cpSync(legacyCache, this.cacheDir, { recursive: true });
      }
      const escaped = this.dbPath.replaceAll("'", "''");
      const source = new DatabaseSync(legacyDbPath, { readOnly: true });
      try { source.exec(`VACUUM INTO '${escaped}'`); } finally { source.close(); }
      const migrated = new DatabaseSync(this.dbPath);
      try {
        const tables = new Set(migrated.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
        const columns = [['videos', 'storyboard_path'], ['video_shots', 'keyframe_path'], ['shot_analysis_runs', 'storyboard_path']];
        for (const [table, column] of columns) {
          if (!tables.has(table)) continue;
          migrated.prepare(`UPDATE ${table} SET ${column}=replace(${column}, ?, ?) WHERE ${column} LIKE ?`)
            .run(this.legacyDbDir, this.dbDir, `${this.legacyDbDir}%`);
        }
      } finally { migrated.close(); }
      console.log(`[MediaCenter] Migrated data directory to ${this.dbDir}`);
    } catch (error) {
      console.warn('[MediaCenter] Legacy data migration failed:', error.message);
    }
  }

  ensureDirs() {
    if (!fs.existsSync(this.dbDir)) {
      fs.mkdirSync(this.dbDir, { recursive: true });
    }
    if (!fs.existsSync(this.storyboardsDir)) {
      fs.mkdirSync(this.storyboardsDir, { recursive: true });
    }
    if (!fs.existsSync(this.keyframesDir)) {
      fs.mkdirSync(this.keyframesDir, { recursive: true });
    }
    if (!fs.existsSync(this.previewsDir)) {
      fs.mkdirSync(this.previewsDir, { recursive: true });
    }
    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
    }

    // Auto-update .gitignore
    try {
      const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        if (!content.includes('.dsh-media-center')) {
          fs.appendFileSync(gitignorePath, '\n# DSH Media Center data and cache\n.dsh-media-center/\n.dsh-video-manager/\n');
        }
      }
    } catch {
      // ignore gitignore update failure
    }
  }

  initDb() {
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');

    // 1. Settings Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // 2. Folders Table (Supports Multi-level hierarchy)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        name TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        source_dir_path TEXT,
        level INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE CASCADE
      );
    `);

    // 3. Videos Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        folder_id TEXT,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL UNIQUE,
        source_identity_json TEXT,
        file_size INTEGER DEFAULT 0,
        duration REAL DEFAULT 0,
        width INTEGER DEFAULT 0,
        height INTEGER DEFAULT 0,
        fps REAL DEFAULT 0,
        codec TEXT,
        video_profile TEXT,
        pix_fmt TEXT,
        bitrate INTEGER DEFAULT 0,
        audio_channels INTEGER DEFAULT 0,
        sample_rate INTEGER DEFAULT 0,
        status TEXT DEFAULT 'imported',
        summary TEXT,
        user_notes TEXT,
        tags TEXT DEFAULT '[]',
        storyboard_path TEXT,
        storyboard_status TEXT NOT NULL DEFAULT 'not_started',
        storyboard_error TEXT,
        ai_model TEXT,
        ai_prompt_tokens INTEGER DEFAULT 0,
        ai_completion_tokens INTEGER DEFAULT 0,
        ai_total_tokens INTEGER DEFAULT 0,
        ai_latency_ms INTEGER DEFAULT 0,
        ai_analyzed_at TEXT,
        ai_error TEXT,
        captured_at TEXT,
        captured_at_source TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE SET NULL
      );
    `);

    // Migration: ensure new AI audit columns exist on existing databases
    try {
      const videoCols = this.db.prepare("PRAGMA table_info(videos)").all().map(c => c.name);
      if (!videoCols.includes('storyboard_status')) {
        this.db.exec("ALTER TABLE videos ADD COLUMN storyboard_status TEXT NOT NULL DEFAULT 'not_started';");
        this.db.exec("UPDATE videos SET storyboard_status = CASE WHEN storyboard_path IS NOT NULL AND storyboard_path != '' THEN 'ready' ELSE 'not_started' END;");
      }
      if (!videoCols.includes('storyboard_error')) this.db.exec('ALTER TABLE videos ADD COLUMN storyboard_error TEXT;');
      if (!videoCols.includes('source_identity_json')) this.db.exec('ALTER TABLE videos ADD COLUMN source_identity_json TEXT;');
      if (!videoCols.includes('ai_prompt_tokens')) this.db.exec("ALTER TABLE videos ADD COLUMN ai_prompt_tokens INTEGER DEFAULT 0;");
      if (!videoCols.includes('ai_completion_tokens')) this.db.exec("ALTER TABLE videos ADD COLUMN ai_completion_tokens INTEGER DEFAULT 0;");
      if (!videoCols.includes('ai_total_tokens')) this.db.exec("ALTER TABLE videos ADD COLUMN ai_total_tokens INTEGER DEFAULT 0;");
      if (!videoCols.includes('ai_latency_ms')) this.db.exec("ALTER TABLE videos ADD COLUMN ai_latency_ms INTEGER DEFAULT 0;");
      if (!videoCols.includes('ai_analyzed_at')) this.db.exec("ALTER TABLE videos ADD COLUMN ai_analyzed_at TEXT;");
      if (!videoCols.includes('ai_error')) this.db.exec('ALTER TABLE videos ADD COLUMN ai_error TEXT;');
      if (!videoCols.includes('video_profile')) this.db.exec('ALTER TABLE videos ADD COLUMN video_profile TEXT;');
      if (!videoCols.includes('pix_fmt')) this.db.exec('ALTER TABLE videos ADD COLUMN pix_fmt TEXT;');
      if (!videoCols.includes('captured_at')) {
        this.db.exec("ALTER TABLE videos ADD COLUMN captured_at TEXT;");
      }
      if (!videoCols.includes('captured_at_source')) {
        this.db.exec("ALTER TABLE videos ADD COLUMN captured_at_source TEXT;");
        // The old migration copied import timestamps; none of those values are trusted.
        this.db.exec("UPDATE videos SET captured_at = NULL;");
      }
    } catch (e) {
      console.warn('[VideoDatabase] Video table migration warning:', e.message);
    }

    // 4. Video Shots Table (Storyboards / Scenes)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS video_shots (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        shot_index INTEGER NOT NULL,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        duration REAL NOT NULL,
        shot_type TEXT,
        camera_movement TEXT,
        subject TEXT,
        visual_description TEXT,
        composition TEXT,
        tags TEXT DEFAULT '[]',
        quality_score REAL DEFAULT 3,
        keyframe_path TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE
      );
    `);

    // 5. Video Audio Table (Transcripts, Beats, Silence Intervals)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS video_audio (
        video_id TEXT PRIMARY KEY,
        transcripts TEXT DEFAULT '[]',
        bgm_type TEXT,
        bgm_mood TEXT,
        bpm REAL DEFAULT 0,
        beats TEXT DEFAULT '[]',
        silence_intervals TEXT DEFAULT '[]',
        sfx_cues TEXT DEFAULT '[]',
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(video_id) REFERENCES videos(id) ON DELETE CASCADE
      );
    `);

    // 6. FTS5 Virtual Table for Fast Hybrid Search
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS video_shots_fts USING fts5(
          shot_id UNINDEXED,
          video_id UNINDEXED,
          subject,
          visual_description,
          shot_type,
          camera_movement,
          tags
        );
      `);
    } catch (e) {
      // In case FTS5 is not available in some environment
      console.warn('[VideoDatabase] FTS5 setup warning:', e.message);
    }
  }

  // ================= Setting Methods =================
  getSetting(key, defaultValue = null) {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key);
    return row ? row.value : defaultValue;
  }

  setSetting(key, value) {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(key, String(value));
  }

  getAllSettings() {
    const stmt = this.db.prepare('SELECT key, value FROM settings');
    const rows = stmt.all();
    const result = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  // ================= Folder Methods =================
  ensureFolder(relativePath, sourceDirPath = null, baseParentId = null) {
    // relativePath e.g. "扎尕那" or "1004-洛克之路"
    const parts = relativePath.split(/[/\\]/).filter(Boolean);
    if (parts.length === 0) return null;

    let parentId = null;
    let accumulatedPath = '';
    let currentFolder = null;
    let baseLevel = 0;

    if (baseParentId) {
      const baseParent = this.db.prepare('SELECT * FROM folders WHERE id = ?').get(baseParentId);
      if (baseParent) {
        parentId = baseParent.id;
        accumulatedPath = baseParent.relative_path;
        baseLevel = baseParent.level;
      }
    }

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const level = baseLevel + i + 1;

      let row = this.db.prepare('SELECT * FROM folders WHERE relative_path = ?').get(accumulatedPath);
      if (!row) {
        const id = 'folder_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        const sourcePath = (i === parts.length - 1) ? sourceDirPath : null;
        this.db.prepare(`
          INSERT INTO folders (id, parent_id, name, relative_path, source_dir_path, level)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, parentId, part, accumulatedPath, sourcePath, level);
        row = this.db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
      }
      parentId = row.id;
      currentFolder = row;
    }
    return currentFolder;
  }

  getFolderTree() {
    const folders = this.db.prepare('SELECT * FROM folders ORDER BY level ASC, sort_order ASC, name ASC').all();
    const videoCounts = this.db.prepare(`
      SELECT folder_id, COUNT(*) as count,
             SUM(CASE WHEN status = 'analyzed' THEN 1 ELSE 0 END) as analyzed_count
      FROM videos
      GROUP BY folder_id
    `).all();

    const countMap = {};
    for (const vc of videoCounts) {
      countMap[vc.folder_id] = { count: vc.count, analyzedCount: vc.analyzed_count };
    }

    const folderMap = new Map();
    const rootNodes = [];

    for (const f of folders) {
      const stats = countMap[f.id] || { count: 0, analyzedCount: 0 };
      const node = {
        ...f,
        videoCount: stats.count,
        analyzedCount: stats.analyzedCount,
        children: []
      };
      folderMap.set(f.id, node);
    }

    for (const f of folders) {
      const node = folderMap.get(f.id);
      if (f.parent_id && folderMap.has(f.parent_id)) {
        folderMap.get(f.parent_id).children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    // Rollup video counts from children to parents so ancestors reflect total videos in their subtree
    const rollupCounts = (node) => {
      let totalCount = node.videoCount;
      let totalAnalyzed = node.analyzedCount;
      for (const child of node.children) {
        const childStats = rollupCounts(child);
        totalCount += childStats.count;
        totalAnalyzed += childStats.analyzed;
      }
      node.videoCount = totalCount;
      node.analyzedCount = totalAnalyzed;
      return { count: totalCount, analyzed: totalAnalyzed };
    };

    for (const root of rootNodes) {
      rollupCounts(root);
    }

    return rootNodes;
  }

  getAllDescendantFolderIds(rootFolderId) {
    const ids = [rootFolderId];
    const queue = [rootFolderId];
    const stmt = this.db.prepare('SELECT id FROM folders WHERE parent_id = ?');

    while (queue.length > 0) {
      const parentId = queue.shift();
      const children = stmt.all(parentId);
      for (const child of children) {
        ids.push(child.id);
        queue.push(child.id);
      }
    }
    return ids;
  }

  createFolder(name, parentId = null, sourceDirPath = null) {
    let relativePath = name;
    let level = 1;
    if (parentId) {
      const parent = this.db.prepare('SELECT * FROM folders WHERE id = ?').get(parentId);
      if (parent) {
        relativePath = `${parent.relative_path}/${name}`;
        level = parent.level + 1;
      }
    }
    const id = 'folder_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    this.db.prepare(`
      INSERT INTO folders (id, parent_id, name, relative_path, source_dir_path, level)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, parentId, name, relativePath, sourceDirPath, level);
    return this.db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
  }

  deleteFolder(folderId) {
    this.db.prepare('DELETE FROM folders WHERE id = ?').run(folderId);
    return true;
  }

  renameFolder(folderId, newName) {
    const folder = this.db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
    if (!folder || !newName || !newName.trim()) return null;

    const trimmedName = newName.trim();
    let newRelativePath = trimmedName;
    if (folder.parent_id) {
      const parent = this.db.prepare('SELECT relative_path FROM folders WHERE id = ?').get(folder.parent_id);
      if (parent) {
        newRelativePath = `${parent.relative_path}/${trimmedName}`;
      }
    }

    this.db.prepare('UPDATE folders SET name = ?, relative_path = ? WHERE id = ?').run(trimmedName, newRelativePath, folderId);

    // Recursively update children
    const updateDescendants = (parentId, parentPath) => {
      const children = this.db.prepare('SELECT id, name FROM folders WHERE parent_id = ?').all(parentId);
      for (const child of children) {
        const childPath = `${parentPath}/${child.name}`;
        this.db.prepare('UPDATE folders SET relative_path = ? WHERE id = ?').run(childPath, child.id);
        updateDescendants(child.id, childPath);
      }
    };
    updateDescendants(folderId, newRelativePath);

    return this.db.prepare('SELECT * FROM folders WHERE id = ?').get(folderId);
  }

  // ================= Video Methods =================
  upsertVideo(videoData, options = {}) {
    const id = videoData.id || ('vid_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12));
    const now = new Date().toISOString();

    let existing = null;
    if (videoData.id) {
      existing = this.db.prepare('SELECT id FROM videos WHERE id = ?').get(videoData.id);
    }
    if (!existing && videoData.file_path) {
      existing = this.db.prepare('SELECT id FROM videos WHERE file_path = ?').get(videoData.file_path);
    }
    if (existing) {
      if (options.insertOnly) return { created: false, video: this.getVideoById(existing.id) };
      this.db.prepare(`
        UPDATE videos SET
          folder_id = COALESCE(?, folder_id),
          file_name = COALESCE(?, file_name),
          file_size = COALESCE(?, file_size),
          duration = COALESCE(?, duration),
          width = COALESCE(?, width),
          height = COALESCE(?, height),
          fps = COALESCE(?, fps),
          codec = COALESCE(?, codec),
          video_profile = COALESCE(?, video_profile),
          pix_fmt = COALESCE(?, pix_fmt),
          bitrate = COALESCE(?, bitrate),
          audio_channels = COALESCE(?, audio_channels),
          sample_rate = COALESCE(?, sample_rate),
          status = COALESCE(?, status),
          summary = COALESCE(?, summary),
          user_notes = COALESCE(?, user_notes),
          tags = COALESCE(?, tags),
          storyboard_path = COALESCE(?, storyboard_path),
          storyboard_status = COALESCE(?, storyboard_status),
          storyboard_error = CASE WHEN ? THEN ? ELSE storyboard_error END,
          source_identity_json = COALESCE(?, source_identity_json),
          ai_model = COALESCE(?, ai_model),
          ai_prompt_tokens = COALESCE(?, ai_prompt_tokens),
          ai_completion_tokens = COALESCE(?, ai_completion_tokens),
          ai_total_tokens = COALESCE(?, ai_total_tokens),
          ai_latency_ms = COALESCE(?, ai_latency_ms),
          ai_analyzed_at = COALESCE(?, ai_analyzed_at),
          ai_error = CASE WHEN ? THEN ? ELSE ai_error END,
          captured_at = CASE WHEN ? THEN ? ELSE captured_at END,
          captured_at_source = COALESCE(?, captured_at_source),
          updated_at = ?
        WHERE id = ?
      `).run(
        videoData.folder_id ?? null,
        videoData.file_name ?? null,
        videoData.file_size ?? null,
        videoData.duration ?? null,
        videoData.width ?? null,
        videoData.height ?? null,
        videoData.fps ?? null,
        videoData.codec ?? null,
        videoData.video_profile ?? null,
        videoData.pix_fmt ?? null,
        videoData.bitrate ?? null,
        videoData.audio_channels ?? null,
        videoData.sample_rate ?? null,
        videoData.status ?? null,
        videoData.summary ?? null,
        videoData.user_notes ?? null,
        videoData.tags ? (typeof videoData.tags === 'string' ? videoData.tags : JSON.stringify(videoData.tags)) : null,
        videoData.storyboard_path ?? null,
        videoData.storyboard_status ?? null,
        Object.hasOwn(videoData, 'storyboard_error') ? 1 : 0,
        videoData.storyboard_error ?? null,
        videoData.source_identity_json ?? null,
        videoData.ai_model ?? null,
        videoData.ai_prompt_tokens ?? null,
        videoData.ai_completion_tokens ?? null,
        videoData.ai_total_tokens ?? null,
        videoData.ai_latency_ms ?? null,
        videoData.ai_analyzed_at ?? null,
        Object.hasOwn(videoData, 'ai_error') ? 1 : 0,
        videoData.ai_error ?? null,
        Object.hasOwn(videoData, 'captured_at') ? 1 : 0,
        videoData.captured_at ?? null,
        videoData.captured_at_source ?? null,
        now,
        existing.id
      );
      return this.getVideoById(existing.id);
    } else {
      this.db.prepare(`
        INSERT INTO videos (
          id, folder_id, file_name, file_path, source_identity_json, file_size, duration,
          width, height, fps, codec, video_profile, pix_fmt, bitrate, audio_channels, sample_rate,
          status, summary, user_notes, tags, storyboard_path, storyboard_status, storyboard_error,
          ai_model, ai_prompt_tokens, ai_completion_tokens, ai_total_tokens, ai_latency_ms, ai_analyzed_at, ai_error,
          captured_at, captured_at_source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        videoData.folder_id ?? null,
        videoData.file_name,
        videoData.file_path,
        videoData.source_identity_json ?? null,
        videoData.file_size ?? 0,
        videoData.duration ?? 0,
        videoData.width ?? 0,
        videoData.height ?? 0,
        videoData.fps ?? 0,
        videoData.codec ?? '',
        videoData.video_profile ?? null,
        videoData.pix_fmt ?? null,
        videoData.bitrate ?? 0,
        videoData.audio_channels ?? 0,
        videoData.sample_rate ?? 0,
        videoData.status ?? 'imported',
        videoData.summary ?? null,
        videoData.user_notes ?? null,
        videoData.tags ? (typeof videoData.tags === 'string' ? videoData.tags : JSON.stringify(videoData.tags)) : '[]',
        videoData.storyboard_path ?? null,
        videoData.storyboard_status ?? (videoData.storyboard_path ? 'ready' : 'not_started'),
        videoData.storyboard_error ?? null,
        videoData.ai_model ?? null,
        videoData.ai_prompt_tokens ?? 0,
        videoData.ai_completion_tokens ?? 0,
        videoData.ai_total_tokens ?? 0,
        videoData.ai_latency_ms ?? 0,
        videoData.ai_analyzed_at ?? null,
        videoData.ai_error ?? null,
        videoData.captured_at ?? null,
        videoData.captured_at_source ?? null,
        now,
        now
      );
      const video = this.getVideoById(id);
      return options.insertOnly ? { created: true, video } : video;
    }
  }

  insertVideoIfAbsent(videoData) {
    try {
      return this.upsertVideo(videoData, { insertOnly: true });
    } catch (error) {
      const existing = videoData?.file_path ? this.db.prepare('SELECT id FROM videos WHERE file_path = ?').get(videoData.file_path) : null;
      if (existing) return { created: false, video: this.getVideoById(existing.id) };
      throw error;
    }
  }

  updateStoryboardState(videoId, status, errorCode = null, expectedFilePath = null) {
    const allowed = new Set(['not_started','pending','generating','ready','failed']);
    if (!allowed.has(status)) throw new Error('Invalid storyboard status');
    const error = errorCode == null ? null : String(errorCode).replace(/[\r\n]/g,' ').slice(0,120);
    const result = expectedFilePath == null
      ? this.db.prepare('UPDATE videos SET storyboard_status = ?, storyboard_error = ?, updated_at = ? WHERE id = ?').run(status,error,new Date().toISOString(),videoId)
      : this.db.prepare('UPDATE videos SET storyboard_status = ?, storyboard_error = ?, updated_at = ? WHERE id = ? AND file_path = ?').run(status,error,new Date().toISOString(),videoId,expectedFilePath);
    return result.changes > 0;
  }

  setVideoStoryboard(videoId, expectedFilePath, storyboardPath) {
    const result = this.db.prepare(`UPDATE videos SET storyboard_path = ?, storyboard_status = 'ready', storyboard_error = NULL, updated_at = ? WHERE id = ? AND file_path = ?`)
      .run(storyboardPath,new Date().toISOString(),videoId,expectedFilePath);
    return result.changes > 0;
  }

  getPendingStoryboardVideos() {
    return this.db.prepare(`SELECT id, file_path, file_name, duration, storyboard_path, storyboard_status FROM videos WHERE storyboard_status IN ('pending','generating') ORDER BY created_at ASC`).all();
  }

  getReadyStoryboardVideos() {
    return this.db.prepare(`SELECT id, file_path, file_name, duration, storyboard_path, storyboard_status FROM videos WHERE storyboard_status = 'ready' AND storyboard_path IS NOT NULL AND storyboard_path != ''`).all();
  }

  resetStoryboardCache() {
    return this.db.prepare(`UPDATE videos SET storyboard_path = NULL, storyboard_status = 'not_started', storyboard_error = NULL, updated_at = ? WHERE storyboard_path IS NOT NULL OR storyboard_status != 'not_started'`).run(new Date().toISOString()).changes;
  }

  getPendingCaptureTimes() {
    return this.db.prepare(`SELECT id, file_path FROM videos
      WHERE captured_at_source IS NULL OR captured_at_source = 'unavailable'`).all();
  }

  updateCaptureTime(videoId, captureTime) {
    this.db.prepare(`UPDATE videos SET captured_at = ?, captured_at_source = ? WHERE id = ?`)
      .run(captureTime.captured_at ?? null, captureTime.captured_at_source, videoId);
  }

  getVideoById(id, includeShots = false, includeAudio = false) {
    const video = this.db.prepare(`
      SELECT v.*, f.name as folder_name, f.relative_path as folder_path
      FROM videos v
      LEFT JOIN folders f ON v.folder_id = f.id
      WHERE v.id = ?
    `).get(id);

    if (!video) return null;

    try {
      video.tags = JSON.parse(video.tags || '[]');
    } catch {
      video.tags = [];
    }

    delete video.source_identity_json;
    if (includeShots) {
      video.shots = this.getVideoShots(id);
    }
    if (includeAudio) {
      video.audio = this.getVideoAudio(id);
    }
    return video;
  }

  getVideoByPath(filePath) {
    const row = this.db.prepare('SELECT id FROM videos WHERE file_path = ?').get(filePath);
    return row ? this.getVideoById(row.id) : null;
  }

  getVideoImportRecord(videoId) {
    return this.db.prepare(`SELECT id,file_path,file_name,file_size,duration,source_identity_json,storyboard_path,storyboard_status,storyboard_error FROM videos WHERE id = ?`).get(videoId) || null;
  }

  listVideoImportRecords() {
    return this.db.prepare(`SELECT id,file_path,file_name,file_size,duration,source_identity_json,storyboard_path,storyboard_status,storyboard_error FROM videos`).all();
  }

  queryVideos(options = {}) {
    let sql = `
      SELECT v.*, f.name as folder_name, f.relative_path as folder_path
      FROM videos v
      LEFT JOIN folders f ON v.folder_id = f.id
      WHERE 1=1
    `;
    const params = [];

    if (options.folder_id) {
      // Recursively include this folder and ALL its descendant sub-folders
      const folderIds = this.getAllDescendantFolderIds(options.folder_id);
      if (folderIds.length === 1) {
        sql += ` AND v.folder_id = ?`;
        params.push(folderIds[0]);
      } else {
        const placeholders = folderIds.map(() => '?').join(',');
        sql += ` AND v.folder_id IN (${placeholders})`;
        params.push(...folderIds);
      }
    }

    if (options.status) {
      sql += ` AND v.status = ?`;
      params.push(options.status);
    }

    if (options.query) {
      sql += ` AND (v.file_name LIKE ? OR v.summary LIKE ? OR v.user_notes LIKE ?)`;
      const q = `%${options.query}%`;
      params.push(q, q, q);
    }

    if (options.tag) {
      sql += ` AND v.tags LIKE ?`;
      params.push(`%"${options.tag}"%`);
    }

    // Dynamic Multi-field Sorting
    const allowedSortFields = {
      captured_at: 'julianday(v.captured_at)',
      created_at: 'julianday(v.created_at)',
      file_name: 'v.file_name COLLATE NOCASE',
      duration: 'v.duration',
      file_size: 'v.file_size',
      updated_at: 'v.updated_at'
    };

    const sortBy = options.sort_by || options.order_by || 'captured_at';
    const sortField = allowedSortFields[sortBy] || allowedSortFields.captured_at;
    // Default sort direction: file_name defaults to ASC, others default to DESC
    let defaultDir = sortBy === 'file_name' ? 'ASC' : 'DESC';
    const sortDir = options.sort_dir || options.order_dir
      ? (String(options.sort_dir || options.order_dir).toUpperCase() === 'ASC' ? 'ASC' : 'DESC')
      : defaultDir;

    sql += ` ORDER BY ${sortField} IS NULL ASC, ${sortField} ${sortDir}, v.id DESC`;

    if (options.limit) {
      sql += ` LIMIT ?`;
      params.push(Number(options.limit));
      if (options.offset) {
        sql += ` OFFSET ?`;
        params.push(Number(options.offset));
      }
    }

    const rows = this.db.prepare(sql).all(...params);
    return rows.map(r => {
      try {
        r.tags = JSON.parse(r.tags || '[]');
      } catch {
        r.tags = [];
      }
      delete r.source_identity_json;
      return r;
    });
  }

  deleteVideo(videoId) {
    const video = this.getVideoById(videoId);
    if (!video) return false;

    // Paths in the database are untrusted; never delete files during removal.
    // FTS is a separate virtual table and does not participate in FK cascades.
    try {
      this.db.prepare('DELETE FROM video_shots_fts WHERE video_id = ?').run(videoId);
    } catch (e) {
      if (!String(e.message).includes('no such table: video_shots_fts')) throw e;
    }
    this.db.prepare('DELETE FROM videos WHERE id = ?').run(videoId);
    return true;
  }

  batchMoveVideos(videoIds, targetFolderId) {
    if (!Array.isArray(videoIds) || videoIds.length === 0) return 0;
    const stmt = this.db.prepare("UPDATE videos SET folder_id = ?, updated_at = datetime('now', 'localtime') WHERE id = ?");
    for (const id of videoIds) {
      stmt.run(targetFolderId || null, id);
    }
    return videoIds.length;
  }

  batchDeleteVideos(videoIds) {
    if (!Array.isArray(videoIds) || videoIds.length === 0) return 0;
    for (const id of videoIds) {
      this.deleteVideo(id); // Database records only; leave all files untouched.
    }
    return videoIds.length;
  }

  // ================= Shots Methods =================
  getVideoShots(videoId) {
    const shots = this.db.prepare(`
      SELECT * FROM video_shots WHERE video_id = ? ORDER BY shot_index ASC
    `).all(videoId);

    return shots.map(s => {
      try {
        s.tags = JSON.parse(s.tags || '[]');
      } catch {
        s.tags = [];
      }
      return s;
    });
  }

  upsertShots(videoId, shotsList) {
    // Clean old shots
    this.db.prepare('DELETE FROM video_shots WHERE video_id = ?').run(videoId);
    try {
      this.db.prepare('DELETE FROM video_shots_fts WHERE video_id = ?').run(videoId);
    } catch {}

    const insertShot = this.db.prepare(`
      INSERT INTO video_shots (
        id, video_id, shot_index, start_time, end_time, duration,
        shot_type, camera_movement, subject, visual_description,
        composition, tags, quality_score, keyframe_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let insertFts = null;
    try {
      insertFts = this.db.prepare(`
        INSERT INTO video_shots_fts (
          shot_id, video_id, subject, visual_description, shot_type, camera_movement, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
    } catch {}

    const savedIds = [];
    for (let i = 0; i < shotsList.length; i++) {
      const s = shotsList[i];
      const shotId = s.id || ('shot_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12));
      const shotIndex = s.shot_index != null ? s.shot_index : (i + 1);
      const startTime = Number(s.start_time) || 0;
      const endTime = Number(s.end_time) || 0;
      const duration = Number(s.duration) || Math.max(0, endTime - startTime);
      const tagsStr = s.tags ? (typeof s.tags === 'string' ? s.tags : JSON.stringify(s.tags)) : '[]';

      insertShot.run(
        shotId,
        videoId,
        shotIndex,
        startTime,
        endTime,
        duration,
        s.shot_type || '中景',
        s.camera_movement || '固定',
        s.subject || '',
        s.visual_description || '',
        s.composition || '',
        tagsStr,
        Number(s.quality_score) || 3,
        s.keyframe_path || null
      );

      if (insertFts) {
        try {
          insertFts.run(
            shotId,
            videoId,
            s.subject || '',
            s.visual_description || '',
            s.shot_type || '',
            s.camera_movement || '',
            tagsStr
          );
        } catch {}
      }
      savedIds.push(shotId);
    }

    // Mark video as analyzed if shots exist
    if (shotsList.length > 0) {
      this.db.prepare(`UPDATE videos SET status = 'analyzed', updated_at = datetime('now', 'localtime') WHERE id = ?`).run(videoId);
    }
    return savedIds;
  }

  // ================= Audio Methods =================
  getVideoAudio(videoId) {
    const audio = this.db.prepare('SELECT * FROM video_audio WHERE video_id = ?').get(videoId);
    if (!audio) return null;

    try { audio.transcripts = JSON.parse(audio.transcripts || '[]'); } catch { audio.transcripts = []; }
    try { audio.beats = JSON.parse(audio.beats || '[]'); } catch { audio.beats = []; }
    try { audio.silence_intervals = JSON.parse(audio.silence_intervals || '[]'); } catch { audio.silence_intervals = []; }
    try { audio.sfx_cues = JSON.parse(audio.sfx_cues || '[]'); } catch { audio.sfx_cues = []; }
    return audio;
  }

  upsertVideoAudio(videoId, audioData) {
    const existing = this.db.prepare('SELECT video_id FROM video_audio WHERE video_id = ?').get(videoId);
    const transcriptsStr = audioData.transcripts ? (typeof audioData.transcripts === 'string' ? audioData.transcripts : JSON.stringify(audioData.transcripts)) : null;
    const beatsStr = audioData.beats ? (typeof audioData.beats === 'string' ? audioData.beats : JSON.stringify(audioData.beats)) : null;
    const silenceStr = audioData.silence_intervals ? (typeof audioData.silence_intervals === 'string' ? audioData.silence_intervals : JSON.stringify(audioData.silence_intervals)) : null;
    const sfxStr = audioData.sfx_cues ? (typeof audioData.sfx_cues === 'string' ? audioData.sfx_cues : JSON.stringify(audioData.sfx_cues)) : null;

    if (existing) {
      this.db.prepare(`
        UPDATE video_audio SET
          transcripts = COALESCE(?, transcripts),
          bgm_type = COALESCE(?, bgm_type),
          bgm_mood = COALESCE(?, bgm_mood),
          bpm = COALESCE(?, bpm),
          beats = COALESCE(?, beats),
          silence_intervals = COALESCE(?, silence_intervals),
          sfx_cues = COALESCE(?, sfx_cues),
          updated_at = datetime('now', 'localtime')
        WHERE video_id = ?
      `).run(
        transcriptsStr,
        audioData.bgm_type ?? null,
        audioData.bgm_mood ?? null,
        audioData.bpm ?? null,
        beatsStr,
        silenceStr,
        sfxStr,
        videoId
      );
    } else {
      this.db.prepare(`
        INSERT INTO video_audio (
          video_id, transcripts, bgm_type, bgm_mood, bpm, beats, silence_intervals, sfx_cues
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        videoId,
        transcriptsStr || '[]',
        audioData.bgm_type || '无',
        audioData.bgm_mood || '平静',
        audioData.bpm || 0,
        beatsStr || '[]',
        silenceStr || '[]',
        sfxStr || '[]'
      );
    }
    return this.getVideoAudio(videoId);
  }

  // ================= Semantic & Shot Search =================
  searchShots(queryText, options = {}) {
    let shots = [];
    const tokens = (options.tokens && options.tokens.length > 0)
      ? options.tokens
      : queryText.split(/[\s,，、]+/).filter(Boolean);

    // Build multi-token LIKE query
    if (tokens.length > 0) {
      const conditions = [];
      const params = [];
      for (const t of tokens.slice(0, 8)) {
        const q = `%${t}%`;
        conditions.push(`(s.visual_description LIKE ? OR s.subject LIKE ? OR s.tags LIKE ? OR s.shot_type LIKE ? OR s.camera_movement LIKE ? OR f.name LIKE ?)`);
        params.push(q, q, q, q, q, q);
      }

      const sql = `
        SELECT s.*, v.file_name, v.file_path, f.name as folder_name, f.relative_path as folder_path
        FROM video_shots s
        JOIN videos v ON s.video_id = v.id
        LEFT JOIN folders f ON v.folder_id = f.id
        WHERE ${conditions.join(' OR ')}
        LIMIT ?
      `;
      params.push(Number(options.limit) || 50);

      try {
        shots = this.db.prepare(sql).all(...params);
      } catch (e) {
        console.warn('[searchShots] Query error:', e.message);
      }
    }

    if (shots.length === 0) {
      // Fallback: load recent shots
      const recentSql = `
        SELECT s.*, v.file_name, v.file_path, f.name as folder_name, f.relative_path as folder_path
        FROM video_shots s
        JOIN videos v ON s.video_id = v.id
        LEFT JOIN folders f ON v.folder_id = f.id
        ORDER BY s.created_at DESC
        LIMIT ?
      `;
      try {
        shots = this.db.prepare(recentSql).all(Number(options.limit) || 50);
      } catch {}
    }

    return shots.map(s => {
      try { s.tags = JSON.parse(s.tags || '[]'); } catch { s.tags = []; }
      return s;
    });
  }
}
