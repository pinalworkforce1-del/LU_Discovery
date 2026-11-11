/* BOOST Career Evidence Review v1 — shared UI/workflow across Northern, Pinal and Level Up.
   No automatic résumé claims. All verified entries are scoped to the active résumé version.
   Existing alignment.explored entries remain readable and reviewable. */
(function(){
'use strict';
function create(ctx){
 const {resumeData,saveState,renderResumePreview,callR2WResumeAI,showResumeCoach,syncActiveExperience,escapeHtml:esc,$}=ctx;
 const list=values=>Array.isArray(values)&&values.length?'<ul>'+values.map(v=>'<li>'+esc(String(v))+'</li>').join('')+'</ul>':'<p>No verified items identified yet.</p>';
 const now=()=>new Date().toISOString();
 const entries=a=>Array.isArray(a.explored)?a.explored:(a.explored=[]);
 const safe=s=>esc(String(s||''));
 // Only the participant's answers are source evidence; the target-job gap is context, never proof.
 function evidenceSource(item,answer){
   const lines=['Participant account: '+String(answer||'').trim()];
   (Array.isArray(item.rosieFollowUps)?item.rosieFollowUps:[]).forEach(x=>{
     lines.push('Nova asked: '+String(x.question||'').trim());
     lines.push('Participant clarified: '+String(x.answer||'').trim());
   });
   return lines.join('\n');
 }
 function resetReviewIfChanged(item,answer){
   if(item.answer!==answer){
     item.answer=answer;
     item.rosieReview=null;
     item.rosieFollowUps=[];
     item.editedAt=now();
   }
 }
 function render(){
   const d=resumeData(),v=d.versions[d.activeVersion],a=d.alignment,panel=$('rbAlignmentPanel'),review=$('rbEvidenceReview');
   if(!panel||!review)return;
   if(!a){panel.hidden=true;review.hidden=true;return;}
   const current=String(a.jobDescription||'').trim()===String(d.jobDescription||'').trim();
   panel.hidden=!current;
   if(current){
     $('rbStrongMatch').innerHTML=list(a.strongMatch);
     $('rbEmphasize').innerHTML=list(a.emphasizeMore);
     const rows=(a.gaps||[]).map((gap,i)=>{
       const last=entries(a).filter(x=>x.gap===gap).slice(-1)[0];
       const label=last?.status==='verified_applied'?'Verified and added':last?.status==='no_related_evidence_reported'?'Not claimed':last?.status==='participant_evidence_to_review'?'Awaiting Nova review':'Not yet explored';
       return '<article class="gap-explore-item"><div class="gap-explore-heading"><p>'+safe(gap)+'</p><span class="gap-state">'+label+'</span></div><button type="button" class="gap-explore-btn" data-gap-index="'+i+'">'+(last?.status==='participant_evidence_to_review'?'Ask Nova again':'Explore with Nova →')+'</button><div class="gap-explore-convo" data-gap-convo="'+i+'" hidden></div></article>';
     }).join('');
     $('rbGap').innerHTML='<p class="gap-coaching-copy">Only supported experience belongs on your résumé. Nova can help you clarify a gap and draft truthful wording, but she cannot independently verify your history.</p>'+rows;
     $('rbGap').querySelectorAll('.gap-explore-btn').forEach(b=>b.onclick=()=>explore(Number(b.dataset.gapIndex)));
   }
   const items=entries(a),pending=items.filter(x=>x.status==='participant_evidence_to_review').length,approved=items.filter(x=>x.status==='verified_applied').length;
   review.hidden=items.length===0;
   if(!items.length){review.innerHTML='';return;}
   const old=current?'':'<p class="evidence-recheck">This evidence belongs to an earlier job description for this résumé version. Run alignment again to check the current job.</p>';
   const recheck=a.needsRecheck?'<p class="evidence-recheck">Your verified evidence was added. Select <strong>Nova: Check My Alignment</strong> again to refresh the job match.</p>':'';
   review.innerHTML='<header class="evidence-review-head"><span class="eyebrow">CAREER EVIDENCE REVIEW</span><h3>Review what Nova uncovered</h3><p>'+pending+' awaiting review · '+approved+' added after Nova coaching and participant confirmation. Nothing is added automatically.</p></header>'+old+recheck+
     items.map((item,i)=>{
       const status=item.status||'participant_evidence_to_review';
       const label=status==='verified_applied'?'Verified and added':status==='no_related_evidence_reported'?'Not claimed':'Needs Nova review';
       const details=status==='verified_applied'?'<p class="evidence-applied"><strong>Added to résumé:</strong> '+safe(item.claim)+'</p>':status==='no_related_evidence_reported'?'<p>No experience claimed for this requirement.</p>':'';
       const opts=(d.experiences||[]).map((x,j)=>'<option value="experience:'+j+'">Experience: '+safe([x.role,x.employer].filter(Boolean).join(' • ')||'Experience '+(j+1))+'</option>').join('');
       const rv=item.rosieReview,valid=rv&&rv.sourceAnswer===item.answer&&rv.sourceEvidence===evidenceSource(item,item.answer)&&rv.targetOccupation===d.target&&rv.gap===item.gap;
       const question=valid&&rv.status==='clarify'?'<div class="evidence-rosie-question"><strong>Nova needs one more detail:</strong><p>'+safe(rv.question)+'</p><label>Your clarification<textarea class="evidence-clarification" rows="4" placeholder="Tell Nova only what you actually did."></textarea></label><button type="button" class="rosie-ai-btn evidence-send-clarification">Send clarification to Nova</button></div>':'';
       const draft=valid&&rv.status==='drafts'?'<div class="evidence-rosie-drafts"><strong>Nova drafted two evidence-based options</strong><p>Compare these with your actual experience. Choose only wording you can personally support. If neither is accurate, revise your answer and ask Nova again.</p>'+
         ['clearDirect','skillsForward'].filter(key=>String(rv.drafts?.[key]||'').trim()).map(key=>'<label class="evidence-draft-choice"><input type="radio" name="evidence-draft-'+i+'" value="'+key+'"'+(rv.selectedDraft===key?' checked':'')+'><span><b>'+(key==='clearDirect'?'Clear & direct':'Skills forward')+'</b><span>'+safe(rv.drafts[key])+'</span></span></label>').join('')+
         '<label>Where should this reviewed bullet go?<select class="evidence-destination">'+opts+'<option value="skills">Skills section (shared across résumé versions)</option></select></label><label class="evidence-confirm"><input type="checkbox" class="evidence-attest"> I have checked every claim in the selected bullet and can explain and support it in an interview.</label><button type="button" class="primary-btn evidence-approve">Confirm & add selected Nova-reviewed bullet</button></div>':'';
       const form=status==='participant_evidence_to_review'?'<label>Your answer to Nova<textarea class="evidence-answer" rows="5">'+safe(item.answer)+'</textarea></label><div class="evidence-rosie-step"><span class="rosie-mini-badge">Nova</span><strong>Let’s turn this into a credible résumé statement.</strong><p>Nova will examine your answer, ask a specific follow-up if needed, and draft targeted wording from the facts you supply.</p><button type="button" class="rosie-ai-btn evidence-rosie-review">✦ Nova: Develop & check my evidence</button><p class="evidence-rosie-limit">Nova can assess whether the wording is supported by your account, not independently confirm the experience occurred.</p></div>'+question+draft+'<div class="evidence-review-actions"><button type="button" class="secondary-btn evidence-save-answer">Save revised answer</button><button type="button" class="secondary-btn evidence-keep-gap">Keep as an honest gap</button></div><p class="evidence-error" role="status"></p>':'';
       return '<article class="evidence-review-item" data-evidence-index="'+i+'"><div class="evidence-review-item-head"><strong>'+safe(item.gap||'Experience to explore')+'</strong><span class="gap-state">'+label+'</span></div>'+details+form+'</article>';
     }).join('');
   review.querySelectorAll('[data-evidence-index]').forEach(card=>{
     const i=Number(card.dataset.evidenceIndex),item=items[i],answer=card.querySelector('.evidence-answer');
     if(!answer)return;
     const error=card.querySelector('.evidence-error'),dest=card.querySelector('.evidence-destination'),attest=card.querySelector('.evidence-attest');
     card.querySelector('.evidence-save-answer').onclick=()=>{
       const value=answer.value.trim();if(!value){error.textContent='Enter an answer or keep this as a gap.';return;}
       resetReviewIfChanged(item,value);v.alignment=a;saveState();render();
     };
     card.querySelector('.evidence-keep-gap').onclick=()=>{
       item.answer=answer.value.trim();item.status='no_related_evidence_reported';item.reviewedAt=now();v.alignment=a;saveState();render();
     };
     card.querySelector('.evidence-rosie-review').onclick=async()=>{
       const value=answer.value.trim();
       if(value.length<8){error.textContent='Describe at least one real task or experience before asking Nova.';answer.focus();return;}
       resetReviewIfChanged(item,value);v.alignment=a;saveState();
       await coachEvidence(item,card,i);
     };
     const clarification=card.querySelector('.evidence-send-clarification');
     if(clarification)clarification.onclick=async()=>{
       const response=card.querySelector('.evidence-clarification')?.value.trim();
       if(item.answer!==answer.value.trim()){error.textContent='Your original answer changed. Ask Nova to review the updated answer first.';return;}
       if(!response||response.length<5){error.textContent='Add a factual detail for Nova, or choose to keep this as a gap.';return;}
       const question=item.rosieReview?.question||'What additional detail can you provide?';
       item.rosieFollowUps=Array.isArray(item.rosieFollowUps)?item.rosieFollowUps:[];
       item.rosieFollowUps.push({question,answer:response,at:now()});
       item.rosieReview=null;v.alignment=a;saveState();
       await coachEvidence(item,card,i);
     };
     card.querySelectorAll('input[name="evidence-draft-'+i+'"]').forEach(input=>input.onchange=()=>{
       if(!item.rosieReview||item.rosieReview.status!=='drafts')return;
       item.rosieReview.selectedDraft=input.value;v.alignment=a;saveState();
     });
     const approve=card.querySelector('.evidence-approve');
     if(approve)approve.onclick=()=>{
       const rv=item.rosieReview,value=answer.value.trim(),selected=rv?.selectedDraft,wording=String(rv?.drafts?.[selected]||'').trim(),destination=dest?.value;
       if(!rv||rv.status!=='drafts'||rv.sourceAnswer!==value||rv.sourceEvidence!==evidenceSource(item,value)||rv.targetOccupation!==d.target||rv.gap!==item.gap||!wording){
         error.textContent='Nova must review the current evidence and you must select one of her draft options before adding it.';return;
       }
       if(!attest?.checked){error.textContent='Read the selected bullet and confirm every claim is accurate before adding it.';return;}
       syncActiveExperience(d);
       if(destination==='skills'){
         const existing=String(d.skills||'').trim();d.skills=existing?(existing.includes(wording)?existing:existing+'\n'+wording):wording;
         if($('rbSkills'))$('rbSkills').value=d.skills;
       }else{
         const idx=Number(String(destination||'').split(':')[1]),exp=d.experiences[idx];
         if(!exp||!String(destination).startsWith('experience:')){error.textContent='Choose an existing experience or the skills section.';return;}
         exp.bullets=Array.isArray(exp.bullets)?exp.bullets:[];
         if(!exp.bullets.includes(wording))exp.bullets.push(wording);
       }
       item.claim=wording;item.destination=destination;item.status='verified_applied';item.verifiedAt=now();
       v.careerEvidenceProfile=Array.isArray(v.careerEvidenceProfile)?v.careerEvidenceProfile:[];
       v.careerEvidenceProfile.push({gap:item.gap,answer:value,clarifications:item.rosieFollowUps||[],claim:wording,destination,rosieReviewedAt:rv.reviewedAt,verifiedAt:item.verifiedAt});
       a.needsRecheck=true;v.alignment=a;saveState();renderResumePreview();render();
     };
   });
 }
 async function coachEvidence(item,card,index){
   const d=resumeData(),v=d.versions[d.activeVersion],alignment=d.alignment,versionIndex=d.activeVersion,answer=String(item.answer||'').trim();
   const error=card.querySelector('.evidence-error'),button=card.querySelector('.evidence-rosie-review'),clarify=card.querySelector('.evidence-send-clarification');
   const source=evidenceSource(item,answer);
   if(source.length>1350){error.textContent='Your combined answers are too long for this review. Shorten them to the most relevant facts and ask Nova again.';return;}
   const target=d.target||'',gap=item.gap||'',experience=(d.experiences||[]).map(x=>[x.role,x.employer].filter(Boolean).join(' at ')).filter(Boolean).join('; ');
   const previousBullets=(d.experiences||[]).flatMap(x=>Array.isArray(x.bullets)?x.bullets:[]).filter(Boolean).slice(0,8);
   if(button)button.disabled=true;if(clarify)clarify.disabled=true;
   error.textContent='Nova is checking the evidence and preparing your next step…';
   try{
     const result=await callR2WResumeAI({mode:'bullet',evidence:{targetOccupation:target,experience:'Job requirement being explored (not proof of experience): '+gap+'. Related roles: '+experience,currentEvidence:source,previousBullets}});
     const live=resumeData();
     if(live.activeVersion!==versionIndex||live.alignment!==alignment||item.status!=='participant_evidence_to_review')return;
     if(result.integrityFailed||result.needsClarification){
       item.rosieReview={status:'clarify',question:String(result.question||'What did you personally do, and how?'),sourceAnswer:answer,sourceEvidence:source,targetOccupation:target,gap,reviewedAt:now()};
     }else{
       const drafts={clearDirect:String(result.clearDirect||'').trim(),skillsForward:String(result.skillsForward||'').trim()};
       if(!drafts.clearDirect&&!drafts.skillsForward)throw Error('Nova did not return a usable draft. Please try again.');
       item.rosieReview={status:'drafts',drafts,selectedDraft:'',sourceAnswer:answer,sourceEvidence:source,targetOccupation:target,gap,reviewedAt:now(),method:'rosie_bullet_grounded_draft'};
     }
     v.alignment=alignment;saveState();render();
     const refreshed=document.querySelector('[data-evidence-index="'+index+'"]');
     refreshed?.scrollIntoView({behavior:'smooth',block:'nearest'});
   }catch(e){
     error.textContent='Nova could not complete the evidence review. Your answer is saved, but nothing can be added until Nova completes this step. Try again.';
   }finally{if(button)button.disabled=false;if(clarify)clarify.disabled=false;}
 }
 async function analyze(){
   const d=resumeData(),v=d.versions[d.activeVersion],btn=$('rbAnalyzeJob');
   syncActiveExperience(d);
   if(!d.jobDescription.trim()){showResumeCoach('rbJobCoach','<strong>Paste the job description first.</strong><br>Then Nova can compare it with your verified evidence.');return;}
   const verified=(d.experiences||[]).map((x,i)=>['Experience '+(i+1),x.role,x.employer,(x.bullets||[]).join(' | '),x.evidence].filter(Boolean).join(' — ')).join('\n');
   btn.disabled=true;btn.textContent='✦ Nova is checking alignment…';
   showResumeCoach('rbJobCoach','<strong>Nova is comparing the job with your verified experience.</strong><br>Unverified responses are not treated as qualifications.');
   try{
     const data=await callR2WResumeAI({mode:'alignment',evidence:{targetOccupation:d.target,jobDescription:d.jobDescription,verifiedEvidence:verified,skills:d.skills,education:d.education}});
     const prior=d.alignment;
     if(prior&&prior.jobDescription!==d.jobDescription){
       v.alignmentHistory=Array.isArray(v.alignmentHistory)?v.alignmentHistory:[];
       v.alignmentHistory.push(prior);
     }
     d.alignment={jobDescription:d.jobDescription,strongMatch:data.strongMatch||[],emphasizeMore:data.emphasizeMore||[],gaps:data.gaps||[],coachNote:data.coachNote||'',explored:prior?.jobDescription===d.jobDescription?entries(prior):[],analyzedAt:now(),needsRecheck:false};
     v.jobDescription=d.jobDescription;v.alignment=d.alignment;saveState();
     showResumeCoach('rbJobCoach','<strong>Alignment complete.</strong><br>'+safe(data.coachNote||'Explore gaps only where you have real experience.'));
     render();$('rbAlignmentPanel')?.scrollIntoView({behavior:'smooth',block:'start'});
   }catch(e){showResumeCoach('rbJobCoach','<strong>Nova could not complete the alignment check.</strong><br>Your prior evidence remains saved. Try again.');}
   finally{btn.disabled=false;btn.textContent='✦ Nova: Check My Alignment';}
 }
 async function explore(i){
   const d=resumeData(),v=d.versions[d.activeVersion],gap=d.alignment?.gaps?.[i],box=document.querySelector('[data-gap-convo="'+i+'"]');
   if(!gap||!box)return;
   const verified=(d.experiences||[]).map((x,n)=>['Experience '+(n+1),x.role,x.employer,(x.bullets||[]).join(' | '),x.evidence].filter(Boolean).join(' — ')).join('\n');
   document.querySelectorAll('[data-gap-convo]').forEach(el=>{if(el!==box)el.hidden=true;});
   box.hidden=false;box.innerHTML='<p><strong>Nova is preparing this question…</strong></p>';
   try{
     const data=await callR2WResumeAI({mode:'explore_gap',evidence:{gap,jobDescription:d.jobDescription,verifiedEvidence:verified}});
     box.innerHTML='<div class="rosie-gap-question"><span class="rosie-mini-badge">Nova</span><p><strong>'+safe(data.question||'Have you done anything similar in another setting?')+'</strong></p><small>'+safe(data.whyItMatters||'This may help show transferable experience.')+'</small><label>Your response<textarea rows="6" placeholder="Describe what you did, where, and how."></textarea></label><div class="gap-reply-actions"><button type="button" class="primary-btn gap-save-evidence">Save for Career Evidence Review</button><button type="button" class="secondary-btn gap-no-evidence">I haven\'t done this</button></div></div>';
     const ta=box.querySelector('textarea');
     box.querySelector('.gap-save-evidence').onclick=()=>{
       const answer=ta.value.trim();if(!answer){ta.focus();return;}
       const xs=entries(d.alignment),prior=xs.filter(x=>x.gap===gap&&x.status==='participant_evidence_to_review').slice(-1)[0];
       if(prior){prior.answer=answer;prior.editedAt=now();}
       else xs.push({gap,answer,status:'participant_evidence_to_review',at:now()});
       v.alignment=d.alignment;saveState();render();
       $('rbEvidenceReview')?.scrollIntoView({behavior:'smooth',block:'start'});
     };
     box.querySelector('.gap-no-evidence').onclick=()=>{
       entries(d.alignment).push({gap,status:'no_related_evidence_reported',at:now()});
       v.alignment=d.alignment;saveState();render();
     };
     ta.focus();
   }catch(e){box.innerHTML='<p><strong>Nova could not open this question.</strong> Your previous responses remain saved.</p>';}
 }
 function bind(){
   const btn=$('rbAnalyzeJob');if(btn)btn.onclick=analyze;
   const preview=$('rbTogglePreview');
   if(preview)preview.onclick=()=>{
     const work=document.querySelector('.resume-workspace');if(!work)return;
     const open=work.classList.toggle('alignment-preview-open');
     preview.textContent=open?'Hide résumé preview':'Show résumé preview';
   };
 }
 return {render,analyze,explore,bind};
}
window.R2WEvidenceWorkflow={create};
})();