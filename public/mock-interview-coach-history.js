(function(global){
 'use strict';
 const ENDPOINT='https://dnijrzotfyvmmnmueknk.supabase.co/functions/v1/levelup-interview-coach-history';
 const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined&&text!==null)x.textContent=String(text);if(cls)x.className=cls;return x};
 const btn=(label,click)=>{const b=el('button',label,'mock-action');b.type='button';b.onclick=click;return b};
 const date=(x)=>{try{return x?new Date(x).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'—'}catch{return '—'}};
 const pretty=(value)=>Number.isFinite(Number(value))&&value!==null?Number(value).toFixed(2).replace(/\.00$/,'')+'/5':'Not assessed';
 const css=`
 .mock-dashboard{font-family:Inter,Segoe UI,Arial,sans-serif;font-size:13px;line-height:1.5;color:#233d4d}
 .mock-dashboard h3{color:#123c52;font-size:17px;margin:16px 0 8px}.mock-dashboard p{margin:7px 0;color:#506674}
 .mock-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
 .mock-stat{border:1px solid #d6e1e8;background:#f7fafb;padding:12px;border-radius:12px}
 .mock-stat small{display:block;font-size:11px;color:#5b707d}.mock-stat strong{font-size:23px;color:#16435a;display:block}
 .mock-history{display:grid;gap:8px;margin:12px 0}.mock-session{display:block;width:100%;text-align:left;border:1px solid #cbdce4;background:#fff;border-radius:11px;padding:12px;color:#244657;cursor:pointer;font:inherit}
 .mock-session.current{background:#e8f5f6;border-color:#278ba0;box-shadow:inset 3px 0 #278ba0}.mock-session strong{display:block}
 .mock-session span{display:block;font-size:11px;color:#607583;margin-top:3px}
 .mock-action{border:1px solid #1e6980;background:#165d78;color:#fff;padding:9px 13px;border-radius:9px;cursor:pointer;font:inherit;font-weight:700}
 .mock-viewer{width:100%;min-height:490px;height:65vh;background:#fff;border:1px solid #cbdce4;border-radius:9px}
 .mock-table{width:100%;border-collapse:collapse;font-size:12px;margin:9px 0}
 .mock-table th,.mock-table td{border-bottom:1px solid #dce6e9;padding:8px;text-align:left}
 .mock-note{background:#eff6f8;border-left:3px solid #2d8ea2;padding:10px;border-radius:8px;margin:12px 0!important}
 .mock-split{display:grid;grid-template-columns:minmax(170px,240px) minmax(0,1fr);gap:14px;align-items:start}
 .mock-report-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}
 @media(max-width:720px){.mock-summary{grid-template-columns:1fr}.mock-split{grid-template-columns:1fr}.mock-viewer{min-height:400px}}
 `;
 if(!document.getElementById('mock-interview-coach-style')){const s=el('style');s.id='mock-interview-coach-style';s.textContent=css;document.head.append(s);}
 function entry(parent,tag,text,cls){const n=el(tag,text,cls);parent.append(n);return n}
 function metrics(history){
   const verified=history.sessions.filter(s=>s.verified&&s.feedback_generated);
   const quality=verified.filter(s=>s.average_answer_quality!==null).slice().reverse();
   const head=quality[0]||null,tail=quality[quality.length-1]||null;
   const delta=head&&tail&&head!==tail?Math.round((tail.average_answer_quality-head.average_answer_quality)*100)/100:null;
   return {verified,quality,delta};
 }
 function showComparison(parent,history){
   const {verified,quality,delta}=metrics(history);
   entry(parent,'h3','Practice & growth');
   const summary=entry(parent,'div',null,'mock-summary');
   for(const [label,value] of [['Recorded attempts',history.history_count],['Verified reports',history.verified_count],['Overall answer-quality change',delta===null?'—':(delta>0?'+':'')+delta.toFixed(2)+'/5']]){
     const card=entry(summary,'div',null,'mock-stat');entry(card,'small',label);entry(card,'strong',value);
   }
   if(quality.length>=2){
     const table=entry(parent,'table',null,'mock-table');
     const thead=entry(table,'thead'),tr=entry(thead,'tr');
     for(const x of ['Attempt','Date','Career focus','Answer quality'])entry(tr,'th',x);
     const tbody=entry(table,'tbody');
     for(const [i,item] of quality.entries()){
       const line=entry(tbody,'tr');
       for(const x of [String(i+1),date(item.completed_at||item.ended_at),item.occupation||'Not selected',pretty(item.average_answer_quality)])entry(line,'td',x);
     }
   }
   entry(parent,'p','Score changes describe answer quality, not employability. Different questions or roles may limit comparisons. Legacy interviews may have no detailed dimensional scores.','mock-note');
   const latest=verified[0];
   if(latest?.feedback?.next_steps?.length){
     entry(parent,'h3','Next practice focus');
     const list=entry(parent,'ul');
     for(const goal of latest.feedback.next_steps.slice(0,3))entry(list,'li',goal);
   }
 }
 function dimensions(parent,item){
   entry(parent,'h3','Developmental evidence');
   const table=entry(parent,'table',null,'mock-table');
   for(const [label,key] of [['Situation','situation'],['Action','action'],['Result','result'],['Specificity','specificity'],['Individual contribution','individual_contribution'],['Communication','communication']]){
     const tr=entry(table,'tr');entry(tr,'th',label);entry(tr,'td',pretty(item.dimensions?.[key]));
   }
   entry(parent,'p','SAR dimensions are not applied to Tell Me About Yourself. These measures are recorded only when available in Nova’s saved evaluation, and never estimated from an older report.');
 }
 async function render({container,personKey,authHeaders}={}){
   if(!container)throw Error('Mock Interview panel is unavailable.');
   container.replaceChildren();
   const root=entry(container,'section',null,'mock-dashboard');
   entry(root,'h3','Mock Interview • Historical evidence');
   const loading=entry(root,'p','Loading verified interview history…');
   try{
     const headers=typeof authHeaders==='function'?await authHeaders():authHeaders;
     if(!headers)throw Error('Staff session expired. Sign in again.');
     const res=await fetch(ENDPOINT,{method:'POST',headers,body:JSON.stringify({person_key:personKey})});
     const data=await res.json().catch(()=>({}));
     if(!res.ok)throw Error(data.error==='not_assigned_to_coach'?'This record is not assigned to your coach account. Administrators can access all participant histories.':data.error||'Interview history unavailable.');
     loading.remove();
     showComparison(root,data);
     entry(root,'h3','Interview session history');
     if(!data.sessions?.length){entry(root,'p','No practice sessions have been recorded yet.');return;}
     const split=entry(root,'div',null,'mock-split');
     const sessions=entry(split,'div',null,'mock-history');
     const report=entry(split,'div');
     async function select(item,button){
       for(const b of sessions.querySelectorAll('.mock-session'))b.classList.toggle('current',b===button);
       report.replaceChildren();
       entry(report,'h3','Interview • '+date(item.completed_at||item.ended_at||item.started_at));
       entry(report,'p','Source: '+(item.source_module==='interview-arena'?'Interview Arena':item.source_module==='interview-intelligence'?'Interview Intelligence':'Earlier interview (source not captured)')+' · '+(item.occupation||'Career unspecified'));
       if(!item.verified||!item.feedback_generated){
         entry(report,'p','This attempt does not have a verified, completed Nova feedback report. Its original status is preserved.','mock-note');return;
       }
       entry(report,'p','Answer-quality indicator: '+pretty(item.average_answer_quality)+' · Participant conversation share: '+(item.conversation_balance?.participant_percent??'—')+'%');
       dimensions(report,item);
       const actions=entry(report,'div',null,'mock-report-actions');
       const download=btn('Download original PDF',()=>{});download.hidden=true;actions.append(download);
       const frameContainer=entry(report,'div');
       const iframe=entry(frameContainer,'iframe',null,'mock-viewer');
       iframe.setAttribute('data-interview-pdf','');
       const evidence={required_questions:item.required_questions,answer_evidence:item.answer_evidence,
         conversation_balance:item.conversation_balance,occupation:item.occupation,completed_at:item.completed_at,ended_at:item.ended_at};
       try{
         if(!global.LevelUpInterviewReport)throw Error('PDF viewer script has not loaded.');
         await global.LevelUpInterviewReport.render({container:frameContainer,downloadButton:download,feedback:item.feedback,evidence,participantName:data.participant?.display_name});
       }catch(e){entry(report,'p','PDF could not render: '+(e?.message||'Unknown error'))}
     }
     let first=null;
     for(const item of data.sessions){
       const b=btn('',()=>select(item,b));b.className='mock-session';
       b.replaceChildren();
       entry(b,'strong',date(item.completed_at||item.ended_at||item.started_at));
       entry(b,'span',(item.verified&&item.feedback_generated?'Verified feedback':'Attempt: '+item.status)+' · '+(item.occupation||'Practice')+' · '+pretty(item.average_answer_quality));
       sessions.append(b);
       if(!first&&item.verified&&item.feedback_generated)first=[item,b];
     }
     if(!first){const item=data.sessions[0],b=sessions.children[0];first=[item,b]}
     await select(...first);
   }catch(e){loading.textContent='Could not load Mock Interview history: '+(e?.message||'Unexpected error')}
 }
 global.LevelUpMockInterviewCoach={render};
})(window);