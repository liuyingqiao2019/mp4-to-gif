import {createServer} from 'node:http';
import {createReadStream,createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {spawn} from 'node:child_process';
import {mkdir, stat, rename, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {cleanup} from './cleanup.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)), work=path.join(root,'work');
const ffmpeg=process.env.FFMPEG_PATH||path.join(root,'bin/ffmpeg.exe');
const probe={path:process.env.FFPROBE_PATH||path.join(root,'bin/ffprobe.exe')};
await mkdir(work,{recursive:true});
const jobs=new Map(),activeUploads=new Set();
const port=Number(process.env.PORT||3815),host=process.env.HOST||'127.0.0.1';
const cleanupInterval=30*60*1000;
let nextCleanupAt=Date.now()+cleanupInterval;
await cleanup(work,jobs,activeUploads);
let receiving=false;
function run(bin,args,job){return new Promise((resolve,reject)=>{const child=spawn(bin,args,{windowsHide:true});let out='',err='';if(job)job.child=child;child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err=(err+d).slice(-6000));child.on('error',reject);child.on('close',code=>{if(job)job.child=null;code===0?resolve(out):reject(new Error(job?.cancelled?'已取消转换':err||'编码失败'));});});}
async function convert(job){const deadline=setTimeout(()=>{job.cancelled=true;job.child?.kill();},25*60*1000);deadline.unref();let best=Infinity,selected=null;try{
const data=JSON.parse(await run(probe.path,['-v','error','-show_streams','-show_format','-of','json',job.input],job));const video=data.streams.find(s=>s.codec_type==='video');if(!video)throw new Error('文件中没有视频轨道');
const duration=Number(data.format.duration);if(!Number.isFinite(duration)||duration<=0)throw new Error('无法识别视频时长');job.source={width:video.width,height:video.height,duration};
const rates=job.allowDrop?[...new Set([job.fps,...[15,10,8,5,3,2,1].filter(n=>n<job.fps)])]:[job.fps];
const variants=[[256,'sierra2_4a']];job.total=rates.length;
for(const fps of rates){for(const [colors,dither] of variants){if(job.cancelled)throw new Error('已取消转换');job.attempt++;job.message=`第 ${job.attempt} 次编码 · ${fps} FPS · ${colors} 色 · ${dither}`;const candidate=path.join(job.dir,'candidate.gif');
// A full palette for each frame avoids losing scene-specific hues to one global palette.
// Size limits only change temporal sampling, never palette size or dithering quality.
const filter=`[0:v]fps=${fps},split[a][b];[a]palettegen=max_colors=256:reserve_transparent=0:stats_mode=single[p];[b][p]paletteuse=new=1:dither=sierra2_4a`;
await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',job.input,'-filter_complex',filter,'-an','-loop','0','-gifflags','+transdiff',candidate],job);
if(job.cancelled)throw new Error('已取消转换');
const size=(await stat(candidate)).size;job.history.push({fps,colors,dither,bytes:size});if(size<best){best=size;selected={fps,colors,dither,bytes:size};await rm(path.join(job.dir,'output.gif'),{force:true});await rename(candidate,path.join(job.dir,'output.gif'));}if(!job.target||size<job.target){job.met=true;break;}}if(job.met)break;}
job.result={...selected,url:`/api/jobs/${job.id}/output`,met:job.met};job.state='done';job.message=job.met?'转换完成':'本轮优化未达到目标；已保留最小结果，可提高上限或允许降低帧率。';
}catch(e){job.state=job.cancelled?'cancelled':'error';job.message=e.message.slice(-1500);}finally{clearTimeout(deadline);await rm(job.input,{force:true}).catch(console.error);await rm(path.join(job.dir,'candidate.gif'),{force:true}).catch(console.error);job.finished=Date.now();}}

const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
const server=createServer(async(req,res)=>{try{
const url=new URL(req.url,'http://127.0.0.1:3815');
// Conversion jobs and generated files are not public search landing pages.
if(url.pathname.startsWith('/api/'))res.setHeader('X-Robots-Tag','noindex, nofollow');
if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}` && req.headers.origin!==process.env.PUBLIC_ORIGIN)return send(res,403,{error:'Origin rejected'});
if(req.method==='POST'&&url.pathname==='/api/jobs'){
const fps=Number(url.searchParams.get('fps')),raw=url.searchParams.get('mb'),mb=raw?Number(raw):null;
if(!Number.isFinite(fps)||fps<1||fps>50||(mb!==null&&(!Number.isFinite(mb)||mb<.001||mb>1000)))return send(res,400,{error:'帧率需为 1–50，大小需为 0.001–1000 MB'});
if(receiving||[...jobs.values()].some(j=>j.state==='running'))return send(res,409,{error:'已有任务正在转换'});
if(Number(req.headers['content-length'])>1e9)return send(res,413,{error:'文件不能超过 1 GB'});
receiving=true;const id=randomUUID(),dir=path.join(work,id),input=path.join(dir,'input');activeUploads.add(id);
try{await mkdir(dir);let size=0;await pipeline(req,new Transform({transform(chunk,enc,cb){size+=chunk.length;cb(size>1e9?new Error('文件不能超过 1 GB'):null,chunk);}}),createWriteStream(input));
if(!size)throw new Error('文件为空');const job={id,dir,input,fps,target:mb===null?null:Math.floor(mb*1e6),allowDrop:url.searchParams.get('allowDrop')==='true',state:'running',attempt:0,total:1,history:[],message:'正在分析视频',met:false,cancelled:false};jobs.set(id,job);send(res,200,{id});void convert(job);
}catch(e){await rm(dir,{recursive:true,force:true});throw e;}finally{receiving=false;activeUploads.delete(id);}return;}
const match=url.pathname.match(/^\/api\/jobs\/([a-f0-9-]+)(\/output)?$/);
if(match){const j=jobs.get(match[1]);if(!j||j.cleaning)return send(res,410,{error:'文件已自动清理，请重新上传'});
if(req.method==='DELETE'&&!match[2]){if(j.state==='running'){j.cancelled=true;j.child?.kill();}return send(res,200,{ok:true});}
if(req.method==='GET'&&match[2]){if(j.state!=='done')return send(res,404,{error:'结果未就绪'});res.writeHead(200,{'Content-Type':'image/gif','Content-Disposition':'inline; filename="converted.gif"','Cache-Control':'no-store'});j.downloads=(j.downloads||0)+1;try{await pipeline(createReadStream(path.join(j.dir,'output.gif')),res);}finally{j.downloads--;}return;}
if(req.method==='GET'){const {child,dir,input,...safe}=j;return send(res,200,{...safe,nextCleanupAt});}}
const files={'/':['index.html','text/html; charset=utf-8'],'/style.css':['style.css','text/css'],'/app.js':['app.js','text/javascript'],'/robots.txt':['robots.txt','text/plain; charset=utf-8'],'/sitemap.xml':['sitemap.xml','application/xml; charset=utf-8']};
if((req.method==='GET'||req.method==='HEAD')&&files[url.pathname]){const [name,type]=files[url.pathname];res.writeHead(200,{'Content-Type':type});if(req.method==='HEAD'){res.end();return;}await pipeline(createReadStream(path.join(root,'public',name)),res);return;}
send(res,404,{error:'Not found'});
}catch(e){if(!res.headersSent)send(res,400,{error:e.message});else res.end();}});
let sweeping=false;
setInterval(async()=>{if(sweeping)return;sweeping=true;nextCleanupAt=Date.now()+cleanupInterval;try{await cleanup(work,jobs,activeUploads);}catch(e){console.error(e);}finally{sweeping=false;}},cleanupInterval).unref();
server.requestTimeout=10*60*1000;
server.listen(port,host,()=>console.log(`Frame GIF: http://${host}:${port}`));
