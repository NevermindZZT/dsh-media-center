import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createMediaCenterApiHandler } from '../src/host/api/router.js';

const defer = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
function fixture() {
  const videos = new Map(['a','b','c','legacy'].map(id => [id, { id, status: id === 'legacy' ? 'analyzing' : 'imported' }]));
  const calls = [];
  const work = [];
  const db = {
    getVideoById: id => videos.has(id) ? { ...videos.get(id) } : null,
    upsertVideo: patch => {
      calls.push(patch);
      if (!videos.has(patch.id)) throw new Error('unexpected insert');
      videos.set(patch.id, { ...videos.get(patch.id), ...patch });
    },
    queryVideos: options => {
      let rows = [...videos.values()].map(v => ({...v}));
      if (options.status) rows = rows.filter(v => v.status === options.status);
      if (options.limit) rows = rows.slice(Number(options.offset || 0), Number(options.offset || 0) + Number(options.limit));
      return rows;
    },
    countVideos: options => {
      let rows = [...videos.values()];
      if (options.status) rows = rows.filter(v => v.status === options.status);
      return rows.length;
    }
  };
  const analyzer = { getAiSettings: () => ({ concurrency: 1 }), analyzeVideo: id => { const d = defer(); work.push({id,...d}); return d.promise; } };
  const handler = createMediaCenterApiHandler({ db, mediaEngine: { ensureCaptureTimes: async () => {} }, videoAiAnalyzer: analyzer });
  const request = (method, url, body) => {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]); req.method=method; req.url=url; req.headers={};
    const done = defer();
    const res = { writeHead: (status, headers) => { res.status=status; }, end: buf => done.resolve({status:res.status, body:JSON.parse(buf.toString())}) };
    Promise.resolve(handler(req,res)).catch(done.reject);
    return done.promise;
  };
  return { videos, calls, work, request };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

// No real network calls, video files, or model endpoints are used.
test('batch validates all IDs before reserving or writing, and rejects conflicts atomically', async () => {
  const f = fixture();
  for (const payload of [{}, {video_ids:[]}, {video_ids:['a','a']}, {video_ids:['a','missing']}, {video_ids:['a',2]}, {video_ids:['a','']}, null]) {
    const r = await f.request('POST','/api/media-center/videos/batch-ai-analyze',payload);
    assert.equal(r.status,400); assert.equal(f.work.length,0); assert.equal(f.calls.length,0);
  }
  const single = f.request('POST','/api/media-center/videos/a/ai-analyze'); await tick();
  assert.equal(f.work.length,1);
  const overlapping = await f.request('POST','/api/media-center/videos/batch-ai-analyze',{video_ids:['b','a']});
  assert.equal(overlapping.status,409); assert.deepEqual(overlapping.body.video_ids,['a']);
  const other = f.request('POST','/api/media-center/videos/b/ai-analyze'); await tick();
  assert.equal(f.work.length,2); // b was not partially reserved
  const missing = await f.request('POST','/api/media-center/videos/missing/ai-analyze');
  assert.equal(missing.status,400); assert.equal(f.calls.length,0);
  for (const item of f.work) { f.videos.get(item.id).status='analyzed'; item.resolve({success:true,video:{id:item.id,status:'analyzed'},audit:{}}); }
  assert.equal((await single).status,200); assert.equal((await other).status,200);
});

test('batch marks one running and all remaining queued, with status filtering before pagination', async () => {
  const f=fixture();
  const batch=f.request('POST','/api/media-center/videos/batch-ai-analyze',{video_ids:['a','b','c']}); await tick();
  assert.deepEqual(f.work.map(x=>x.id),['a']);
  const list=await f.request('GET','/api/media-center/videos?limit=10');
  assert.deepEqual(list.body.videos.map(v=>[v.id,v.status]),[['a','analyzing'],['b','queued'],['c','queued'],['legacy','analyzing']]);
  const imported=await f.request('GET','/api/media-center/videos?status=imported&limit=10');
  assert.deepEqual(imported.body.videos.map(v=>[v.id,v.status]),[['a','analyzing'],['b','queued'],['c','queued']]);
  const filtered=await f.request('GET','/api/media-center/videos?status=queued&limit=1&offset=1');
  assert.deepEqual(filtered.body.videos.map(v=>v.id),['c']);
  assert.equal((await f.request('GET','/api/media-center/videos/b')).body.video.status,'queued');
  assert.equal((await f.request('POST','/api/media-center/videos/c/ai-analyze')).status,409);
  assert.equal((await f.request('POST','/api/media-center/videos/batch-ai-analyze',{video_ids:['b','c']})).status,409);
  f.videos.get('a').status='analyzed'; f.work[0].resolve({success:true,audit:{}}); await tick();
  assert.deepEqual(f.work.map(x=>x.id),['a','b']);
  assert.equal((await f.request('GET','/api/media-center/videos/a')).body.video.status,'analyzed');
  assert.equal((await f.request('GET','/api/media-center/videos/b')).body.video.status,'analyzing');
  f.work[1].reject(new Error('model down')); await tick();
  assert.equal(f.videos.get('b').status,'error');
  assert.equal((await f.request('GET','/api/media-center/videos/c')).body.video.status,'analyzing');
  f.videos.get('c').status='analyzed'; f.work[2].resolve({success:true,audit:{}});
  const result=await batch;
  assert.equal(result.status,200); assert.equal(result.body.succeeded,2);
  assert.deepEqual(result.body.results.map(x=>x.success),[true,false,true]);
  assert.equal(result.body.results[1].error,'model down');
  assert.ok(f.calls.every(p=>p.status !== 'analyzing' && p.status !== 'queued'));
  const retry=f.request('POST','/api/media-center/videos/b/ai-analyze'); await tick();
  f.work[3].resolve({success:true,video:{id:'b',status:'analyzed'},audit:{}});
  assert.equal((await retry).status,200);
});

test('failed reanalysis preserves an existing analyzed status', async () => {
  const f=fixture();
  f.videos.get('a').status='analyzed';
  const request=f.request('POST','/api/media-center/videos/a/ai-analyze'); await tick();
  f.work[0].reject(new Error('model failed'));
  assert.equal((await request).status,500);
  assert.equal(f.videos.get('a').status,'analyzed');
});

test('direct failure releases reservation and missing during execution never creates video', async () => {
  const f=fixture();
  const request=f.request('POST','/api/media-center/videos/a/ai-analyze'); await tick();
  f.videos.delete('a'); f.work[0].reject(new Error('offline'));
  const response=await request;
  assert.equal(response.status,500); assert.equal(f.calls.length,0);
  assert.equal((await f.request('POST','/api/media-center/videos/a/ai-analyze')).status,400);
  f.videos.set('a',{id:'a',status:'imported'});
  const retry=f.request('POST','/api/media-center/videos/a/ai-analyze'); await tick();
  f.work[1].resolve({success:true,video:{id:'a',status:'analyzed'},audit:{}});
  assert.equal((await retry).status,200);
});

test('deleted queued video fails individually and batch continues without inserting a row', async () => {
  const f=fixture();
  const request=f.request('POST','/api/media-center/videos/batch-ai-analyze',{video_ids:['a','b','c']}); await tick();
  f.videos.delete('b'); f.work[0].resolve({success:true,audit:{}}); await tick();
  assert.deepEqual(f.work.map(x=>x.id),['a','c']);
  f.work[1].resolve({success:true,audit:{}});
  const result=await request;
  assert.equal(result.body.succeeded,2);
  assert.equal(result.body.results[1].error,'Video not found');
  assert.equal(f.calls.length,0);
});
