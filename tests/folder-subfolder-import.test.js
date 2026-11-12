import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {VideoDatabase} from '../src/host/db/database.js';
import {MediaEngine} from '../src/host/media/engine.js';
import {createVideoManagerApiHandler} from '../src/host/api/router.js';

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-subfolder-import-'));
 const sourceRoot=path.join(root,'disk-parent'),parentDirectory=path.join(sourceRoot,'set');
 fs.mkdirSync(parentDirectory,{recursive:true});
 const folderA=path.join(parentDirectory,'scene-a'),folderB=path.join(parentDirectory,'scene-b'),sibling=path.join(parentDirectory,'not-selected');
 fs.mkdirSync(path.join(folderA,'nested'),{recursive:true});fs.mkdirSync(folderB,{recursive:true});fs.mkdirSync(sibling,{recursive:true});
 const files=[path.join(folderA,'a.mp4'),path.join(folderA,'nested','b.mov'),path.join(folderB,'c.mkv'),path.join(sibling,'skip.mp4')];
 for(const [i,file] of files.entries())fs.writeFileSync(file,`synthetic-${i}`);
 const hashes=files.map(file=>fs.readFileSync(file));
 const db=new VideoDatabase({workspaceRoot:root});
 t.after(()=>{db.db.close();fs.rmSync(root,{recursive:true,force:true});});
 const engine=new MediaEngine(db);
 engine.probeVideo=async filePath=>({file_path:filePath,file_name:path.basename(filePath),file_size:fs.statSync(filePath).size,duration:3,width:320,height:180,fps:30,codec:'TEST',bitrate:0,audio_channels:0,sample_rate:0,captured_at:null,captured_at_source:'unknown'});
 engine.generateStoryboard=async()=>null;
 const parent=db.createFolder('Travel');
 return {root,parentDirectory,folderA,folderB,sibling,files,hashes,db,engine,parent};
}

test('imports multiple selected direct child folders under selected asset parent and recursively includes nested videos',async t=>{
 const f=fixture(t),result=await f.engine.scanAndImportDirectories([f.folderA,f.folderB],f.parentDirectory,f.parent.id);
 assert.equal(result.scanned_count,2);assert.equal(result.imported_count,3);assert.equal(result.failed_count,0);
 assert.equal(result.folders.find(x=>x.name==='scene-a').imported_count,2);assert.equal(result.folders.find(x=>x.name==='scene-b').imported_count,1);
 const parent=f.db.getFolderTree()[0];assert.equal(parent.name,'Travel');assert.equal(parent.children.length,2);
 const a=parent.children.find(x=>x.name==='scene-a');assert.ok(a);assert.equal(a.videoCount,2);assert.equal(a.children.length,1);assert.equal(a.children[0].name,'nested');assert.equal(a.children[0].videoCount,1);
 assert.equal(parent.children.find(x=>x.name==='scene-b').videoCount,1);assert.equal(parent.videoCount,3);
 const videos=f.db.queryVideos({query:'',folder_id:parent.id,limit:20});assert.equal(videos.length,3);
 assert.deepEqual(f.files.map(file=>fs.readFileSync(file)),f.hashes);
});

test('rejects paths outside current browser directory, duplicate selection and invalid parent',async t=>{
 const f=fixture(t);
 await assert.rejects(f.engine.scanAndImportDirectories([f.sibling],f.folderA,f.parent.id),/直接子文件夹/);
  await assert.rejects(f.engine.scanAndImportDirectories([f.parentDirectory],f.folderA,f.parent.id),/直接子文件夹/);
 await assert.rejects(f.engine.scanAndImportDirectories([f.folderA,f.folderA],f.parentDirectory,f.parent.id),/直接子文件夹/);
 await assert.rejects(f.engine.scanAndImportDirectories([f.folderA],f.parentDirectory,'folder_missing'),/父分类不存在/);
 assert.equal(f.db.queryVideos({query:'',limit:20}).length,0);
});

test('HTTP multi-folder import route delegates to the same recursive service',async t=>{
 const f=fixture(t);let received;
 f.engine.scanAndImportDirectories=async(...args)=>{received=args;return {scanned_count:args[0].length,imported_count:4,failed_count:0,folders:[]};};
 const handler=createVideoManagerApiHandler({db:f.db,mediaEngine:f.engine});
 const request=()=>new Promise((resolve,reject)=>{
  const req=Readable.from([JSON.stringify({parent_directory_path:f.parentDirectory,directory_paths:[f.folderA,f.folderB],parent_id:f.parent.id})]);req.method='POST';req.url='/api/video-manager/folders/scan-selected';req.headers={};
  const res={writeHead(status){this.status=status;},end(buffer){resolve({status:this.status,body:JSON.parse(buffer.toString())});}};
  Promise.resolve(handler(req,res)).catch(reject);
 });
 const result=await request();assert.equal(result.status,200);assert.equal(result.body.imported_count,4);
 assert.deepEqual(received,[[f.folderA,f.folderB],f.parentDirectory,f.parent.id]);
});
