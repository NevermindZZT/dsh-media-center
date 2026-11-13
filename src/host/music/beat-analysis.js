import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { stat } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const SAMPLE_RATE = 11025;
export const MAX_MUSIC_ANALYSIS_SECONDS = 600;
const HOP = 110; // Approximately 10 ms per energy frame.
const METHOD = 'pcm-energy-onsets-interval-hypotheses-v2';
const MAX_BEAT_CANDIDATES = 512;
const TEMPO_CLUSTER_LOG_TOLERANCE = Math.log(1.02);
const MIN_CONFIRMED_EVIDENCE_ONSETS = 6;
function summarizeEnergy(energies,onsets,duration){
  if(!energies.length)return {mean_rms:0,p10_rms:0,p90_rms:0,dynamic_range_db:null,transient_density_per_minute:0};
  const sorted=[...energies].sort((a,b)=>a-b),mean=energies.reduce((sum,value)=>sum+value,0)/energies.length;
  const p10=sorted[Math.floor((sorted.length-1)*0.1)]||0,p90=sorted[Math.floor((sorted.length-1)*0.9)]||0;
  const rangeDb=p10>1e-8?20*Math.log10(p90/p10):null;
  return {mean_rms:Number(mean.toFixed(5)),p10_rms:Number(p10.toFixed(5)),p90_rms:Number(p90.toFixed(5)),
    dynamic_range_db:rangeDb===null?null:Number(rangeDb.toFixed(2)),transient_density_per_minute:Number((onsets.length/Math.max(duration/60,1e-6)).toFixed(2))};
}

function tempoHypotheses(onsets) {
  const seeds=[];
  for(let i=0;i<onsets.length;i++){
    for(let j=i+1;j<onsets.length;j++){
      const delta=onsets[j]-onsets[i];
      if(delta>8)break;
      for(let periods=1;periods<=8;periods++){
        const bpm=60*periods/delta;
        if(bpm>=60&&bpm<=200)seeds.push(Math.log(bpm));
      }
    }
  }
  seeds.sort((a,b)=>a-b);
  const clusters=[];
  for(let i=0;i<seeds.length;){
    let end=i+1,sum=seeds[i];
    while(end<seeds.length&&seeds[end]-seeds[i]<=TEMPO_CLUSTER_LOG_TOLERANCE){sum+=seeds[end++];}
    if(end-i>=3)clusters.push({bpm:Math.exp(sum/(end-i)),votes:end-i});
    i=end;
  }
  clusters.sort((a,b)=>a.bpm-b.bpm);
  const merged=[];
  for(const cluster of clusters){
    const previous=merged[merged.length-1];
    if(previous&&Math.abs(Math.log(cluster.bpm/previous.bpm))<=TEMPO_CLUSTER_LOG_TOLERANCE){
      const votes=previous.votes+cluster.votes;
      previous.bpm=Math.exp((Math.log(previous.bpm)*previous.votes+Math.log(cluster.bpm)*cluster.votes)/votes);
      previous.votes=votes;
    }else merged.push({...cluster});
  }
  return merged.sort((a,b)=>b.votes-a.votes).slice(0,48);
}

function fitTempoHypothesis(onsets,{bpm,votes}){
  const period=60/bpm;
  const tolerance=Math.max(0.018,period*0.045);
  const bins=Math.max(24,Math.min(128,Math.ceil(period/Math.max(0.006,tolerance/2))));
  let best=null;
  for(let bin=0;bin<bins;bin++){
    const phase=bin*period/bins,indices=[],residuals=[];
    for(let i=0;i<onsets.length;i++){
      const phaseTime=((onsets[i]%period)+period)%period;
      const diff=Math.abs(phaseTime-phase),residual=Math.min(diff,period-diff);
      if(residual<=tolerance){indices.push(i);residuals.push(residual);}
    }
    if(indices.length<MIN_CONFIRMED_EVIDENCE_ONSETS)continue;
    residuals.sort((a,b)=>a-b);
    const medianResidual=residuals[Math.floor(residuals.length/2)];
    const spanPeriods=indices.length>1?(onsets[indices.at(-1)]-onsets[indices[0]])/period:0;
    if(!best||indices.length>best.indices.length||
      (indices.length===best.indices.length&&medianResidual<best.medianResidual)){
      best={indices,medianResidual,spanPeriods};
    }
  }
  if(!best)return null;
  const supportRatio=best.indices.length/onsets.length;
  const countFactor=Math.min(1,best.indices.length/8);
  const spanFactor=Math.min(1,best.spanPeriods/6);
  const regularity=Math.exp(-best.medianResidual/Math.max(0.006,tolerance*1.5));
  const confidence=Math.max(0,Math.min(1,Math.min(1,supportRatio*1.5)*countFactor*spanFactor*regularity));
  return {bpm,votes,period,tolerance,indices:best.indices,support_count:best.indices.length,
    support_periods:Number(best.spanPeriods.toFixed(2)),median_residual_seconds:Number(best.medianResidual.toFixed(4)),
    confidence:Number(confidence.toFixed(3))};
}

function halfDoubleRelated(a,b){
  const ratio=Math.max(a.bpm,b.bpm)/Math.min(a.bpm,b.bpm);
  return Math.abs(ratio-2)/2<=0.05;
}


function empty(status, extra = {}) {
  return { status, source: 'measured', method: METHOD, bpm: null, confidence: null,
    onsets: [], beats: [], beat_candidates: [], tempo_candidates: [], feature_summary:{}, ...extra };
}

/**
 * Analyze a mono Float32 PCM segment. Onsets/beat candidates are measured peak times,
 * never generated on a synthetic tempo grid. BPM is only an estimate: half/double
 * ambiguity is represented explicitly in tempo_candidates.
 * @param {Float32Array} samples mono PCM [-1,1]
 * @param {{sampleRate?:number,startSeconds?:number}} options
 */
export function analyzePcmBeats(samples, { sampleRate = SAMPLE_RATE, startSeconds = 0 } = {}) {
  if (!(samples instanceof Float32Array) || !Number.isFinite(sampleRate) || sampleRate <= 0 ||
      !Number.isFinite(startSeconds) || startSeconds < 0) throw new Error('Invalid PCM input');
  if (samples.length > sampleRate * MAX_MUSIC_ANALYSIS_SECONDS) throw new Error(`PCM input exceeds ${MAX_MUSIC_ANALYSIS_SECONDS} seconds`);
  const hop = Math.max(1, Math.round(sampleRate * HOP / SAMPLE_RATE));
  const energies = [];
  let total = 0;
  for (let offset = 0; offset + hop <= samples.length; offset += hop) {
    let sum = 0;
    for (let i = offset; i < offset + hop; i++) {
      const sample = samples[i];
      if (!Number.isFinite(sample)) throw new Error('Non-finite PCM sample');
      sum += sample * sample;
    }
    const energy = Math.sqrt(sum / hop);
    energies.push(energy); total += sum;
  }
  const window = { start_seconds: startSeconds, duration_seconds: samples.length / sampleRate };
  if (!energies.length || Math.sqrt(total / Math.max(1, energies.length * hop)) < 0.0001) return empty('silence', { analysis_window: window, feature_summary:summarizeEnergy(energies,[],window.duration_seconds) });
  // Rising energy identifies transient onsets. Remove slow loudness changes using
  // a local baseline; keep peaks at least 120ms apart to avoid double counting.
  const flux = energies.map((e, i) => Math.max(0, e - (energies[i - 1] || 0)));
  const candidates = [];
  const radius = Math.max(2, Math.round(0.25 * sampleRate / hop));
  const absoluteFloor = Math.max(...flux) * 0.035;
  for (let i = 1; i < flux.length - 1; i++) {
    let local = 0, count = 0;
    for (let j = Math.max(0, i - radius); j < i; j++) { local += flux[j]; count++; }
    const threshold = Math.max(absoluteFloor, count ? local / count * 2 : 0);
    if (flux[i] > threshold && flux[i] >= flux[i - 1] && flux[i] > flux[i + 1]) {
      const time = startSeconds + i * hop / sampleRate;
      const last = candidates[candidates.length - 1];
      if (last && time - last.time < 0.12) { if (flux[i] > last.strength) candidates[candidates.length - 1] = { time, strength: flux[i] }; }
      else candidates.push({ time, strength: flux[i] });
    }
  }
  const onsets = candidates.map(p => Number(p.time.toFixed(4)));
  if (onsets.length < 4 || samples.length / sampleRate < 3) return empty('low_confidence', { onsets, beats: [], analysis_window: window, feature_summary:summarizeEnergy(energies,onsets,window.duration_seconds) });

  const hypotheses=tempoHypotheses(onsets).map(item=>fitTempoHypothesis(onsets,item)).filter(item=>
    item&&item.support_count>=MIN_CONFIRMED_EVIDENCE_ONSETS&&item.support_periods>=4&&item.median_residual_seconds<=item.tolerance&&item.confidence>=0.35);
  hypotheses.sort((a,b)=>b.confidence-a.confidence||b.votes-a.votes);
  const best=hypotheses[0]||null,runnerUp=hypotheses[1]||null;
  const halfDoublePeers=best?hypotheses.filter(item=>item!==best&&halfDoubleRelated(best,item)):[];
  const runnerUpClose=!!(best&&runnerUp&&best.confidence-runnerUp.confidence<0.15&&runnerUp.confidence>=0.5);
  const ambiguity=!!best&&(halfDoublePeers.length>0||runnerUpClose);
  const runnerUpConfidence=runnerUp?.confidence??0;
  const separation=best?Math.max(0,(best.confidence-runnerUpConfidence)/Math.max(best.confidence,1e-9)):0;
  const confidence=best?Number((best.confidence*separation).toFixed(3)):null;
  const hasUniqueWinner=!!best&&best.confidence>=0.75&&!ambiguity&&confidence>=0.75;
  const ambiguityMembers=new Set(ambiguity?[best,...halfDoublePeers,...(runnerUpClose&&runnerUp!==best?[runnerUp]:[])]:[]);
  const ambiguityGroup=ambiguityMembers.size?`tempo_${Math.round(Math.min(...[...ambiguityMembers].map(x=>x.bpm))*10)}_${Math.round(Math.max(...[...ambiguityMembers].map(x=>x.bpm))*10)}`:null;
  const displayed=[];
  for(const item of [...ambiguityMembers,...hypotheses.filter(x=>x.confidence>=0.65)]){if(displayed.length>=4)break;if(!displayed.includes(item))displayed.push(item);}
  const tempo_candidates=displayed.map(item=>({
    hypothesis_id:`tempo_${Math.round(item.bpm*10)}`,bpm:Number(item.bpm.toFixed(1)),confidence:item.confidence,
    support_count:item.support_count,support_periods:item.support_periods,median_residual_seconds:item.median_residual_seconds,
    ambiguous:ambiguityMembers.has(item),ambiguity_group:ambiguityMembers.has(item)?ambiguityGroup:null
  }));
  const beat_candidates=[];
  if(best&&best.confidence>=0.75&&(hasUniqueWinner||ambiguity)&&best.support_periods>=4&&best.support_count>=MIN_CONFIRMED_EVIDENCE_ONSETS){
    for(const onset_index of best.indices){
      if(beat_candidates.length>=MAX_BEAT_CANDIDATES)break;
      beat_candidates.push({source_seconds:onsets[onset_index],onset_index,hypothesis_id:`tempo_${Math.round(best.bpm*10)}`,
        tempo_bpm:Number(best.bpm.toFixed(1)),confidence:best.confidence,source:'observed_onset',ambiguous:!hasUniqueWinner});
    }
  }
  return {status:hasUniqueWinner?'ok':'low_confidence',source:'measured',method:METHOD,
    bpm:hasUniqueWinner?Number(best.bpm.toFixed(1)):null,confidence,onsets,beats:[],beat_candidates,tempo_candidates,
    note:!hasUniqueWinner?'未选出足够可靠的唯一 BPM；所有 beat_candidates 仅是实测 onset 事件，需试听确认。':'BPM 仅在证据充分且与竞争假设有足够区分时给出；beat_candidates 只引用实测 onset，不保证是真正拍点。',
    feature_summary:summarizeEnergy(energies,onsets,window.duration_seconds),analysis_window:window};
}

/**
 * Read-only FFprobe + bounded FFmpeg decode. Never modifies or removes input.
 * Defaults to first 60 seconds; duration is capped at `MAX_MUSIC_ANALYSIS_SECONDS` (600 seconds).
 * Status: ok, low_confidence, silence, no_audio, or error; errors return no fake tempo.
 * Audio timestamps are source-relative seconds. Empty/no audio is distinguished
 * from tool, timeout and cancellation failures by `error_code`.
 */
export async function analyzeMusicBeats({ filePath, ffmpeg, ffprobe, startSeconds = 0, durationSeconds = 60, signal } = {}) {
  if (typeof filePath !== 'string' || !filePath.trim() || !path.isAbsolute(filePath) || typeof ffmpeg !== 'string' || !ffmpeg.trim() ||
      typeof ffprobe !== 'string' || !ffprobe.trim() || !Number.isFinite(startSeconds) || startSeconds < 0 ||
      !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_MUSIC_ANALYSIS_SECONDS) {
    throw new Error('Invalid audio analysis arguments');
  }
  const analysis_window = { start_seconds:startSeconds, duration_seconds:durationSeconds };
  if (signal?.aborted) return empty('error', { error_code:'ABORTED', analysis_window });
  try {
    const file = await stat(filePath);
    if (!file.isFile()) return empty('error', { error_code:'SOURCE_UNAVAILABLE', analysis_window });
  } catch {
    return empty('error', { error_code:'SOURCE_UNAVAILABLE', analysis_window });
  }
  try {
    const probe = await execFileAsync(ffprobe, ['-v','error','-select_streams','a:0','-show_entries','stream=codec_type','-of','json',filePath],
      { encoding:'utf8', timeout:15000, maxBuffer:256*1024, signal, windowsHide:true });
    const metadata = JSON.parse(probe.stdout);
    if (!Array.isArray(metadata.streams) || !metadata.streams.some(s => s.codec_type === 'audio')) return empty('no_audio', { analysis_window });
  } catch (error) {
    return empty('error', { error_code:signal?.aborted ? 'ABORTED' : error?.killed ? 'PROBE_TIMEOUT' : 'PROBE_FAILED', analysis_window });
  }
  try {
    const maxBytes = Math.ceil(durationSeconds * SAMPLE_RATE * 4) + 65536;
    const decoded = await execFileAsync(ffmpeg, ['-v','error','-nostdin','-ss',String(startSeconds),'-i',filePath,
      '-t',String(durationSeconds),'-map','0:a:0','-ac','1','-ar',String(SAMPLE_RATE),'-f','f32le','pipe:1'],
      { encoding:'buffer', timeout:120000, maxBuffer:maxBytes, signal, windowsHide:true });
    const bytes = decoded.stdout;
    if (!bytes.length) return empty('low_confidence', { error_code:'EMPTY_WINDOW', analysis_window });
    const samples = new Float32Array(Math.floor(bytes.length / 4));
    for (let i=0; i<samples.length; i++) samples[i] = bytes.readFloatLE(i*4);
    return analyzePcmBeats(samples, { sampleRate:SAMPLE_RATE, startSeconds });
  } catch (error) {
    return empty('error', { error_code:signal?.aborted ? 'ABORTED' : error?.killed ? 'DECODE_TIMEOUT' : 'DECODE_FAILED', analysis_window });
  }
}
