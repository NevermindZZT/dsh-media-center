import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');

test('music workbench renders a drawable DSP timeline instead of spectrogram images', () => {
  assert.match(source, /analysis\/features\?analysis_id=/);
  assert.match(source, /音乐波形、频谱、段落与拍点时间轴/);
  assert.match(source, /1\/4 拍/);
  assert.match(source, /cut_candidates/);
  assert.match(source, /色带 = 段落结构/);
  assert.match(source, /青色三角 = 切点/);
});

test('music workbench no longer renders a spectrogram image thumbnail', () => {
  assert.doesNotMatch(source, /\/spectrogram`/);
});

test('music detail docks below the track list instead of a separate right column', () => {
  assert.match(source, /const musicTopRowStyle=/);
  assert.match(source, /musicBodyStyle/);
  assert.match(source, /'aria-label':'音乐详情'/);
  const topRow = source.indexOf("h('div',{style:musicTopRowStyle}");
  const detail = source.indexOf("'aria-label':'音乐详情'");
  assert.ok(topRow > 0 && detail > topRow, 'detail aside must follow the track list row');
  assert.doesNotMatch(source, /maxHeight:isMobile\?'none':'calc\(100% - 260px\)'/);
});

test('timeline wheel zoom, side wheel pan and drag pan share one canvas', () => {
  assert.match(source, /addEventListener\('wheel',onWheel,\{passive:false\}\)/);
  assert.match(source, /removeEventListener\('wheel',onWheel\)/);
  assert.match(source, /Math\.abs\(event\.deltaX\)>Math\.abs\(event\.deltaY\)/);
  assert.match(source, /event\.ctrlKey/);
  assert.match(source, /主滚轮缩放 · 侧滚平移 · 拖动平移/);
  assert.doesNotMatch(source, /onWheel:e=>\{e\.preventDefault\(\)/);
});
