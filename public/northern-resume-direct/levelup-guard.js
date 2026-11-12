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
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'sb-'+REF+'-auth-token'}
 });
 if(!client){say('Level Up sign-in library is unavailable.');return}
 async function signInOnStaging(){
  // GitHub Pages sites use separate browser storage. Authenticate with the SAME
  // existing Level Up email rather than assuming a session transfers domains.
  const panel=document.createElement('form');
  panel.style.cssText='display:grid;gap:12px;margin-top:16px';
  const email=document.createElement('input');
  email.type='email';email.required=true;email.autocomplete='email';
  email.placeholder='Your existing Level Up email';
  email.setAttribute('aria-label','Existing Level Up email');
  const code=document.createElement('input');
  code.type='text';code.inputMode='numeric';code.autocomplete='one-time-code';
  code.placeholder='Numeric code (only if your email includes one)';code.setAttribute('aria-label','Email verification code');
  code.hidden=true;
  const submit=document.createElement('button');submit.type='submit';submit.textContent='Email me a sign-in link';
  submit.style.cssText='border:0;padding:12px 18px;border-radius:9px;background:#e1f4fc;color:#12374a;font-weight:700;cursor:pointer';
  const status=document.createElement('p');status.setAttribute('role','status');
  status.style.cssText='margin:0;font-size:13px';
  panel.append(email,code,submit,status);
  root.querySelector('.inner')?.append(panel);
  say('Sign in with your existing Level Up email. Follow the sign-in link from your email back to this page. No new account is created.');
  let awaitingCode=false;
  return await new Promise(resolve=>{
   panel.addEventListener('submit',async event=>{
    event.preventDefault();submit.disabled=true;status.textContent='Checking sign-in…';
    try{
     if(!awaitingCode){
      const redirect=location.origin+location.pathname;
      const {error}=await client.auth.signInWithOtp({email:email.value.trim(),options:{shouldCreateUser:false,emailRedirectTo:redirect}});
      if(error)throw error;
      awaitingCode=true;email.readOnly=true;code.hidden=false;code.required=false;
      submit.textContent='Verify code (if provided)';
      status.textContent='Check your email and click the Level Up sign-in link. It should return to this staging page. If the email provides a numeric code instead, enter it here.';
     }else{
      if(!code.value.trim())throw new Error('Open the sign-in link in your email, or enter the numeric code if one was sent.');
      const {data,error}=await client.auth.verifyOtp({email:email.value.trim(),token:code.value.trim(),type:'email'});
      if(error)throw error;
      if(!data?.session)throw new Error('The sign-in code did not create a verified session.');
      panel.remove();resolve(data.session);
     }
    }catch(err){status.textContent=err?.message||'Could not verify the email code.'}
    finally{submit.disabled=false}
   });
  });
 }
 try{
  const {data:sd,error:se}=await client.auth.getSession();
  if(se)throw se;
  if(!sd?.session)await signInOnStaging();
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
  // This isolated test route always opens the source four-step résumé builder, not the Northern course map.
  if(location.hash!=='#resume-builder')history.replaceState(null,'','#resume-builder');
  const entryParam=new URLSearchParams(location.search).get('from');
  const allowedEntry=['resume-district','ready-2-work'];
  const entryKey=STORAGE+':entry:'+uid;
  if(allowedEntry.includes(entryParam))sessionStorage.setItem(entryKey,entryParam);
  const origin=allowedEntry.includes(entryParam)?entryParam:(sessionStorage.getItem(entryKey)||null);
  const destinations={
   'resume-district':{label:'Resume District',url:'https://pinalworkforce1-del.github.io/Resume_District/'},
   'ready-2-work':{label:'Ready 2 Work map',url:'https://pinalworkforce1-del.github.io/Level_Up_Portal/career-tree-next/ready-2-work/#map'}
  };
  function chooseReturn(){
   let dialog=document.getElementById('luResumeReturnDialog');
   if(!dialog){
    dialog=document.createElement('dialog');dialog.id='luResumeReturnDialog';
    dialog.style.cssText='max-width:500px;width:calc(100% - 32px);border:1px solid #c4d6e5;border-radius:16px;padding:24px;color:#18384f;box-shadow:0 20px 80px #0005';
    const heading=document.createElement('h2');heading.textContent='Your résumé is saved';
    const guidance=document.createElement('p');guidance.textContent='Choose where to return in Level Up, or stay here to keep editing.';
    dialog.append(heading,guidance);
    for(const item of Object.values(destinations)){
     const btn=document.createElement('button');btn.type='button';btn.textContent='Return to '+item.label;
     btn.style.cssText='display:block;margin:10px 0;padding:12px 15px;border:0;border-radius:8px;background:#176088;color:white;cursor:pointer';
     btn.onclick=()=>location.assign(item.url);
     dialog.append(btn);
    }
    const stay=document.createElement('button');stay.type='button';stay.textContent='Keep editing';
    stay.style.cssText='padding:12px 15px;border:1px solid #9db4c2;border-radius:8px;background:white;cursor:pointer';
    stay.onclick=()=>dialog.close();dialog.append(stay);document.body.append(dialog);
   }
   dialog.showModal();
  }
  function navigateBack(){
   if(origin&&destinations[origin])location.assign(destinations[origin].url);
   else chooseReturn();
  }
  window.LEVELUP_NOVA_R2W={client,userId:uid,verified:true,storageKey:STORAGE,scopedKey:scoped,origin,navigateBack};
  const scripts=['course-data.js','resume-evidence-review-v1.js','resume-occupation-titles-v1.js','resume-occupation-search-v1.js','resume-format-v1.js','app.js','resume-polish-v1.js','resume-strategy-v1.js','interview-landing-v1.js','levelup-resume-cloud.js','levelup-experience-discovery.js'];
  for(const src of scripts){
   await new Promise((resolve,reject)=>{
    const el=document.createElement('script');el.src='./'+src;el.onload=resolve;el.onerror=()=>reject(new Error('Could not load '+src));document.body.appendChild(el);
   });
  }
  root.hidden=true;
 }catch(e){say(e?.message||'Could not open the Level Up résumé test safely. Your existing saved work has not been altered.')}
})();