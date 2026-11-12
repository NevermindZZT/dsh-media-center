import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const start=source.indexOf('    function EditingWorkbench('), end=source.indexOf('    // --- Main Workbench',start);
assert.ok(start>=0 && end>start);
const workbenchSource=source.slice(start,end);
function harness() {
  const values=[],refs=[],calls=[],responses=[],effects=[]; let cursor=0,refCursor=0,tree;
  const React={Fragment:'fragment'};
  const windowStub={confirm:()=>true};
  const context=vm.createContext({ React, window:windowStub, console, JSON, Number, Array, Set, encodeURIComponent,
    useState(initial){const i=cursor++; if(!(i in values)) values[i]=typeof initial==='function'?initial():initial; return [values[i],value=>{values[i]=typeof value==='function'?value(values[i]):value;}];},
    useRef(initial){const i=refCursor++; if(!refs[i]) refs[i]={current:initial}; return refs[i];},
    useEffect(fn){effects.push(fn);},
    h(type,props,...children){return {type,props:props||{},children:children.flat(Infinity).filter(x=>x!==false&&x!==null&&x!==undefined)};},
    fetch:async(url,options={})=>{ calls.push({url,options}); const next=responses.shift(); if(!next) throw new Error('unexpected fetch '+url); return {ok:next.ok!==false,status:next.status||200,json:async()=>next.body}; }
  });
  vm.runInContext(workbenchSource+'\nglobalThis.Component=EditingWorkbench;',context);
  const props={onClose(){},isMobile:true,styles:{input:{},primary:{},secondary:{},modal:{},overlay:{}}};
  const render=()=>{cursor=0;refCursor=0;tree=context.Component(props);return tree;};
  const all=(node,predicate)=>{if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...(node.children||[]).flatMap(x=>all(x,predicate))];};
  const text=node=>typeof node==='string'?node:node&&typeof node==='object'?(node.children||[]).map(text).join(' '):String(node??'');
  const find=(type,label)=>all(tree,n=>n.type===type && (n.props['aria-label']===label || text(n).includes(label)))[0];
  const response=body=>responses.push({body});
  const click=async label=>{const button=find('button',label);assert.ok(button,`button ${label}`);await button.props.onClick();render();};
  const change=(type,label,value)=>{const node=find(type,label);assert.ok(node,`${type} ${label}`);node.props.onChange({target:{value,checked:value}});render();};
  const mount=async()=>{render();response({success:true,items:[{id:'mus_1',file_name:'a.mp3',title:'A',license_status:'unknown'}]});response({success:true,items:[]});effects[0]();await new Promise(r=>setImmediate(r));render();};
  return {context,windowStub,values,calls,responses,props,render,find,text,response,click,change,mount,get tree(){return tree;}};
}

test('editing workbench delegates creative planning to DSH chat and has no AI calls',async()=>{
  const f=harness();await f.mount();
  const text=f.text(f.tree);
  assert.match(text,/DSH 对话/);assert.match(text,/已保存的剪辑项目/);
  for (const label of ['生成创意方案','AI 推荐音乐','保存 AI 方案']) assert.equal(f.find('button',label),undefined);
  assert.doesNotMatch(workbenchSource,/ai-settings|ai-analyze|music-recommendations|\/proposals|projects\/commit/);
  assert.equal(f.calls.some(c=>/ai-settings|ai-analyze|music-recommendations|\/proposals|projects\/commit/.test(c.url)),false);
});

test('music browser selects an audio path without importing it automatically',async()=>{
  const f=harness();await f.mount();
  f.response({success:true,current_path:'C:\\music',parent_path:'C:\\',drive_roots:[],folders:[],audio_files:[{name:'track.wav',path:'C:\\music\\track.wav'}]});
  await f.click('浏览音乐文件');
  assert.ok(f.find('button','选择：track.wav'));
  await f.click('选择：track.wav');
  assert.equal(f.find('input','音乐文件绝对路径').props.value,'C:\\music\\track.wav');
  assert.equal(f.calls.filter(c=>c.url.endsWith('/music') && c.options.method==='POST').length,0);
});

test('music import stores only a read-only reference and rights confirmation is explicit',async()=>{
  const f=harness();await f.mount();
  f.change('input','音乐文件绝对路径','C:\\music\\track.mp3');
  f.response({success:true,created:true,music:{id:'mus_2'}});f.response({success:true,items:[{id:'mus_2',title:'track',file_name:'track.mp3',license_status:'unknown'}]});
  await f.click('导入本地音乐');
  const imported=JSON.parse(f.calls.find(c=>c.options.method==='POST').options.body);
  assert.equal(imported.license_status,'unknown');assert.equal(imported.file_path,'C:\\music\\track.mp3');
  assert.match(f.text(f.tree),/授权：未知/);
  f.response({success:true});f.response({success:true,items:[{id:'mus_2',title:'track',license_status:'personal_confirmed'}]});await f.click('确认个人使用权限');
  const confirm=f.calls.find(c=>c.url.endsWith('/confirm-personal'));assert.equal(JSON.parse(confirm.options.body).confirmed,true);
  assert.match(f.text(f.tree),/未独立核验/);
});

test('declining personal-use declaration performs no mutation',async()=>{
  const f=harness();await f.mount();f.change('select','选择音乐','mus_1');
  f.windowStub.confirm=()=>false;await f.click('确认个人使用权限');
  assert.equal(f.calls.filter(c=>c.url.endsWith('/confirm-personal')).length,0);
});

test('music analysis shows BPM confidence and transients separately',async()=>{
  const f=harness();await f.mount();f.change('select','选择音乐','mus_1');
  f.response({success:true,analysis:{status:'low_confidence',bpm:null,confidence:0.2,beats:[],onsets:[1.25]}});
  await f.click('分析音乐');
  const text=f.text(f.tree);assert.match(text,/BPM：未检测到/);assert.match(text,/实测节拍（秒）：未提供/);
  assert.match(text,/检测瞬态候选（秒）：1.25/);assert.match(text,/不一定是节拍或强拍/);
});

test('Jamendo UI is metadata-only and clears the one-time Client ID',async()=>{
  const f=harness();await f.mount();f.change('input','Jamendo Client ID','secret-client');f.change('input','Jamendo 搜索词','travel');
  f.response({success:true,items:[{source_id:'1',title:'Track',artist:'Artist',rights_status:'unverified'}]});await f.click('搜索预览');
  assert.equal(f.find('input','Jamendo Client ID').props.value,'');assert.doesNotMatch(f.text(f.tree),/secret-client/);
  assert.match(f.text(f.tree),/仅搜索预览/);assert.match(f.text(f.tree),/授权需核验/);
  const request=f.calls.find(c=>c.url.endsWith('/jamendo/search'));
  assert.equal(JSON.parse(request.options.body).clientId,'secret-client');
  assert.equal(f.calls.some(c=>c.url.includes('music-recommendations')),false);
});

test('saved project manager lists and opens project detail',async()=>{
  const f=harness();await f.mount();
  f.response({success:true,items:[{id:'edit_123',title:'旅行草稿方案'}]});await f.click('刷新项目');
  assert.ok(f.find('button','旅行草稿方案'));
  f.response({success:true,project:{id:'edit_123',title:'旅行草稿方案',tracks:{video:[],music:[]}}});
  await f.click('旅行草稿方案');
  assert.match(f.text(f.tree),/旅行草稿方案/);
  assert.ok(f.calls.some(c=>c.url.endsWith('/projects/edit_123')));
});
