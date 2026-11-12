// Jamendo's public Tracks API, search only. API availability and licensing must be
// verified separately; these results are discovery metadata, not grants of rights.
const TRACKS_ENDPOINT = 'https://api.jamendo.com/v3.0/tracks/';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
}
function externalUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    // Query parameters may contain tokens or tracking data; they are not needed for review links.
    url.search = ''; url.hash = '';
    return url.toString();
  } catch { return null; }
}
async function readBounded(response) {
  const length = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(length) && length > MAX_RESPONSE_BYTES) throw new Error('response too large');
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = []; let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) { try { await reader.cancel(); } catch {} throw new Error('response too large'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8');
  }
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('response too large');
  return text;
}

/** Official Jamendo API client. `fetch` and clientId are injected; neither is stored
 * in result objects or errors. Search is metadata-only: no stream/download URL is
 * returned or fetched; license metadata is explicitly unverified. */
export class JamendoSearch {
  constructor({ clientId, fetch: fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
    if (typeof clientId !== 'string' || !clientId.trim() || clientId.length > 256 || /[\u0000-\u001f]/.test(clientId)) throw new Error('Jamendo client ID is required');
    if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) throw new Error('Invalid timeout');
    this.clientId = clientId.trim();
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  /** {query,limit? 1-20,offset? 0-1000,signal?}; returns {items,limit,offset,has_more}.
   * Search result rights_status is always 'unverified', not a usage grant. */
  async search({ query, limit = 10, offset = 0, signal } = {}) {
    if (typeof query !== 'string' || !query.trim() || query.length > 200 || /[\u0000-\u001f]/.test(query)) throw new Error('Search query is required (maximum 200 characters)');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20 || !Number.isSafeInteger(offset) || offset < 0 || offset > 1000) throw new Error('Invalid pagination');
    const url = new URL(TRACKS_ENDPOINT);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', String(limit + 1));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('search', query.trim());
    url.searchParams.set('include', 'licenses musicinfo');
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response, data;
    try {
      response = await this.fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' }, signal: combined, redirect: 'error' });
      if (!response.ok) {
        const status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
        throw new Error(status ? `HTTP_${status}` : 'HTTP_ERROR');
      }
      data = JSON.parse(await readBounded(response));
    } catch (error) {
      if (signal?.aborted) throw new Error('Jamendo search cancelled');
      if (timeout.aborted) throw new Error('Jamendo search timed out');
      const status = /^HTTP_\d{3}$/.test(error?.message || '') ? error.message.slice(5) : null;
      throw new Error(status ? `Jamendo search failed (HTTP ${status})` : 'Jamendo search failed');
    }
    if (!data || data.headers?.status !== 'success' || !Array.isArray(data.results)) throw new Error('Jamendo search returned an invalid response');
    const rows = data.results.slice(0, limit + 1).filter(row => row && typeof row === 'object' && /^\d{1,24}$/.test(String(row.id ?? '')));
    const items = rows.slice(0, limit).map(row => ({
      source: 'jamendo',
      source_id: String(row.id),
      title: cleanText(row.name, 500),
      artist: cleanText(row.artist_name, 500),
      duration: row.duration != null && row.duration !== '' && Number.isFinite(Number(row.duration)) && Number(row.duration) >= 0 ? Number(row.duration) : null,
      source_url: externalUrl(row.shareurl),
      license_url: externalUrl(row.license_ccurl),
      download_allowed: row.audiodownload_allowed === true,
      rights_status: 'unverified',
      rights_notice: 'License, synchronization rights and intended-use permission must be verified for this specific track before use.'
    }));
    return { items, limit, offset, has_more: data.results.length > limit };
  }
}
