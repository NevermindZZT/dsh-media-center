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
    return this.db.prepare('SELECT id,revision,title,created_at,updated_at FROM editing_projects ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?').all(limit,offset);
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
