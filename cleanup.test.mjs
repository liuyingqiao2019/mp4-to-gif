import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {cleanup} from './cleanup.mjs';
test('sweep removes completed and restart leftovers, preserves active uploads/conversions/downloads',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'gif-cleanup-'));
 try{const ids=Array.from({length:5},()=>randomUUID()),jobs=new Map();
 for(const id of ids){await mkdir(path.join(root,id));await writeFile(path.join(root,id,'input'),'data');}
 jobs.set(ids[0],{state:'done',finished:Date.now()});jobs.set(ids[1],{state:'running'});jobs.set(ids[2],{state:'done',finished:Date.now(),downloads:1});
 await mkdir(path.join(root,'unrelated'));
 await cleanup(root,jobs,new Set([ids[3]]));
 for(const id of [ids[0],ids[4]])await assert.rejects(access(path.join(root,id)));
 for(const id of [ids[1],ids[2],ids[3],'unrelated'])await access(path.join(root,id));
 assert.equal(jobs.has(ids[0]),false);
 jobs.get(ids[1]).state='cancelled';jobs.get(ids[1]).finished=Date.now();jobs.get(ids[2]).downloads=0;
 await cleanup(root,jobs);assert.equal(jobs.size,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
