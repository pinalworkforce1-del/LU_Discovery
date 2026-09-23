const ENGINE_VERSION="1.0.3";
const CACHE_PREFIX="level-up-offline";
const scopeUrl=new URL(self.registration.scope);
const scopeKey=scopeUrl.pathname.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"")||"root";
const CACHE_NAME=`${CACHE_PREFIX}-${scopeKey}-v${ENGINE_VERSION}`;
const MANIFEST_URL=new URL("offline-manifest.json",self.registration.scope).toString();

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    for(const url of [self.registration.scope,MANIFEST_URL]){
      try{const r=await fetch(url,{cache:"no-store"});if(r.ok)await cache.put(url,r.clone())}catch(_){}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));

function inScope(url){return url.origin===scopeUrl.origin&&url.pathname.startsWith(scopeUrl.pathname)}
function cacheable(r){return r&&r.ok&&r.type!=="opaque"&&r.status!==206}

async function scopeCaches(){
  return (await caches.keys()).filter(k=>k.startsWith(CACHE_PREFIX+"-"+scopeKey+"-"));
}
async function matchAny(request){
  const names=await scopeCaches();
  names.sort((a,b)=>a===CACHE_NAME?-1:b===CACHE_NAME?1:0);
  for(const name of names){
    const hit=await (await caches.open(name)).match(request,{ignoreSearch:true,ignoreVary:true});
    if(hit)return hit;
  }
  return null;
}
async function retireOld(){
  const names=await scopeCaches();
  await Promise.all(names.filter(n=>n!==CACHE_NAME).map(n=>caches.delete(n)));
}
async function ranged(request,cached){
  const h=request.headers.get("range");
  if(!h)return cached;
  const m=/^bytes=(\d*)-(\d*)$/.exec(h.trim());
  if(!m)return cached;
  const blob=await cached.blob(),size=blob.size;
  let start,end;
  if(m[1]===""&&m[2]==="")return cached;
  if(m[1]===""){
    const suffix=Number(m[2]); if(!Number.isFinite(suffix)||suffix<=0)return cached;
    start=Math.max(0,size-suffix); end=size-1;
  }else{
    start=Number(m[1]); end=m[2]===""?size-1:Number(m[2]);
  }
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||start>=size||end<start){
    return new Response(null,{status:416,headers:{"Content-Range":`bytes */${size}`}});
  }
  end=Math.min(end,size-1);
  const type=cached.headers.get("content-type")||blob.type||"application/octet-stream";
  return new Response(blob.slice(start,end+1,type),{status:206,headers:{
    "Content-Type":type,"Content-Range":`bytes ${start}-${end}/${size}`,
    "Content-Length":String(end-start+1),"Accept-Ranges":"bytes"
  }});
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(!inScope(url))return;

  if(request.mode==="navigate"){
    event.respondWith((async()=>{
      try{
        const r=await fetch(request);
        if(cacheable(r)){try{await (await caches.open(CACHE_NAME)).put(request,r.clone())}catch(_){}}
        return r;
      }catch(_){
        return (await matchAny(request))||
          (await matchAny(new Request(new URL("index.html",self.registration.scope).toString())))||
          (await matchAny(new Request(self.registration.scope)))||Response.error();
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const hit=await matchAny(request);
    if(hit){
      if(!request.headers.has("range")){
        event.waitUntil(fetch(request).then(async r=>{
          if(cacheable(r)){try{await (await caches.open(CACHE_NAME)).put(request,r.clone())}catch(_){}}
        }).catch(()=>{}));
      }
      return ranged(request,hit);
    }
    try{
      const r=await fetch(request);
      if(cacheable(r)){try{await (await caches.open(CACHE_NAME)).put(request,r.clone())}catch(_){}}
      return r;
    }catch(_){return Response.error()}
  })());
});

async function prepareOffline(){
  const mr=await fetch(MANIFEST_URL,{cache:"no-store"});
  if(!mr.ok)throw new Error("Offline manifest unavailable");
  const manifest=await mr.json(),files=Array.isArray(manifest.files)?manifest.files:[];
  const cache=await caches.open(CACHE_NAME);
  let completed=0,total=0; const failures=[];
  total++;
  try{
    const rootResponse=await fetch(self.registration.scope,{cache:"reload"});
    if(!cacheable(rootResponse))throw new Error("HTTP "+rootResponse.status);
    await cache.put(self.registration.scope,rootResponse.clone());
    completed++;
  }catch(error){failures.push({path:"./",error:String(error?.message||error)})}
  for(const entry of files){
    const raw=typeof entry==="string"?entry:entry.path;
    if(!raw)continue; total++;
    const url=new URL(raw,self.registration.scope).toString();
    try{
      const r=await fetch(url,{cache:"reload"});
      if(!cacheable(r))throw new Error("HTTP "+r.status);
      await cache.put(url,r); completed++;
    }catch(error){failures.push({path:raw,error:String(error?.message||error)})}
  }
  await cache.put(MANIFEST_URL,new Response(JSON.stringify(manifest),{headers:{"Content-Type":"application/json"}}));
  const ok=failures.length===0&&completed===total;
  if(ok)await retireOld();
  return {ok,engineVersion:ENGINE_VERSION,completed,total,failures,manifest};
}

async function status(){
  const cache=await caches.open(CACHE_NAME),keys=await cache.keys();
  return {engineVersion:ENGINE_VERSION,cachedRequests:keys.length};
}

self.addEventListener("message",event=>{
  const {type}=event.data||{}; if(!type)return;
  const reply=p=>event.ports?.[0]?.postMessage(p);
  if(type==="PREPARE_OFFLINE")event.waitUntil(prepareOffline().then(reply).catch(e=>reply({ok:false,engineVersion:ENGINE_VERSION,error:String(e?.message||e)})));
  else if(type==="OFFLINE_STATUS")event.waitUntil(status().then(s=>reply({ok:true,...s})));
  else if(type==="SKIP_WAITING"){self.skipWaiting();reply({ok:true,engineVersion:ENGINE_VERSION})}
});
