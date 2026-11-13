import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {VideoDatabase} from '../src/host/db/database.js';
import {MusicAnalysisStore} from '../src/host/music/music-analysis-store.js';

const MUSIC='mus_0123456789abcdef0123456789abcdef';
const identity=(change={})=>({size:4096,mtimeMs:1700000000123.5,ctimeMs:1700000000456.5,dev:1,ino:99,...change});
const analysis=(change={})=>({analysis_version:'pcm-v2',method:'energy-autocorrelation',analysis_window:{start_seconds:0,duration_seconds:10},status:'ok',bpm:120,confidence:0.85,
  tempo_candidates:[{bpm:120,score:0.85},{bpm:60,score:0.55}],onsets:[0.5,1,1.5],beat_candidates:[0.51,1.01,1.49],feature_summary:{rms:0.12,peak:0.9},...change});
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-music-analysis-store-'));
 const videoDb=new VideoDatabase({workspaceRoot:root});
 const store=new MusicAnalysisStore(videoDb);
 t.after(()=>{videoDb.db.close();fs.rmSync(root,{recursive:true,force:true});});
 return {root,videoDb,store};
}

test('migrates existing music analysis profiles with spectrogram interpretation columns',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-music-profile-migration-'));
  const videoDb=new VideoDatabase({workspaceRoot:root});
  videoDb.db.exec(`CREATE TABLE music_analysis_profiles (
    profile_seq INTEGER PRIMARY KEY AUTOINCREMENT,analysis_id TEXT NOT NULL UNIQUE,music_id TEXT NOT NULL,source_identity_json TEXT NOT NULL,
    analysis_version TEXT NOT NULL,method TEXT NOT NULL,window_start_seconds REAL NOT NULL,window_duration_seconds REAL NOT NULL,
    status TEXT NOT NULL,bpm REAL,confidence REAL,tempo_candidates_json TEXT NOT NULL,transient_onsets_json TEXT NOT NULL,
    beat_candidates_json TEXT NOT NULL,user_confirmed_beats_json TEXT NOT NULL DEFAULT '[]',feature_summary_json TEXT NOT NULL,
    style_suggestions_json TEXT NOT NULL DEFAULT '[]',style_rationale TEXT NOT NULL DEFAULT '',style_provenance TEXT,
    beats_confirmed_at TEXT,style_confirmed_at TEXT,created_at TEXT NOT NULL
  )`);
  t.after(()=>{videoDb.db.close();fs.rmSync(root,{recursive:true,force:true});});
  videoDb.db.prepare(`INSERT INTO music_analysis_profiles (analysis_id,music_id,source_identity_json,analysis_version,method,window_start_seconds,window_duration_seconds,status,bpm,confidence,tempo_candidates_json,transient_onsets_json,beat_candidates_json,feature_summary_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('ma_0123456789abcdef0123456789abcdef',MUSIC,'{}','pcm-v2','energy',0,10,'ok',100,0.5,'[]','[1,2,3]','[]','{}','2026-01-01T00:00:00Z');
  new MusicAnalysisStore(videoDb);
  const columns=new Set(videoDb.db.prepare('PRAGMA table_info(music_analysis_profiles)').all().map(row=>row.name));
  for(const name of ['model_interpretation_json','model_provider','model_name','model_reasoning_effort','model_interpreted_at','model_interpretation_edits_json','model_interpretation_edited_at'])assert.ok(columns.has(name),name);
  assert.equal(videoDb.db.prepare('SELECT transient_onsets_json FROM music_analysis_profiles WHERE analysis_id=?').get('ma_0123456789abcdef0123456789abcdef').transient_onsets_json,'[]');
});

 test('stores multiple immutable analysis profiles with windows and returns the latest source-matching version',t=>{
  const f=fixture(t);
 const first=f.store.save(MUSIC,identity(),analysis());
 const second=f.store.save(MUSIC,identity(),analysis({analysis_version:'pcm-v3',analysis_window:{start_seconds:20,duration_seconds:8},bpm:96,onsets:[20.5,21,21.5],beat_candidates:[20.5,21,21.5]}));
 assert.notEqual(first.analysis_id,second.analysis_id);
 assert.equal(f.store.get(first.analysis_id).analysis_version,'pcm-v2');
 assert.equal(f.store.latest(MUSIC,identity()).analysis_id,second.analysis_id);
 assert.deepEqual(f.store.latest(MUSIC,identity()).analysis_window,{start_seconds:20,duration_seconds:8});
 assert.equal(f.store.analysisSummary(second.analysis_id).tempo_candidate_count,2);
 assert.equal('transient_count' in f.store.analysisSummary(second.analysis_id),false);
});

test('accepts signed Windows network device and inode fingerprint values',t=>{
  const f=fixture(t),profile=f.store.save(MUSIC,identity({dev:'-16',ino:'-4096'}),analysis());
  assert.equal(profile.source_identity.dev,'-16');assert.equal(profile.source_identity.ino,'-4096');
  assert.throws(()=>f.store.save(MUSIC,identity({size:'-1'}),analysis()),/Invalid source identity/);
});

 test('stores model spectrogram interpretation with provenance separately from beats and user styles',t=>{
  const f=fixture(t),profile=f.store.save(MUSIC,identity(),analysis());
  const interpretation={summary:'层次渐进',rhythm_character:'中慢速脉冲',energy_arc:'中段增强',scene_suggestions:[{scene:'山地日出延时',reason:'渐进能量',fit:'medium'}],tempo_hypotheses:[{bpm:96,confidence:'low',reason:'视觉间距粗略估计'}],beat_time_hypotheses:[{time_fraction:0.25,confidence:'low',reason:'疑似重复能量脉冲'}],style_tags:['山地慢剪'],uncertainties:['频谱图不能确定精确拍点']};
  const saved=f.store.saveModelInterpretation(profile.analysis_id,identity(),interpretation,{provider:'p1',model:'vision',reasoning_effort:'low'});
  assert.equal(saved.model_interpretation.summary,'层次渐进');assert.equal(saved.model_interpretation_provenance.model,'vision');
  assert.equal(saved.model_interpretation.tempo_hypotheses[0].bpm,96);assert.equal(saved.model_interpretation.beat_time_hypotheses[0].source_seconds,2.5);assert.equal(saved.model_interpretation.beat_time_hypotheses[0].approximate,true);
  assert.deepEqual(saved.model_interpretation.style_tags,['山地慢剪']);assert.deepEqual(saved.user_confirmed_beats,[]);assert.deepEqual(saved.style_tags,[]);
  const edited=f.store.saveModelInterpretationEdits(profile.analysis_id,identity(),{summary:'人工修订摘要',rhythm_character:'较慢且均匀',energy_arc:'缓慢上扬',style_tags:['山地旅行慢剪'],user_confirmed_model_beats:[2.5]});
  assert.equal(edited.model_interpretation.summary,'层次渐进');assert.equal(edited.model_interpretation_edits.summary,'人工修订摘要');
  assert.deepEqual(edited.model_interpretation_edits.style_tags,['山地旅行慢剪']);assert.deepEqual(edited.model_interpretation_edits.user_confirmed_model_beats,[2.5]);
  assert.throws(()=>f.store.saveModelInterpretationEdits(profile.analysis_id,identity(),{summary:'x',rhythm_character:'x',energy_arc:'x',style_tags:[],user_confirmed_model_beats:[3]}),/match a spectrogram hint/);
  assert.throws(()=>f.store.saveModelInterpretation(profile.analysis_id,identity({ino:-101}),interpretation,{provider:'p1',model:'vision'}),/stale/);
  assert.throws(()=>f.store.saveModelInterpretation(profile.analysis_id,identity(),{...interpretation,summary:'C:\\private\\track'},{}),/absolute path/);
});

test('marks a source identity mismatch stale without returning old analysis data',t=>{
 const f=fixture(t),saved=f.store.save(MUSIC,identity(),analysis());
 const stale=f.store.latest(MUSIC,identity({ino:100}));
 assert.equal(stale.status,'stale');assert.equal(stale.analysis_id,saved.analysis_id);
 assert.equal('transient_onsets' in stale,false);assert.equal('source_identity' in stale,false);
});

test('rejects invalid IDs, fingerprint paths, malformed windows, unbounded arrays, and invalid values',t=>{
 const f=fixture(t),store=f.store;
 assert.throws(()=>store.save('music-1',identity(),analysis()),/Invalid music ID/);
 assert.throws(()=>store.get('not-an-analysis-id'),/Invalid analysis ID/);
 assert.throws(()=>f.store.confirmBeats('not-an-analysis-id',identity(),[0.5],{confirmed:true}),/Invalid analysis ID/);

 assert.throws(()=>store.save(MUSIC,{...identity(),file_path:'C:\\private\\song.wav'},analysis()),/paths are not allowed/);
 assert.throws(()=>store.save(MUSIC,{size:1,dev:1,ino:2},analysis()),/modification or change time/);
 assert.throws(()=>store.save(MUSIC,identity(),analysis({analysis_window:{start_seconds:-1,duration_seconds:10}})),/Invalid analysis window start/);
 assert.throws(()=>store.save(MUSIC,identity(),analysis({status:'measured'})),/Unsupported analysis status/);
 assert.throws(()=>store.save(MUSIC,identity(),analysis({onsets:Array.from({length:6001},(_,i)=>i/10)})),/Invalid transient_onsets/);
  assert.throws(()=>store.save(MUSIC,identity(),analysis({analysis_window:{start_seconds:0,duration_seconds:600.1}})),/Invalid analysis window duration/);
 assert.throws(()=>store.save(MUSIC,identity(),analysis({feature_summary:{file_path:'C:\\secret\\song.wav'}})),/must not store paths/);
 assert.throws(()=>store.save(MUSIC,identity(),analysis({bpm:NaN})),/Invalid bpm/);
});

test('stores ten-minute analysis windows without exposing raw onset arrays',t=>{
  const f=fixture(t),onsets=Array.from({length:5000},(_,i)=>(i+1)*0.12);
  const profile=f.store.save(MUSIC,identity(),analysis({analysis_window:{start_seconds:0,duration_seconds:600},onsets,beat_candidates:[]}));
  assert.equal(profile.analysis_window.duration_seconds,600);assert.equal('transient_onsets' in profile,false);
});

 test('stores only filesystem attributes and never an absolute source path',t=>{
 const f=fixture(t),profile=f.store.save(MUSIC,identity(),analysis({feature_summary:{rms:0.1,band_energy:[0.2,0.3]}}));
 const raw=f.videoDb.db.prepare('SELECT * FROM music_analysis_profiles WHERE analysis_id=?').get(profile.analysis_id);
 assert.equal(Object.hasOwn(raw,'file_path'),false);
 assert.equal(raw.source_identity_json.includes('\\song.wav'),false);
 assert.equal(JSON.stringify(profile).includes('C:\\'),false);
 assert.deepEqual(profile.source_identity,{dev:'1',ino:'99',size:'4096',ctimeMs:'1700000000456.5',mtimeMs:'1700000000123.5'});
});

test('beat confirmation is user-only, source-bound, and limited to measured beat candidates',t=>{
 const f=fixture(t),profile=f.store.save(MUSIC,identity(),analysis());
 assert.throws(()=>f.store.confirmBeats(profile.analysis_id,identity(),[0.51],{confirmed:false}),/confirmation is required/);
 assert.deepEqual(f.store.get(profile.analysis_id).user_confirmed_beats,[]);
 assert.throws(()=>f.store.confirmBeats(profile.analysis_id,identity({mtimeMs:identity().mtimeMs+1}),[0.51],{confirmed:true}),/stale/);
 assert.throws(()=>f.store.confirmBeats(profile.analysis_id,identity(),[0.7],{confirmed:true}),/match a measured beat candidate/);
 const updated=f.store.confirmBeats(profile.analysis_id,identity(),[0.52,1.49],{confirmed:true});
 assert.deepEqual(updated.user_confirmed_beats,[0.52,1.49]);assert.ok(updated.beats_confirmed_at);
});

test('catalog removal cleanup deletes only the selected music analysis profiles',t=>{
 const f=fixture(t),other='mus_ffffffffffffffffffffffffffffffff';
 const first=f.store.save(MUSIC,identity(),analysis()),second=f.store.save(MUSIC,identity(),analysis({analysis_version:'pcm-v3'}));
 const otherProfile=f.store.save(other,identity({ino:100}),analysis());
 assert.equal(f.store.removeForMusic(MUSIC),2);assert.equal(f.store.get(first.analysis_id),null);assert.equal(f.store.get(second.analysis_id),null);
 assert.equal(f.store.get(otherProfile.analysis_id).music_id,other);assert.equal(f.store.removeForMusic(MUSIC),0);
});

test('Agent style suggestions persist only after explicit confirmation and carry user-approved provenance',t=>{
 const f=fixture(t),profile=f.store.save(MUSIC,identity(),analysis());
 assert.throws(()=>f.store.saveStyleSuggestions(profile.analysis_id,['ambient'],'Warm and calm',{confirmed:false}),/confirmation is required/);
 assert.deepEqual(f.store.get(profile.analysis_id).style_suggestions,[]);
 assert.throws(()=>f.store.saveStyleSuggestions(profile.analysis_id,['ambient'],'C:\\secret\\rationale',{confirmed:true}),/absolute path/);
 const updated=f.store.saveStyleSuggestions(profile.analysis_id,['ambient','cinematic'],'Gentle, spacious texture',{confirmed:true});
 assert.deepEqual(updated.style_suggestions,['ambient','cinematic']);assert.equal(updated.style_rationale,'Gentle, spacious texture');
 assert.equal(updated.style_provenance,'dsh-agent-user-approved');assert.ok(updated.style_confirmed_at);
 assert.deepEqual(f.store.analysisSummary(profile.analysis_id).style_tags,['ambient','cinematic']);
});
