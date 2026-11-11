/* Level Up-only cloud boundary for the intact Northern staged résumé builder.
 * No Northern tables, credentials, or UI modifications.
 * Preserve resume_profiles.master_data legacy content and resume_versions history. */
(()=>{
 'use strict';
 const ctx=window.LEVELUP_NOVA_R2W;
 if(!ctx?.verified||!ctx.client||!ctx.userId)return;
 const {client,userId:uid,storageKey:KEY,scopedKey}=ctx;
 const say=msg=>{let el=document.getElementById('r2wSaveStatus');if(!el){el=document.createElement('span');el.id='r2wSaveStatus';el.setAttribute('role','status');el.style.cssText='font:700 12px system-ui;color:#173850;padding:5px 10px';document.getElementById('resumeBuilderStatus')?.after(el)}if(el)el.textContent=msg};
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}};
 const snapshot=()=>read()?.resumeBuilder||null;
 let ready=false,busy=false,queued=false,timer=null,last='',lastError='';
 async function getMaster(){
  const {data,error}=await client.from('resume_profiles').select('master_data').eq('user_id',uid).maybeSingle();
  if(error)throw error;
  return data?.master_data||{};
 }
 const toString=value=>typeof value==='string'?value:String(value||'');
 function canonical(d,previous){
  const prior=previous&&typeof previous==='object'?previous:{};
  const versions=Array.isArray(d.versions)?d.versions:[];
  const v=versions[d.activeVersion||0]||{};
  const experiences=Array.isArray(d.experiences)?d.experiences:[];
  const bullets=experiences.flatMap(x=>(Array.isArray(x?.bullets)?x.bullets:[]).filter(x=>typeof x==='string'&&x.trim()).map(x=>({
   bullet:x.trim(),text:x.trim(),role:toString(x?.role),employer:toString(x?.employer),source:'levelup-nova-staged-verified'
  })));
  return {...prior,contact:{...(prior.contact||{}),...(d.contact||{})},
    role:toString(v.target||d.target),roleMode:'known',roleCode:toString(v.onetOccupationCode||''),
    summary:toString(v.summary||d.summary),education:toString(d.education),bullets,
    experiences:JSON.parse(JSON.stringify(experiences)),
    levelUpNorthernDirectResume:JSON.parse(JSON.stringify(d)),
    novaFinalized:true};
 }
 async function persist(){
  if(!ready||busy||!queued)return false;
  const state=read(),d=state?.resumeBuilder;
  if(!d||typeof d!=='object')return false;
  busy=true;queued=false;
  try{
   const raw=JSON.stringify(d);
   if(raw===last){say('Saved to Level Up');return true}
   const master=await getMaster();
   const next={...master,levelUpNorthernDirectResume:JSON.parse(raw)};
   const {error}=await client.from('resume_profiles').upsert({
    user_id:uid,master_data:next,updated_at:new Date().toISOString()
   },{onConflict:'user_id'});
   if(error)throw error;
   last=raw;lastError='';
   localStorage.setItem(scopedKey,JSON.stringify(state));
   say('Saved to Level Up');
   return true;
  }catch(error){
   queued=true;lastError=error.message||'Cloud save failed';say('Cloud save pending — draft kept in this browser');
   return false;
  }finally{
   busy=false;
   if(queued){clearTimeout(timer);timer=setTimeout(()=>void persist(),3500)}
  }
 }
 function schedule(){
  const state=read();if(!state?.resumeBuilder)return;
  try{localStorage.setItem(scopedKey,JSON.stringify(state))}catch{}
  queued=true;clearTimeout(timer);timer=setTimeout(()=>void persist(),550);
 }
 async function ensureSaved(){
  queued=true;clearTimeout(timer);
  for(let i=0;i<2;i++){if(busy){await new Promise(r=>setTimeout(r,300));continue}
   if(await persist())return true;
  }
  return false;
 }
 async function complete(){
  const d=snapshot();
  if(!d?.complete)throw new Error('Finish verifying your résumé before completing.');
  if(!await ensureSaved())throw new Error('Cloud save is not yet confirmed. Your résumé remains a draft.');
  const master=await getMaster();
  const t=toString(d.versions?.[d.activeVersion||0]?.target||d.target).trim();
  const c=canonical(d,master);
  if(!t||!c.contact?.name||!c.bullets.some(b=>b.bullet.length>=16))throw new Error('Add a target, contact name, and reviewed bullet before completion.');
  if(d.levelUpVersionSavedId)return d.levelUpVersionSavedId;
  const {data,error}=await client.from('resume_versions').insert({
   user_id:uid,version_name:toString(d.versions?.[d.activeVersion||0]?.name||'Nova staged résumé'),
   target_role:t,occupation_code:toString(d.versions?.[d.activeVersion||0]?.onetOccupationCode||'')||null,
   version_data:c
  }).select('id').single();
  if(error||!data?.id)throw error||new Error('Version save was not confirmed.');
  d.levelUpVersionSavedId=data.id;
  const state=read()||{};state.resumeBuilder=d;localStorage.setItem(KEY,JSON.stringify(state));
  schedule();await ensureSaved();
  say('Completed résumé version saved to Level Up');
  return data.id;
 }
 ctx.complete=complete;
 ctx.flush=ensureSaved;
 window.addEventListener('boost-r2w-saved',schedule);
 window.addEventListener('online',schedule);
 (async()=>{
  try{
   const master=await getMaster(),incoming=master.levelUpNorthernDirectResume;
   const local=snapshot();
   if(incoming&&typeof incoming==='object'){
    const remoteTime=Date.parse(incoming.lastEditedAt||'')||0;
    const localTime=Date.parse(local?.lastEditedAt||'')||0;
    if(!local||remoteTime>localTime){
     const state=read()||{};
     state.resumeBuilder=incoming;
     localStorage.setItem(KEY,JSON.stringify(state));
     localStorage.setItem(scopedKey,JSON.stringify(state));
     window.dispatchEvent(new CustomEvent('boost-r2w-cloud-restored',{detail:{progress:{resumeBuilder:incoming}}}));
    }
   }
   ready=true;last=JSON.stringify(snapshot()||{});
   say('Level Up cloud connected');
   if(snapshot())schedule();
  }catch(e){ready=true;say('Cloud connection unavailable — draft remains on this device');}
 })();
})();