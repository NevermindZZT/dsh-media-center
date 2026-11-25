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

test('change points follow audio events instead of a uniform grid', () => {
  const sampleRate = 22050;
  const seconds = 16;
  const samples = new Float32Array(seconds * sampleRate);
  // 0-5s 无内容，5-10s 稳定的中速钢琴，10-16s 突然加密加响
  const clickAt = (time, gain) => {
    const offset = Math.round(time * sampleRate);
    for (let i = 0; i < Math.round(0.05 * sampleRate) && offset + i < samples.length; i++) {
      const t = i / sampleRate;
      samples[offset + i] = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 40) * gain;
    }
  };
  for (let t = 5; t < 10; t += 0.65) clickAt(t, 0.5);
  for (let t = 10; t < 16; t += 0.33) clickAt(t, 0.95);
  const result = analyzePcmMusicV2(samples, { sampleRate });
  const changes = result.cut_candidates.filter(cut => cut.type === 'change');
  assert.ok(changes.length >= 2, 'expected change points');
  assert.ok(changes.some(point => Math.abs(point.time - 5) < 0.7), 'should flag the entrance around 5s');
  const gaps = changes.slice(1).map((point, index) => point.time - changes[index].time);
  const distinct = new Set(gaps.map(gap => Math.round(gap * 4)));
  assert.ok(distinct.size > 1, 'change points must not be a uniform grid');
});

test('beat tracking follows a mid-track tempo change instead of one rigid grid', () => {
  const sampleRate = 22050;
  const seconds = 40;
  const samples = new Float32Array(seconds * sampleRate);
  const clicks = [];
  let time = 0.2, bpm = 96;
  while (time < seconds) {
    clicks.push(time);
    const offset = Math.round(time * sampleRate);
    for (let i = 0; i < Math.round(0.04 * sampleRate) && offset + i < samples.length; i++) {
      const t = i / sampleRate;
      samples[offset + i] = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 60) * 0.85;
    }
    if (time > seconds / 2) bpm = 108;
    time += 60 / bpm;
  }
  const result = analyzePcmMusicV2(samples, { sampleRate });
  assert.equal(result.status, 'ok');
  const distances = result.beats.times.map(beat => Math.min(...clicks.map(click => Math.abs(click - beat))));
  const matched = distances.filter(distance => distance < 0.06).length;
  assert.ok(matched >= result.beats.times.length * 0.8, `only ${matched}/${result.beats.times.length} beats landed on clicks`);
});
