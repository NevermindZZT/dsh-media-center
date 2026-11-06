import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const helperStart = source.indexOf('    const SHOT_ANALYSIS_FIELDS');
const helperEnd = source.indexOf('    // --- Main Workbench', helperStart);
const start = source.indexOf('      const hasActiveShotAnalysis =');
const end = source.indexOf('      const renderShotAnalysis =', start);
assert.ok(helperStart >= 0 && helperEnd > helperStart && start >= 0 && end > start);

function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function fixture() {
  const state = { runs: {}, open: {}, loading: {}, errors: {}, fields: {}, applying: null };
  const set = key => value => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  const calls = [], pending = [], details = [];
  const context = vm.createContext({
    encodeURIComponent, console, Number, JSON, Object, Set,
    shotRunVersionsRef: { current: {} }, shotLocksRef: { current: new Set() },
    applyingShotRunRef: { current: null }, editingRef: { current: false },
    viewRef: { current: { videoId: 'v1' } },
    shotRuns: state.runs,
    setShotRuns: value => { set('runs')(value); context.shotRuns = state.runs; }, setOpenShotRun: set('open'), setShotRunLoading: set('loading'),
    setShotRunError: set('errors'), setShotSelectedFields: set('fields'), setApplyingShotRun: set('applying'),
    loadVideoDetail: async (...args) => { details.push(args); },
    fetch: (url, options = {}) => { const d = deferred(); calls.push({ url, options }); pending.push(d); return d.promise; }
  });
  vm.runInContext(source.slice(helperStart, helperEnd) + '\n' + source.slice(start, end) + '\nObject.assign(globalThis, { loadShotRuns, handleShotDeepAnalysis, handleApplyShotRun, shotRunBoundaryMatches });', context);
  const reply = (n, data, ok = true) => pending[n].resolve({ ok, json: async () => data });
  return { state, calls, pending, reply, context, details };
}

test('analysis is single-flight and stores a candidate without automatically applying', async () => {
  const f = fixture();
  const first = f.context.handleShotDeepAnalysis('v1', 'shot1');
  await f.context.handleShotDeepAnalysis('v1', 'shot1');
  assert.equal(f.calls.length, 1);
  assert.match(f.calls[0].url, /v1\/shots\/shot1\/deep-analysis$/);
  f.reply(0, { success:true, run:{ id:'r1', status:'completed', candidate:{subject:'new'} } });
  await first;
  assert.equal(f.state.runs.shot1[0].id, 'r1');
  assert.deepEqual([...f.state.fields.r1], []);
  assert.equal(f.calls.some(c => c.url.endsWith('/apply')), false);
  assert.equal(f.details.length, 0);
});

test('a known running analysis cannot be triggered twice from this view', async () => {
  const f = fixture();
  f.context.shotRuns = { shot1:[{ id:'running',status:'running' }] };
  await f.context.handleShotDeepAnalysis('v1','shot1');
  assert.equal(f.calls.length,0);
});

test('application rejects editing, missing fields, stale bounds and changed baseline', async () => {
  const f = fixture();
  const shot = { id:'s', start_time:0, end_time:5, subject:'current' };
  const run = { id:'r', status:'completed', start_time:0, end_time:5, baseline:{ subject:'current' } };
  f.context.editingRef.current = true;
  await f.context.handleApplyShotRun('v1', shot, run, ['subject']);
  f.context.editingRef.current = false;
  await f.context.handleApplyShotRun('v1', shot, run, []);
  await f.context.handleApplyShotRun('v1', shot, {...run, start_time:1}, ['subject']);
  await f.context.handleApplyShotRun('v1', shot, {...run, baseline:{subject:'old'}}, ['subject']);
  await f.context.handleApplyShotRun('v1', shot, {...run, baseline:{}}, ['subject']);
  assert.equal(f.calls.length, 0);
});

test('application sends only explicitly selected fields and preserves active editing', async () => {
  const f = fixture();
  const shot = { id:'s', start_time:0, end_time:5, subject:'old' };
  const run = { id:'r', status:'completed', start_time:0, end_time:5, baseline:{ subject:'old' } };
  const result = f.context.handleApplyShotRun('v1', shot, run, ['subject']);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(JSON.parse(f.calls[0].options.body), { fields:['subject'] });
  f.context.editingRef.current = true;
  f.reply(0, { success:true, shot:{}, run });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.details.length, 0);
  assert.match(f.calls[1].url, /deep-analyses$/);
  f.reply(1, { success:true, runs:[run] });
  await result;
  assert.equal(f.context.applyingShotRunRef.current, null);
});

test('shot prompt loads separately and only sends changed text on explicit save', async () => {
  const start = source.indexOf('      const loadShotAnalysisSettings =');
  const end = source.indexOf('      // 6. Load Local Filesystem', start);
  assert.ok(start >= 0 && end > start);
  const requests = [], pending = [], state = {};
  const context = vm.createContext({
    shotPromptVersionRef:{current:0}, shotPromptInitialRef:{current:''}, shotPromptLoaded:false, shotPrompt:'',
    setShotPromptLoaded: value => { state.loaded=value; context.shotPromptLoaded=value; },
    setShotPromptError: value => { state.error=value; },
    setShotPrompt: value => { state.prompt=value; context.shotPrompt=value; },
    setShotDefaultPrompt: value => { state.defaultPrompt=value; },
    fetch: (url, options = {}) => { const d=deferred(); requests.push({url,options}); pending.push(d); return d.promise; }
  });
  vm.runInContext(source.slice(start,end) + '\nObject.assign(globalThis,{loadShotAnalysisSettings,saveShotAnalysisSettings});', context);
  await assert.rejects(context.saveShotAnalysisSettings(), /尚未加载/);
  const load = context.loadShotAnalysisSettings();
  assert.equal(requests.length,1); assert.equal(requests[0].options.method,undefined);
  pending[0].resolve({ok:true,json:async()=>({success:true,prompt:'saved',default_prompt:'default'})});
  await load;
  assert.equal(state.prompt,'saved'); assert.equal(state.defaultPrompt,'default');
  await context.saveShotAnalysisSettings(); assert.equal(requests.length,1);
  context.shotPrompt='edited';
  const save = context.saveShotAnalysisSettings();
  assert.equal(requests.length,2);
  assert.deepEqual(JSON.parse(requests[1].options.body),{prompt:'edited'});
  pending[1].resolve({ok:true,json:async()=>({success:true})}); await save;
  assert.equal(context.shotPromptInitialRef.current,'edited');
});

test('new analysis response cannot be overwritten by older history response', async () => {
  const f = fixture();
  const history = f.context.loadShotRuns('v1','s');
  const analysis = f.context.handleShotDeepAnalysis('v1','s');
  f.reply(1, { success:true, run:{id:'new',status:'completed'} }); await analysis;
  f.reply(0, { success:true, runs:[{id:'old'}] }); await history;
  assert.equal(f.state.runs.s[0].id, 'new');
});
