/* Level Up-only Nova experience discovery.
   Original Northern bullet selection remains untouched. Story and discovered themes
   are stored with each résumé/experience, not only in temporary UI memory. */
(()=>{
 'use strict';
 const ctx=window.LEVELUP_NOVA_R2W;
 if(!ctx?.verified||!ctx.client)return;
 const endpoint='https://dnijrzotfyvmmnmueknk.supabase.co/functions/v1/levelup-nova-resume-discovery-staging';
 const key='sb_publishable_qSEo4iczJBozMaSIvTKisw_BsJy-iPc';
 const STORAGE=ctx.storageKey;
 const field=document.getElementById('rbEvidence');
 const label=document.getElementById('rbEvidenceLabel');
 if(!field||!label||document.getElementById('luExperienceDiscovery'))return;
 const section=document.createElement('section');
 section.id='luExperienceDiscovery';
 section.style.cssText='border:1px solid #cbd5e4;border-radius:13px;background:#f3f8fd;padding:14px 16px;margin:12px 0;color:#163651';
 const heading=document.createElement('strong');
 heading.textContent='Nova · Explore your accomplishments';
 heading.style.cssText='display:block;font-size:16px;margin-bottom:5px';
 const guidance=document.createElement('p');
 guidance.textContent='Tell your story in everyday words. Nova will separate your accomplishments so you can develop them one at a time. Your full story and other ideas stay saved while you work.';
 guidance.style.cssText='font-size:14px;line-height:1.5;margin:0 0 12px';
 const discover=document.createElement('button');
 discover.type='button';discover.id='luFindAccomplishments';discover.className='secondary-btn';
 discover.textContent='✦ Nova: Find accomplishments in my story';
 const status=document.createElement('p');status.id='luDiscoveryStatus';status.setAttribute('role','status');
 status.style.cssText='font-size:13px;margin:10px 0 0';
 const results=document.createElement('div');results.id='luDiscoveryResults';
 results.style.cssText='display:grid;gap:10px;margin-top:12px';
 const source=document.createElement('details');source.id='luDiscoveryOriginal';source.hidden=true;
 const summary=document.createElement('summary');summary.textContent='My original story (saved)';
 const original=document.createElement('p');original.style.cssText='white-space:pre-wrap;font-size:13px';
 source.append(summary,original);
 const sourceActions=document.createElement('div');
 const restore=document.createElement('button');restore.type='button';restore.id='luRestoreFullStory';restore.className='secondary-btn';
 restore.textContent='Put original story back in the text box';
 restore.style.cssText='margin:8px 0 3px';
 sourceActions.append(restore);source.append(sourceActions);
 const next=document.createElement('button');
 next.type='button';next.id='luDevelopNextAccomplishment';next.className='primary-btn';
 next.style.cssText='display:none;margin:10px 0;padding:11px 16px';
 next.textContent='→ Develop next accomplishment';
 section.append(heading,guidance,discover,status,next,results,source);
 label.insertAdjacentElement('afterend',section);
 let pending=false;
 let currentExperience=-1;
 const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||'{}').resumeBuilder||{}}catch{return {}}};
 const experienceIndex=()=>Number.isInteger(read().activeExperience)?read().activeExperience:0;
 const collectionFor=(d,index)=>d?.novaDiscoveryCollections?.[index]||null;
 function persist(index,collection){
  window.dispatchEvent(new CustomEvent('levelup-nova-discovery-update',{detail:{index,collection:JSON.parse(JSON.stringify(collection))}}));
 }
 const checkMark=item=>item.status==='complete'?'✓ Added':item.status==='in_progress'?'In progress':'Not yet developed';
 function render(){
  const d=read(),index=experienceIndex(),c=collectionFor(d,index);
  currentExperience=index;
  results.replaceChildren();
  const coachButton=document.getElementById('rbBuildBullet');
  // Avoid offering two apparently equivalent actions once Nova has organized a story.
  if(coachButton)coachButton.hidden=!!c?.items?.length;
  next.style.display='none';
  source.hidden=!c?.original;
  original.textContent=c?.original||'';
  restore.hidden=!c?.original;
  if(!c?.items?.length){
   discover.textContent='✦ Nova: Find accomplishments in my story';
   status.textContent='';
   return;
  }
  discover.textContent='✦ Nova: Review these accomplishments';
  const n=c.items.length,done=c.items.filter(x=>x.status==='complete').length;
  const pendingIndex=c.items.findIndex(x=>x.status==='pending');
  if(done>0&&pendingIndex>=0&&c.activeIndex==null){
   next.style.display='inline-block';
   next.onclick=()=>results.querySelector('[data-accomplishment-index="'+pendingIndex+'"] button')?.click();
  }
  status.textContent='Nova found '+n+' accomplishment'+(n===1?'':'s')+'. '+done+' added to your résumé. Choose another to develop whenever you are ready.';
  c.items.forEach((item,i)=>{
   const box=document.createElement('div');
   box.style.cssText='border:1px solid '+(item.status==='in_progress'?'#3182b7':'#bbccdc')+';background:white;border-radius:10px;padding:11px 13px';
   box.dataset.accomplishmentIndex=String(i);
   const title=document.createElement('strong');title.textContent=(i+1)+'. '+item.title;
   const category=document.createElement('span');category.textContent=' · '+item.category;
   category.style.cssText='color:#4d6980;font-size:12px';
   const progress=document.createElement('span');progress.textContent=' · '+checkMark(item);
   progress.style.cssText='font-size:12px;font-weight:700;color:#2e657e';
   const detail=document.createElement('p');detail.textContent=item.source;
   detail.style.cssText='white-space:pre-wrap;margin:8px 0;font-size:14px';
   const use=document.createElement('button');use.type='button';use.className='secondary-btn';
   use.textContent=item.status==='complete'?'Develop another bullet from this idea':item.status==='in_progress'?'Continue this accomplishment':'Develop this accomplishment';
   use.setAttribute('aria-pressed',String(item.status==='in_progress'));
   use.addEventListener('click',()=>{
    const fresh=collectionFor(read(),index);
    if(!fresh?.items?.[i])return;
    const updated=JSON.parse(JSON.stringify(fresh));
    updated.items.forEach((x,j)=>{if(x.status==='in_progress'&&j!==i)x.status='pending'});
    updated.items[i].status='in_progress';
    updated.activeIndex=i;
    persist(index,updated);
    // Every distinct accomplishment is a new coaching session.
    window.dispatchEvent(new Event('levelup-nova-coaching-reset'));
    field.value=(updated.items[i].workingText||updated.items[i].source).replace(/\\\\n/g,'\n');
    field.dispatchEvent(new Event('input',{bubbles:true}));
    const choices=document.getElementById('rbBulletChoices');
    choices?.replaceChildren();
    const coach=document.getElementById('rbBulletCoach');
    if(coach){coach.hidden=true;coach.replaceChildren()}
    render();
    status.textContent='Nova is coaching you through '+updated.items[i].title+'. Your original story and other accomplishments remain saved.';
    const coaching=document.getElementById('rbBuildBullet');
    if(coaching&&!coaching.disabled)coaching.click();
    else status.textContent='Nova is already coaching a bullet. Finish that draft before starting another.';

   });
   box.append(title,category,progress,detail,use);results.append(box);
  });
 }
 restore.addEventListener('click',()=>{
  const c=collectionFor(read(),experienceIndex());
  if(!c?.original)return;
  field.value=c.original;
  field.dispatchEvent(new Event('input',{bubbles:true}));
  status.textContent='Original story restored for review. Your discovered accomplishments remain saved below.';
  field.focus();
 });
 // While a specific accomplishment is being developed, preserve clarifications
 // independently from the untouched original story and remaining themes.
 field.addEventListener('input',()=>{
  const index=experienceIndex(),c=collectionFor(read(),index);
  const active=c?.activeIndex;
  if(!Number.isInteger(active)||!c.items?.[active]||c.items[active].status!=='in_progress')return;
  const updated=JSON.parse(JSON.stringify(c));
  updated.items[active].workingText=field.value;
  persist(index,updated);
 });
 // Existing Northern builder handles approving and inserting the actual résumé bullet.
 // Mark the chosen theme complete only once the approved bullet is in the saved draft.
 document.addEventListener('click',e=>{
  if(!e.target.closest('#rbCommitSelectedBullet'))return;
  const index=experienceIndex(),c=collectionFor(read(),index),active=c?.activeIndex;
  if(!Number.isInteger(active)||!c?.items?.[active])return;
  setTimeout(()=>{
   const d=read(),latest=collectionFor(d,index),item=latest?.items?.[active];
   if(!item||item.status!=='in_progress')return;
   const bullets=d.experiences?.[index]?.bullets||[];
   const count=bullets.length;
   if(!count)return;
   const updated=JSON.parse(JSON.stringify(latest));
   updated.items[active].status='complete';
   updated.items[active].approvedBullet=bullets[bullets.length-1];
   updated.activeIndex=null;
   persist(index,updated);
   render();
   const remaining=updated.items.filter(x=>x.status==='pending').length;
   status.textContent=remaining
     ? 'Bullet added! '+remaining+' accomplishment'+(remaining===1?' remains':'s remain')+'. Select “Develop next accomplishment” when you’re ready.'
     : 'All discovered accomplishments have been reviewed. You can continue to Skills & Education.';
  },100);
 },false);
 discover.addEventListener('click',async()=>{
  if(pending)return;
  const index=experienceIndex(),old=collectionFor(read(),index);
  if(old?.items?.length){render();results.scrollIntoView({behavior:'smooth',block:'nearest'});return}
  const narrative=field.value.trim();
  if(narrative.length<16){status.textContent='Tell Nova about your school, work, activities, or volunteering first.';field.focus();return}
  pending=true;discover.disabled=true;discover.textContent='Nova is organizing your story…';
  status.textContent='Finding distinct accomplishments while keeping your original words.';
  try{
   const {data,error}=await ctx.client.auth.getSession();
   const token=data?.session?.access_token;
   if(error||!token)throw new Error('Your Level Up session needs to be refreshed.');
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+token},body:JSON.stringify({narrative,target:document.getElementById('rbTarget')?.value||''})});
   const answer=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(answer?.error||'Nova could not organize that story.');
   const items=(Array.isArray(answer.items)?answer.items:[]).filter(x=>x&&x.title&&x.source).slice(0,6).map(x=>({
    title:String(x.title),source:String(x.source),category:String(x.category||'other'),status:'pending',workingText:''
   }));
   if(!items.length)throw new Error('No distinct accomplishments found. You can still develop a bullet from your notes.');
   persist(index,{original:narrative,items,activeIndex:null,createdAt:new Date().toISOString()});
   render();
  }catch(e){status.textContent=(e?.message||'Nova discovery is unavailable.')+' Your original notes remain in the text box.'}
  finally{pending=false;discover.disabled=false}
 });
 window.addEventListener('levelup-nova-discovery-refresh',render);
 window.addEventListener('boost-r2w-cloud-restored',()=>setTimeout(render,0));
 render();
})();