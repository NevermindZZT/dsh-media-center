import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createMediaCenterApiHandler } from '../src/host/api/router.js';

test('music preview is catalog-only, read-only, byte-range aware and same-origin protected',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-audio-stream-'));
 const file=fs.realpathSync(path.join(root,fs.writeFileSync(path.join(root,'sample.wav'),'0123456789')||'sample.wav'));
 const id='mus_0123456789abcdef0123456789abcdef';let sourceStatus='current';
 const service={catalog:{get:key=>key===id?{id,file_path:file,source_status:sourceStatus}:null}};
 const handler=createMediaCenterApiHandler({db:{},mediaEngine:{},editingWorkflow:service});
 const server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(()=>{fs.rmSync(root,{recursive:true,force:true});resolve();})));
 const base=`http://127.0.0.1:${server.address().port}`;
 let result=await fetch(`${base}/api/media-center/editing/music/${id}/stream`,{headers:{Range:'bytes=2-5'}});
 assert.equal(result.status,206);assert.equal(result.headers.get('content-range'),'bytes 2-5/10');assert.equal(await result.text(),'2345');
 result=await fetch(`${base}/api/media-center/editing/music/${id}/stream`,{headers:{Range:'bytes=-3'}});
 assert.equal(result.status,206);assert.equal(await result.text(),'789');
 result=await fetch(`${base}/api/media-center/editing/music/${id}/stream`,{headers:{Range:'bytes=99-'}});assert.equal(result.status,416);
 result=await fetch(`${base}/api/media-center/editing/music/${id}/stream`,{headers:{Origin:'https://outside.invalid'}});assert.equal(result.status,403);
 result=await fetch(`${base}/api/media-center/editing/music/mus_11111111111111111111111111111111/stream`);assert.equal(result.status,404);
 sourceStatus='mismatch';result=await fetch(`${base}/api/media-center/editing/music/${id}/stream`);assert.equal(result.status,409);
 assert.equal(fs.readFileSync(file,'utf8'),'0123456789');
});
