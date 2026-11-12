import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEditProject, quantizeSecondsToFrame, frameToSeconds, mapMusicBeatToTimeline } from '../src/host/edit/edit-project.js';

function fixture() {
  return { schema_version:1, title:'国庆旅行', rationale:'从人物进入，以山景收尾', evidence:{source:'人工核对',confidence:'uncertain'},
    fps:{num:30000,den:1001}, duration_frames:900,
    tracks:{
      video:[
        {id:'v1',source:{id:'source1',path:'Z:\\media\\a.mp4',duration_seconds:60},source_in_seconds:5,source_out_seconds:20.015,timeline_start_frame:0,timeline_end_frame:450,rationale:'开场',evidence:{kind:'sampled_frames',times:[5,10]}},
        {id:'v2',source:{id:'source2',duration_seconds:40},source_in_seconds:0,source_out_seconds:15.015,timeline_start_frame:450,timeline_end_frame:900,rationale:'收尾'}
      ],
      music:[{id:'m1',source:{id:'music1',path:'Z:\\music\\a.wav',duration_seconds:90},source_in_seconds:40,source_out_seconds:70.03,timeline_start_frame:0,timeline_end_frame:900,rights:{status:'unknown',license_url:'https://example.invalid/license',notes:'由用户确认'},beats:[{source_seconds:40.2,method:'manual'},{source_seconds:46.006,confidence:0.8}]}]
    }
  };
}
const codes=r=>r.errors.map(e=>e.code);

test('default horizontal canvas, preserve rationale evidence rights and input immutability',()=>{
  const input=fixture(), before=structuredClone(input), r=validateEditProject(input);
  assert.equal(r.valid,true,JSON.stringify(r.errors));
  assert.deepEqual(r.project.canvas,{width:1920,height:1080,aspect:'16:9'});
  assert.deepEqual(input,before); assert.deepEqual(r.project.evidence,input.evidence);
  assert.deepEqual(r.project.tracks.music[0].rights,input.tracks.music[0].rights);
  assert.deepEqual(r.project.tracks.video[0].evidence,input.tracks.video[0].evidence);
  assert.ok(r.warnings.some(w=>w.code==='RIGHTS_UNCONFIRMED'));
  r.project.tracks.music[0].rights.notes='changed'; assert.equal(input.tracks.music[0].rights.notes,'由用户确认');
});

test('explicit vertical canvas and rational rates are accepted',()=>{
  const p=fixture(); p.canvas={width:1080,height:1920,aspect:'9:16'};
  const r=validateEditProject(p); assert.equal(r.valid,true); assert.equal(r.project.canvas.aspect,'9:16');
  assert.equal(frameToSeconds(30000,{num:30000,den:1001}),1001);
  assert.equal(quantizeSecondsToFrame(1001,{num:30000,den:1001}),30000);
  assert.equal(quantizeSecondsToFrame(0.5,{num:24,den:1}),12);
  assert.throws(()=>quantizeSecondsToFrame(-1,p.fps)); assert.throws(()=>frameToSeconds(0.5,p.fps));
});

test('no fabricated beats or permission: optional beats retained and unknown rights warned',()=>{
  const p=fixture(); delete p.tracks.music[0].beats;
  const r=validateEditProject(p); assert.equal(r.valid,true); assert.equal(r.project.tracks.music[0].beats,undefined);
  assert.equal(r.project.tracks.music[0].rights.status,'unknown'); assert.ok(r.warnings.some(w=>w.code==='RIGHTS_UNCONFIRMED'));
  p.tracks.music=[]; const noMusic=validateEditProject(p); assert.equal(noMusic.valid,true); assert.ok(noMusic.warnings.some(w=>w.code==='MUSIC_MISSING'));
});

test('maps source beat through trim, offset and rational frame quantization',()=>{
  const p=fixture(); const mapped=mapMusicBeatToTimeline(p,'m1',46.006);
  assert.ok(Math.abs(mapped.timeline_seconds-6.006)<1e-9); assert.equal(mapped.timeline_frame,180);
  assert.ok(Math.abs(mapped.quantization_error_seconds)<1e-9);
  assert.equal(mapMusicBeatToTimeline(p,'m1',39),null);
  assert.equal(mapMusicBeatToTimeline(p,'m1',70.03),null);
  assert.equal(mapMusicBeatToTimeline(p,'m1',70.029).timeline_frame,null);
  assert.throws(()=>mapMusicBeatToTimeline(p,'missing',41),/not found/);
  // Same music source starts later in the timeline; beats map using both offsets.
  p.tracks.music[0].source_out_seconds=65.025; p.tracks.music[0].timeline_start_frame=150;
  const offset=mapMusicBeatToTimeline(p,'m1',46.006);
  assert.equal(offset.timeline_frame,330); assert.ok(Math.abs(offset.timeline_seconds-11.011)<1e-9);
});

test('reject overlap and video gaps but warn on music gaps',()=>{
  const p=fixture(); p.tracks.video[1].timeline_start_frame=440;
  let r=validateEditProject(p); assert.ok(codes(r).includes('TRACK_OVERLAP'));
  p.tracks.video[1].timeline_start_frame=460;
  r=validateEditProject(p); assert.ok(codes(r).includes('TRACK_GAP'));
  const q=fixture(); q.tracks.music[0].source_out_seconds=65.025; q.tracks.music[0].timeline_start_frame=150;
  r=validateEditProject(q); assert.equal(r.valid,true); assert.ok(r.warnings.some(w=>w.code==='TRACK_GAP'));
});

test('reject invalid source bounds, malformed timeline, unauthorized speed and duplicate ids',()=>{
  for(const mutate of [p=>p.tracks.video[0].source_in_seconds=-1,p=>p.tracks.video[0].source_out_seconds=100,p=>p.tracks.video[0].source_out_seconds=5,p=>p.tracks.video[0].timeline_start_frame=.5,p=>p.tracks.video[0].timeline_end_frame=901,p=>p.tracks.video[0].speed=2,p=>p.tracks.video[1].id='v1',p=>p.tracks.music[0].rights.status='licensed']) {
    const p=fixture(); mutate(p); assert.equal(validateEditProject(p).valid,false);
  }
});

test('enforce frame duration within half-frame and do not hide invalid intervals',()=>{
  const p=fixture(); p.tracks.video[0].source_out_seconds+=0.1;
  assert.ok(codes(validateEditProject(p)).includes('DURATION_MISMATCH'));
  p.tracks.video[0].source_out_seconds=20.015+1001/30000*0.49;
  assert.equal(validateEditProject(p).valid,true);
});

test('confirmed rights remain an unverified assertion and sources are not inspected',()=>{
  const p=fixture(); p.tracks.music[0].rights.status='confirmed';
  const r=validateEditProject(p);
  assert.equal(r.valid,true);
  assert.ok(r.warnings.some(w=>w.code==='RIGHTS_NOT_VERIFIED'));
  assert.ok(r.warnings.some(w=>w.code==='SOURCES_UNVERIFIED'));
});

test('reject invalid project/canvas/fps/metadata without touching files',()=>{
  assert.equal(validateEditProject(null).valid,false);
  for (const mutate of [p=>p.fps={num:0,den:1},p=>p.fps={num:30,den:0},p=>p.canvas={width:1080,height:1920,aspect:'16:9'},p=>p.tracks.video=[],p=>p.title='',p=>p.rationale='',p=>p.tracks.music[0].beats=[{source_seconds:42},{source_seconds:41}],p=>p.tracks.music[0].beats=[{source_seconds:99}],p=>p.evidence={bad:NaN}]) {
    const p=fixture(); mutate(p); assert.equal(validateEditProject(p).valid,false);
  }
  const p=fixture(); p.evidence={}; p.evidence.self=p.evidence;
  assert.ok(codes(validateEditProject(p)).includes('INVALID_JSON'));
});
