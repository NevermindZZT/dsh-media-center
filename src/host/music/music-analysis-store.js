import crypto from 'node:crypto';
import { MAX_MUSIC_ANALYSIS_SECONDS } from './beat-analysis.js';

const MUSIC_ID=/^mus_[0-9a-f]{32}$/;
const ANALYSIS_ID=/^ma_[0-9a-f]{32}$/;
const STAT_KEYS=['dev','ino','size','ctimeMs','mtimeMs','mtimeNs'];
const STAT_KEY_SET=new Set(STAT_KEYS);
const STAT_PATH_RE=/(?:^|[\s"'`])(?:[a-z]:[\\/]|\\\\|\/(?:Users|home|mnt|media|tmp|private|var|Volumes|root)\/)/i;
const STATUSES=new Set(['ok','low_confidence','silence','no_audio','error']);
const MAX_EVENTS=6000;
const MAX_JSON_BYTES=128*1024;
const MAX_DEPTH=6;
const MAX_ITEMS=200;
const BEAT_CANDIDATE_TOLERANCE_SECONDS=0.05;

function assertId(value, pattern, label){
  if(typeof value!=='string'||!pattern.test(value))throw new Error(`Invalid ${label}`);
}
function boundedText(value,label,max,{allowEmpty=false}={}){
  if(typeof value!=='string'||value.length>max||value.includes('\0')||(!allowEmpty&&!value.trim()))throw new Error(`Invalid ${label}`);
  const text=value.trim();
  if(STAT_PATH_RE.test(text))throw new Error(`${label} must not contain an absolute path`);
  return text;
}
function plainObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);}
function number(value,label,min,max,{nullable=false}={}){
  if(nullable&&(value===null||value===undefined))return null;
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`Invalid ${label}`);
  return value;
}
function numericIdentityValue(value,key){
  const allowNegative=key!=='size',integer=!['mtimeMs','ctimeMs'].includes(key);
  if(typeof value==='number'&&Number.isFinite(value)&&(allowNegative||value>=0)){
    if(integer&&!Number.isSafeInteger(value))throw new Error('Invalid source identity');
    return String(value);
  }
  const pattern=new RegExp(`^${allowNegative?'-?':''}\\d+${integer?'':'(?:\\.\\d+)'}$`);
  if(typeof value==='string'&&value.length<=80&&pattern.test(value))return value;
  throw new Error('Invalid source identity');
}
function normalizeSourceIdentity(identity){
  if(!plainObject(identity))throw new Error('sourceIdentity must be an object of filesystem fingerprint attributes');
  const keys=Object.keys(identity);
  if(keys.some(key=>!STAT_KEY_SET.has(key)))throw new Error('sourceIdentity may contain fingerprint attributes only; paths are not allowed');
  for(const key of ['dev','ino','size'])if(!Object.hasOwn(identity,key))throw new Error(`sourceIdentity is missing ${key}`);
  if(!Object.hasOwn(identity,'mtimeMs')&&!Object.hasOwn(identity,'mtimeNs')&&!Object.hasOwn(identity,'ctimeMs'))throw new Error('sourceIdentity requires a modification or change time');
  const normalized={};
  for(const key of STAT_KEYS)if(Object.hasOwn(identity,key))normalized[key]=numericIdentityValue(identity[key],key);
  return normalized;
}
function normalizeTimeArray(value,label,window,{max=MAX_EVENTS,allowEmpty=true}={}){
  if(!Array.isArray(value)||value.length>max||(!allowEmpty&&!value.length))throw new Error(`Invalid ${label}`);
  const start=window.start_seconds,end=start+window.duration_seconds;
  let previous=-Infinity;
  return value.map(item=>{
    const point=number(item,label,0,86400);
    if(point<=previous||point<start-1e-6||point>end+1e-6)throw new Error(`${label} must be increasing and inside the analysis window`);
    previous=point;return point;
  });
}
function assertSafeJson(value,label){
  let nodes=0;
  const walk=(item,depth)=>{
    if(++nodes>MAX_ITEMS*4||depth>MAX_DEPTH)throw new Error(`${label} exceeds structural limits`);
    if(item===null||typeof item==='boolean')return;
    if(typeof item==='number'){if(!Number.isFinite(item))throw new Error(`${label} must contain finite numbers`);return;}
    if(typeof item==='string'){if(item.length>2000||item.includes('\0')||STAT_PATH_RE.test(item))throw new Error(`${label} contains unsafe text`);return;}
    if(Array.isArray(item)){if(item.length>MAX_ITEMS)throw new Error(`${label} has too many items`);item.forEach(value=>walk(value,depth+1));return;}
    if(plainObject(item)){
      for(const [key,value] of Object.entries(item)){
        if(/^(?:path|file_path|filepath|source_path|absolutepath|absolute_path|canonical)$/i.test(key.replace(/[-_]/g,'')))throw new Error(`${label} must not store paths`);
        if(key.length>100)throw new Error(`${label} has an invalid key`);
        walk(value,depth+1);
      }
      return;
    }
    throw new Error(`${label} must be JSON-compatible`);
  };
  walk(value,0);
  const json=JSON.stringify(value);
  if(Buffer.byteLength(json,'utf8')>MAX_JSON_BYTES)throw new Error(`${label} exceeds the size limit`);
  return JSON.parse(json);
}
function parseJson(text,fallback){try{return text?JSON.parse(text):fallback;}catch{return fallback;}}
function readWindow(analysis){
  const value=analysis.analysis_window??analysis.window;
  if(!plainObject(value))throw new Error('analysis_window is required');
  const start=number(value.start_seconds??value.start,'analysis window start',0,86400);
  const duration=number(value.duration_seconds??value.duration,'analysis window duration',0.001,MAX_MUSIC_ANALYSIS_SECONDS);
  return {start_seconds:start,duration_seconds:duration};
}
function normalizeAnalysis(analysis){
  if(!plainObject(analysis))throw new Error('analysis must be an object');
  const analysisVersion=boundedText(analysis.analysis_version??analysis.version??'1','analysis_version',80);
  const method=boundedText(analysis.method??analysis.analysis_method,'method',120);
  const status=analysis.status;
  if(!STATUSES.has(status))throw new Error('Unsupported analysis status');
  const analysisWindow=readWindow(analysis);
  const bpm=number(analysis.bpm,'bpm',1,400,{nullable:true});
  const confidence=number(analysis.confidence,'confidence',0,1,{nullable:true});
  const tempoSource=analysis.tempo_candidates??[];
  if(!Array.isArray(tempoSource)||tempoSource.length>20)throw new Error('Invalid tempo_candidates');
  const tempoCandidates=tempoSource.map(candidate=>{
    if(!plainObject(candidate))throw new Error('Invalid tempo candidate');
    const normalized={bpm:number(candidate.bpm,'tempo candidate bpm',1,400)};
    if(candidate.score!==undefined)normalized.score=number(candidate.score,'tempo candidate score',0,1);
    if(candidate.confidence!==undefined)normalized.confidence=number(candidate.confidence,'tempo candidate confidence',0,1);
    if(candidate.hypothesis_id!==undefined)normalized.hypothesis_id=boundedText(candidate.hypothesis_id,'tempo hypothesis id',100);
    if(candidate.ambiguous!==undefined){if(typeof candidate.ambiguous!=='boolean')throw new Error('Invalid tempo ambiguity');normalized.ambiguous=candidate.ambiguous;}
    if(candidate.ambiguity_group!==undefined&&candidate.ambiguity_group!==null)normalized.ambiguity_group=boundedText(candidate.ambiguity_group,'tempo ambiguity group',100);
    if(candidate.support_count!==undefined){if(!Number.isSafeInteger(candidate.support_count)||candidate.support_count<0||candidate.support_count>MAX_EVENTS)throw new Error('Invalid tempo support count');normalized.support_count=candidate.support_count;}
    if(candidate.support_periods!==undefined)normalized.support_periods=number(candidate.support_periods,'tempo support periods',0,100000);
    if(candidate.median_residual_seconds!==undefined)normalized.median_residual_seconds=number(candidate.median_residual_seconds,'tempo residual',0,10);
    return normalized;
  });
  normalizeTimeArray(analysis.transient_onsets??analysis.onsets??[],'transient_onsets',analysisWindow);
  const beatCandidates=normalizeTimeArray(analysis.beat_candidates??[],'beat_candidates',analysisWindow);
  const featureSummaryInput=assertSafeJson(analysis.feature_summary??analysis.featureSummary??{},'feature_summary');
  const {transient_density_per_minute:_transientDensity,...featureSummary}=featureSummaryInput;
  return {analysis_version:analysisVersion,method,analysis_window:analysisWindow,status,bpm,confidence,tempo_candidates:tempoCandidates,
    transient_onsets:[],beat_candidates:beatCandidates,feature_summary:featureSummary};
}
function normalizeModelInterpretation(value,window){
  if(!plainObject(value))throw new Error('model_interpretation must be an object');
  const summary=boundedText(value.summary,'model summary',1200);
  const rhythmCharacter=boundedText(value.rhythm_character,'rhythm character',500);
  const energyArc=boundedText(value.energy_arc,'energy arc',500);
  const suggestions=value.scene_suggestions;
  if(!Array.isArray(suggestions)||suggestions.length>8)throw new Error('Invalid scene_suggestions');
  const sceneSuggestions=suggestions.map(item=>{
    if(!plainObject(item))throw new Error('Invalid scene suggestion');
    const scene=boundedText(item.scene,'scene suggestion',120),reason=boundedText(item.reason,'scene suggestion reason',500);
    const fit=['low','medium','high'].includes(item.fit)?item.fit:'medium';
    return {scene,reason,fit};
  });
  const tempoInputs=value.tempo_hypotheses??[];
  if(!Array.isArray(tempoInputs)||tempoInputs.length>6)throw new Error('Invalid tempo_hypotheses');
  const tempoHypotheses=tempoInputs.map(item=>{
    if(!plainObject(item))throw new Error('Invalid tempo hypothesis');
    return {bpm:number(item.bpm,'model BPM hypothesis',40,240),confidence:['low','medium','high'].includes(item.confidence)?item.confidence:'low',
      reason:boundedText(item.reason,'tempo hypothesis reason',300)};
  });
  const beatInputs=value.beat_time_hypotheses??[];
  if(!Array.isArray(beatInputs)||beatInputs.length>64)throw new Error('Invalid beat_time_hypotheses');
  const rawBeatTimeHypotheses=beatInputs.map(item=>{
    if(!plainObject(item))throw new Error('Invalid model beat hypothesis');
    const fraction=number(item.time_fraction,'model beat fraction',0,1);
    return {time_fraction:fraction,source_seconds:Number((window.start_seconds+fraction*window.duration_seconds).toFixed(1)),
      confidence:['low','medium','high'].includes(item.confidence)?item.confidence:'low',reason:boundedText(item.reason,'model beat reason',300),approximate:true};
  });
  const beatTimeHypotheses=[...new Map(rawBeatTimeHypotheses.map(item=>[item.source_seconds,item])).values()].sort((a,b)=>a.source_seconds-b.source_seconds);
  const styleInputs=value.style_tags??[];
  if(!Array.isArray(styleInputs)||styleInputs.length>20)throw new Error('Invalid model style_tags');
  const styleTags=[...new Set(styleInputs.map(tag=>boundedText(tag,'model style tag',80)))];
  const uncertainties=value.uncertainties??[];
  if(!Array.isArray(uncertainties)||uncertainties.length>8)throw new Error('Invalid interpretation uncertainties');
  return assertSafeJson({summary,rhythm_character:rhythmCharacter,energy_arc:energyArc,scene_suggestions:sceneSuggestions,
    tempo_hypotheses:tempoHypotheses,beat_time_hypotheses:beatTimeHypotheses,style_tags:styleTags,
    uncertainties:uncertainties.map(item=>boundedText(item,'interpretation uncertainty',300))},'model_interpretation');
}
function normalizeModelInterpretationEdits(value,model,window){
  if(!plainObject(value))throw new Error('model_interpretation_edits must be an object');
  const summary=boundedText(value.summary,'edited model summary',1200);
  const rhythmCharacter=boundedText(value.rhythm_character,'edited rhythm character',500);
  const energyArc=boundedText(value.energy_arc,'edited energy arc',500);
  const styleInputs=value.style_tags??[];
  if(!Array.isArray(styleInputs)||styleInputs.length>20)throw new Error('Invalid edited model style_tags');
  const styleTags=[...new Set(styleInputs.map(tag=>boundedText(tag,'edited model style tag',80)))];
  const confirmed=normalizeTimeArray(value.user_confirmed_model_beats??[],'user_confirmed_model_beats',window,{max:64});
  const hints=Array.isArray(model.beat_time_hypotheses)?model.beat_time_hypotheses:[];
  if(confirmed.some(time=>!hints.some(hint=>Math.abs(hint.source_seconds-time)<=0.2)))throw new Error('Confirmed model beat must match a spectrogram hint within 200 ms');
  return assertSafeJson({summary,rhythm_character:rhythmCharacter,energy_arc:energyArc,style_tags:styleTags,
    user_confirmed_model_beats:confirmed},'model_interpretation_edits');
}

function decodeRow(row){
  if(!row)return null;
  const styleSuggestions=parseJson(row.style_suggestions_json,[]),modelInterpretation=parseJson(row.model_interpretation_json,null),modelInterpretationEdits=parseJson(row.model_interpretation_edits_json,null),storedFeatureSummary=parseJson(row.feature_summary_json,{});
  const {transient_density_per_minute:_legacyTransientDensity,...featureSummary}=plainObject(storedFeatureSummary)?storedFeatureSummary:{};

  return {analysis_id:row.analysis_id,music_id:row.music_id,source_identity:parseJson(row.source_identity_json,{}),
    analysis_version:row.analysis_version,method:row.method,analysis_window:{start_seconds:row.window_start_seconds,duration_seconds:row.window_duration_seconds},
    status:row.status,bpm:row.bpm,confidence:row.confidence,tempo_candidates:parseJson(row.tempo_candidates_json,[]),
    beat_candidates:parseJson(row.beat_candidates_json,[]),
    user_confirmed_beats:parseJson(row.user_confirmed_beats_json,[]),feature_summary:featureSummary,
    style_tags:styleSuggestions,style_suggestions:styleSuggestions,style_rationale:row.style_rationale,
    style_provenance:row.style_provenance,model_interpretation:modelInterpretation,model_interpretation_edits:modelInterpretationEdits,model_interpretation_edits_provenance:modelInterpretationEdits?{edited_at:row.model_interpretation_edited_at}:null,
     model_interpretation_provenance:modelInterpretation?{provider:row.model_provider,model:row.model_name,reasoning_effort:row.model_reasoning_effort,analyzed_at:row.model_interpreted_at}:null,beats_confirmed_at:row.beats_confirmed_at,style_confirmed_at:row.style_confirmed_at,
    created_at:row.created_at};
}

/** Versioned analysis metadata for local music. This store never opens or changes source media. */
export class MusicAnalysisStore {
  constructor(videoDb){
    if(!videoDb?.db)throw new Error('An open VideoDatabase is required');
    this.db=videoDb.db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS music_analysis_profiles (
      profile_seq INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id TEXT NOT NULL UNIQUE,
      music_id TEXT NOT NULL,
      source_identity_json TEXT NOT NULL,
      analysis_version TEXT NOT NULL,
      method TEXT NOT NULL,
      window_start_seconds REAL NOT NULL,
      window_duration_seconds REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('ok','low_confidence','silence','no_audio','error')),
      bpm REAL,
      confidence REAL,
      tempo_candidates_json TEXT NOT NULL,
      transient_onsets_json TEXT NOT NULL,
      beat_candidates_json TEXT NOT NULL,
      user_confirmed_beats_json TEXT NOT NULL DEFAULT '[]',
      feature_summary_json TEXT NOT NULL,
      style_suggestions_json TEXT NOT NULL DEFAULT '[]',
      style_rationale TEXT NOT NULL DEFAULT '',
      style_provenance TEXT,
       model_interpretation_json TEXT,
       model_provider TEXT,
       model_name TEXT,
       model_reasoning_effort TEXT,
       model_interpreted_at TEXT,
        model_interpretation_edits_json TEXT,
        model_interpretation_edited_at TEXT,
      beats_confirmed_at TEXT,
      style_confirmed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_music_analysis_latest ON music_analysis_profiles(music_id,profile_seq DESC);
    CREATE INDEX IF NOT EXISTS idx_music_analysis_identity ON music_analysis_profiles(music_id,source_identity_json,profile_seq DESC);`);
    const columns=new Set(this.db.prepare('PRAGMA table_info(music_analysis_profiles)').all().map(row=>row.name));
     for(const [name,type] of [['model_interpretation_json','TEXT'],['model_provider','TEXT'],['model_name','TEXT'],['model_reasoning_effort','TEXT'],['model_interpreted_at','TEXT'],['model_interpretation_edits_json','TEXT'],['model_interpretation_edited_at','TEXT']])if(!columns.has(name))this.db.exec(`ALTER TABLE music_analysis_profiles ADD COLUMN ${name} ${type}`);
      if(columns.has('transient_onsets_json'))this.db.exec("UPDATE music_analysis_profiles SET transient_onsets_json='[]' WHERE transient_onsets_json!='[]'");
   }
   save(musicId,sourceIdentity,analysis){
    assertId(musicId,MUSIC_ID,'music ID');
    const identity=normalizeSourceIdentity(sourceIdentity),normalized=normalizeAnalysis(analysis),now=new Date().toISOString();
    const analysisId=`ma_${crypto.randomUUID().replace(/-/g,'')}`;
    this.db.prepare(`INSERT INTO music_analysis_profiles
      (analysis_id,music_id,source_identity_json,analysis_version,method,window_start_seconds,window_duration_seconds,status,bpm,confidence,
       tempo_candidates_json,transient_onsets_json,beat_candidates_json,user_confirmed_beats_json,feature_summary_json,style_suggestions_json,style_rationale,style_provenance,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(analysisId,musicId,JSON.stringify(identity),normalized.analysis_version,normalized.method,
        normalized.analysis_window.start_seconds,normalized.analysis_window.duration_seconds,normalized.status,normalized.bpm,normalized.confidence,
        JSON.stringify(normalized.tempo_candidates),JSON.stringify(normalized.transient_onsets),JSON.stringify(normalized.beat_candidates),'[]',
        JSON.stringify(normalized.feature_summary),'[]','',null,now);
    return decodeRow(this.db.prepare('SELECT * FROM music_analysis_profiles WHERE analysis_id=?').get(analysisId));
  }
  saveModelInterpretation(analysisId,sourceIdentity,interpretation,provenance={}){
    assertId(analysisId,ANALYSIS_ID,'analysis ID');
    const identity=normalizeSourceIdentity(sourceIdentity),row=this.db.prepare('SELECT analysis_id,source_identity_json,window_start_seconds,window_duration_seconds FROM music_analysis_profiles WHERE analysis_id=?').get(analysisId);
    if(!row)throw new Error('Music analysis profile not found');
    if(JSON.stringify(identity)!==row.source_identity_json)throw new Error('Music analysis profile is stale for this source identity');
    if(!plainObject(provenance))throw new Error('Invalid model provenance');
    const normalized=normalizeModelInterpretation(interpretation,{start_seconds:row.window_start_seconds,duration_seconds:row.window_duration_seconds});
    const provider=boundedText(provenance.provider??'unknown','model provider',120);
    const model=boundedText(provenance.model??'unknown','model name',200);
    const effort=provenance.reasoning_effort==null?null:boundedText(provenance.reasoning_effort,'reasoning effort',80);
    const now=new Date().toISOString();
    this.db.prepare(`UPDATE music_analysis_profiles SET model_interpretation_json=?,model_provider=?,model_name=?,model_reasoning_effort=?,model_interpreted_at=?,model_interpretation_edits_json=NULL,model_interpretation_edited_at=NULL WHERE analysis_id=?`)
      .run(JSON.stringify(normalized),provider,model,effort,now,analysisId);
    return this.get(analysisId);
  }
  saveModelInterpretationEdits(analysisId,sourceIdentity,edits){
    assertId(analysisId,ANALYSIS_ID,'analysis ID');
    const identity=normalizeSourceIdentity(sourceIdentity),row=this.db.prepare('SELECT * FROM music_analysis_profiles WHERE analysis_id=?').get(analysisId);
    if(!row)throw new Error('Music analysis profile not found');
    if(JSON.stringify(identity)!==row.source_identity_json)throw new Error('Music analysis profile is stale for this source identity');
    const model=parseJson(row.model_interpretation_json,null);
    if(!model)throw new Error('Spectrogram model interpretation not found');
    const window={start_seconds:row.window_start_seconds,duration_seconds:row.window_duration_seconds};
    const normalized=normalizeModelInterpretationEdits(edits,model,window),now=new Date().toISOString();
    this.db.prepare('UPDATE music_analysis_profiles SET model_interpretation_edits_json=?,model_interpretation_edited_at=? WHERE analysis_id=? AND source_identity_json=?')
      .run(JSON.stringify(normalized),now,analysisId,row.source_identity_json);
    return this.get(analysisId);
  }
  latest(musicId,sourceIdentity){
    assertId(musicId,MUSIC_ID,'music ID');
    const identity=normalizeSourceIdentity(sourceIdentity),identityJson=JSON.stringify(identity);
    const matching=this.db.prepare('SELECT * FROM music_analysis_profiles WHERE music_id=? AND source_identity_json=? ORDER BY profile_seq DESC LIMIT 1').get(musicId,identityJson);
    if(matching)return decodeRow(matching);
    const newest=this.db.prepare('SELECT analysis_id,analysis_version,method,created_at FROM music_analysis_profiles WHERE music_id=? ORDER BY profile_seq DESC LIMIT 1').get(musicId);
    return newest?{status:'stale',analysis_id:newest.analysis_id,analysis_version:newest.analysis_version,method:newest.method,created_at:newest.created_at}:null;
  }
  get(analysisId){
    assertId(analysisId,ANALYSIS_ID,'analysis ID');
    return decodeRow(this.db.prepare('SELECT * FROM music_analysis_profiles WHERE analysis_id=?').get(analysisId));
  }
  removeForMusic(musicId){
    assertId(musicId,MUSIC_ID,'music ID');
    return this.db.prepare('DELETE FROM music_analysis_profiles WHERE music_id=?').run(musicId).changes;
  }
  confirmBeats(analysisId,sourceIdentity,beats,{confirmed}={}){
    assertId(analysisId,ANALYSIS_ID,'analysis ID');
    if(confirmed!==true)throw new Error('User confirmation is required to confirm beat candidates');
    const row=this.db.prepare('SELECT * FROM music_analysis_profiles WHERE analysis_id=?').get(analysisId);
    if(!row)throw new Error('Music analysis profile not found');
    const identity=normalizeSourceIdentity(sourceIdentity);
    if(JSON.stringify(identity)!==row.source_identity_json)throw new Error('Music analysis profile is stale for this source identity');
    const window={start_seconds:row.window_start_seconds,duration_seconds:row.window_duration_seconds};
    const confirmedBeats=normalizeTimeArray(beats,'user_confirmed_beats',window,{allowEmpty:false});
    const candidates=parseJson(row.beat_candidates_json,[]);
    if(!candidates.length)throw new Error('No beat candidates are available to confirm');
    if(confirmedBeats.some(beat=>!candidates.some(candidate=>Math.abs(candidate-beat)<=BEAT_CANDIDATE_TOLERANCE_SECONDS)))
      throw new Error('Every confirmed beat must match a measured beat candidate within 50 ms');
    const now=new Date().toISOString();
    this.db.prepare('UPDATE music_analysis_profiles SET user_confirmed_beats_json=?,beats_confirmed_at=? WHERE analysis_id=?')
      .run(JSON.stringify(confirmedBeats),now,analysisId);
    return this.get(analysisId);
  }
  saveStyleSuggestions(analysisId,tags,rationale,{confirmed}={}){
    assertId(analysisId,ANALYSIS_ID,'analysis ID');
    if(confirmed!==true)throw new Error('User confirmation is required to store Agent style suggestions');
    if(!Array.isArray(tags)||tags.length<1||tags.length>30)throw new Error('tags must contain 1–30 style suggestions');
    const normalizedTags=tags.map(tag=>boundedText(tag,'style tag',100));
    if(new Set(normalizedTags).size!==normalizedTags.length)throw new Error('style tags must be unique');
    const safeRationale=boundedText(rationale,'style rationale',2000);
    const row=this.db.prepare('SELECT analysis_id FROM music_analysis_profiles WHERE analysis_id=?').get(analysisId);
    if(!row)throw new Error('Music analysis profile not found');
    const now=new Date().toISOString();
    this.db.prepare(`UPDATE music_analysis_profiles SET style_suggestions_json=?,style_rationale=?,style_provenance=?,style_confirmed_at=? WHERE analysis_id=?`)
      .run(JSON.stringify(normalizedTags),safeRationale,'dsh-agent-user-approved',now,analysisId);
    return this.get(analysisId);
  }
  analysisSummary(analysisId){
    const profile=this.get(analysisId);
    if(!profile)return null;
    return {analysis_id:profile.analysis_id,music_id:profile.music_id,analysis_version:profile.analysis_version,method:profile.method,
      analysis_window:profile.analysis_window,status:profile.status,bpm:profile.bpm,confidence:profile.confidence,
      tempo_candidate_count:profile.tempo_candidates.length,tempo_candidates:profile.tempo_candidates.slice(0,4),
      beat_candidate_count:profile.beat_candidates.length,confirmed_beat_count:profile.user_confirmed_beats.length,
      style_tags:profile.style_suggestions,style_provenance:profile.style_provenance,created_at:profile.created_at};
  }
}
