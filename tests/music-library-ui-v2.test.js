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
  assert.match(source, /建议卡点/);
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

test('spectrogram is drawn through drawImage so it keeps CSS coordinates at any device pixel ratio', () => {
  assert.match(source, /ctx\.drawImage\(strips\.spec,sx,0,sw,strips\.bands,0,ySpec,width,specHeight\)/);
  assert.match(source, /ctx\.drawImage\(strips\.wave,wsx,0,wsw,strips\.wave\.height,0,yWave,width,waveHeight\)/);
  assert.match(source, /const height=Math\.max\(120,Math\.round\(canvas\.clientHeight\|\|150\)\)/);
  assert.doesNotMatch(source, /ctx\.putImageData\(image,0,ySpec\)/);
});

test('timeline redraw is prerendered and wheel input is coalesced per frame', () => {
  assert.match(source, /stripsRef/);
  assert.match(source, /spec\.width=columns;spec\.height=bands/);
  assert.match(source, /requestAnimationFrame\(\(\)=>\{wheelFrameRef\.current=0;setTimelineView\(viewRef\.current\);\}\)/);
  assert.match(source, /cancelAnimationFrame\(wheelFrameRef\.current\)/);
});

test('timeline highlights numbered cut points and keeps dense beat clutter optional', () => {
  assert.match(source, /const cutScoreFloor=/);
  assert.match(source, /const editingCuts=/);
  assert.match(source, /cut\.type==='change'/);
  assert.match(source, /const label=String\(cut\.index\)/);
  assert.match(source, /ctx\.fillText\(label,x\+5,ySpec\+10\)/);
  assert.match(source, /只显示卡点/);
  assert.match(source, /卡点 \+ 小节/);
  assert.match(source, /'aria-label':'叠加信息'/);
  assert.doesNotMatch(source, /rgba\(148,163,184,0\.1\)/);
  assert.doesNotMatch(source, /rgba\(248,250,252,0\.72\)/);
});
