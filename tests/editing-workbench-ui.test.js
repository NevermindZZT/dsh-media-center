import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../client.js',import.meta.url),'utf8');
const tabsStart=source.indexOf('    const LIBRARY_TABS = [');
const start=source.indexOf('    function MusicLibraryWorkbench(');
const end=source.indexOf('    // --- Main Workbench View Component',start);
assert.ok(tabsStart>=0&&start>=0&&end>start,'MusicLibraryWorkbench and navigation tabs exist');
const panelSource=source.slice(Math.min(tabsStart,start),end);
const mainSource=source.slice(source.indexOf('    function MediaCenterWorkbench('));

function harness(){
 const values=[],refs=[],effectDeps=[],pendingEffects=[],calls=[],responses=[],confirmMessages=[];
 let stateCursor=0,refCursor=0,effectCursor=0,tree;
 const React={Fragment:'fragment'};
 const Icon={music:props=>({type:'music-icon',props,children:[]}),clapperboard:props=>({type:'video-icon',props,children:[]}),film:props=>({type:'film-icon',props,children:[]}),upload:props=>({type:'upload-icon',props,children:[]}),folder:props=>({type:'folder-icon',props,children:[]}),grid:props=>({type:'grid-icon',props,children:[]}),hardDrive:props=>({type:'disk-icon',props,children:[]}),arrowUp:props=>({type:'up-icon',props,children:[]}),chevronRight:props=>({type:'right-icon',props,children:[]}),chevronDown:props=>({type:'down-icon',props,children:[]}),compass:props=>({type:'compass-icon',props,children:[]}),edit:props=>({type:'edit-icon',props,children:[]}),sparkles:props=>({type:'sparkles-icon',props,children:[]})};
 const windowStub={confirm:message=>{confirmMessages.push(message);return true;}};
 const context=vm.createContext({React,Icon,window:windowStub,console,URLSearchParams,Number,Array,Set,Math,JSON,MAX_MUSIC_ANALYSIS_SECONDS:600,MAX_MUSIC_IMPORT_BATCH:50,
   useState(initial){const index=stateCursor++;if(!(index in values))values[index]=typeof initial==='function'?initial():initial;return [values[index],next=>{values[index]=typeof next==='function'?next(values[index]):next;}];},
   useRef(initial){const index=refCursor++;if(!refs[index])refs[index]={current:initial};return refs[index];},
   useEffect(fn,deps){const index=effectCursor++;const previous=effectDeps[index];const changed=!deps||!previous||deps.length!==previous.length||deps.some((value,i)=>!Object.is(value,previous[i]));if(changed){effectDeps[index]=deps?[...deps]:undefined;pendingEffects.push(fn);}},
   h(type,props,...children){return {type,props:props||{},children:children.flat(Infinity).filter(child=>child!==false&&child!==null&&child!==undefined)};},
   fetch:async(url,options={})=>{calls.push({url,options});const next=responses.shift();if(!next)throw new Error('unexpected fetch '+url);return {ok:next.ok!==false,status:next.status||200,json:async()=>next.body};}
 });
 vm.runInContext(panelSource+'\nglobalThis.Component=MusicLibraryWorkbench;globalThis.Tabs=LibraryPageTabs;',context);
 const props={onClose(){},isMobile:false};
 const render=()=>{stateCursor=0;refCursor=0;effectCursor=0;tree=context.Component(props);return tree;};
 const all=(node,predicate)=>{if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...(node.children||[]).flatMap(child=>all(child,predicate))];};
 const text=node=>typeof node==='string'?node:node&&typeof node==='object'?(node.children||[]).map(text).join(' '):String(node??'');
 const find=(type,label)=>all(tree,node=>node.type===type&&(node.props['aria-label']===label||text(node).includes(label)))[0];
 const response=body=>responses.push({body});
 const failResponse=(status,error)=>responses.push({ok:false,status,body:{success:false,error}});
 const flushEffects=async()=>{for(let i=0;i<8&&pendingEffects.length;i++){const batch=pendingEffects.splice(0);for(const fn of batch)await fn();await new Promise(resolve=>setImmediate(resolve));render();}};
 const click=async label=>{const button=find('button',label);assert.ok(button,`button ${label}`);assert.notEqual(button.props.disabled,true,`button disabled ${label}`);await button.props.onClick?.();render();await flushEffects();};
 const change=(type,label,value)=>{const node=find(type,label);assert.ok(node,`${type} ${label}`);node.props.onChange({target:{value,checked:value}});render();};
 const mount=async()=>{render();await flushEffects();};
 return {context,calls,confirmMessages,response,failResponse,click,change,find,text,all,render,mount,get tree(){return tree;},panelSource,mainSource};
}

function item(overrides={}){return {id:'mus_1',file_name:'song.wav',title:'Song',artist:'Artist',duration:12,license_status:'unknown',source_status:'current',analysis_summary:null,...overrides};}
function goodProfile(overrides={}){return {analysis_id:'analysis_1',status:'ok',analysis_window:{start_seconds:0,duration_seconds:6},bpm:120,confidence:0.8,tempo_candidates:[{bpm:120,confidence:0.8}],transient_onsets:[0.25,0.5,1.0],beat_candidates:[0.5,1.0],user_confirmed_beats:[1],feature_summary:{mean_rms:0.08,dynamic_range_db:null,transient_density_per_minute:20},style_tags:['calm'],style_rationale:'较长持续音与低起音密度',style_provenance:'dsh-agent-user-approved',provenance:{analysis_id:'analysis_1',schema_version:1},created_at:'2026-11-12T00:00:00.000Z',...overrides};}

 test('video and music libraries are full-page tabs, not a music dialog or project manager',async()=>{
  const f=harness();f.response({success:true,items:[]});await f.mount();
  assert.equal(f.tree.props['aria-label'],'音乐库页面');assert.equal(f.tree.props.role,undefined);assert.equal(f.tree.props.style.position,undefined);
  let selected='';
  const tabs=f.context.Tabs({active:'music',isMobile:false,onSelect:tab=>{selected=tab;}});assert.equal(tabs.props.role,'tablist');
  const tabButtons=tabs.children.filter(node=>node?.props?.role==='tab');assert.equal(tabButtons.length,3);assert.equal(tabButtons.find(node=>node.props['aria-label']==='切换到音乐库').props['aria-selected'],true);
  tabButtons.find(node=>node.props['aria-label']==='切换到视频库').props.onClick();assert.equal(selected,'video');
  tabButtons.find(node=>node.props['aria-label']==='切换到项目库').props.onClick();assert.equal(selected,'projects');
     assert.equal((source.match(/function LibraryPageTabs/g)||[]).length,1);
   assert.match(mainSource,/activeLibrary === 'music'/);assert.match(mainSource,/renderMediaLibraryHeader/);assert.match(mainSource,/renderLibrarySectionHeader/);assert.match(mainSource,/showScanModal && renderAssetImportDialog/);
   assert.match(panelSource,/gridTemplateColumns: 'minmax\(0, 1fr\) auto minmax\(0, 1fr\)'/);assert.match(panelSource,/renderLibraryColumnLayout/);assert.match(panelSource,/renderAssetImportDialog/);
   assert.match(panelSource,/来源目录/);assert.match(panelSource,/音乐内容区/);assert.match(panelSource,/音乐详情/);
   assert.match(mainSource,/ProjectLibraryWorkbench/);assert.match(mainSource,/activeLibrary === 'projects'/);
   assert.match(panelSource,/项目库/);assert.match(panelSource,/FCPXML/);assert.match(panelSource,/Premiere Pro XML/);
   assert.doesNotMatch(mainSource,/导出剪辑工程/);

  assert.doesNotMatch(panelSource,/ai-settings|ai-analyze|chat\/completions|music-recommendations|\/styles/);
  assert.equal(f.find('input','本地音频绝对路径'),undefined);assert.ok(f.find('button','导入音乐'));
  assert.doesNotMatch(panelSource,/ai-settings|ai-analyze|chat\/completions|music-recommendations|\/styles/);
 });

test('music source directory tree groups and recursively filters assets',async()=>{
  const f=harness();
  f.response({success:true,items:[item({id:'mus_a',title:'Alpha Track',file_path:'C:\\Media\\Films\\A\\alpha.wav'}),item({id:'mus_b',title:'Beta Track',file_path:'C:\\Media\\Films\\B\\beta.wav'})]});
  f.response({success:true,analysis_id:'analysis_a',profile:goodProfile()});
  await f.mount();
  assert.ok(f.find('button','选择目录 C:/Media/Films/A'));
  assert.ok(f.find('button','选择目录 C:/Media/Films/B'));
  const folder=f.find('button','选择目录 C:/Media/Films/A');folder.props.onClick();f.render();
  assert.match(f.text(f.tree),/Alpha Track/);assert.doesNotMatch(f.text(f.tree),/Beta Track/);
 });

test('music library lists assets and displays playback, measured profile and separated style provenance',async()=>{
 const f=harness();f.response({success:true,items:[item({analysis_summary:{status:'ok',bpm:120,confidence:0.8}})]});f.response({success:true,analysis_id:'analysis_1',profile:goodProfile()});await f.mount();
 const content=f.text(f.tree);assert.match(content,/音乐库/);assert.match(content,/Song/);assert.match(content,/120/);assert.match(content,/80%/);assert.doesNotMatch(content,/瞬态 onsets|瞬态事件/);assert.match(content,/拍点候选/);assert.match(content,/用户确认拍点/);assert.match(content,/DSH Agent 建议/);assert.match(content,/用户确认的 Agent 风格建议/);assert.match(content,/较长持续音与低起音密度/);assert.match(content,/测量来源/);
   const thumbnail=f.all(f.tree,node=>node.type==='img')[0];assert.ok(thumbnail);assert.equal(thumbnail.props.loading,'lazy');assert.match(thumbnail.props.src,/\/spectrogram$/);assert.doesNotMatch(thumbnail.props.src,/[A-Z]:\\/i);
  assert.ok(f.find('audio','试听 Song'));assert.equal(f.find('audio','试听 Song').props.style.position,'sticky');assert.ok(f.find('summary','分析逻辑与拍点确认'));assert.ok(f.find('summary','选择拍点候选'));assert.equal(f.calls.some(call=>/ai-settings|music-recommendations|\/styles/.test(call.url)),false);
});

test('spectrogram model action is visible but gated without a current DSP profile',async()=>{
  const f=harness();f.response({success:true,items:[item()]});f.response({success:true,analysis:null});await f.mount();
  const button=f.find('button','大模型频谱解读');assert.ok(button);assert.equal(button.props.disabled,true);assert.equal(f.find('input','音乐分析窗口长度').props.value,12);
  assert.match(f.text(f.tree),/先运行本地分析，再可使用频谱图模型解读/);
});

 test('music search and license filters request only matching library records',async()=>{
  const f=harness();f.response({success:true,items:[item()]});f.response({success:true,analysis_id:'analysis_1',profile:goodProfile()});await f.mount();
 f.change('input','搜索音乐库','travel');f.change('select','授权状态筛选','personal_confirmed');
 f.response({success:true,items:[item({license_status:'personal_confirmed'})]});f.response({success:true,analysis_id:'analysis_1',profile:goodProfile()});await f.click('搜索');
 const request=f.calls.find(call=>call.url.includes('query=travel'));assert.ok(request);
 const query=new URL(request.url,'http://local').searchParams;assert.equal(query.get('query'),'travel');assert.equal(query.get('license_status'),'personal_confirmed');
 assert.ok(f.find('button','Song'));
});

test('legacy Host without new music analysis routes reports a clear reload hint',async()=>{
  const f=harness();f.response({success:true,items:[item()]});f.failResponse(404,'未知剪辑工作流操作');await f.mount();
  const content=f.text(f.tree);assert.match(content,/当前 Host 尚未加载新版音乐分析接口/);assert.doesNotMatch(content,/未知剪辑工作流操作/);
});

test('music catalogue filters by confirmed style tags and BPM candidates',async()=>{
  const f=harness();
  f.response({success:true,items:[item({id:'mus_1',title:'Mountain Song',analysis_summary:{status:'ok',bpm:120,tempo_candidates:[{bpm:120}],style_tags:['山地风光慢剪']}}),item({id:'mus_2',title:'City Song',analysis_summary:{status:'low_confidence',bpm:null,tempo_candidates:[{bpm:82,ambiguous:true}],style_tags:['城市夜景']}})]});
  f.response({success:true,analysis_id:'analysis_1',profile:goodProfile()});await f.mount();
  f.change('select','音乐风格筛选','城市夜景');assert.ok(f.find('button','City Song'));assert.equal(f.find('button','Mountain Song'),undefined);
  f.change('select','音乐风格筛选','all');f.change('input','最低 BPM','80');f.change('input','最高 BPM','90');
  assert.ok(f.find('button','City Song'));assert.equal(f.find('button','Mountain Song'),undefined);
});

test('zero beat candidates are clearly explained and cannot be confirmed',async()=>{
  const f=harness();f.response({success:true,items:[item()]});f.response({success:true,analysis_id:'analysis_1',profile:goodProfile({status:'low_confidence',bpm:null,beat_candidates:[],confidence:0.2})});await f.mount();
  assert.doesNotMatch(f.text(f.tree),/瞬态 onsets/);assert.match(f.text(f.tree),/此窗口没有本地拍点候选/);
  const confirm=f.find('button','暂无拍点候选');assert.ok(confirm);assert.equal(confirm.props.disabled,true);assert.notEqual(confirm.props.style.backgroundColor,'#2563eb');
 });

 test('low confidence or tempo ambiguity allows only explicit manual beat confirmation with a warning',async()=>{
  const f=harness();f.response({success:true,items:[item()]});f.response({success:true,analysis_id:'analysis_1',profile:goodProfile({status:'low_confidence',confidence:0.35,tempo_candidates:[{bpm:60,ambiguous:true},{bpm:120,ambiguous:true}]})});await f.mount();
 const confirm=f.find('button','确认所选候选拍点');assert.equal(confirm.props.disabled,true);assert.match(f.text(f.tree),/试听后逐项确认真实拍点/);
 const candidate=f.find('input','确认候选拍点 0.500 秒');assert.equal(candidate.props.disabled,false);candidate.props.onChange({target:{checked:true}});f.render();assert.equal(f.find('button','确认所选候选拍点').props.disabled,false);
 assert.equal(f.calls.some(call=>call.url.endsWith('/analysis/confirm-beats')),false);
});

test('beat confirmation records only explicitly selected candidate timestamps after user confirmation',async()=>{
 const f=harness();f.response({success:true,items:[item()]});f.response({success:true,analysis_id:'analysis_1',profile:goodProfile()});await f.mount();
 const candidate=f.find('input','确认候选拍点 0.500 秒');assert.ok(candidate);assert.equal(candidate.props.disabled,false);candidate.props.onChange({target:{checked:true}});f.render();
 f.response({success:true,analysis_id:'analysis_1',profile:goodProfile({user_confirmed_beats:[0.5,1]})});
 f.response({success:true,items:[item({license_status:'unknown'})]});
 f.response({success:true,analysis_id:'analysis_1',profile:goodProfile({user_confirmed_beats:[0.5,1]})});
 await f.click('确认所选拍点');
 const call=f.calls.find(item=>item.url.endsWith('/analysis/confirm-beats'));
 assert.ok(call);assert.equal(JSON.parse(call.options.body).confirmed,true);assert.deepEqual(JSON.parse(call.options.body).beats,[0.5]);
 assert.match(f.confirmMessages.at(-1),/已试听/);assert.equal(f.calls.some(item=>item.url.endsWith('/styles')),false);
});

test('stale music source cannot be previewed, analyzed, or newly authorized',async()=>{
  const f=harness();f.response({success:true,items:[item({source_status:'mismatch',license_status:'unknown'})]});f.response({success:false,status:409,error:'音乐源文件不可用或已变化'});await f.mount();
  assert.match(f.text(f.tree),/缺失\/已变化/);assert.equal(f.find('audio','试听 Song'),undefined);
  assert.equal(f.find('button','分析所选窗口').props.disabled,true);assert.equal(f.find('button','确认个人使用权限').props.disabled,true);
});

test('spectrogram model suggestions stay distinct from beats and are requested explicitly',async()=>{
  const interpretation={summary:'渐进而平稳',rhythm_character:'中慢速脉冲',energy_arc:'后半段略增强',scene_suggestions:[{scene:'山地日出延时',reason:'渐进能量适合缓慢铺陈',fit:'medium'}],tempo_hypotheses:[{bpm:112,confidence:'low',reason:'重复间距粗略估计'}],beat_time_hypotheses:[{time_fraction:0.4,source_seconds:2.4,confidence:'low',reason:'可见重复能量脉冲',approximate:true}],style_tags:['山地慢剪'],uncertainties:['频谱图无法确认精确拍点']};
  const f=harness();f.response({success:true,items:[item()]});f.response({success:true,analysis:goodProfile({model_interpretation:interpretation,model_interpretation_provenance:{provider:'p1',model:'vision',analyzed_at:'2026-11-12T00:00:00Z'}})});await f.mount();
  assert.match(f.text(f.tree),/频谱图模型解读（主观推测）/);assert.match(f.text(f.tree),/山地日出延时/);assert.match(f.text(f.tree),/频谱图无法确认精确拍点/);assert.match(f.text(f.tree),/112 BPM/);assert.match(f.text(f.tree),/约 2\.4 秒/);assert.match(f.text(f.tree),/山地慢剪/);
  f.response({success:true,analysis_id:'analysis_1',model_interpretation:interpretation});f.response({success:true,analysis:goodProfile({model_interpretation:interpretation,model_interpretation_provenance:{provider:'p1',model:'vision'}})});
  await f.click('使用大模型解读频谱图');
  const call=f.calls.find(item=>item.url.endsWith('/interpret'));assert.ok(call);assert.equal(JSON.parse(call.options.body).analysis_id,'analysis_1');
});

 test('model interpretation summary and style tags are manually editable',async()=>{
  const interpretation={summary:'AI摘要',rhythm_character:'中速',energy_arc:'缓慢增强',scene_suggestions:[],tempo_hypotheses:[],beat_time_hypotheses:[],style_tags:['城市漫步'],uncertainties:[]};
  const f=harness();f.response({success:true,items:[item()]});f.response({success:true,analysis:goodProfile({model_interpretation:interpretation,model_interpretation_provenance:{provider:'p1',model:'vision'}})});await f.mount();
  await f.click('编辑频谱解读与风格标签');
  f.change('textarea','编辑模型解读摘要','用户修订的音乐解读');f.change('textarea','编辑模型风格标签','城市夜景, 慢节奏剪辑');
  f.response({success:true,model_interpretation_edits:{summary:'用户修订的音乐解读',rhythm_character:'中速',energy_arc:'缓慢增强',style_tags:['城市夜景','慢节奏剪辑'],user_confirmed_model_beats:[]},model_interpretation_edits_provenance:{edited_at:'now'}});
  await f.click('保存编辑');
  const call=f.calls.find(item=>item.url.endsWith('/interpret/edits'));assert.ok(call);const body=JSON.parse(call.options.body);
  assert.equal(body.confirmed,true);assert.equal(body.edits.summary,'用户修订的音乐解读');assert.deepEqual(body.edits.style_tags,['城市夜景','慢节奏剪辑']);
  assert.match(f.text(f.tree),/用户修订的音乐解读/);
});

test('selected model beat hints require audition confirmation and remain separate',async()=>{
  const interpretation={summary:'approx',rhythm_character:'pulsed',energy_arc:'steady',scene_suggestions:[],tempo_hypotheses:[{bpm:100,confidence:'low',reason:'rough'}],beat_time_hypotheses:[{time_fraction:0.4,source_seconds:2.4,confidence:'low',reason:'pulse',approximate:true}],style_tags:[],uncertainties:[]};
  const f=harness();f.response({success:true,items:[item()]});f.response({success:true,analysis:goodProfile({model_interpretation:interpretation,model_interpretation_provenance:{provider:'p1',model:'vision'}})});await f.mount();
  f.change('input','选择模型节奏提示约 2.4 秒','true');
  f.response({success:true,model_interpretation_edits:{summary:'approx',rhythm_character:'pulsed',energy_arc:'steady',style_tags:[],user_confirmed_model_beats:[2.4]},model_interpretation_edits_provenance:{edited_at:'now'}});
  await f.click('确认所选模型节奏提示 (1)');
  const call=f.calls.find(item=>item.url.endsWith('/interpret/edits'));assert.ok(call);const body=JSON.parse(call.options.body);
  assert.equal(body.confirmed,true);assert.deepEqual(body.edits.user_confirmed_model_beats,[2.4]);assert.match(f.confirmMessages.at(-1),/试听/);
});

test('analysis is bounded to ten minutes and does not call a model',async()=>{
  const f=harness();f.response({success:true,items:[item()]});f.response({success:true,profile:goodProfile()});await f.mount();
 f.change('input','音乐分析窗口长度','601');await f.click('分析所选窗口');
 assert.match(f.text(f.tree),/最多10分钟/);assert.equal(f.calls.some(call=>call.url.endsWith('/analyze')),false);
 f.change('input','音乐分析窗口长度','600');f.response({success:true,analysis_id:'analysis_2',profile:goodProfile({analysis_id:'analysis_2',analysis_window:{start_seconds:0,duration_seconds:600}})});await f.click('分析所选窗口');
 const call=f.calls.find(item=>item.url.endsWith('/analyze'));assert.ok(call);assert.equal(JSON.parse(call.options.body).durationSeconds,600);
 assert.equal(f.calls.some(item=>/ai-settings|chat\/completions|music-recommendations/.test(item.url)),false);
});

test('local audio import uses the shared import dialog with browser and cancel actions',async()=>{
 const f=harness();f.response({success:true,items:[]});await f.mount();
 assert.equal(f.find('input','本地音频绝对路径'),undefined);
 await f.click('导入音乐');
 const dialog=f.all(f.tree,node=>node.props?.role==='dialog')[0];assert.ok(dialog);assert.equal(dialog.props['aria-label'],'导入本地音乐');
 assert.ok(f.find('input','音乐标题'));assert.ok(f.find('input','音乐作者'));assert.ok(f.find('textarea','个人用途许可备注'));
 assert.ok(f.find('button','图形化选择'));assert.ok(f.find('button','手动填路径'));assert.ok(f.find('button','浏览'));assert.ok(f.find('button','导入音乐引用'));
 await f.click('取消');assert.equal(f.find('input','本地音频绝对路径'),undefined);
 assert.equal(f.calls.some(call=>call.options.method==='POST'&&call.url.endsWith('/music')),false);
});

test('music import submits multiple selected audio references sequentially',async()=>{
  const first=item({id:'mus_a',title:'Alpha',file_name:'alpha.wav',file_path:'C:\\music\\alpha.wav'});
  const second=item({id:'mus_b',title:'Beta',file_name:'beta.wav',file_path:'C:\\music\\beta.wav'});
  const f=harness();f.response({success:true,items:[]});await f.mount();
  f.response({success:true,current_path:'C:\\music',parent_path:'C:\\',drive_roots:[],folders:[],audio_files:[{name:'alpha.wav',path:first.file_path},{name:'beta.wav',path:second.file_path}]});
  await f.click('导入音乐');await f.click('浏览');
  f.find('input','选择音频 alpha.wav').props.onChange();f.render();
  f.find('input','选择音频 beta.wav').props.onChange();f.render();
  assert.match(f.text(f.tree),/2\/50 已选/);
  f.response({success:true,created:true,music:first});f.response({success:true,created:true,music:second});
  f.response({success:true,items:[first,second]});f.response({success:true,profile:null});
  await f.click('导入所选音频 (2)');
  const posts=f.calls.filter(call=>call.options.method==='POST'&&call.url.endsWith('/music'));
  assert.equal(posts.length,2);assert.deepEqual(posts.map(call=>JSON.parse(call.options.body).file_path),[first.file_path,second.file_path]);
  assert.match(f.text(f.tree),/批量导入完成：新增 2 条/);
});

test('local audio browsing/import stores only a read-only reference and keeps rights explicit',async()=>{
  const f=harness();f.response({success:true,items:[]});await f.mount();
  f.response({success:true,current_path:'C:\\music',parent_path:'C:\\',drive_roots:[],folders:[],audio_files:[{name:'song.wav',path:'C:\\music\\song.wav'}]});
  await f.click('导入音乐');await f.click('浏览');
  const audioCheck=f.find('input','选择音频 song.wav');assert.ok(audioCheck);audioCheck.props.onChange();f.render();
  f.change('input','音乐标题','Song');f.change('input','音乐作者','Artist');
  f.response({success:true,created:true,music:item()});f.response({success:true,items:[item()]});f.response({success:true,profile:null});
  await f.click('导入所选音频 (1)');
  const imported=f.calls.find(call=>call.options.method==='POST'&&call.url.endsWith('/music'));
  assert.equal(JSON.parse(imported.options.body).file_path,'C:\\music\\song.wav');assert.equal(JSON.parse(imported.options.body).license_status,'unknown');
  f.response({success:true});f.response({success:true,items:[item({license_status:'personal_confirmed'})]});f.response({success:true,profile:null});await f.click('确认个人使用权限');
  const confirmation=f.calls.find(call=>call.url.endsWith('/confirm-personal'));assert.equal(JSON.parse(confirmation.options.body).confirmed,true);
  assert.match(f.text(f.tree),/未独立核验/);assert.equal(f.calls.some(call=>/music-recommendations|\/styles/.test(call.url)),false);
});