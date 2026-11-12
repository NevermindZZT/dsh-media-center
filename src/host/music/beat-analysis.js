import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { stat } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const SAMPLE_RATE = 11025;
const HOP = 110; // Approximately 10 ms per energy frame.
const METHOD = 'pcm-energy-onsets-autocorrelation-v1';

function empty(status, extra = {}) {
  return { status, source: 'measured', method: METHOD, bpm: null, confidence: null,
    onsets: [], beats: [], tempo_candidates: [], ...extra };
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
  if (samples.length > sampleRate * 180) throw new Error('PCM input exceeds 180 seconds');
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
  if (!energies.length || Math.sqrt(total / Math.max(1, energies.length * hop)) < 0.0001) return empty('silence', { analysis_window: window });
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
  if (onsets.length < 4 || samples.length / sampleRate < 3) return empty('low_confidence', { onsets, beats: [], analysis_window: window });
  // Score real observed onset pairs at all separations, rather than inventing
  // phase/beat locations. A weak metrical prior resolves exact half/double ties,
  // while alternative candidates remain visible to the caller.
  const scores = [];
  for (let bpm = 60; bpm <= 200; bpm++) {
    const period = 60 / bpm;
    let score = 0, weight = 0;
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length && j <= i + 8; j++) {
        const delta = candidates[j].time - candidates[i].time;
        if (delta > 4) break;
        const multiple = Math.max(1, Math.round(delta / period));
        if (multiple > 6) continue;
        const distance = Math.abs(delta - multiple * period);
        const w = 1 / Math.sqrt(multiple);
        score += w * Math.exp(-0.5 * (distance / 0.035) ** 2); weight += w;
      }
    }
    const fit = weight ? score / weight : 0;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 115) / 1.05) ** 2);
    scores.push({ bpm, score: fit * (0.94 + 0.06 * prior), fit });
  }
  scores.sort((a,b) => b.score - a.score);
  const best = scores[0];
  const alternatives = [];
  for (const item of scores) {
    if (item.score < best.score * 0.78) break;
    if (alternatives.every(other => Math.abs(Math.log2(item.bpm / other.bpm)) > 0.09)) alternatives.push(item);
    if (alternatives.length >= 4) break;
  }
  const confidence = Math.max(0, Math.min(1, best.fit * Math.min(1, onsets.length / 8)));
  return { status: confidence >= 0.55 ? 'ok' : 'low_confidence', source:'measured', method:METHOD,
    bpm: best.bpm, confidence: Number(confidence.toFixed(3)), onsets, beats: [],
    tempo_candidates: alternatives.map(item => ({ bpm:item.bpm, score:Number(item.score.toFixed(3)) })),
    note: 'BPM 为估算，候选拍点为实际检测的瞬态，不保证每个瞬态都是拍点；可能存在半速/倍速歧义。', analysis_window:window };
}

/**
 * Read-only FFprobe + bounded FFmpeg decode. Never modifies or removes input.
 * Defaults to first 60 seconds; duration is capped at 180 seconds.
 * Status: ok, low_confidence, silence, no_audio, or error; errors return no fake tempo.
 * Audio timestamps are source-relative seconds. Empty/no audio is distinguished
 * from tool, timeout and cancellation failures by `error_code`.
 */
export async function analyzeMusicBeats({ filePath, ffmpeg, ffprobe, startSeconds = 0, durationSeconds = 60, signal } = {}) {
  if (typeof filePath !== 'string' || !filePath.trim() || !path.isAbsolute(filePath) || typeof ffmpeg !== 'string' || !ffmpeg.trim() ||
      typeof ffprobe !== 'string' || !ffprobe.trim() || !Number.isFinite(startSeconds) || startSeconds < 0 ||
      !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 180) {
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
