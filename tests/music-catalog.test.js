import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile as execFileCallback, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
const execFile = promisify(execFileCallback);
import { VideoDatabase } from '../src/host/db/database.js';
import { MusicCatalog } from '../src/host/music/music-catalog.js';
import { JamendoSearch } from '../src/host/music/jamendo.js';

function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-music-catalog-'));
  const db = new VideoDatabase({ workspaceRoot: root });
  const music = path.join(root, 'song.mp3');
  fs.writeFileSync(music, 'source audio bytes');
  const catalog = new MusicCatalog(db, options);
  t.after(() => { db.db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, db, music, catalog };
}
const hash = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

test('local import stores only reference, unverified authorization, provenance and removes DB entry only', async t => {
  const f = fixture(t), before = hash(f.music);
  const result = await f.catalog.importFile({ file_path: f.music, source_name:'my collection', source_url:'https://example.org/track/1' });
  assert.equal(result.created, true);
  assert.equal(result.music.file_path, await fs.promises.realpath(f.music));
  assert.equal(result.music.title, 'song');
  assert.equal(result.music.metadata_detail.title, 'filename');
  assert.equal(result.music.metadata_detail.technical, 'unknown');
  assert.equal(result.music.license_status, 'unknown');
  assert.equal(result.music.license_confirmed_at, null);
  assert.equal(f.catalog.get(result.music.id).id, result.music.id);
  assert.equal(f.catalog.remove(result.music.id), true);
  assert.equal(f.catalog.get(result.music.id), null);
  assert.equal(f.catalog.remove(result.music.id), false);
  assert.equal(hash(f.music), before);
});

test('injected ffprobe metadata keeps per-field provenance and explicit personal confirmation', async t => {
  let called;
  const f = fixture(t, { probeAudio: async file => { called=file; return {format:{duration:'30.25',tags:{title:'Embedded',artist:'Artist'}},streams:[{codec_type:'audio',codec_name:'aac',sample_rate:'44100',channels:2}]}; } });
  const result=await f.catalog.importFile({file_path:f.music,title:'My title', license_status:'personal_confirmed', license_confirmed:true, license_note:'User reviewed personal use'});
  assert.equal(called, await fs.promises.realpath(f.music));
  assert.equal(result.music.title,'My title'); assert.equal(result.music.artist,'Artist');
  assert.equal(result.music.duration,30.25); assert.equal(result.music.sample_rate,44100); assert.equal(result.music.channels,2);
  assert.deepEqual(result.music.metadata_detail,{title:'user',artist:'ffprobe',technical:'ffprobe'});
  assert.equal(result.music.license_status,'personal_confirmed'); assert.ok(result.music.license_confirmed_at);
});

test('filesystem browser lists audio separately without altering media', async t => {
  const f=fixture(t), before=hash(f.music);
  const {MediaEngine}=await import('../src/host/media/engine.js');
  const result=new MediaEngine(f.db).browseFileSystem(f.root);
  assert.ok(result.audio_files.some(file=>file.name==='song.mp3'));
  assert.ok(Array.isArray(result.video_files));
  assert.equal(hash(f.music),before);
});

test('replacement at the same path invalidates effective rights and cannot be reconfirmed without reimport', async t => {
  const f=fixture(t);
  const originalStat=fs.statSync(f.music);
  const {music}=await f.catalog.importFile({file_path:f.music,license_status:'personal_confirmed',license_confirmed:true});
  assert.equal(music.source_status,'current');
  assert.equal(music.license_source_status,'current');
  const replacement=path.join(f.root,'replacement.mp3');
  fs.writeFileSync(replacement,'different bytes!!!'.slice(0,originalStat.size));
  // Replace only this test-owned file, never user media; keep size and mtime comparable.
  fs.utimesSync(replacement, originalStat.atime, originalStat.mtime);
  fs.renameSync(replacement,f.music);
  const after=f.catalog.get(music.id);
  assert.equal(after.source_status,'mismatch');
  assert.equal(after.license_status,'unknown');
  assert.equal(after.license_status_recorded,'personal_confirmed');
  assert.equal(after.license_source_status,'stale');
  assert.equal(f.catalog.list({license_status:'personal_confirmed'}).items.length,0);
  assert.equal(f.catalog.list({license_status:'unknown'}).items[0].id,music.id);
  assert.throws(()=>f.catalog.confirmPersonalUse(music.id,{confirmed:true}),/changed or cannot be verified/);
  const samePath=await f.catalog.importFile({file_path:f.music});
  assert.equal(samePath.created,false); assert.equal(samePath.music.license_status,'unknown');
});

test('missing source and legacy records never retain effective authorization', async t => {
  const f=fixture(t);
  const {music}=await f.catalog.importFile({file_path:f.music,license_status:'personal_confirmed',license_confirmed:true});
  const moved=path.join(f.root,'temporary-source.mp3');
  fs.renameSync(f.music,moved);
  assert.equal(f.catalog.get(music.id).source_status,'unavailable');
  assert.equal(f.catalog.get(music.id).license_status,'unknown');
  assert.throws(()=>f.catalog.confirmPersonalUse(music.id,{confirmed:true}),/cannot be verified/);
  fs.renameSync(moved,f.music);
  assert.notEqual(f.catalog.get(music.id).license_status,'personal_confirmed');
  f.db.db.prepare('UPDATE local_music_catalog SET source_identity_json=NULL, license_identity_json=NULL WHERE id=?').run(music.id);
  assert.equal(f.catalog.get(music.id).source_status,'unverified');
  assert.equal(f.catalog.get(music.id).license_status,'unknown');
});

test('existing music personal-use declaration requires explicit confirmation', async t => {
  const f=fixture(t), before=hash(f.music);
  const {music}=await f.catalog.importFile({file_path:f.music});
  assert.throws(()=>f.catalog.confirmPersonalUse(music.id,{confirmed:false}),/explicit confirmation/);
  assert.equal(f.catalog.get(music.id).license_status,'unknown');
  const updated=f.catalog.confirmPersonalUse(music.id,{confirmed:true,license_note:'个人分享使用权由用户确认'});
  assert.equal(updated.license_status,'personal_confirmed'); assert.ok(updated.license_confirmed_at);
  assert.equal(hash(f.music),before);
});

test('duplicate import returns existing data without probing or mutating metadata and rights', async t => {
  let calls=0; const f=fixture(t,{probeAudio:async()=>{calls++;return {streams:[{codec_type:'audio'}],format:{}};}});
  const first=await f.catalog.importFile({file_path:f.music,title:'First'});
  const second=await f.catalog.importFile({file_path:path.join(f.root,'.','song.mp3'),title:'Second',license_status:'personal_confirmed',license_confirmed:true});
  assert.equal(second.created,false); assert.equal(second.music.id,first.music.id);
  assert.equal(second.music.title,'First'); assert.equal(second.music.license_status,'unknown'); assert.equal(calls,1);
  assert.equal(f.catalog.list().items.length,1);
});

test('invalid paths, false authorization and failed probes never insert entries or alter file', async t => {
  const f=fixture(t,{probeAudio:async()=>({streams:[],format:{}})}), before=hash(f.music);
  await assert.rejects(f.catalog.importFile({file_path:'relative.mp3'}),/absolute/);
  await assert.rejects(f.catalog.importFile({file_path:f.root}),/regular file/);
  await assert.rejects(f.catalog.importFile({file_path:path.join(f.root,'missing.mp3')}),/unavailable/);
  await assert.rejects(f.catalog.importFile({file_path:f.music,license_status:'personal_confirmed'}),/explicit confirmation/);
  await assert.rejects(f.catalog.importFile({file_path:f.music,license_status:'commercial'}),/license status/);
  await assert.rejects(f.catalog.importFile({file_path:f.music,source_url:'https://u:secret@example.org/'}),/URL/);
  await assert.rejects(f.catalog.importFile({file_path:f.music}),/No audio stream/);
  assert.equal(f.catalog.list().items.length,0); assert.equal(hash(f.music),before);
});

test('probe failures redact paths and exceptions; metadata changes during probe abort import', async t => {
  const f=fixture(t,{probeAudio:async()=>{throw new Error('secret path and key');}});
  await assert.rejects(f.catalog.importFile({file_path:f.music}), e => /Unable to read/.test(e.message) && !e.message.includes('secret'));
  f.catalog.probeAudio=async file => { fs.appendFileSync(file,'x'); return {streams:[{codec_type:'audio'}]}; };
  await assert.rejects(f.catalog.importFile({file_path:f.music}),/changed or became unavailable/);
  assert.equal(f.catalog.list().items.length,0);
});

test('bounded list and literal search with deterministic pagination', async t => {
  const f=fixture(t);
  for (const name of ['a.mp3','b.mp3','100%.wav']) { const p=path.join(f.root,name); fs.writeFileSync(p,'data'); await f.catalog.importFile({file_path:p,title:name}); }
  const page1=f.catalog.list({limit:2}); const page2=f.catalog.list({limit:2,offset:2});
  assert.equal(page1.items.length,2); assert.equal(page1.has_more,true); assert.equal(page2.items.length,1); assert.equal(page2.has_more,false);
  assert.equal(new Set([...page1.items,...page2.items].map(m=>m.id)).size,3);
  assert.deepEqual(f.catalog.search('%').items.map(m=>m.title),['100%.wav']);
  assert.throws(()=>f.catalog.list({limit:101}),/pagination/);
  assert.throws(()=>f.catalog.list({offset:-1}),/pagination/);
  assert.throws(()=>f.catalog.remove('../unsafe'),/Invalid music ID/);
});

test('real ffprobe imports generated audio read-only when FFmpeg is available', async t => {
  const binDir = path.join(os.homedir(), '.local', 'bin');
  const ffmpeg = process.platform === 'win32' ? path.join(binDir, 'ffmpeg.exe') : 'ffmpeg';
  const ffprobe = process.platform === 'win32' ? path.join(binDir, 'ffprobe.exe') : 'ffprobe';
  if (spawnSync(ffmpeg, ['-version'], {stdio:'ignore'}).status !== 0 || spawnSync(ffprobe, ['-version'], {stdio:'ignore'}).status !== 0) { t.skip('FFmpeg/FFprobe not available'); return; }
  const f=fixture(t,{probeAudio:async file=>JSON.parse((await execFile(ffprobe,['-v','error','-show_format','-show_streams','-print_format','json',file],{timeout:10000})).stdout)});
  const audio=path.join(f.root,'generated-test.wav');
  const generated=spawnSync(ffmpeg,['-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','0.4','-c:a','pcm_s16le','-n',audio],{stdio:'ignore'});
  assert.equal(generated.status,0);
  const before=hash(audio); const result=await f.catalog.importFile({file_path:audio});
  assert.equal(result.music.codec,'pcm_s16le'); assert.equal(result.music.sample_rate,44100);
  assert.ok(result.music.duration > 0); assert.equal(result.music.metadata_detail.technical,'ffprobe');
  f.catalog.remove(result.music.id); assert.equal(hash(audio),before);
});

test('Jamendo search uses official HTTPS endpoint with bounded metadata and unverified rights', async () => {
  let request;
  const tracks=Array.from({length:3},(_,i)=>({id:i+1,name:`Track ${i}`,artist_name:'Artist',duration:45,shareurl:`https://www.jamendo.com/track/${i+1}?secret=private`,license_ccurl:'https://creativecommons.org/licenses/by/4.0/',audio:'https://private/audio?token=secret',audiodownload:'https://private/download',audiodownload_allowed:i===0}));
  const client=new JamendoSearch({clientId:'client-secret',fetch:async(url,opts)=>{request={url,opts}; return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({headers:{status:'success'},results:tracks})};}});
  const result=await client.search({query:'travel ambient',limit:2});
  const req=new URL(request.url); assert.equal(req.origin,'https://api.jamendo.com'); assert.equal(req.pathname,'/v3.0/tracks/');
  assert.equal(req.searchParams.get('client_id'),'client-secret'); assert.equal(req.searchParams.get('limit'),'3');
  assert.equal(request.opts.redirect,'error'); assert.equal(result.items.length,2); assert.equal(result.has_more,true);
  assert.equal(result.items[0].rights_status,'unverified'); assert.equal(result.items[0].download_allowed,true);
  assert.equal(result.items[0].source_url,'https://www.jamendo.com/track/1');
  assert.doesNotMatch(JSON.stringify(result),/client-secret|token=secret|private\/audio|private\/download/);
  assert.equal(Object.hasOwn(result.items[0],'audio'),false);
});

test('Jamendo rejects invalid input and safely redacts network and API failures', async () => {
  let calls=0;
  const client=new JamendoSearch({clientId:'secret-id',fetch:async()=>{calls++;throw new Error('secret-id raw token');}});
  await assert.rejects(client.search({query:''}),/required/);
  await assert.rejects(client.search({query:'x',limit:21}),/pagination/);
  await assert.rejects(client.search({query:'x',offset:1001}),/pagination/); assert.equal(calls,0);
  await assert.rejects(client.search({query:'x'}),e=>e.message==='Jamendo search failed' && !e.message.includes('secret'));
  const http=new JamendoSearch({clientId:'secret-id',fetch:async()=>({ok:false,status:401})});
  await assert.rejects(http.search({query:'x'}),e=>e.message==='Jamendo search failed (HTTP 401)' && !e.message.includes('secret'));
  const invalid=new JamendoSearch({clientId:'secret-id',fetch:async()=>({ok:true,headers:{get:()=>null},text:async()=>'{not-json secret-id'})});
  await assert.rejects(invalid.search({query:'x'}),e=>!e.message.includes('secret-id'));
});

test('Jamendo enforces payload size and cancellation', async () => {
  const oversized=new JamendoSearch({clientId:'id',fetch:async()=>({ok:true,headers:{get:()=>String(4*1024*1024)},text:async()=>{throw new Error('should not read');}})});
  await assert.rejects(oversized.search({query:'x'}),/Jamendo search failed/);
  const abort=new AbortController(); abort.abort();
  const cancelled=new JamendoSearch({clientId:'id',fetch:async(_url,{signal})=>{signal.throwIfAborted();}});
  await assert.rejects(cancelled.search({query:'x',signal:abort.signal}),/cancelled/);
});
