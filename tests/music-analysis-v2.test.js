import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePcmMusicV2, FEATURE_BANDS, WAVEFORM_BUCKETS, MAX_MUSIC_ANALYSIS_SECONDS } from '../src/host/music/music-analysis-v2.js';

function clickTrack(bpm, seconds, sampleRate = 22050) {
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  const period = 60 / bpm;
  for (let start = period / 2; start < seconds; start += period) {
    const offset = Math.round(start * sampleRate);
    for (let i = 0; i < Math.round(0.045 * sampleRate); i++) {
      const t = i / sampleRate;
      samples[offset + i] = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 55) * 0.9;
    }
  }
  for (let i = 0; i < samples.length; i++) samples[i] += (Math.random() - 0.5) * 0.002;
  return samples;
}

test('v2 analysis returns BPM candidates, quarter-beat grid, meter and sections', () => {
  const result = analyzePcmMusicV2(clickTrack(120, 12), { sampleRate: 22050 });
  assert.equal(result.status, 'ok');
  assert.ok(result.bpm >= 55 && result.bpm <= 130);
  assert.ok(result.tempo_candidates.length >= 1);
  assert.equal(result.beats.subdivision, 4);
  assert.ok(result.beats.times.length >= 8);
  assert.ok(result.beats.quarter_times.length >= result.beats.times.length * 3);
  assert.ok(result.beats.downbeats.length >= 2);
  assert.ok(result.meter.beats_per_bar === 4 || result.meter.beats_per_bar === 3);
  assert.ok(result.sections.length >= 1);
  assert.ok(result.cut_candidates.length > 0);
  assert.ok(Math.max(...result.cut_candidates.map(cut => cut.time)) > 10);
  assert.ok(result.features.columns > 0);
  assert.equal(result.features.data.length, result.features.columns * FEATURE_BANDS);
  assert.equal(result.waveform.data.length, WAVEFORM_BUCKETS * 2);
});

test('v2 analysis distinguishes silence and enforces the ten-minute limit', () => {
  const silence = analyzePcmMusicV2(new Float32Array(22050 * 2), { sampleRate: 22050 });
  assert.equal(silence.status, 'silence');
  assert.deepEqual(silence.beats.quarter_times, []);
  assert.equal(silence.sections.length, 0);
  assert.throws(() => analyzePcmMusicV2(new Float32Array(MAX_MUSIC_ANALYSIS_SECONDS * 10 + 1), { sampleRate: 10 }), /limit/);
});
