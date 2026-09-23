(() => {
  if (!("serviceWorker" in navigator)) return;
  const CLIENT_ENGINE_VERSION="1.0.2";
  const script=document.currentScript;
  const localRoot=script?new URL("./",script.src).pathname:new URL("./",location.href).pathname;

  const normalizeRoot=(root)=>{
    let value=root||localRoot;
    if(!value.startsWith("/"))value="/"+value;
    if(!value.endsWith("/"))value+="/";
    return value;
  };

  const post=(worker,type,timeoutMs=180000)=>new Promise((resolve,reject)=>{
    if(!worker){reject(new Error("Offline worker is not available"));return}
    const channel=new MessageChannel();
    const timer=setTimeout(()=>reject(new Error("Offline worker timed out")),timeoutMs);
    channel.port1.onmessage=(event)=>{clearTimeout(timer);resolve(event.data)};
    worker.postMessage({type},[channel.port2]);
  });

  const waitState=(worker,timeoutMs=15000)=>new Promise((resolve)=>{
    if(!worker||worker.state==="activated"||worker.state==="redundant"){resolve(worker);return}
    const timer=setTimeout(()=>resolve(worker),timeoutMs);
    const done=()=>{
      if(worker.state==="activated"||worker.state==="redundant"){
        clearTimeout(timer);worker.removeEventListener("statechange",done);resolve(worker);
      }
    };
    worker.addEventListener("statechange",done);
  });

  async function register(root=localRoot){
    const scope=normalizeRoot(root);
    const swUrl=new URL(scope+"offline-sw.js",location.origin).toString();
    return navigator.serviceWorker.register(swUrl,{scope,updateViaCache:"none"});
  }

  async function activeWorker(root){
    const reg=await register(root);
    try{await reg.update()}catch(_){}
    if(reg.installing)await waitState(reg.installing);
    if(reg.waiting){
      try{await post(reg.waiting,"SKIP_WAITING",5000)}catch(_){}
      await waitState(reg.waiting);
    }
    let worker=reg.active||reg.waiting||reg.installing;
    if(!worker)throw new Error("Offline worker is not available");

    let status=null;
    try{status=await post(worker,"OFFLINE_STATUS",8000)}catch(_){}
    if(status?.engineVersion!==CLIENT_ENGINE_VERSION){
      try{await reg.update()}catch(_){}
      if(reg.installing)await waitState(reg.installing);
      if(reg.waiting){
        try{await post(reg.waiting,"SKIP_WAITING",5000)}catch(_){}
        await waitState(reg.waiting);
      }
      worker=reg.active||reg.waiting||reg.installing;
      status=worker?await post(worker,"OFFLINE_STATUS",8000):null;
    }
    if(status?.engineVersion!==CLIENT_ENGINE_VERSION){
      throw new Error("Offline engine update is still installing");
    }
    return worker;
  }

  async function prepareScope(root){
    const worker=await activeWorker(root);
    const result=await post(worker,"PREPARE_OFFLINE");
    if(result?.engineVersion!==CLIENT_ENGINE_VERSION)throw new Error("Offline preparation used an outdated worker");
    return result;
  }

  async function prepareScopes(roots,onProgress){
    const unique=[...new Set((roots||[]).map(normalizeRoot))];
    const results=[];
    for(let i=0;i<unique.length;i+=1){
      const root=unique[i];
      onProgress?.({phase:"start",root,index:i,total:unique.length});
      const result=await prepareScope(root);
      results.push({root,...result});
      onProgress?.({phase:"complete",root,index:i,total:unique.length,result});
      if(!result?.ok)throw Object.assign(new Error("Offline preparation failed for "+root),{result,root});
    }
    return results;
  }

  async function estimateScopes(roots){
    const unique=[...new Set((roots||[]).map(normalizeRoot))];
    const manifests=[];
    for(const root of unique){
      const url=new URL(root+"offline-manifest.json",location.origin);
      const response=await fetch(url,{cache:"no-store"});
      if(!response.ok)throw new Error("Offline manifest unavailable for "+root);
      manifests.push({root,...(await response.json())});
    }
    return {
      manifests,
      totalBytes:manifests.reduce((sum,m)=>sum+Number(m.totalBytes||0),0),
      totalFiles:manifests.reduce((sum,m)=>sum+Number(m.files?.length||0),0),
    };
  }

  window.LevelUpOffline={version:CLIENT_ENGINE_VERSION,register,prepareScope,prepareScopes,estimateScopes,normalizeRoot};
  activeWorker(localRoot).catch(error=>console.warn("Level Up offline registration deferred",error));
})();
