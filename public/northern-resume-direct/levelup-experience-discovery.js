/* Level Up-only Nova experience discovery.
   Converts freeform notes into separate, participant-selectable threads.
   Existing Northern bullet drafting/verification remains untouched. */
(()=>{
 'use strict';
 const ctx=window.LEVELUP_NOVA_R2W;
 if(!ctx?.verified||!ctx.client)return;
 const endpoint='https://dnijrzotfyvmmnmueknk.supabase.co/functions/v1/levelup-nova-resume-discovery-staging';
 const key='sb_publishable_qSEo4iczJBozMaSIvTKisw_BsJy-iPc';
 const field=document.getElementById('rbEvidence');
 if(!field||document.getElementById('luExperienceDiscovery'))return;
 const label=document.getElementById('rbEvidenceLabel');
 if(!label)return;
 const section=document.createElement('section');
 section.id='luExperienceDiscovery';
 section.style.cssText='border:1px solid #cbd5e4;border-radius:13px;background:#f3f8fd;padding:14px 16px;margin:12px 0;color:#163651';
 const heading=document.createElement('strong');
 heading.textContent='Nova · Discover accomplishments in your story';
 heading.style.cssText='display:block;font-size:16px;margin-bottom:5px';
 const guidance=document.createElement('p');
 guidance.textContent='It’s okay to write everything at once. Nova can separate school, work, leadership and volunteer accomplishments into individual ideas. Nothing goes on your résumé until you review and add it.';
 guidance.style.cssText='font-size:14px;line-height:1.5;margin:0 0 12px';
 const discover=document.createElement('button');
 discover.type='button';discover.id='luFindAccomplishments';discover.className='secondary-btn';
 discover.textContent='✦ Nova: Find accomplishments in my story';
 const status=document.createElement('p');status.id='luDiscoveryStatus';status.setAttribute('role','status');
 status.style.cssText='font-size:13px;margin:10px 0 0';
 const results=document.createElement('div');results.id='luDiscoveryResults';
 results.style.cssText='display:grid;gap:10px;margin-top:12px';
 const source=document.createElement('details');source.id='luDiscoveryOriginal';source.hidden=true;
 const summary=document.createElement('summary');summary.textContent='Review my original story';
 const original=document.createElement('p');original.style.cssText='white-space:pre-wrap;font-size:13px';
 source.append(summary,original);
 section.append(heading,guidance,discover,status,results,source);
 label.insertAdjacentElement('afterend',section);
 let pending=false,story='',items=[];
 function showItems(list){
  results.replaceChildren();
  list.forEach((item,index)=>{
   const box=document.createElement('div');
   box.style.cssText='border:1px solid #bbccdc;background:white;border-radius:10px;padding:11px 13px';
   const title=document.createElement('strong');title.textContent=(index+1)+'. '+item.title;
   const category=document.createElement('span');category.textContent=' · '+item.category;
   category.style.cssText='color:#4d6980;font-size:12px';
   const detail=document.createElement('p');detail.textContent=item.source;
   detail.style.cssText='white-space:pre-wrap;margin:8px 0;font-size:14px';
   const use=document.createElement('button');use.type='button';use.className='secondary-btn';
   use.textContent='Develop this accomplishment';
   use.addEventListener('click',()=>{
    field.value=item.source;
    field.dispatchEvent(new Event('input',{bubbles:true}));
    const choices=document.getElementById('rbBulletChoices');
    if(choices)choices.replaceChildren();
    const coach=document.getElementById('rbBulletCoach');
    if(coach){coach.hidden=true;coach.replaceChildren()}
    results.querySelectorAll('button').forEach(btn=>btn.setAttribute('aria-pressed',String(btn===use)));
    status.textContent='Selected: '+item.title+'. Review the details, then choose “Nova: Turn This Into Résumé Evidence” to draft and approve a bullet.';
    field.focus();
   });
   use.setAttribute('aria-pressed','false');
   box.append(title,category,detail,use);
   results.append(box);
  });
 }
 discover.addEventListener('click',async()=>{
  if(pending)return;
  const narrative=field.value.trim();
  if(narrative.length<16){status.textContent='Start by telling Nova what you did, even in rough notes.';field.focus();return}
  pending=true;discover.disabled=true;discover.textContent='Nova is organizing your story…';
  status.textContent='Looking for separate accomplishments without adding anything to your résumé.';
  try{
   const {data,error}=await ctx.client.auth.getSession();
   const token=data?.session?.access_token;
   if(error||!token)throw new Error('Your Level Up sign-in needs to be refreshed.');
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+token},body:JSON.stringify({narrative,target:document.getElementById('rbTarget')?.value||''})});
   const answer=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(answer?.error||'Nova could not organize the story.');
   const entries=Array.isArray(answer.items)?answer.items.filter(x=>x&&x.title&&x.source).slice(0,6):[];
   if(!entries.length)throw new Error('No separate accomplishments identified. You can still draft a bullet from your notes.');
   story=narrative;items=entries;
   original.textContent=story;source.hidden=false;
   showItems(items);
   status.textContent=answer.intro||('Nova found '+items.length+' ideas. Choose one to develop first.');
  }catch(e){status.textContent=(e?.message||'Nova discovery is unavailable.')+' Your original story is still here and you can use the bullet builder normally.'}
  finally{pending=false;discover.disabled=false;discover.textContent='✦ Nova: Find accomplishments in my story'}
 });
})();