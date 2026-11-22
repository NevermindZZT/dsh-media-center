import crypto from 'node:crypto';
import { validateEditProject } from './edit-project.js';

/** Plugin-owned editable project versions. Does not open or change source files. */
export class EditProjectStore {
  constructor(videoDb) {
    if (!videoDb?.db) throw new Error('Database unavailable');
    this.db = videoDb.db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS editing_projects (
      id TEXT PRIMARY KEY, revision INTEGER NOT NULL, title TEXT NOT NULL,
      project_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
  }
  get(id) {
    const row = this.db.prepare('SELECT * FROM editing_projects WHERE id = ?').get(id);
    return row ? { ...row, project: JSON.parse(row.project_json), project_json: undefined } : null;
  }
  list({limit=30,offset=0}={}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid pagination');
    return this.db.prepare('SELECT id,revision,title,project_json,created_at,updated_at FROM editing_projects ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?').all(limit,offset)
      .map(row => {
        let project = null;
        try { project = JSON.parse(row.project_json); } catch {}
        const fps = project?.fps;
        const durationSeconds = fps && Number.isSafeInteger(project?.duration_frames) ? project.duration_frames * fps.den / fps.num : 0;
        return {
          id: row.id, revision: row.revision, title: row.title,
          created_at: row.created_at, updated_at: row.updated_at,
          duration_seconds: Math.round(durationSeconds * 100) / 100,
          fps: fps ? { num: fps.num, den: fps.den } : null,
          canvas: project?.canvas || null,
          clip_count: project?.tracks?.video?.length || 0,
          poster_video_id: project?.tracks?.video?.[0]?.source?.id || null
        };
      });
  }
  delete(id) {
    if (typeof id !== 'string' || !/^edit_[a-f0-9]{32}$/.test(id)) throw new Error('Valid project id required');
    return this.db.prepare('DELETE FROM editing_projects WHERE id = ?').run(id).changes > 0;
  }
  save(project, {id,expectedRevision}={}) {
    const checked=validateEditProject(project);
    if (!checked.valid) return {success:false, error:'INVALID_PROJECT', errors:checked.errors, warnings:checked.warnings};
    const text=JSON.stringify(checked.project);
    if (Buffer.byteLength(text,'utf8')>1024*1024) throw new Error('Project exceeds size limit');
    const now=new Date().toISOString();
    if (id === undefined) {
      if (expectedRevision !== undefined) throw new Error('Unexpected revision for new project');
      const newId='edit_'+crypto.randomUUID().replaceAll('-','');
      this.db.prepare('INSERT INTO editing_projects(id,revision,title,project_json,created_at,updated_at) VALUES(?,1,?,?,?,?)').run(newId,checked.project.title,text,now,now);
      return {success:true, record:this.get(newId), warnings:checked.warnings};
    }
    if (typeof id !== 'string' || !/^edit_[a-f0-9]{32}$/.test(id) || !Number.isSafeInteger(expectedRevision) || expectedRevision<1) throw new Error('Valid project id and expected revision required');
    const result=this.db.prepare('UPDATE editing_projects SET revision=revision+1,title=?,project_json=?,updated_at=? WHERE id=? AND revision=?').run(checked.project.title,text,now,id,expectedRevision);
    if (!result.changes) return {success:false,error:'CONFLICT_OR_NOT_FOUND'};
    return {success:true,record:this.get(id),warnings:checked.warnings};
  }
}
