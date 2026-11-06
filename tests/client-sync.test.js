import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const start = source.indexOf('      const loadVideos = async');
const end = source.indexOf('      // 4. Load Single Video Detail', start);
const code = source.slice(start, end);
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function harness() {
  const pending = [];
  const calls = { videos: [], loading: [], details: [], selected: [] };
  const viewRef = { current: { folderId: null, query: '', status: '', videoId: 'selected' } };
  const versions = { current: { videos: 0, detail: 0 } };
  const editingRef = { current: false };
  const context = vm.createContext({
    viewRef, requestVersions: versions, editingRef, sortRuleRef: { current: 'captured_at_desc' },
    parseSortRule: () => ({ sortBy: 'captured_at', sortDir: 'desc' }),
    setLoading: v => calls.loading.push(v), setVideos: v => calls.videos.push(v),
    setSelectedVideo: v => calls.selected.push(v),
    loadVideoDetail: id => { calls.details.push(id); viewRef.current.videoId = id; versions.current.detail++; },
    isMobile: false, encodeURIComponent, console,
    fetch: url => { const d = deferred(); pending.push({ ...d, url }); return d.promise; }
  });
  vm.runInContext(code + '\nglobalThis.load = loadVideos;', context);
  const reply = (request, videos) => request.resolve({ json: async () => ({ success: true, videos }) });
  return { context, pending, calls, reply, viewRef, versions, editingRef };
}

test('slow old list response cannot overwrite a newer folder and loading state', async () => {
  const h = harness();
  const old = h.context.load('old', '', '');
  const latest = h.context.load('new', '', '');
  h.reply(h.pending[1], [{ id: 'selected' }, { id: 'new' }]); await latest;
  h.reply(h.pending[0], [{ id: 'old' }]); await old;
  assert.deepEqual(h.calls.videos.map(v => v.map(item => item.id)), [['selected', 'new']]);
  assert.equal(h.viewRef.current.folderId, 'new');
  assert.deepEqual(h.calls.loading, [true, true, false]);
});

test('list refresh does not replace a newer explicit selection or unsaved edits', async () => {
  const h = harness();
  const first = h.context.load(null, '', '');
  h.viewRef.current.videoId = 'new-choice'; h.versions.current.detail++;
  h.reply(h.pending[0], [{ id: 'first' }]); await first;
  assert.equal(h.calls.details.length, 0);
  h.editingRef.current = true;
  const second = h.context.load(null, '', '');
  h.reply(h.pending[1], [{ id: 'other' }]); await second;
  assert.equal(h.calls.details.length, 0);
  assert.equal(h.viewRef.current.videoId, 'new-choice');
});

test('empty filtered result clears the current selection when not editing', async () => {
  const h = harness();
  const request = h.context.load('empty', '', '');
  h.reply(h.pending[0], []); await request;
  assert.equal(h.viewRef.current.videoId, null);
  assert.deepEqual(h.calls.selected, [null]);
});
