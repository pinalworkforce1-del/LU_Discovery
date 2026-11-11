/* Level Up integration boundary: source Northern résumé builder is loaded only
   after Level Up Supabase confirms the participant's identity. */
(async()=>{
 'use strict';
 const root=document.getElementById('northernGate'),message=document.getElementById('northernGateText');
 const say=value=>{if(message)message.textContent=value};
 const REF='dnijrzotfyvmmnmueknk';
 const URL='https://'+REF+'.supabase.co';
 const KEY='sb_publishable_qSEo4iczJBozMaSIvTKisw_BsJy-iPc';
 const STORAGE='levelup-northern-direct-r2w-v1';
 const client=window.supabase?.createClient(URL,KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sb-'+REF+'-auth-token'}
 });
 if(!client){say('Level Up sign-in library is unavailable.');return}
 try{
  const {data:sd,error:se}=await client.auth.getSession();
  if(se||!sd?.session){say('Sign in to Level Up in this browser, then reopen this test page.');return}
  const {data:identity,error:ie}=await client.auth.getUser();
  const uid=identity?.user?.id;
  if(ie||!uid){say('We could not verify your Level Up session. Sign in again.');return}
  // Never allow two accounts to inherit each other's browser draft.
  const scoped=STORAGE+':'+uid,owner=STORAGE+':owner';
  const previousOwner=localStorage.getItem(owner);
  if(previousOwner&&previousOwner!==uid){localStorage.removeItem(STORAGE);sessionStorage.removeItem(STORAGE);sessionStorage.removeItem(STORAGE+'-backup')}
  localStorage.setItem(owner,uid);
  const raw=localStorage.getItem(scoped);
  if(raw){localStorage.setItem(STORAGE,raw)}
  else{
   const {data:profile,error:pe}=await client.from('resume_profiles').select('master_data').eq('user_id',uid).maybeSingle();
   if(pe)throw new Error('Level Up saved résumé could not be loaded.');
   const master=profile?.master_data||{};
   const direct=master.levelUpNorthernDirectResume;
   const legacy=master.levelUpNovaStudio;
   let resume=null;
   if(direct&&typeof direct==='object')resume=direct;
   else if(legacy&&typeof legacy==='object')resume=legacy;
   else if(master&&Object.keys(master).length){
    const bullets=Array.isArray(master.bullets)?master.bullets.map(b=>typeof b==='string'?b:b?.bullet||'').filter(Boolean):[];
    resume={step:0,contact:master.contact||{},target:master.role||master.target||'',skills:master.skills||'',summary:master.summary||'',education:master.education||'',
     experiences:Array.isArray(master.experiences)&&master.experiences.length?master.experiences:[{role:'',employer:'',evidence:'',bullets}],
     versions:[{name:'Résumé 1',target:master.role||master.target||'',summary:master.summary||'',format:'hybrid'}],activeVersion:0,activeExperience:0};
   }
   if(resume){
    const d=JSON.parse(JSON.stringify(resume));
    if(Array.isArray(d.versions)&&d.versions.length&&d.target&&!d.versions[d.activeVersion||0]?.target){
     d.versions[d.activeVersion||0].target=d.target;
    }
    localStorage.setItem(STORAGE,JSON.stringify({resumeBuilder:d,participantName:d.contact?.name||'',savedAt:new Date().toISOString()}));
   }else localStorage.removeItem(STORAGE);
  }
  window.LEVELUP_NOVA_R2W={client,userId:uid,verified:true,storageKey:STORAGE,scopedKey:scoped};
  const scripts=['course-data.js','resume-evidence-review-v1.js','resume-occupation-titles-v1.js','resume-occupation-search-v1.js','resume-format-v1.js','app.js','resume-polish-v1.js','resume-strategy-v1.js','interview-landing-v1.js','levelup-resume-cloud.js'];
  for(const src of scripts){
   await new Promise((resolve,reject)=>{
    const el=document.createElement('script');el.src='./'+src;el.onload=resolve;el.onerror=()=>reject(new Error('Could not load '+src));document.body.appendChild(el);
   });
  }
  root.hidden=true;
 }catch(e){say(e?.message||'Could not open the Level Up résumé test safely. Your existing saved work has not been altered.')}
})();