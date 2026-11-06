// In-process reservations are the source of truth for transient AI states.
// reserve() contains no await: validation and reservation are atomic in the Host event loop.
export class AnalysisQueue {
  constructor(db) {
    this.db = db;
    this.active = new Map();
  }

  reserve(ids) {
    if (!Array.isArray(ids) || ids.length === 0 ||
        ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id))) {
      return { ok: false, status: 400, error: 'video_ids must be a non-empty array of valid video IDs' };
    }
    if (new Set(ids).size !== ids.length) {
      return { ok: false, status: 400, error: 'Duplicate video IDs are not allowed' };
    }
    const missing = ids.filter(id => !this.db.getVideoById(id));
    if (missing.length) return { ok: false, status: 400, error: 'Video not found', video_ids: missing };
    const busy = ids.filter(id => this.active.has(id));
    if (busy.length) return { ok: false, status: 409, error: 'Video analysis already queued or running', video_ids: busy };
    const token = Symbol('reservation');
    for (const id of ids) this.active.set(id, { token, state: 'queued' });
    return { ok: true, token };
  }

  start(id, token) {
    const entry = this.active.get(id);
    if (!entry || entry.token !== token) throw new Error('Analysis reservation is missing');
    entry.state = 'analyzing';
  }

  release(id, token) {
    if (this.active.get(id)?.token === token) this.active.delete(id);
  }

  overlay(video) {
    if (!video) return video;
    const state = this.active.get(video.id)?.state;
    if (state) return { ...video, status: state, analysis_state: state };
    return video;
  }
}
