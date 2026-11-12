/* Northern BOOST: ATS-friendly résumé structures. Pure data model + DOM-only presentation.
 * Never mutate source experience, evidence, skills, résumé versions, or approved bullets.
 */
(()=>{
 'use strict';
 const formats=['chronological','hybrid','functional'];
 const labels={chronological:'Chronological',hybrid:'Combination / Hybrid',functional:'Skills-Forward'};
 const descriptions={
  chronological:'Recent work history leads. Verified bullets stay with each employer, followed by skills and education.',
  hybrid:'Relevant skills lead, followed by complete reverse-chronological work experience and education.',
  functional:'Verified skills and achievements lead. Employment history, employers and dates remain visible below.'
 };
 const order={
  chronological:['summary','experience','skills','education'],
  hybrid:['summary','skills','experience','education'],
  functional:['summary','skills','achievements','experience','education']
 };
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function parseDate(value){
  const s=String(value||'').trim();
  if(!s)return 0;
  if(/^(present|current|now|ongoing|today)$/i.test(s))return 99999999;
  const m=s.match(/^(\d{1,2})\s*[/-]\s*(\d{4})$/);
  if(m)return Number(m[2])*100+Number(m[1]);
  const y=s.match(/^(\d{4})$/);
  if(y)return Number(y[1])*100+12;
  const d=Date.parse(s);
  if(Number.isFinite(d)){const x=new Date(d);return x.getUTCFullYear()*100+x.getUTCMonth()+1;}
  return 0;
 }
 function parseItems(raw){
  const items=String(raw||'').split(/[\n,;|•]+/).map(x=>x.trim().replace(/^[-•]\s*/,'' )).filter(Boolean);
  return [...new Map(items.map(x=>[x.toLocaleLowerCase(),x])).values()];
 }
 function buildModel(d){
  d=d||{};
  const version=(Array.isArray(d.versions)?d.versions[d.activeVersion||0]:null)||{};
  const format=formats.includes(version.format)?version.format:formats.includes(d.resumeFormat)?d.resumeFormat:'hybrid';
  const experiences=(Array.isArray(d.experiences)?d.experiences:[])
   .map((x,i)=>({
    index:i,role:String(x?.role||''),employer:String(x?.employer||''),startDate:String(x?.startDate||''),
    endDate:String(x?.endDate||''),bullets:(Array.isArray(x?.bullets)?x.bullets:[]).map(x=>String(x||'').trim()).filter(Boolean),
    hasSource:!!(x?.experience||x?.evidence)
   }))
   .filter(x=>x.role||x.employer||x.startDate||x.endDate||x.bullets.length||x.hasSource)
   .sort((a,b)=>(parseDate(b.endDate||b.startDate)-parseDate(a.endDate||a.startDate))||a.index-b.index);
  const achievements=experiences.flatMap(x=>x.bullets.map(text=>({text,source:[x.role,x.employer].filter(Boolean).join(' · ')||'Work experience'})));
  return {format,sections:order[format].slice(),skills:parseItems(d.skills),education:parseItems(d.education),
   experiences,achievements,description:descriptions[format]};
 }
 function sectionContent(id,model){
  if(id==='skills'){
   const el=document.getElementById('rpSkills');
   if(!el)return;
   el.innerHTML=model.skills.length?'<ul class="resume-skills-list">'+model.skills.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>':'<p class="preview-placeholder">Verified skills will appear here.</p>';
  }
  if(id==='education'){
   const el=document.getElementById('rpEducation');
   if(!el)return;
   el.innerHTML=model.education.length?model.education.map(s=>'<p class="resume-education-line">'+esc(s)+'</p>').join(''):'<p class="preview-placeholder">Education, training and credentials will appear here.</p>';
  }
  if(id==='experience'){
   const el=document.getElementById('rpExperienceList');
   if(!el)return;
   const compact=model.format==='functional';
   el.innerHTML=model.experiences.map(x=>{
    const title=[x.role,x.employer].filter(Boolean).join(' · ')||'Work experience';
    const dates=[x.startDate,x.endDate].filter(Boolean).join(' – ');
    const bullets=compact?'':x.bullets.length?'<ul>'+x.bullets.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>':'<p class="preview-placeholder">No reviewed résumé bullets for this role yet.</p>';
    return '<div class="preview-experience'+(compact?' compact':'')+'"><strong>'+esc(title)+'</strong>'+(dates?'<small>'+esc(dates)+'</small>':'')+bullets+'</div>';
   }).join('')||'<p class="preview-placeholder">Work history will appear here.</p>';
   for(const name of ['rpExperience','rpEvidence']){const old=document.getElementById(name);if(old)old.hidden=true;}
  }
  if(id==='achievements'){
   const el=document.getElementById('rpAchievementList');
   if(!el)return;
   el.innerHTML=model.achievements.length?'<ul class="resume-achievement-list">'+model.achievements.map(x=>'<li>'+esc(x.text)+'<small>'+esc(x.source)+'</small></li>').join('')+'</ul>':'<p class="preview-placeholder">Approved résumé bullets will appear here as you develop them with Nova.</p>';
  }
 }
 function render(d){
  const preview=document.querySelector('.resume-preview'),container=document.getElementById('rpSections');
  if(!preview||!container)return null;
  const model=buildModel(d);
  preview.dataset.resumeFormat=model.format;
  preview.classList.remove('resume-style-classic','resume-style-clean');
  preview.classList.add('resume-style-modern');
  const headings={
   chronological:{experience:'Relevant Experience',skills:'Skills'},
   hybrid:{experience:'Relevant Experience',skills:'Relevant Skills'},
   functional:{experience:'Relevant Experience',skills:'Core Skills'}
  };
  const byName={};
  [...container.querySelectorAll('[data-resume-section]')].forEach(node=>{byName[node.dataset.resumeSection]=node;});
  for(const name of model.sections){
   const node=byName[name];if(!node)continue;
   node.hidden=false;container.appendChild(node);
   if(name==='experience'||name==='skills'){
    const title=node.querySelector('h3');if(title)title.textContent=headings[model.format][name];
   }
   sectionContent(name,model);
  }
  for(const [name,node] of Object.entries(byName))if(!model.sections.includes(name))node.hidden=true;
  document.querySelectorAll('[data-format]').forEach(button=>{
   const selected=button.dataset.format===model.format;
   button.classList.toggle('selected',selected);
   button.setAttribute('aria-pressed',String(selected));
  });
  const note=document.getElementById('rbFormatExplanation');
  if(note)note.textContent=model.description+' Switching formats only changes presentation; your saved evidence remains unchanged.';
  const badge=preview.querySelector('[data-format-preview-label]');
  if(badge)badge.textContent='LIVE RÉSUMÉ PREVIEW · '+labels[model.format].toUpperCase();
  return model;
 }
 window.R2WResumeFormat={buildModel,render,labels,descriptions};
})();