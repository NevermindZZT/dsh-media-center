import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const start = source.indexOf('      const startVideoImport = async');
const end = source.indexOf('      const handleCreateFolder = async', start);
const code = source.slice(start, end);
function deferred(){ let resolve; const promise=new Promise(r=>{resolve=r;});return {promise,resolve}; }
function fixture(){
  const request=deferred(), states={modal:[],busy:[],progress:[],refresh:0};
  const context=vm.createContext({
    importLockRef:{current:false},selectedFolderId:'folder_a',scanDirPath:'C:\\video',
    selectedBrowserFolders:new Set(),selectedBrowserFiles:new Set(),browserData:{current_path:'C:\\video'},
    setIsImporting:value=>states.busy.push(value),setShowScanModal:value=>states.modal.push(value),setImportNotice:()=>{},
    setImportProgress:value=>states.progress.push(value),setSelectedBrowserFolders:()=>{},setSelectedBrowserFiles:()=>{},
    rememberPendingImport:()=>{},clearPendingImport:()=>{},pendingImport:null,
    refreshCurrentViewRef:{current:async()=>{states.refresh++;}},window:{confirm:()=>true},alert:()=>{},JSON,
    fetch:(url,options)=>{states.request={url,options};return request.promise;}
  });
  vm.runInContext(code+'\nglobalThis.startImport=startVideoImport; globalThis.importFiles=handleImportSelectedFiles;',context);
  return {context,request,states};
}
test('import closes dialog before server responds and tracks background job',async()=>{
  const f=fixture();const pending=f.context.importFiles(['C:\\video\\a.mp4']);
  assert.deepEqual(f.states.modal,[false]);assert.equal(f.states.progress[0].status,'starting');
  assert.equal(f.states.request.url,'/api/media-center/videos/import-files');
  f.request.resolve({ok:true,json:async()=>({success:true,job:{id:'job_1',status:'scanning',total:null}})});
  await pending;assert.equal(f.states.progress.at(-1).id,'job_1');assert.equal(f.states.busy.at(-1),true);assert.equal(f.states.refresh,1);
});
test('failed job start reports an error and unlocks import',async()=>{
  const f=fixture();const pending=f.context.startImport('/api/test',{});
  f.request.resolve({ok:false,json:async()=>({success:false,error:'不可读取目录'})});await pending;
  assert.equal(f.states.progress.at(-1).status,'failed');assert.equal(f.states.progress.at(-1).error,'不可读取目录');assert.equal(f.context.importLockRef.current,false);
});
test('polling follows an active job and refreshes the current view',async()=>{
  const marker="      useEffect(() => {\n        if (!importProgress?.id";
  const pos=source.indexOf(marker),tail="      }, [importProgress?.id, importProgress?.status]);";
  const finish=source.indexOf(tail,pos);assert.ok(pos>=0&&finish>pos);
  const snippet=source.slice(pos,finish+tail.length);let effect,timer;const events=[];
  const context=vm.createContext({importProgress:{id:'job_1',status:'importing'},importLockRef:{current:false},
    useEffect:fn=>{effect=fn;},setIsImporting:value=>events.push(['busy',value]),
    setImportProgress:value=>events.push(['job',value]),refreshCurrentViewRef:{current:async()=>events.push(['refresh'])},
    clearPendingImport:()=>events.push(['clearPending']),
    fetch:async url=>({ok:true,json:async()=>({success:true,job:{id:'job_1',status:'completed',inserted:2}})}),
    setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>{},window:{sessionStorage:{removeItem:()=>events.push(['clear'])}},encodeURIComponent});
  vm.runInContext(snippet,context);effect();await timer();
  assert.ok(events.some(item=>item[0]==='refresh'));assert.ok(events.some(item=>item[0]==='job'&&item[1].status==='completed'));
  assert.equal(context.importLockRef.current,false);assert.ok(events.some(item=>item[0]==='clear'));
});

test('unknown background job clears stale resume token and unblocks UI',async()=>{
  const marker="      useEffect(() => {\n        if (!importProgress?.id",tail="      }, [importProgress?.id, importProgress?.status]);";
  const pos=source.indexOf(marker),end=source.indexOf(tail,pos);let effect,timer;const events=[];
  const context=vm.createContext({importProgress:{id:'old_job',status:'running'},importLockRef:{current:false},useEffect:fn=>{effect=fn;},
    setIsImporting:value=>events.push(['busy',value]),setImportProgress:value=>events.push(['job',value]),
    refreshCurrentViewRef:{current:async()=>events.push(['refresh'])},fetch:async()=>({ok:false,status:404}),
    setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>{},window:{sessionStorage:{removeItem:()=>events.push(['clear'])}},encodeURIComponent});
  vm.runInContext(source.slice(pos,end+tail.length),context);effect();await timer();
  assert.equal(context.importLockRef.current,false);assert.ok(events.some(item=>item[0]==='clear'));
  assert.ok(events.some(item=>item[0]==='job'&&item[1].status==='interrupted'));
});

test('progress distinguishes discovery, deduplication and storyboard work',()=>{
  assert.match(source,/total_known === false/);assert.match(source,/importProgress\.importable/);
  assert.match(source,/importProgress\.duplicates/);assert.match(source,/importProgress\.storyboard_done/);
  assert.match(source,/dsh-media-center-active-import/);
});

test('import can be interrupted and resumed from a saved request',()=>{
  assert.match(source,/中断视频导入/);assert.match(source,/继续上次视频导入/);
  assert.match(source,/dsh-media-center-pending-import/);assert.match(source,/startVideoImport\(pendingImport\.url, pendingImport\.body\)/);
});
test('HEVC preview and storyboard regeneration are exposed in the UI',()=>{
  assert.match(source,/生成兼容预览/);assert.match(source,/stream\?preview=1/);
  assert.match(source,/hvc1\.1\.6\.L153\.B0/);assert.match(source,/BROWSER_SUPPORTS_HEVC/);
  assert.match(source,/canPlayHevcDirectly/);assert.match(source,/pixFmt\.includes\('420'\)/);
  assert.match(source,/required: false, status: 'direct'/);
  assert.doesNotMatch(source,/autoTimer/);
  assert.match(source,/onClick: \(\) => startCompatiblePreview\(\)/);
  assert.match(source,/重新生成故事板/);assert.match(source,/videos\/.*\/storyboard`,\s*\{ method: 'POST' \}/);
  assert.match(source,/用系统播放器打开/);assert.match(source,/\/open`, \{ method: 'POST' \}/);
});
test('batch AI analysis offers unanalyzed-only and full selection scopes',()=>{
  assert.match(source,/仅分析未分析过的视频/);
  assert.match(source,/分析全部所选视频/);
  assert.match(source,/v\.status === 'analyzed'/);
  assert.match(source,/handleBatchAiAnalyze\(batchAiScope\)/);
});


test('video list paginates instead of silently stopping at 200',()=>{
  assert.match(source,/const \[videoTotal, setVideoTotal\]/);
  assert.match(source,/loadMoreVideos/);
  assert.match(source,/加载更多（已加载/);
  assert.match(source,/setVideoTotal\(Number\(data\.total\)/);
});


test('video cards expose analyzed summary and separate storyboard state',()=>{
  assert.match(source,/role: 'tooltip'/);assert.match(source,/summaryVideoId === v\.id/);assert.match(source,/v\.storyboard_status === 'generating'/);
  assert.match(source,/showVideoSummary/);assert.match(source,/summaryAnchor/);assert.match(source,/position: 'fixed'/);
});


test('settings use grouped navigation and expose AI concurrency',()=>{
  assert.match(source,/aria-label': '设置分类'/);
  assert.match(source,/settingsSection === 'ai'/);
  assert.match(source,/AI 分析最大并发/);
  assert.match(source,/AI 分析失败重试次数/);
  assert.match(source,/清理全部缓存/);
  assert.match(source,/失败原因：/);
  assert.match(source,/重试 AI 深度分析/);
});
