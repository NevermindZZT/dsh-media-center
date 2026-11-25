import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { stat } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
export const MUSIC_ANALYSIS_VERSION = '2';
export const MAX_MUSIC_ANALYSIS_SECONDS = 600;
export const FEATURE_FPS = 20;
export const FEATURE_BANDS = 64;
export const WAVEFORM_BUCKETS = 3000;
const SAMPLE_RATE = 22050;
const FFT_SIZE = 1024;
const HOP_SIZE = 512;
const MIN_SECTION_SECONDS = 4;
const MAX_SECTIONS = 8;
const MIN_ONSET_GAP_SECONDS = 0.08;
const MAX_CUT_CANDIDATES = 6000;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wr = Math.cos(angle), wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr;
        im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr;
        im[i + j + len / 2] = ui - vi;
        const nextCr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nextCr;
      }
    }
  }
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function std(values, average = mean(values)) {
  return values.length ? Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length) : 0;
}
function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))];
}
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function round(value, digits = 3) {
  return Number(Number(value).toFixed(digits));
}

function frameFeatures(samples, sampleRate) {
  const bands = new Float64Array(FEATURE_BANDS);
  const edges = new Float64Array(FEATURE_BANDS + 1);
  for (let i = 0; i <= FEATURE_BANDS; i++) edges[i] = 40 * (10000 / 40) ** (i / FEATURE_BANDS);
  const bandBins = [];
  for (let i = 0; i < FEATURE_BANDS; i++) {
    const start = Math.max(1, Math.floor(edges[i] * FFT_SIZE / sampleRate));
    const end = Math.max(start, Math.min(FFT_SIZE / 2 - 1, Math.ceil(edges[i + 1] * FFT_SIZE / sampleRate)));
    bandBins.push([start, end]);
  }
  const count = Math.max(0, Math.floor((samples.length - FFT_SIZE) / HOP_SIZE) + 1);
  const flux = new Float32Array(count);
  const rms = new Float32Array(count);
  const centroid = new Float32Array(count);
  const low = new Float32Array(count);
  const mid = new Float32Array(count);
  const high = new Float32Array(count);
  const bandDb = new Float32Array(count * FEATURE_BANDS);
  const re = new Float64Array(FFT_SIZE), im = new Float64Array(FFT_SIZE);
  let previous = null;
  for (let frame = 0; frame < count; frame++) {
    let energy = 0;
    for (let i = 0; i < FFT_SIZE; i++) {
      const value = samples[frame * HOP_SIZE + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
      re[i] = value;
      im[i] = 0;
      energy += value * value;
    }
    fft(re, im);
    let fluxValue = 0, weighted = 0, lowValue = 0, midValue = 0, highValue = 0;
    for (let b = 0; b < FEATURE_BANDS; b++) {
      let sum = 0;
      for (let k = bandBins[b][0]; k <= bandBins[b][1]; k++) sum += re[k] * re[k] + im[k] * im[k];
      const magnitude = Math.log10(Math.sqrt(sum / (bandBins[b][1] - bandBins[b][0] + 1)) + 1e-9);
      bands[b] = magnitude;
      bandDb[frame * FEATURE_BANDS + b] = magnitude;
      if (previous) {
        const diff = Math.max(0, magnitude - previous[b]);
        fluxValue += diff;
        const hz = (edges[b] + edges[b + 1]) / 2;
        weighted += diff * hz;
        if (hz < 250) lowValue += diff;
        else if (hz < 2000) midValue += diff;
        else highValue += diff;
      }
    }
    previous = Float32Array.from(bands);
    flux[frame] = fluxValue;
    rms[frame] = Math.sqrt(energy / FFT_SIZE);
    centroid[frame] = fluxValue > 1e-9 ? weighted / fluxValue : 0;
    low[frame] = lowValue;
    mid[frame] = midValue;
    high[frame] = highValue;
  }
  return { count, bandDb, flux, rms, centroid, low, mid, high, frameRate: sampleRate / HOP_SIZE, bands: FEATURE_BANDS };
}

function detectOnsets(features) {
  const env = new Float32Array(features.count);
  for (let i = 0; i < features.count; i++) {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - 1); j <= Math.min(features.count - 1, i + 1); j++) {
      sum += features.flux[j]; n++;
    }
    env[i] = sum / n;
  }
  const average = mean(env), deviation = std(env, average);
  const window = Math.max(2, Math.round(0.35 * features.frameRate));
  const onsets = [];
  for (let i = 2; i < features.count - 2; i++) {
    let local = 0, n = 0;
    for (let j = Math.max(0, i - window); j < i; j++) { local += env[j]; n++; }
    const threshold = Math.max(average * 0.45, deviation * 0.35, n ? local / n * 1.35 : 0);
    if (env[i] <= threshold || env[i] < env[i - 1] || env[i] <= env[i + 1]) continue;
    const time = i / features.frameRate;
    const last = onsets[onsets.length - 1];
    if (last && time - last.time < MIN_ONSET_GAP_SECONDS) {
      if (env[i] > last.strength) { last.time = time; last.strength = env[i]; last.frame = i; }
    } else {
      onsets.push({ time, strength: env[i], frame: i });
    }
  }
  const peak = percentile(onsets.map(item => item.strength), 0.95) || 1;
  return { envelope: env, onsets: onsets.map(item => ({ time: round(item.time, 4), strength: round(clamp01(item.strength / peak), 3), frame: item.frame })) };
}

function tempoCandidates(features, fromSeconds, toSeconds) {
  const start = Math.max(0, Math.floor(fromSeconds * features.frameRate));
  const end = Math.min(features.count, Math.ceil(toSeconds * features.frameRate));
  const length = end - start;
  if (length < 12) return [];
  const segment = new Float32Array(length);
  let average = 0;
  for (let i = 0; i < length; i++) average += features.envelope[start + i];
  average /= length;
  for (let i = 0; i < length; i++) segment[i] = features.envelope[start + i] - average;
  const candidates = [];
  const minLag = Math.max(3, Math.round(features.frameRate * 60 / 200));
  const maxLag = Math.min(length - 2, Math.round(features.frameRate * 60 / 45));
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0, count = 0;
    for (let i = 0; i + lag < length; i++) { sum += segment[i] * segment[i + lag]; count++; }
    const bpm = 60 * features.frameRate / lag;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 100) / 0.5) ** 2);
    candidates.push({ bpm, lag, score: count ? sum / count * prior : 0 });
  }
  candidates.sort((a, b) => b.score - a.score);
  const picked = [];
  for (const candidate of candidates) {
    if (picked.every(item => Math.abs(Math.log2(candidate.bpm / item.bpm)) > 0.035)) picked.push(candidate);
    if (picked.length >= 6) break;
  }
  return picked.map(item => ({ bpm: round(item.bpm, 1), lag: item.lag, score: round(item.score, 4) }));
}

function preferTempoOctave(candidates) {
  if (!candidates.length) return candidates;
  let primary = candidates[0];
  for (const candidate of candidates.slice(1)) {
    const ratio = primary.bpm / candidate.bpm;
    if (ratio >= 1.8 && ratio <= 2.2 && candidate.score >= primary.score * 0.55) primary = candidate;
  }
  return [primary, ...candidates.filter(item => item !== primary)];
}

function alignTempoToGlobal(tempo, global) {
  if (!tempo || !global) return tempo;
  let best = tempo;
  let bestDistance = Math.abs(Math.log2(tempo.bpm / global.bpm));
  for (const shift of [-2, -1, 1, 2]) {
    const bpm = tempo.bpm * 2 ** shift;
    const distance = Math.abs(Math.log2(bpm / global.bpm));
    if (bpm >= 45 && bpm <= 220 && distance < bestDistance) {
      best = { ...tempo, bpm: round(bpm, 1) };
      bestDistance = distance;
    }
  }
  return bestDistance <= 0.22 ? best : tempo;
}

function beatGrid(features, start, end, tempo) {
  if (!tempo) return { times: [], strengths: [], quarterTimes: [], quarterStrengths: [], period: 0, confidence: 0 };
  const period = 60 / tempo.bpm;
  const framesPerPeriod = period * features.frameRate;
  const startFrame = Math.max(0, Math.floor(start * features.frameRate));
  const endFrame = Math.min(features.count, Math.ceil(end * features.frameRate));
  let best = null;
  const phaseSteps = Math.min(256, Math.max(16, Math.round(framesPerPeriod)));
  for (let step = 0; step < phaseSteps; step++) {
    const offset = step * framesPerPeriod / phaseSteps;
    let score = 0, count = 0;
    for (let frame = startFrame + offset; frame < endFrame; frame += framesPerPeriod) {
      const index = Math.round(frame);
      if (index < 0 || index >= features.count) continue;
      score += features.envelope[index] + 0.4 * (features.envelope[index - 1] || 0) + 0.4 * (features.envelope[index + 1] || 0);
      count++;
    }
    if (!count) continue;
    const normalized = score / count;
    if (!best || normalized > best.score) best = { offset, score: normalized };
  }
  if (!best) return { times: [], strengths: [], quarterTimes: [], quarterStrengths: [], period, confidence: 0 };
  const times = [], strengths = [];
  const peak = percentile([...features.envelope], 0.95) || 1;
  for (let frame = startFrame + best.offset; frame < endFrame; frame += framesPerPeriod) {
    const index = Math.round(frame);
    if (index < 0 || index >= features.count) continue;
    times.push(round(index / features.frameRate, 4));
    strengths.push(round(clamp01(features.envelope[index] / peak), 3));
  }
  const quarterTimes = [], quarterStrengths = [];
  for (let i = 0; i < times.length; i++) {
    for (let subdivision = 0; subdivision < 4; subdivision++) {
      const time = times[i] + subdivision * period / 4;
      if (time >= end) continue;
      const index = Math.min(features.count - 1, Math.max(0, Math.round(time * features.frameRate)));
      quarterTimes.push(round(time, 4));
      quarterStrengths.push(round(clamp01(features.envelope[index] / peak), 3));
    }
  }
  const confidence = clamp01(best.score / (peak * 1.4));
  return { times, strengths, quarterTimes, quarterStrengths, period, confidence };
}

function sectionLabel({ energy, density, nextEnergy }) {
  if (energy === 'high' && density === 'high') return '高能快节奏';
  if (energy === 'low' && density === 'low') return '慢速/舒展';
  if (energy === 'low' && nextEnergy === 'high') return '铺垫/渐强';
  if (energy === 'high' && nextEnergy === 'low') return '爆发/落点';
  return '稳定中速';
}

function buildSections(features, onsets, duration) {
  const seconds = Math.max(1, Math.floor(duration));
  const perSecond = [];
  for (let t = 0; t < seconds; t++) {
    const from = Math.floor(t * features.frameRate), to = Math.min(features.count, Math.floor((t + 1) * features.frameRate));
    if (to <= from) continue;
    const slice = (array) => array.slice(from, to).reduce((sum, value) => sum + value, 0) / (to - from);
    perSecond.push({
      t,
      rms: slice(features.rms),
      flux: slice(features.flux),
      centroid: slice(features.centroid),
      low: slice(features.low),
      mid: slice(features.mid),
      high: slice(features.high),
      density: onsets.filter(item => item.time >= t && item.time < t + 1).length
    });
  }
  if (perSecond.length < 8) return [{ start: 0, end: duration, label: '稳定中速', energy: 'medium', onset_density: round(onsets.length / Math.max(1, duration), 2), confidence: 0.5 }];
  const keys = ['rms', 'flux', 'centroid', 'low', 'mid', 'high', 'density'];
  const scales = Object.fromEntries(keys.map(key => [key, std(perSecond.map(item => item[key])) || 1]));
  const novelty = perSecond.map((_, index) => {
    if (index < 4 || index > perSecond.length - 5) return 0;
    let distance = 0;
    for (let k = 1; k <= 4; k++) {
      const before = perSecond[index - k], after = perSecond[index + k - 1];
      for (const key of keys) distance += Math.abs(before[key] - after[key]) / scales[key];
    }
    return distance / 4;
  });
  const average = mean(novelty), deviation = std(novelty, average);
  const cuts = [];
  for (let i = 5; i < novelty.length - 5; i++) {
    if (novelty[i] < average + deviation * 0.6 || novelty[i] < novelty[i - 1] || novelty[i] <= novelty[i + 1]) continue;
    const time = perSecond[i].t;
    if (!cuts.length || time - cuts[cuts.length - 1] >= MIN_SECTION_SECONDS) cuts.push(time);
  }
  const boundaries = [0, ...cuts.slice(0, MAX_SECTIONS - 1), duration];
  const sections = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i], end = boundaries[i + 1];
    if (end - start < MIN_SECTION_SECONDS && sections.length) { sections[sections.length - 1].end = end; continue; }
    const midpoint = Math.floor((start + end) / 2);
    const stats = perSecond[Math.min(perSecond.length - 1, midpoint)] || perSecond[0];
    const allRms = perSecond.map(item => item.rms);
    const allDensity = perSecond.map(item => item.density);
    const energy = stats.rms >= percentile(allRms, 0.66) ? 'high' : stats.rms <= percentile(allRms, 0.33) ? 'low' : 'medium';
    const density = stats.density >= percentile(allDensity, 0.66) ? 'high' : stats.density <= percentile(allDensity, 0.33) ? 'low' : 'medium';
    const next = perSecond[Math.min(perSecond.length - 1, Math.floor(end) + 2)] || stats;
    sections.push({
      id: `sec_${i + 1}`,
      start: round(start, 3),
      end: round(end, 3),
      label: sectionLabel({ energy, density, nextEnergy: next.rms >= percentile(allRms, 0.66) ? 'high' : 'medium' }),
      energy,
      onset_density: round(stats.density, 2),
      confidence: round(clamp01(0.45 + Math.min(0.4, (end - start) / 60)), 3)
    });
  }
  return sections;
}

function featureRaster(features, duration) {
  const columns = Math.max(1, Math.min(Math.ceil(duration * FEATURE_FPS), 20000));
  const data = Buffer.alloc(columns * FEATURE_BANDS);
  const frequencies = [];
  for (let band = 0; band < FEATURE_BANDS; band++) frequencies.push(0);
  const values = [];
  for (let band = 0; band < FEATURE_BANDS; band++) {
    let min = Infinity, max = -Infinity;
    for (let frame = 0; frame < features.count; frame++) {
      const value = features.bandDb[frame * FEATURE_BANDS + band];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    values.push({ min, max: Math.max(min + 1e-6, max) });
  }
  for (let column = 0; column < columns; column++) {
    const from = Math.floor(column / FEATURE_FPS * features.frameRate);
    const to = Math.max(from + 1, Math.min(features.count, Math.floor((column + 1) / FEATURE_FPS * features.frameRate)));
    for (let band = 0; band < FEATURE_BANDS; band++) {
      let sum = 0;
      for (let frame = from; frame < to; frame++) sum += features.bandDb[frame * FEATURE_BANDS + band];
      const value = (sum / Math.max(1, to - from) - values[band].min) / (values[band].max - values[band].min);
      data[column * FEATURE_BANDS + band] = Math.round(clamp01(value) * 255);
    }
  }
  return { data, columns, fps: FEATURE_FPS, bands: FEATURE_BANDS };
}

function waveformPeaks(samples, buckets = WAVEFORM_BUCKETS) {
  const data = new Int8Array(buckets * 2);
  const size = Math.max(1, Math.floor(samples.length / buckets));
  for (let bucket = 0; bucket < buckets; bucket++) {
    let min = 0, max = 0;
    const from = bucket * size, to = Math.min(samples.length, from + size);
    for (let i = from; i < to; i++) {
      if (samples[i] < min) min = samples[i];
      if (samples[i] > max) max = samples[i];
    }
    data[bucket * 2] = Math.round(clamp01((min + 1) / 2) * 255 - 128);
    data[bucket * 2 + 1] = Math.round(clamp01((max + 1) / 2) * 255 - 128);
  }
  return { data, buckets };
}

function cutCandidates(beats, downbeats, onsets, sections) {
  const candidates = [];
  const downSet = new Set(downbeats.map(value => Math.round(value * 1000)));
  for (const time of beats.times) {
    const isDown = downSet.has(Math.round(time * 1000));
    candidates.push({ time, type: isDown ? 'downbeat' : 'beat', score: isDown ? 0.88 : 0.62, section_id: null });
  }
  for (const onset of onsets) candidates.push({ time: onset.time, type: 'onset', score: 0.5 + onset.strength * 0.35, section_id: null });
  for (const section of sections) candidates.push({ time: section.start, type: 'section_boundary', score: 0.95, section_id: section.id });
  candidates.sort((a, b) => a.time - b.time || b.score - a.score);
  const result = [];
  for (const candidate of candidates) {
    if (candidate.time < 0) continue;
    if (result.length && candidate.time - result[result.length - 1].time < 0.06) {
      if (candidate.score > result[result.length - 1].score) result[result.length - 1] = candidate;
      continue;
    }
    result.push(candidate);
    if (result.length >= MAX_CUT_CANDIDATES) break;
  }
  return result;
}

function empty(status, extra = {}) {
  return {
    status, method: 'spectral-flux-autocorr-v2', analysis_version: MUSIC_ANALYSIS_VERSION,
    bpm: null, bpm_confidence: null, tempo_candidates: [], meter: { beats_per_bar: null, confidence: 0, first_downbeat: null },
    beats: { subdivision: 4, times: [], strengths: [], quarter_times: [], quarter_strengths: [], downbeats: [] }, sections: [], cut_candidates: [],
    features: null, waveform: null, ...extra
  };
}

export function analyzePcmMusicV2(samples, { sampleRate = SAMPLE_RATE, startSeconds = 0 } = {}) {
  if (!(samples instanceof Float32Array) || !Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error('Invalid PCM input');
  const duration = samples.length / sampleRate;
  if (duration > MAX_MUSIC_ANALYSIS_SECONDS) throw new Error('PCM exceeds the analysis limit');
  const features = frameFeatures(samples, sampleRate);
  if (!features.count) return empty('low_confidence', { analysis_window: { start_seconds: startSeconds, duration_seconds: duration } });
  const rmsAverage = mean([...features.rms]);
  if (rmsAverage < 0.0001) return empty('silence', { analysis_window: { start_seconds: startSeconds, duration_seconds: duration } });
  const onsetResult = detectOnsets(features);
  features.envelope = onsetResult.envelope;
  const onsets = onsetResult.onsets;
  if (onsets.length < 4 || duration < 3) {
    return empty('low_confidence', { analysis_window: { start_seconds: startSeconds, duration_seconds: duration }, waveform: waveformPeaks(samples) });
  }
  const sections = buildSections(features, onsets, duration);
  const globalTempo = preferTempoOctave(tempoCandidates(features, 0, duration)).slice(0, 4);
  const primary = globalTempo[0] || null;
  const maxTempoScore = Math.max(1e-9, ...globalTempo.map(item => item.score));
  const grid = beatGrid(features, 0, duration, primary);
  const sectionTempos = [];
  for (const section of sections) {
    const local = preferTempoOctave(tempoCandidates(features, section.start, section.end))[0];
    const tempo = alignTempoToGlobal(local && local.score > 0.00005 ? local : primary, primary);
    section.bpm = tempo ? tempo.bpm : null;
    sectionTempos.push(tempo);
  }
  const downbeats = [];
  if (grid.times.length >= 4) {
    const meter = 4;
    let bestOffset = 0, bestScore = -Infinity;
    for (let offset = 0; offset < meter; offset++) {
      let score = 0;
      for (let i = offset; i < grid.times.length; i += meter) score += grid.strengths[i] || 0;
      if (score > bestScore) { bestScore = score; bestOffset = offset; }
    }
    for (let i = bestOffset; i < grid.times.length; i += meter) downbeats.push(grid.times[i]);
    const meterConfidence = clamp01(bestScore / Math.max(1, grid.times.length / meter * 0.9));
    const cuts = cutCandidates(grid, downbeats, onsets, sections);
    for (const cut of cuts) cut.section_id = sections.find(section => cut.time >= section.start && cut.time < section.end)?.id || sections.at(-1)?.id || null;
    return {
      status: 'ok', method: 'spectral-flux-autocorr-v2', analysis_version: MUSIC_ANALYSIS_VERSION,
      analysis_window: { start_seconds: startSeconds, duration_seconds: duration },
      bpm: primary?.bpm ?? null, bpm_confidence: round(grid.confidence, 3),
      tempo_candidates: globalTempo.map(item => ({ bpm: item.bpm, confidence: round(clamp01(item.score / maxTempoScore), 3) })),
      meter: { beats_per_bar: meter, confidence: round(meterConfidence, 3), first_downbeat: downbeats[0] ?? null },
      beats: { subdivision: 4, times: grid.times, strengths: grid.strengths, quarter_times: grid.quarterTimes, quarter_strengths: grid.quarterStrengths, downbeats },
      sections, cut_candidates: cuts,
      features: featureRaster(features, duration), waveform: waveformPeaks(samples),
      feature_summary: {
        mean_rms: round(rmsAverage, 5), dynamic_range_db: null,
        onset_count: onsets.length, section_count: sections.length
      }
    };
  }
  return {
    status: 'low_confidence', method: 'spectral-flux-autocorr-v2', analysis_version: MUSIC_ANALYSIS_VERSION,
    analysis_window: { start_seconds: startSeconds, duration_seconds: duration },
    bpm: primary?.bpm ?? null, bpm_confidence: round(grid.confidence, 3),
    tempo_candidates: globalTempo.map(item => ({ bpm: item.bpm, confidence: round(clamp01(item.score / maxTempoScore), 3) })),
    meter: { beats_per_bar: 4, confidence: 0, first_downbeat: null },
    beats: { subdivision: 4, times: grid.times, strengths: grid.strengths, quarter_times: grid.quarterTimes, quarter_strengths: grid.quarterStrengths, downbeats: [] },
    sections, cut_candidates: cutCandidates(grid, [], onsets, sections),
    features: featureRaster(features, duration), waveform: waveformPeaks(samples),
    feature_summary: { mean_rms: round(rmsAverage, 5), dynamic_range_db: null, onset_count: onsets.length, section_count: sections.length }
  };
}

export async function analyzeMusicV2({ filePath, ffmpeg, ffprobe, startSeconds = 0, durationSeconds = 600, signal } = {}) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath) || typeof ffmpeg !== 'string' || typeof ffprobe !== 'string' ||
      !Number.isFinite(startSeconds) || startSeconds < 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_MUSIC_ANALYSIS_SECONDS) {
    throw new Error('Invalid music analysis arguments');
  }
  const window = { start_seconds: startSeconds, duration_seconds: durationSeconds };
  if (signal?.aborted) return empty('error', { error_code: 'ABORTED', analysis_window: window });
  try {
    const file = await stat(filePath);
    if (!file.isFile()) return empty('error', { error_code: 'SOURCE_UNAVAILABLE', analysis_window: window });
  } catch {
    return empty('error', { error_code: 'SOURCE_UNAVAILABLE', analysis_window: window });
  }
  try {
    const probe = await execFileAsync(ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type', '-of', 'json', filePath],
      { encoding: 'utf8', timeout: 15000, maxBuffer: 256 * 1024, signal, windowsHide: true });
    const metadata = JSON.parse(probe.stdout);
    if (!Array.isArray(metadata.streams) || !metadata.streams.some(stream => stream.codec_type === 'audio')) return empty('no_audio', { analysis_window: window });
  } catch (error) {
    return empty('error', { error_code: signal?.aborted ? 'ABORTED' : error?.killed ? 'PROBE_TIMEOUT' : 'PROBE_FAILED', analysis_window: window });
  }
  try {
    const maxBytes = Math.ceil(durationSeconds * SAMPLE_RATE * 4) + 65536;
    const decoded = await execFileAsync(ffmpeg, ['-v', 'error', '-nostdin', '-ss', String(startSeconds), '-i', filePath,
      '-t', String(durationSeconds), '-map', '0:a:0', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', 'pipe:1'],
      { encoding: 'buffer', timeout: 180000, maxBuffer: maxBytes, signal, windowsHide: true });
    if (!decoded.stdout.length) return empty('low_confidence', { error_code: 'EMPTY_WINDOW', analysis_window: window });
    const samples = new Float32Array(Math.floor(decoded.stdout.length / 4));
    for (let i = 0; i < samples.length; i++) samples[i] = decoded.stdout.readFloatLE(i * 4);
    return analyzePcmMusicV2(samples, { sampleRate: SAMPLE_RATE, startSeconds });
  } catch (error) {
    return empty('error', { error_code: signal?.aborted ? 'ABORTED' : error?.killed ? 'DECODE_TIMEOUT' : 'DECODE_FAILED', analysis_window: window });
  }
}
