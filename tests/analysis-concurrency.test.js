import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createMediaCenterApiHandler } from '../src/host/api/router.js';

const IDS = ['vid_a', 'vid_b', 'vid_c', 'vid_d'];
function request(handler, method, url, body) {
  return new Promise((resolve, reject) => {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
    req.method = method; req.url = url; req.headers = {};
    const res = { writeHead(status) { this.status = status; }, end(buffer) { try { resolve({ status: this.status, body: buffer ? JSON.parse(buffer.toString()) : null }); } catch (error) { reject(error); } } };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

test('batch AI analysis respects the configured concurrency and preserves result order', async () => {
  let active = 0, peak = 0;
  const calls = [];
  const videoAiAnalyzer = {
    getAiSettings: () => ({ concurrency: 2 }),
    analyzeVideo: async id => {
      calls.push(id); active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 15));
      active--;
      return { success: true, audit: { model: 'vision' } };
    }
  };
  const db = { getVideoById: id => IDS.includes(id) ? { id } : null, upsertVideo: () => ({ id: 'vid_b' }) };
  const handler = createMediaCenterApiHandler({ db, mediaEngine: {}, videoAiAnalyzer });
  const response = await request(handler, 'POST', '/api/media-center/videos/batch-ai-analyze', { video_ids: IDS });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.concurrency, 2);
  assert.equal(peak, 2);
  assert.equal(calls.length, 4);
  assert.deepEqual(response.body.results.map(item => item.video_id), IDS);
});

test('batch AI analysis handles one failure without stopping other workers', async () => {
  const videoAiAnalyzer = {
    getAiSettings: () => ({ concurrency: 2 }),
    analyzeVideo: async id => {
      if (id === 'vid_b') throw new Error('model unavailable');
      return { success: true, audit: {} };
    }
  };
  const db = { getVideoById: id => IDS.includes(id) ? { id } : null, upsertVideo: () => ({ id: 'vid_b' }) };
  const handler = createMediaCenterApiHandler({ db, mediaEngine: {}, videoAiAnalyzer });
  const response = await request(handler, 'POST', '/api/media-center/videos/batch-ai-analyze', { video_ids: IDS });
  assert.equal(response.status, 200);
  assert.equal(response.body.succeeded, 3);
  assert.equal(response.body.results.find(item => item.video_id === 'vid_b').success, false);
  assert.equal(response.body.results.filter(item => item.success).length, 3);
});
