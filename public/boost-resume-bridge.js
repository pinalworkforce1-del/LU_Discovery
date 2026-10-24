// Opt-in shared résumé bridge; no account tokens cross the iframe boundary.
(function(){
  if(new URLSearchParams(location.search).get('source')!=='boost2'||window.parent===window)return;
  const origin='https://pinalworkforce1-del.github.io';
  const pending=new Map();let next=0;
  function request(action,payload){
    if(!['save','load'].includes(action))return Promise.reject(Error('Unsupported action'));
    return new Promise((resolve,reject)=>{
      const id=++next;pending.set(id,{resolve,reject});
      window.parent.postMessage({type:'boost2-resume-request',id,action,payload},origin);
      setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(Error('BOOST response timed out'))}},15000);
    });
  }
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||event.origin!==origin)return;
    const d=event.data||{};
    if(d.type==='boost2-resume-response'&&pending.has(d.id)){
      const task=pending.get(d.id);pending.delete(d.id);
      d.ok?task.resolve(d.data):task.reject(Error(d.error||'BOOST save failed'));
    }
  });
  window.boostResumeBridge=Object.freeze({
    request,saveDraft:draft=>request('save',draft),
    loadDraft:()=>request('load'),
    notifyReady:()=>window.parent.postMessage({type:'boost2-resume-ready'},origin)
  });
})();