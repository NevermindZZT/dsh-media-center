import test from 'node:test';
import assert from 'node:assert/strict';
import { registerMediaCenterTools } from '../src/host/tools/register-tools.js';
import { SHOT_ANALYSIS_FIELDS } from '../src/host/db/shot-analysis-store.js';

const makeRun = (overrides = {}) => ({
  id: 'sar_1', video_id: 'vid_1', shot_id: 'shot_1', status: 'completed',
  start_time: 2, end_time: 4, sample_times: [2.2, 3.8],
  prompt: 'SECRET FULL PROMPT THAT MUST NOT BE RETURNED',
  storyboard_path: '/cache/shot.jpg', provider: 'p', model: 'm', reasoning_effort: 'medium',
  candidate: { subject: '人物', visual_description: '举手', uncertainty: '动作开始时间不明', editing_suggestions: '可作片头', tags: ['人物'] },
  shot_snapshot: { subject: '旧主体', visual_description: '旧描述', tags: ['旧标签'] },
  audit: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, latency_ms: 1000 },
  applied_fields: [], created_at: '2026-01-01T00:00:00Z', finished_at: '2026-01-01T00:01:00Z', ...overrides
});
function fixture(service) {
  const defs = new Map(); let disposals = 0;
  const ctx = { tools: { register(def) { assert.ok(!defs.has(def.name)); defs.set(def.name, def); return () => { disposals++; }; } } };
  const dispose = registerMediaCenterTools(ctx, { db: {}, mediaEngine: {}, projectExporter: {}, shotSearchService: {}, shotAnalysisService: service });
  return { defs, dispose, get disposals() { return disposals; } };
}

test('registers the three schemas while preserving existing tools and disposal', () => {
  const f = fixture();
  for (const name of ['media_center_analyze_shot','media_center_get_shot_analysis','media_center_apply_shot_analysis',
    'media_center_list_folders','media_center_search_videos','media_center_get_video','media_center_export_project']) assert.ok(f.defs.has(name));
  const apply = f.defs.get('media_center_apply_shot_analysis');
  assert.deepEqual(apply.parameters.required, ['run_id', 'fields', 'confirmed']);
  assert.deepEqual(apply.parameters.properties.fields.items.enum, SHOT_ANALYSIS_FIELDS);
  assert.match(apply.parameters.properties.confirmed.description, /明确授权/);
  assert.equal(apply.parameters.additionalProperties, false);
  const n = f.defs.size; f.dispose(); assert.equal(f.disposals, n);
});

test('analyze calls the same service without applying; omits prompt and returns review/audit', async () => {
  const calls = [];
  const f = fixture({ analyze: async (...args) => { calls.push(args); return makeRun(); }, store: { applyFields: () => { throw new Error('must not call'); } } });
  const result = await f.defs.get('media_center_analyze_shot').execute({ video_id:'vid_1', shot_id:'shot_1' });
  assert.equal(result.success, true); assert.deepEqual(calls, [['vid_1','shot_1']]);
  assert.equal(result.run.run_id, 'sar_1'); assert.equal(result.run.candidate.visual_description, '举手');
  assert.equal(result.run.baseline.visual_description, '旧描述');
  assert.equal(result.run.audit.prompt_tokens, 100); assert.equal(result.run.audit.completion_tokens, 20);
  assert.doesNotMatch(JSON.stringify(result), /SECRET FULL PROMPT/);
});

test('run retrieval passes exact filtered bounded listRuns parameters and truncates long candidate fields', async () => {
  const calls = [];
  const f = fixture({ store: { listRuns: async opts => { calls.push(opts); return Array.from({length: 8}, (_, i) => makeRun({ id:`sar_${i}`, candidate: { visual_description:'x'.repeat(1300) } })); } } });
  const tool = f.defs.get('media_center_get_shot_analysis');
  let r = await tool.execute({ video_id:'vid_1', shot_id:'shot_1' });
  assert.deepEqual(calls[0], {video_id:'vid_1',shot_id:'shot_1',limit:3});
  assert.equal(r.runs.length, 3); assert.equal(r.runs[0].candidate.visual_description.length, 1200);
  assert.deepEqual(r.runs[0].truncated_fields, ['candidate.visual_description']);
  assert.match(r.runs[0].review_notice, /完整/);
  r = await tool.execute({ video_id:'vid_1', shot_id:'shot_1', limit:5 });
  assert.deepEqual(calls[1], {video_id:'vid_1',shot_id:'shot_1',limit:5}); assert.equal(r.runs.length,5);
  for (const limit of [0,6,1.5,'2',null]) assert.equal((await tool.execute({ video_id:'vid_1', shot_id:'shot_1', limit })).success, false);
  assert.equal(calls.length,2);
});

test('application refuses missing or false confirmation and invalid fields without mutation', async () => {
  const calls = [];
  const f = fixture({store:{applyFields: async (...args)=> {calls.push(args); return {run:makeRun({status:'applied'}), applied_fields:args[1]};}}});
  const tool=f.defs.get('media_center_apply_shot_analysis');
  for (const confirmed of [undefined,false,'true',1,null]) {
    const result=await tool.execute({run_id:'sar_1',fields:['subject'],confirmed});
    assert.equal(result.success,false); assert.match(result.error,/明确授权/);
  }
  for (const fields of [[],['unsupported'],['subject','subject'],['start_time'],null]) {
    assert.equal((await tool.execute({run_id:'sar_1',fields,confirmed:true})).success,false);
  }
  assert.equal((await tool.execute({run_id:' ',fields:['subject'],confirmed:true})).success,false);
  assert.equal(calls.length,0);
  const result=await tool.execute({run_id:'sar_1',fields:['subject','visual_description'],confirmed:true});
  assert.equal(result.success,true); assert.deepEqual(calls,[['sar_1',['subject','visual_description']]]);
  assert.deepEqual(result.applied_fields,['subject','visual_description']);
});

test('invalid identifiers, missing service and underlying failures return errors safely', async () => {
  const absent=fixture();
  for (const name of ['media_center_analyze_shot','media_center_get_shot_analysis']) {
    assert.equal((await absent.defs.get(name).execute({video_id:'',shot_id:'s'})).success,false);
    assert.match((await absent.defs.get(name).execute({video_id:'v',shot_id:'s'})).error,/不可用/);
  }
  assert.match((await absent.defs.get('media_center_apply_shot_analysis').execute({run_id:'r',fields:['subject'],confirmed:true})).error,/不可用/);
  const failed=fixture({analyze:async()=>{throw new Error('视频或片段不存在');}, store:{listRuns:()=>{throw new Error('查询失败');},applyFields:()=>{throw new Error('shot boundaries changed since analysis');}}});
  assert.match((await failed.defs.get('media_center_analyze_shot').execute({video_id:'v',shot_id:'s'})).error,/不存在/);
  assert.match((await failed.defs.get('media_center_get_shot_analysis').execute({video_id:'v',shot_id:'s'})).error,/查询失败/);
  assert.match((await failed.defs.get('media_center_apply_shot_analysis').execute({run_id:'r',fields:['subject'],confirmed:true})).error,/boundaries changed/);
});
