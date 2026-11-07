const $=id=>document.getElementById(id);let file,videoURL,jobId,busy=false;
function select(f){if(busy||!f)return;if(f.size>1e9){$('status').textContent='请选择小于 1 GB 的视频';return;}file=f;if(videoURL)URL.revokeObjectURL(videoURL);videoURL=URL.createObjectURL(f);$('video').src=videoURL;$('video').hidden=false;$('drop').hidden=true;$('filename').textContent=f.name;$('convert').disabled=false;$('result').hidden=true;$('status').textContent='可以开始转换。';}
$('file').onchange=e=>select(e.target.files[0]);
for(const event of ['dragenter','dragover'])$('drop').addEventListener(event,e=>{e.preventDefault();$('drop').classList.add('over')});
$('drop').ondragleave=()=>$('drop').classList.remove('over');$('drop').ondrop=e=>{e.preventDefault();$('drop').classList.remove('over');select(e.dataTransfer.files[0]);};
async function json(url,options){const r=await fetch(url,options);if(!r.ok){let body;try{body=await r.json()}catch{}throw new Error(body?.error||`请求失败 (${r.status})`)}return r.json();}
function lock(value){busy=value;$('fields').disabled=value;$('file').disabled=value;$('cancel').hidden=!value;$('progress').hidden=!value;}
$('form').onsubmit=async e=>{e.preventDefault();if(!file||busy)return;lock(true);$('result').hidden=true;$('status').textContent='正在上传视频…';const params=new URLSearchParams({fps:$('fps').value,mb:$('mb').value,allowDrop:$('allowDrop').checked});
try{const started=await json('/api/jobs?'+params,{method:'POST',body:file});jobId=started.id;let j;do{await new Promise(r=>setTimeout(r,700));j=await json(`/api/jobs/${jobId}`);$('status').textContent=j.message;$('history').textContent=j.history.map((h,i)=>`${i+1}. ${h.fps} 帧/秒 → ${(h.bytes/1e6).toFixed(3)} MB`).join('\n');}while(j.state==='running');
if(j.state==='done'){const r=j.result;$('result').hidden=false;$('resultTitle').textContent=r.met?'转换完成':'已生成最小结果，但未达到大小上限';$('details').textContent=`${(r.bytes/1e6).toFixed(3)} MB · ${r.fps} 帧/秒 · 预计 ${new Date(j.nextCleanupAt).toLocaleTimeString()} 自动清理，请及时下载`;$('download').href=r.url;$('gif').src=r.url;}else if(j.state==='error')throw new Error(j.message);
}catch(err){$('status').textContent=`转换未完成：${err.message}`;}finally{jobId=null;lock(false)}};
$('cancel').onclick=async()=>{if(jobId){try{await json(`/api/jobs/${jobId}`,{method:'DELETE'});$('status').textContent='正在取消…';}catch(e){$('status').textContent=e.message}}};

// 收到真实备案号后填入；未配置时不展示虚构号码。
const icpNumber = "";
if(icpNumber){$("icp").textContent=icpNumber;$("icp").hidden=false;}
