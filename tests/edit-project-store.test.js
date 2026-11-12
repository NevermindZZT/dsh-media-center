import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { EditProjectStore } from '../src/host/edit/edit-project-store.js';

const project=()=>({schema_version:1,title:'旅行',rationale:'讲述旅程',fps:{num:30,den:1},duration_frames:90,tracks:{video:[{id:'clip',source:{id:'video',duration_seconds:10},source_in_seconds:0,source_out_seconds:3,timeline_start_frame:0,timeline_end_frame:90}],music:[]}});
function setup(t){const db=new DatabaseSync(':memory:');t.after(()=>db.close());return new EditProjectStore({db});}
test('create and query projects without touching source media',t=>{const s=setup(t), result=s.save(project());assert.equal(result.success,true);assert.equal(result.record.revision,1);assert.equal(result.record.project.canvas.aspect,'16:9');assert.equal(s.list().length,1);});
test('revision prevents stale overwrite; invalid proposals never persist',t=>{const s=setup(t), first=s.save(project());const id=first.record.id;const update=project();update.title='第二版';assert.equal(s.save(update,{id,expectedRevision:1}).record.revision,2);assert.equal(s.save(project(),{id,expectedRevision:1}).error,'CONFLICT_OR_NOT_FOUND');const invalid=project();invalid.tracks.video[0].source_out_seconds=100;assert.equal(s.save(invalid,{id,expectedRevision:2}).success,false);assert.equal(s.get(id).project.title,'第二版');});
