import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.aiff', '.aif', '.wma']);
const LICENSE_STATES = new Set(['unknown', 'personal_confirmed']);
const MAX_PAGE = 100;

function boundedText(value, field, max, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || value.length > max || value.includes('\0')) throw new Error(`${field} is invalid`);
  return value.trim();
}
function validId(id) {
  if (typeof id !== 'string' || !/^mus_[0-9a-f]{32}$/.test(id)) throw new Error('Invalid music ID');
}
function safeWebUrl(value) {
  const input = boundedText(value, 'source_url', 2048);
  if (!input) return '';
  let url;
  try { url = new URL(input); } catch { throw new Error('Invalid source URL'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid source URL');
  return url.toString();
}
function optionalNumber(value) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function identityOf(stat) {
  return { size:stat.size, mtimeMs:stat.mtimeMs, ctimeMs:stat.ctimeMs, dev:stat.dev, ino:stat.ino };
}
function identitiesMatch(left, right) {
  return !!left && !!right && ['size','mtimeMs','ctimeMs','dev','ino'].every(key =>
    typeof left[key] === 'number' && Number.isFinite(left[key]) && left[key] === right[key]);
}
function parseIdentity(value) {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}
function readCurrentIdentity(filePath) {
  try {
    if (fsSync.realpathSync(filePath) !== filePath) return null;
    const stat = fsSync.statSync(filePath);
    return stat.isFile() ? identityOf(stat) : null;
  } catch { return null; }
}

function parseProbe(result) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.streams)) throw new Error('Invalid ffprobe metadata');
  const stream = result.streams.find(s => s && s.codec_type === 'audio');
  if (!stream) throw new Error('No audio stream found');
  const tags = result.format?.tags && typeof result.format.tags === 'object' ? result.format.tags : {};
  const text = (v, max) => typeof v === 'string' ? v.replace(/\0/g, '').trim().slice(0, max) : '';
  return {
    duration: optionalNumber(result.format?.duration) ?? optionalNumber(stream.duration),
    codec: text(stream.codec_name, 80),
    sample_rate: optionalNumber(stream.sample_rate),
    channels: optionalNumber(stream.channels),
    embedded_title: text(tags.title ?? stream.tags?.title, 500),
    embedded_artist: text(tags.artist ?? stream.tags?.artist, 500)
  };
}

/** A local reference catalog. It never copies, moves, alters, or deletes source media.
 * probeAudio, when supplied, is an async read-only function receiving the canonical path
 * and returning parsed ffprobe JSON ({format,streams}). No probe occurs otherwise.
 */
export class MusicCatalog {
  constructor(videoDb, { probeAudio } = {}) {
    if (!videoDb?.db) throw new Error('An open VideoDatabase is required');
    if (probeAudio !== undefined && typeof probeAudio !== 'function') throw new Error('probeAudio must be a function');
    this.db = videoDb.db;
    this.probeAudio = probeAudio;
    this.db.exec(`CREATE TABLE IF NOT EXISTS local_music_catalog (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      title TEXT NOT NULL,
      artist TEXT NOT NULL DEFAULT '',
      duration REAL,
      codec TEXT NOT NULL DEFAULT '',
      sample_rate INTEGER,
      channels INTEGER,
      metadata_source TEXT NOT NULL CHECK(metadata_source IN ('filename','ffprobe','user')),
      metadata_detail TEXT NOT NULL DEFAULT '{}',
      source_name TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      license_status TEXT NOT NULL CHECK(license_status IN ('unknown','personal_confirmed')),
      license_note TEXT NOT NULL DEFAULT '',
      license_confirmed_at TEXT,
      source_identity_json TEXT,
      license_identity_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_local_music_created ON local_music_catalog(created_at DESC,id DESC);`);
    const columns = new Set(this.db.prepare('PRAGMA table_info(local_music_catalog)').all().map(row => row.name));
    if (!columns.has('source_identity_json')) this.db.exec('ALTER TABLE local_music_catalog ADD COLUMN source_identity_json TEXT');
    if (!columns.has('license_identity_json')) this.db.exec('ALTER TABLE local_music_catalog ADD COLUMN license_identity_json TEXT');
  }

  /** Insert one local file reference. A canonical-path duplicate is never overwritten.
   * {file_path, title?, artist?, source_name?, source_url?, license_status?,
   *  license_note?, license_confirmed?}; personal_confirmed requires true.
   * Returns {music, created}; probing failure inserts nothing.
   */
  async importFile(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid music input');
    if (typeof input.file_path !== 'string' || !input.file_path.trim() || input.file_path.includes('\0') || !path.isAbsolute(input.file_path)) throw new Error('file_path must be an absolute local file path');
    const titleInput = boundedText(input.title, 'title', 500);
    const artistInput = boundedText(input.artist, 'artist', 500);
    const sourceName = boundedText(input.source_name, 'source_name', 500);
    const sourceUrl = safeWebUrl(input.source_url);
    const licenseStatus = input.license_status ?? 'unknown';
    const licenseNote = boundedText(input.license_note, 'license_note', 4000);
    if (!LICENSE_STATES.has(licenseStatus)) throw new Error('Unsupported license status');
    if (licenseStatus === 'personal_confirmed' && input.license_confirmed !== true) throw new Error('Personal-use status requires explicit confirmation');
    let canonical, stat;
    try { canonical = await fs.realpath(input.file_path); stat = await fs.stat(canonical); }
    catch { throw new Error('Music file is unavailable'); }
    if (!stat.isFile()) throw new Error('Music path must be a regular file');
    if (!AUDIO_EXTENSIONS.has(path.extname(canonical).toLowerCase())) throw new Error('Unsupported audio file extension');
    const existing = this.db.prepare('SELECT * FROM local_music_catalog WHERE file_path = ?').get(canonical);
    if (existing) return { music: this.#decode(existing), created: false };
    let meta = null;
    if (this.probeAudio) {
      try { meta = parseProbe(await this.probeAudio(canonical)); }
      catch (e) { if (e.message === 'No audio stream found') throw e; throw new Error('Unable to read audio metadata'); }
    }
    // Recheck after asynchronous probe; source is still only observed, never opened for writing.
    try {
      const nowPath = await fs.realpath(input.file_path);
      const nowStat = await fs.stat(canonical);
      if (nowPath !== canonical || !nowStat.isFile() || !identitiesMatch(identityOf(stat), identityOf(nowStat))) throw new Error('changed');
    } catch { throw new Error('Music file changed or became unavailable during import'); }
    const id = `mus_${crypto.randomUUID().replace(/-/g, '')}`;
    const filename = path.basename(canonical);
    const embeddedTitle = meta?.embedded_title || '';
    const embeddedArtist = meta?.embedded_artist || '';
    const title = titleInput || embeddedTitle || path.parse(filename).name;
    const artist = artistInput || embeddedArtist;
    const metadataSource = titleInput || artistInput ? 'user' : meta ? 'ffprobe' : 'filename';
    const metadataDetail = JSON.stringify({ title: titleInput ? 'user' : embeddedTitle ? 'ffprobe' : 'filename', artist: artistInput ? 'user' : embeddedArtist ? 'ffprobe' : 'unknown', technical: meta ? 'ffprobe' : 'unknown' });
    const now = new Date().toISOString();
    try {
      this.db.prepare(`INSERT INTO local_music_catalog
        (id,file_path,file_name,file_size,title,artist,duration,codec,sample_rate,channels,metadata_source,metadata_detail,
         source_name,source_url,license_status,license_note,license_confirmed_at,source_identity_json,license_identity_json,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, canonical, filename, stat.size, title, artist,
          meta?.duration ?? null, meta?.codec ?? '', meta?.sample_rate ?? null, meta?.channels ?? null,
          metadataSource, metadataDetail, sourceName, sourceUrl, licenseStatus, licenseNote,
          licenseStatus === 'personal_confirmed' ? now : null, JSON.stringify(identityOf(stat)),
          licenseStatus === 'personal_confirmed' ? JSON.stringify(identityOf(stat)) : null, now);
    } catch (e) {
      // Concurrent duplicate imports resolve to the existing entry, preserving the first metadata and authorization.
      const duplicate = this.db.prepare('SELECT * FROM local_music_catalog WHERE file_path = ?').get(canonical);
      if (duplicate) return { music: this.#decode(duplicate), created: false };
      throw e;
    }
    return { music: this.get(id), created: true };
  }

  #decode(row) {
    if (!row) return null;
    const { source_identity_json, license_identity_json, ...safe } = row;
    const imported = parseIdentity(source_identity_json);
    const current = readCurrentIdentity(row.file_path);
    const source_status = !current ? 'unavailable' : !imported ? 'unverified' : identitiesMatch(imported, current) ? 'current' : 'mismatch';
    const licenseIdentity = parseIdentity(license_identity_json);
    const licenseIsCurrent = source_status === 'current' && identitiesMatch(licenseIdentity, current);
    const effectiveLicense = row.license_status === 'personal_confirmed' && licenseIsCurrent ? 'personal_confirmed' : 'unknown';
    return { ...safe, metadata_detail: JSON.parse(row.metadata_detail), source_status,
      license_status_recorded: row.license_status, license_status: effectiveLicense,
      license_source_status: row.license_status === 'personal_confirmed' ? (licenseIsCurrent ? 'current' : 'stale') : 'unknown' };
  }
  get(id) { validId(id); return this.#decode(this.db.prepare('SELECT * FROM local_music_catalog WHERE id = ?').get(id)); }
  /** {query?,license_status?,limit? 1-100,offset?}; stable ordering and pagination. */
  list({ query = '', license_status, limit = 25, offset = 0 } = {}) {
    query = boundedText(query, 'query', 200);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE || !Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) throw new Error('Invalid pagination');
    if (license_status !== undefined && !LICENSE_STATES.has(license_status)) throw new Error('Unsupported license status');
    const conditions = [], params = [];
    if (query) { const q = `%${query.replace(/[\\%_]/g, '\\$&')}%`; conditions.push("(title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\' OR file_name LIKE ? ESCAPE '\\')"); params.push(q,q,q); }
    // The effective license can differ from the stored assertion after source changes.
    // Filter after verifying identities, before applying pagination.
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    if (!license_status) {
      const rows = this.db.prepare(`SELECT * FROM local_music_catalog${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).all(...params, limit + 1, offset);
      return { items: rows.slice(0, limit).map(row => this.#decode(row)), limit, offset, has_more: rows.length > limit };
    }
    const matching = [];
    let scanOffset = 0;
    const statement = this.db.prepare(`SELECT * FROM local_music_catalog${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`);
    while (matching.length < offset + limit + 1) {
      const rows = statement.all(...params, 100, scanOffset);
      if (!rows.length) break;
      for (const row of rows) {
        const decoded = this.#decode(row);
        if (decoded.license_status === license_status) matching.push(decoded);
      }
      scanOffset += rows.length;
      if (rows.length < 100) break;
    }
    return { items: matching.slice(offset, offset + limit), limit, offset, has_more: matching.length > offset + limit };
  }
  /** Search by a literal substring of title, artist or file name. */
  search(query, options = {}) { return this.list({ ...options, query }); }
  /** Records an explicit user assertion only; it is not an independently verified licence. */
  confirmPersonalUse(id, { confirmed, license_note } = {}) {
    validId(id);
    if (confirmed !== true) throw new Error('Personal-use status requires explicit confirmation');
    const note = boundedText(license_note, 'license_note', 4000);
    const row = this.db.prepare('SELECT * FROM local_music_catalog WHERE id = ?').get(id);
    if (!row) throw new Error('Music not found');
    const current = readCurrentIdentity(row.file_path);
    if (!current || !identitiesMatch(parseIdentity(row.source_identity_json), current)) throw new Error('Music source changed or cannot be verified; remove record and reimport before confirming');
    const result = this.db.prepare("UPDATE local_music_catalog SET license_status='personal_confirmed', license_note=?, license_confirmed_at=?, license_identity_json=? WHERE id=?")
      .run(note, new Date().toISOString(), JSON.stringify(current), id);
    if (!result.changes) throw new Error('Music not found');
    return this.get(id);
  }

  /** Deletes only this DB record; never deletes source media. Returns boolean. */
  remove(id) { validId(id); return this.db.prepare('DELETE FROM local_music_catalog WHERE id = ?').run(id).changes > 0; }
}
