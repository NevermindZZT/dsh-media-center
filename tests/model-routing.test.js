import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VideoAiAnalyzer } from '../src/host/ai/video-analyzer.js';

function fixture(t, initial = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-model-test-'));
  const imagePath = path.join(dir, 'storyboard.jpg');
  fs.writeFileSync(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const settings = new Map(Object.entries(initial));
  const writes = [];
  const video = { id:'v1', file_name:'test.mp4', duration:10, storyboard_path:imagePath };
  const db = {
    getSetting: key => settings.get(key), setSetting: (key, value) => settings.set(key, value),
    getVideoById: () => video,
    upsertShots: (id, shots) => writes.push(['shots', id, shots]),
    upsertVideoAudio: (id, audio) => writes.push(['audio', id, audio]),
    upsertVideo: data => { writes.push(['video', data]); return data; }
  };
  const engine = { detectSilence: async () => [], detectBpmAndBeats: async () => ({ bpm:100 }) };
  const calls = [];
  const ref = { attachmentId:'sha256:fake', mediaType:'image/jpeg', bytes:4, width:1, height:1 };
  const llm = {
    listProviders: () => [{ id:'p1', name:'Provider 1' }, { id:'p2', name:'Provider 2' }],
    listModels: async provider => provider === 'p1' ? [
      { provider:'p1', id:'vision', name:'Vision', inputModalities:['text','image'] },
      { provider:'p1', id:'text', name:'Text', inputModalities:['text'] },
      { provider:'p1', id:'unknown', name:'Unknown' }
    ] : [{ provider:'p2', id:'vision', name:'Other vision', inputModalities:['image'] }],
    resolveModelInfo: async (provider, id) => ({ provider, id }),
    async *stream(options) {
      calls.push(['stream', options]);
      yield { type:'text-delta', index:0, text:'{"summary":"ok",' };
      yield { type:'reasoning-delta', index:1, text:'ignore this' };
      yield { type:'text-delta', index:0, text:'"shots":[{"start_time":0,"end_time":5}]}' };
      yield { type:'usage', usage:{inputTokens:10,outputTokens:4,totalTokens:14} };
      yield { type:'finish', reason:{kind:'stop'} };
    }
  };
  const attachments = { saveImage: async input => { calls.push(['image', input]); return ref; } };
  const analyzer = new VideoAiAnalyzer(db, engine, {llm, attachments});
  return { analyzer, db, settings, writes, calls, llm, ref, imagePath };
}

test('catalog preserves exact provider/model pair and omits secrets', async t => {
  const f = fixture(t);
  const catalog = await f.analyzer.getModelCatalog();
  assert.equal(catalog.providers[0].models[0].provider, 'p1');
  assert.equal(catalog.providers[1].models[0].provider, 'p2');
  assert.deepEqual(catalog.providers[0].models[1].inputModalities, ['text']);
  f.llm.listModels = async () => { throw new Error('private-secret'); };
  assert.doesNotMatch(JSON.stringify(await f.analyzer.getModelCatalog()), /private-secret/);
});

test('settings require exact image-capable route and do not overwrite retained custom keys', async t => {
  const f = fixture(t, { ai_api_key:'secret', ai_base_url:'https://custom.example/v1', ai_model:'legacy' });
  await assert.rejects(f.analyzer.saveAiSettings({mode:'dsh',provider:'p1',model:'text'}), /不支持图片/);
  assert.equal(f.settings.get('ai_mode'), undefined);
  await assert.rejects(f.analyzer.saveAiSettings({mode:'dsh',provider:'p2',model:'unknown'}), /不在/);
  const settings = await f.analyzer.saveAiSettings({mode:'dsh',provider:'p1',model:'vision'});
  assert.equal(settings.custom_model, 'legacy');
  assert.equal(settings.dsh_model, 'vision');
  assert.equal(settings.has_api_key, true);
  assert.doesNotMatch(JSON.stringify(settings), /secret/);
  assert.equal(f.settings.get('ai_api_key'), 'secret');
  await f.analyzer.saveAiSettings({mode:'custom', model:'legacy'});
  assert.equal(f.settings.get('ai_api_key'), 'secret');
  assert.equal(f.settings.get('ai_dsh_model'), 'vision');
});

test('stream request uses normalized image reference, exact route, deltas and usage', async t => {
  const f = fixture(t, { ai_mode:'dsh', ai_provider:'p1', ai_dsh_model:'vision' });
  const result = await f.analyzer.analyzeVideo('v1');
  assert.equal(f.calls[0][0], 'image');
  assert.equal(f.calls[0][1].mediaType, 'image/jpeg');
  const options = f.calls[1][1];
  assert.equal(options.provider, 'p1'); assert.equal(options.model, 'vision');
  assert.deepEqual(options.messages[0].content[1], {type:'image',attachment:f.ref});
  assert.equal(result.audit.total_tokens, 14);
  assert.equal(result.audit.prompt_tokens, 10);
  assert.equal(result.audit.completion_tokens, 4);
  assert.equal(f.writes.find(item=>item[0] === 'video')[1].summary, 'ok');
});

test('spectrogram interpretation uses the configured image model and does not update video annotations',async t=>{
  const f=fixture(t,{ai_mode:'dsh',ai_provider:'p1',ai_dsh_model:'vision'});
  fs.writeFileSync(f.imagePath,Buffer.from([137,80,78,71,13,10,26,10,0]));
  f.llm.stream=async function* (options){
    f.calls.push(['stream',options]);
    yield {type:'text-delta',text:JSON.stringify({summary:'层次渐进，整体平稳',rhythm_character:'中慢速、脉冲稀疏',energy_arc:'中段略有增强',scene_suggestions:[{scene:'山地日出延时',reason:'渐进能量适合缓慢铺陈',fit:'medium'}],uncertainties:['不能据图确定精确拍点']})};
    yield {type:'usage',usage:{inputTokens:12,outputTokens:30,totalTokens:42}};
    yield {type:'finish',reason:{kind:'stop'}};
  };
  const result=await f.analyzer.analyzeImagePrompt({imagePath:f.imagePath,promptText:'Analyze this log-frequency spectrogram; do not invent exact beat timestamps.'});
  assert.equal(f.calls[0][0],'image');assert.equal(f.calls[0][1].mediaType,'image/png');
  const options=f.calls[1][1];assert.equal(options.provider,'p1');assert.equal(options.model,'vision');
  assert.match(options.messages[0].content[0].text,/spectrogram/i);assert.deepEqual(result.interpretation.scene_suggestions[0].scene,'山地日出延时');
  assert.equal(result.audit.total_tokens,42);assert.equal(f.writes.length,0);
});

  test('error or incomplete finish never writes analysis and never exposes provider secret', async t => {
  const f = fixture(t, { ai_mode:'dsh', ai_provider:'p1', ai_dsh_model:'vision' });
  f.llm.stream = async function* () { yield {type:'text-delta',text:'{"shots":[]}'}; yield {type:'finish',reason:{kind:'error',failure:{message:'secret'}}}; };
  await assert.rejects(f.analyzer.analyzeVideo('v1'), error => !error.message.includes('secret') && /error/.test(error.message));
  assert.equal(f.writes.length, 0);
  f.llm.stream = async function* () { yield {type:'text-delta',text:'{"shots":[]}'}; };
  await assert.rejects(f.analyzer.analyzeVideo('v1'), /无结束信号/);
  assert.equal(f.writes.length, 0);
});

test('reasoning-capable models require explicit supported effort before save and dispatch', async t => {
  const f = fixture(t, { ai_mode:'dsh', ai_provider:'p1', ai_dsh_model:'vision', ai_prompt_template:'keep' });
  f.llm.resolveModelInfo = async () => ({reasoning:{defaultEffort:'medium', efforts:[{id:'off',name:'Off'},{id:'high',name:'High'}]}});
  await assert.rejects(f.analyzer.saveAiSettings({mode:'dsh',provider:'p1',model:'vision',prompt_template:'changed'}), /明确选择/);
  assert.equal(f.settings.get('ai_prompt_template'), 'keep');
  await assert.rejects(f.analyzer.analyzeVideo('v1'), /明确选择/);
  assert.equal(f.calls.length, 0);
  await assert.rejects(f.analyzer.saveAiSettings({reasoning_effort:'medium'}), /不受/);
  assert.equal(f.settings.get('ai_reasoning_effort'), undefined);
  const saved = await f.analyzer.saveAiSettings({reasoning_effort:'off'});
  assert.equal(saved.reasoning_effort,'off');
  await f.analyzer.analyzeVideo('v1');
  assert.equal(f.calls.filter(c => c[0] === 'stream').length,1);
  assert.equal(f.calls.find(c => c[0] === 'stream')[1].reasoningEffort,'off');
});

test('model or provider changes reject stale unsupported effort before writes', async t => {
  const f = fixture(t, { ai_mode:'dsh', ai_provider:'p1', ai_dsh_model:'vision', ai_reasoning_effort:'high', ai_prompt_template:'keep' });
  f.llm.resolveModelInfo = async (provider, model) => ({reasoning:{efforts:provider === 'p1' ? [{id:'high'}] : [{id:'low'}]}});
  await assert.rejects(f.analyzer.saveAiSettings({provider:'p2',model:'vision',prompt_template:'changed'}), /不受/);
  assert.equal(f.settings.get('ai_provider'),'p1');
  assert.equal(f.settings.get('ai_reasoning_effort'),'high');
  assert.equal(f.settings.get('ai_prompt_template'),'keep');
});

test('models with no reasoning metadata accept only empty choice', async t => {
  const f = fixture(t, { ai_mode:'dsh', ai_provider:'p1', ai_dsh_model:'vision' });
  await f.analyzer.saveAiSettings({reasoning_effort:''});
  await assert.rejects(f.analyzer.saveAiSettings({reasoning_effort:'high'}), /未声明/);
  await f.analyzer.analyzeVideo('v1');
  assert.equal(Object.hasOwn(f.calls.find(c => c[0] === 'stream')[1],'reasoningEffort'), false);
});

test('reasoning error never triggers a retry', async t => {
  const f = fixture(t, { ai_mode:'dsh', ai_provider:'p1', ai_dsh_model:'vision', ai_reasoning_effort:'off' });
  let calls = 0;
  f.llm.resolveModelInfo = async () => ({ reasoning:{ efforts:[{id:'off'},{id:'medium'}] } });
  f.llm.stream = async function* (options) {
    calls++;
    assert.equal(options.reasoningEffort, 'off');
    yield {type:'finish',reason:{kind:'error',failure:{code:'INVALID_REQUEST',message:'unsupported_value: reasoning.effort'}}};
  };
  await assert.rejects(f.analyzer.analyzeVideo('v1'), /INVALID_REQUEST/);
  assert.equal(calls, 1); assert.equal(f.writes.length, 0);
});

test('catalog refreshes exact dynamic reasoning metadata and marks lookup failure', async t => {
  const f = fixture(t);
  let current = ['off','high'];
  f.llm.resolveModelInfo = async (provider,model) => {
    if (model === 'unknown') throw new Error('private-secret');
    return model === 'vision' ? {reasoning:{efforts:current.map(id=>({id,name:id})),defaultEffort:'high'}} : {};
  };
  const first = await f.analyzer.getModelCatalog();
  assert.deepEqual(first.providers[0].models[0].reasoning.efforts.map(e=>e.id), ['off','high']);
  assert.equal(first.providers[0].models[0].reasoning.defaultEffort, 'high');
  assert.equal(first.providers[0].models[2].reasoning_unavailable, true);
  assert.equal(first.providers[0].models[1].reasoning, undefined);
  assert.doesNotMatch(JSON.stringify(first),/private-secret/);
  current=['low'];
  const second = await f.analyzer.getModelCatalog();
  assert.deepEqual(second.providers[0].models[0].reasoning.efforts.map(e=>e.id), ['low']);
  await assert.rejects(f.analyzer.validateDshRoute('p1','unknown',''), /无法获取/);
});

test('dispatch rechecks dynamic model capability before touching media or invoking model', async t => {
  const f = fixture(t, {ai_mode:'dsh',ai_provider:'p1',ai_dsh_model:'vision',ai_reasoning_effort:'medium'});
  f.llm.resolveModelInfo = async () => ({reasoning:{efforts:[{id:'high',name:'High'}]}});
  await assert.rejects(f.analyzer.analyzeVideo('v1'), /不受/);
  assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0);
});

test('custom mode preserves DSH effort without passing it into custom request', async t => {
  const f = fixture(t, {ai_mode:'dsh',ai_provider:'p1',ai_dsh_model:'vision',ai_reasoning_effort:'high',
    ai_base_url:'https://custom.example/v1',ai_api_key:'secret',ai_model:'legacy',ai_prompt_template:'keep'});
  await f.analyzer.saveAiSettings({mode:'custom',model:'legacy',reasoning_effort:'bogus'});
  assert.equal(f.settings.get('ai_reasoning_effort'), 'high');
  assert.equal(f.settings.get('ai_prompt_template'), 'keep');
  const prior = globalThis.fetch;
  t.after(() => { globalThis.fetch = prior; });
  let body;
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok:true, json:async () => ({choices:[{finish_reason:'stop',message:{content:'{"shots":[{"start_time":0,"end_time":5}]}'}}]}) };
  };
  await f.analyzer.analyzeVideo('v1');
  assert.equal(Object.hasOwn(body, 'reasoningEffort'), false);
  assert.equal(Object.hasOwn(body, 'reasoning_effort'), false);
});

test('invalid model result cannot overwrite existing annotations', async t => {
  const f = fixture(t, { ai_mode:'dsh', ai_provider:'p1', ai_dsh_model:'vision' });
  f.llm.stream = async function* () { yield {type:'text-delta',text:'{"shots":[]}'}; yield {type:'finish',reason:{kind:'stop'}}; };
  await assert.rejects(f.analyzer.analyzeVideo('v1'), /原有标注未更改/);
  assert.equal(f.writes.length, 0);
});

test('unknown modality remains selectable; custom HTTP errors do not leak key or response', async t => {
  const f = fixture(t, { ai_mode:'custom', ai_base_url:'https://custom.example/v1', ai_api_key:'secret', ai_model:'legacy' });
  await f.analyzer.validateDshRoute('p1','unknown');
  const prior = globalThis.fetch;
  t.after(() => { globalThis.fetch = prior; });
  globalThis.fetch = async () => ({ ok:false, status:401, text:async () => 'secret' });
  await assert.rejects(f.analyzer.analyzeVideo('v1'), error => !error.message.includes('secret') && /401/.test(error.message));
  assert.equal(f.writes.length, 0);
});


test('AI concurrency is configurable and validated between 1 and 8', async t => {
  const f = fixture(t, { ai_mode:'dsh', ai_provider:'p1', ai_dsh_model:'vision' });
  assert.equal(f.analyzer.getAiSettings().concurrency,3);
  const saved = await f.analyzer.saveAiSettings({ concurrency: 5 });
  assert.equal(saved.concurrency,5);
  assert.equal(f.settings.get('ai_concurrency'),'5');
  await assert.rejects(f.analyzer.saveAiSettings({ concurrency: 9 }), /1–8/);
  await assert.rejects(f.analyzer.saveAiSettings({ concurrency: 1.5 }), /1–8/);
});
