import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('work/test',{recursive:true});
const ff='bin/ffmpeg.exe',fp='bin/ffprobe.exe';
const generated=spawnSync(ff,['-y','-f','lavfi','-i','testsrc2=size=320x180:rate=30','-t','2','-c:v','mpeg4','-pix_fmt','yuv420p','work/test/input.mp4'],{windowsHide:true});assert.equal(generated.status,0,generated.stderr.toString());
const bytes=await readFile('work/test/input.mp4');
async function start(mb='',allowDrop=false){const params=new URLSearchParams({fps:'15',mb:String(mb),allowDrop:String(allowDrop)});const r=await fetch('http://127.0.0.1:3815/api/jobs?'+params,{method:'POST',body:bytes});assert.equal(r.status,200);return (await r.json()).id;}
async function wait(id){let j;do{await new Promise(r=>setTimeout(r,150));j=await(await fetch(`http://127.0.0.1:3815/api/jobs/${id}`)).json();}while(j.state==='running');return j;}
const normal=await wait(await start());assert.equal(normal.state,'done',normal.message);assert.equal(normal.result.fps,15);
const output=Buffer.from(await(await fetch(`http://127.0.0.1:3815${normal.result.url}`)).arrayBuffer());await writeFile('work/test/output.gif',output);
const info=JSON.parse(spawnSync(fp,['-v','error','-show_streams','-of','json','work/test/output.gif'],{windowsHide:true}).stdout.toString()).streams[0];assert.equal(info.width,320);assert.equal(info.height,180);assert.equal(Number(info.nb_frames),30);
const target=normal.result.bytes*.8/1e6;const fixed=await wait(await start(target));assert.equal(fixed.result.fps,15);assert.equal(fixed.result.met,false);assert.equal(fixed.result.bytes,normal.result.bytes);
const limited=await wait(await start(target,true));assert.equal(limited.state,'done',limited.message);assert.ok(limited.result.fps<15);assert.equal(limited.result.met,true);assert.ok(limited.result.bytes<target*1e6);assert.ok(limited.history.length>1);
for(const attempt of [...fixed.history,...limited.history]){assert.equal(attempt.colors,256);assert.equal(attempt.dither,'sierra2_4a');}
const impossible=await wait(await start(.001));assert.equal(impossible.state,'done');assert.equal(impossible.result.met,false);
const adaptive=await wait(await start(.001,true));assert.equal(adaptive.state,'done');assert.ok(adaptive.history.some(h=>h.fps<15));
assert.ok(adaptive.history.every(h=>h.colors===256&&h.dither==='sierra2_4a'));
const cancelledId=await start(.001,true);await fetch(`http://127.0.0.1:3815/api/jobs/${cancelledId}`,{method:'DELETE'});const cancelled=await wait(cancelledId);assert.equal(cancelled.state,'cancelled');
console.log(JSON.stringify({originalBytes:normal.result.bytes,limitedBytes:limited.result.bytes,targetMB:target,met:limited.result.met,dimensions:[info.width,info.height],frames:info.nb_frames,unreachable:impossible.result.met,adaptiveAttempts:adaptive.history.length,cancelled:cancelled.state},null,2));
