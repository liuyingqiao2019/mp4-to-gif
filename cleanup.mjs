import {readdir,rm} from 'node:fs/promises';
import path from 'node:path';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
// Only server-created UUID directories, never arbitrary workspace paths.
export async function cleanup(work,jobs,activeUploads=new Set()) {
 const entries=await readdir(work,{withFileTypes:true});
 for(const entry of entries){
  if(!entry.isDirectory()||!uuid.test(entry.name)||activeUploads.has(entry.name))continue;
  const job=jobs.get(entry.name);
  if(job&&(job.state==='running'||!job.finished||job.downloads>0))continue;
  if(job)job.cleaning=true;
  try{await rm(path.join(work,entry.name),{recursive:true,force:true});jobs.delete(entry.name);}
  catch(error){if(job)job.cleaning=false;console.error('Cleanup failed:',entry.name,error.message);}
 }
}
