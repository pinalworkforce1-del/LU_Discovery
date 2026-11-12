(() => {
  const course = window.R2W_COURSE;
  const scenes = course.scenes;
  const weights = course.weights;
  const skillNames = course.skills;
  const skillOrder = course.skillOrder;
  const STORAGE_KEY = 'levelup-northern-direct-r2w-v1';
  const $ = id => document.getElementById(id);

  const stageDefs = {
    'Soft Skills Base Camp': {
      number: '1 • SOFT SKILLS BASE CAMP',
      tagline: 'Build the skills you’ll take to work.',
      home: 'https://pinalworkforce1-del.github.io/BOOST_Pathway-Portal/ready-2-work-qa/assests/r2w-base-camp-home.webp',
      description: 'Practice the everyday decisions employers notice: communication, professionalism, problem solving, teamwork, planning, and quality.'
    },
    'Resume Retreat': {
      number: '2 • RESUME RETREAT',
      tagline: 'Show employers what you bring.',
      home: 'https://pinalworkforce1-del.github.io/BOOST_Pathway-Portal/ready-2-work-qa/assests/r2w-resume-retreat-home.webp',
      description: 'Turn real experience into credible, employer-ready resume evidence.'
    },
    'Interview Landing': {
      number: '3 • INTERVIEW LANDING',
      tagline: 'Practice telling your story with confidence.',
      home: 'https://pinalworkforce1-del.github.io/BOOST_Pathway-Portal/ready-2-work-qa/assests/r2w-interview-landing-home.webp',
      description: 'Prepare for interview moments that require judgment, confidence, and clear examples.'
    }
  };
  const stageOrder = Object.keys(stageDefs);

  let state = {
    currentScene: 0,
    ccOn: true,
    audioOn: false,
    sceneSelections: {},
    skillScores: {COM:0,PRO:0,PSA:0,TEAM:0,TIME:0,QUAL:0},
    participantName: '',
    firstOpened: new Date().toISOString(),
    resumeBuilder: {step:0,target:'',summary:'',experience:'',evidence:'',skills:'',education:'',integrity:false,ready:false,complete:false}
  };
  let activeStage = stageOrder[0];
  let lastImpact = null;
  const promptAudio = $('promptAudio');
  const impactAudio = $('impactAudio');

  // Store a verified copy before reporting progress as saved.
  const BACKUP_KEY=STORAGE_KEY+'-backup';
  let persistenceMessage='';
  function reportPersistence(message){
    persistenceMessage=message;
    let el=document.getElementById('r2wPersistenceStatus');
    if(!el){el=document.createElement('div');el.id='r2wPersistenceStatus';el.setAttribute('role','status');el.style.cssText='padding:8px 14px;text-align:center;font:12px system-ui;background:#fff3cd;color:#593b08';document.querySelector('.topbar')?.after(el);}
    if(el){el.textContent=message;el.style.display=message?'block':'none';}
  }
  function loadState(){
    for(const [store,key] of [[localStorage,STORAGE_KEY],[sessionStorage,STORAGE_KEY],[sessionStorage,BACKUP_KEY]]){
      try{
        const raw=store.getItem(key);
        if(!raw)continue;
        const loaded=JSON.parse(raw);
        if(!loaded || typeof loaded!=='object')continue;
        state={...state,...loaded,sceneSelections:{...state.sceneSelections,...(loaded.sceneSelections||{})},skillScores:{...state.skillScores,...(loaded.skillScores||{})}};
        if(store===sessionStorage)reportPersistence('Progress recovered from this browser tab. Export a backup before closing the tab.');
        return;
      }catch(e){reportPersistence('Could not read one saved progress copy: '+e.message);}
    }
  }
  let lastResumeSnapshot='';
  const resumeFingerprint=rb=>{
    if(!rb||typeof rb!=='object')return '{}';
    const {lastEditedAt,...content}=rb;
    return JSON.stringify(content);
  };
  function saveState(){
    const currentResume=resumeFingerprint(state.resumeBuilder);
    if(lastResumeSnapshot&&currentResume!==lastResumeSnapshot&&state.resumeBuilder){
      state.resumeBuilder.lastEditedAt=new Date().toISOString();
    }
    lastResumeSnapshot=currentResume;
    const payload=JSON.stringify({...state,savedAt:new Date().toISOString()});
    let verified=false,stored=payload;
    try{
      localStorage.setItem(STORAGE_KEY,payload);
      // The résumé polish layer normalizes version labels on write. A successful
      // normalized write is still persistent even when the bytes differ.
      stored=localStorage.getItem(STORAGE_KEY)||'';
      verified=!!stored&&!!JSON.parse(stored);
    }catch(e){verified=false}
    if(verified){
      try{
        sessionStorage.setItem(BACKUP_KEY,stored);
        const owner=window.LEVELUP_NOVA_R2W?.userId;
        if(owner){
          localStorage.setItem(STORAGE_KEY+':'+owner,stored);
          localStorage.setItem(STORAGE_KEY+':'+owner+':backup',stored);
        }
      }catch(e){}
      if(persistenceMessage)reportPersistence('');
    }else{
      try{sessionStorage.setItem(STORAGE_KEY,payload);verified=sessionStorage.getItem(STORAGE_KEY)===payload;}catch(e){}
      reportPersistence(verified?'Progress saved only for this tab; browser permanent storage is unavailable. Export a backup before leaving.':'WARNING: This browser is not saving progress. Export your results before leaving.');
    }
    window.dispatchEvent(new CustomEvent('boost-r2w-saved',{detail:{verified,progress:state}}));
    return verified;
  }

  function recalcScores(){
    const next={COM:0,PRO:0,PSA:0,TEAM:0,TIME:0,QUAL:0};
    for(const [sceneId, choice] of Object.entries(state.sceneSelections)){
      const delta = weights[sceneId]?.[choice] || {};
      for(const [k,v] of Object.entries(delta)) next[k] += Number(v||0);
    }
    state.skillScores=next;
  }

  const maxPositive = (()=>{
    const m={COM:0,PRO:0,PSA:0,TEAM:0,TIME:0,QUAL:0};
    for(const s of scenes){
      for(const k of skillOrder){
        let best=0;
        for(const c of ['A','B','C','D']) best=Math.max(best, Number(weights[s.id]?.[c]?.[k]||0));
        m[k]+=best;
      }
    }
    return m;
  })();

  function masteryFromRatio(raw,max){
    const ratio = Math.max(0, Number(raw||0)) / Math.max(1,Number(max||1));
    if(ratio >= .85) return {label:'Advanced',pct:100,ratio};
    if(ratio >= .68) return {label:'Strong',pct:82,ratio};
    if(ratio >= .48) return {label:'Demonstrated',pct:62,ratio};
    return {label:'Developing',pct:Math.max(8,Math.round(ratio*100)),ratio};
  }
  function liveMaxPositive(){
    const m={COM:0,PRO:0,PSA:0,TEAM:0,TIME:0,QUAL:0};
    for(const s of scenes){
      if(!Object.prototype.hasOwnProperty.call(state.sceneSelections,String(s.id)) && !Object.prototype.hasOwnProperty.call(state.sceneSelections,s.id)) continue;
      for(const k of skillOrder){
        let best=0;
        for(const choice of ['A','B','C','D']) best=Math.max(best,Number(weights[s.id]?.[choice]?.[k]||0));
        m[k]+=best;
      }
    }
    return m;
  }
  function mastery(key,mode='live'){
    const max = mode==='final' ? maxPositive[key] : liveMaxPositive()[key];
    return masteryFromRatio(state.skillScores[key],max);
  }

  function answeredCount(){ return Object.keys(state.sceneSelections).filter(id=>scenes.some(s=>String(s.id)===String(id))).length; }
  function stageScenes(stage){ return scenes.filter(s=>s.stage===stage); }
  function stageAnswered(stage){ return stageScenes(stage).filter(s=>state.sceneSelections[s.id]).length; }
  function stageComplete(stage){ const list=stageScenes(stage); const scenariosDone=list.length>0 && stageAnswered(stage)===list.length; if(stage==='Resume Retreat') return scenariosDone && !!state.resumeBuilder?.complete; if(stage==='Interview Landing') return scenariosDone && !!state.jacquelineInterview?.verifiedComplete; return scenariosDone; }
  function allComplete(){ return answeredCount()===scenes.length && !!state.resumeBuilder?.complete && !!state.jacquelineInterview?.verifiedComplete; }
  function stageUnlocked(stage){
    const i=stageOrder.indexOf(stage);
    return i<=0 || stageComplete(stageOrder[i-1]);
  }
  function firstIncompleteIndex(stage){
    const list=stageScenes(stage);
    const s=list.find(x=>!state.sceneSelections[x.id]) || list[0];
    return Math.max(0, scenes.findIndex(x=>x.id===s.id));
  }

  function updateOverall(){
    const n=answeredCount(), total=scenes.length;
    $('overallProgressText').textContent=`${n} of ${total} scenarios complete`;
    $('overallProgressBar').style.width=`${(n/total)*100}%`;
  }

  function hideViews(){ document.querySelectorAll('.view').forEach(v=>v.hidden=true); }
  function route(name, opts={}){
    // Level Up has its own pathway map; Northern course stages stay inactive here.
    if(name==='map'){window.LEVELUP_NOVA_R2W?.navigateBack?.();return;}
    stopAudio();
    hideViews();
    if(name==='map'){
      $('viewMap').hidden=false; renderMap(); history.replaceState(null,'','#map'); window.scrollTo(0,0); return;
    }
    if(name==='stage'){
      activeStage=opts.stage || activeStage; $('viewStage').hidden=false; renderStageHome(activeStage); history.replaceState(null,'',`#stage-${slug(activeStage)}`); window.scrollTo(0,0); return;
    }
    if(name==='scene'){
      if(Number.isInteger(opts.index)) state.currentScene=Math.max(0,Math.min(scenes.length-1,opts.index));
      $('viewScene').hidden=false; renderScene(); history.replaceState(null,'',`#scene-${scenes[state.currentScene].id}`); window.scrollTo(0,0); return;
    }
    if(name==='resume-builder'){
      $('viewResumeBuilder').hidden=false; renderResumeBuilder(); history.replaceState(null,'','#resume-builder'); window.scrollTo(0,0); return;
    }
    if(name==='certificate'){
      $('viewCertificate').hidden=false; renderCertificate(); history.replaceState(null,'','#certificate'); window.scrollTo(0,0); return;
    }
  }
  function slug(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}

  function renderMap(){
    updateOverall();
    document.querySelectorAll('.map-hotspot').forEach(h=>{
      h.classList.remove('map-complete','map-locked','map-current');
      h.querySelector('.map-state-indicator')?.remove();
      let complete=false, unlocked=true;
      if(h.dataset.stage){ complete=stageComplete(h.dataset.stage); unlocked=stageUnlocked(h.dataset.stage); }
      else if(h.dataset.route==='certificate'){ complete=allComplete(); unlocked=true; }
      const indicator=document.createElement('span'); indicator.className='map-state-indicator';
      if(complete){ h.classList.add('map-complete'); indicator.textContent='✓'; indicator.setAttribute('aria-label','Complete'); }
      else if(!unlocked){ h.classList.add('map-locked'); indicator.textContent='🔒'; indicator.setAttribute('aria-label','Locked'); }
      else { h.classList.add('map-current'); indicator.textContent='→'; indicator.setAttribute('aria-label','Available now'); }
      h.appendChild(indicator);
    });
    const cards=$('stageCards'); cards.innerHTML='';
    stageOrder.forEach((stage,i)=>{
      const def=stageDefs[stage], done=stageAnswered(stage), total=stageScenes(stage).length, complete=stageComplete(stage), unlocked=stageUnlocked(stage);
      const b=document.createElement('button'); b.className=`stage-card ${unlocked?'':'locked'}`; b.disabled=!unlocked;
      let status=complete?'Complete':unlocked?`${done} of ${total} scenarios complete`:'Locked'; if(stage==='Resume Retreat'&&done===total&&!state.resumeBuilder?.complete) status='Résumé Builder required'; if(stage==='Interview Landing'&&done===total&&!state.jacquelineInterview?.verifiedComplete) status='Jacqueline Interview required';
      const action=complete?'Review →':unlocked?'Continue →':'Complete prior stage';
      b.innerHTML=`<img src="${def.home}" alt=""><div class="stage-card-copy"><span>STAGE ${i+1}</span><h2>${stage}</h2><p>${def.description}</p><div class="stage-card-foot"><span class="status-pill ${complete?'complete':''}">${status}</span><strong>${action}</strong></div></div>`;
      if(unlocked) b.onclick=()=>route('stage',{stage}); cards.appendChild(b);
    });
  }

  function renderStageHome(stage){
    updateOverall(); const def=stageDefs[stage], done=stageAnswered(stage), total=stageScenes(stage).length, complete=stageComplete(stage);
    $('stageHomeImg').src=def.home; $('stageHomeImg').alt=`${stage} home environment`;
    $('stageNumber').textContent=def.number; $('stageHomeTitle').textContent=stage; $('stageHomeTagline').textContent=def.tagline;
    $('stageHomeProgress').textContent=complete?'Complete':`${done} of ${total} complete`;
    $('stageHomeProgress').className=`status-pill ${complete?'complete':''}`;
    $('requiredPathTitle').textContent=complete?'Review required scenarios':'Continue required scenarios';
    $('requiredPathMeta').textContent=complete?`${total} of ${total} complete • revisit any decision`:`${done} of ${total} complete • skill impact updates after every decision`;
    $('requiredPathBtn').onclick=()=>route('scene',{index:firstIncompleteIndex(stage)});
    const grid=$('stageExperienceGrid'); grid.querySelectorAll('.resume-builder-card').forEach(x=>x.remove());
    if(stage==='Resume Retreat'){
      const scenariosDone=done===total, rb=state.resumeBuilder||{};
      const b=document.createElement('button'); b.type='button'; b.className='board-card resume-builder-card'+(scenariosDone?'':' locked'); b.disabled=!scenariosDone;
      b.innerHTML=`<span class="card-kicker">REQUIRED • STEP 2</span><strong>Résumé Builder</strong><small>${!scenariosDone?'Complete the 5 Resume Retreat decisions to unlock.':rb.complete?'Employer-ready résumé complete ✓':'Build, review, and approve your employer-ready résumé.'}</small><span class="card-arrow">${rb.complete?'✓':'→'}</span>`;
      if(scenariosDone) b.onclick=()=>route('resume-builder'); grid.prepend(b);
      $('requiredPathTitle').textContent=scenariosDone?'Review Resume Decision Trail':'Continue Resume Decision Trail';
      $('requiredPathMeta').textContent=`${done} of ${total} decisions complete • Résumé Builder ${rb.complete?'complete':scenariosDone?'unlocked':'locked'}`;
      $('stageHomeProgress').textContent=stageComplete(stage)?'Complete':scenariosDone?'Builder required':`${done} of ${total} decisions`;
    }
  }


  let resumeStep=0;
  function resumeData(){ state.resumeBuilder=state.resumeBuilder||{step:0,target:'',summary:'',experience:'',evidence:'',skills:'',education:'',integrity:false,ready:false,complete:false}; const d=state.resumeBuilder;d.contact=d.contact||{name:'',email:'',phone:'',location:''};d.jobDescription=d.jobDescription||'';d.resumeFormat=d.resumeFormat||'hybrid';if(!Array.isArray(d.experiences))d.experiences=[];if(d.experiences.length===0&&(String(d.experience||'').trim()||String(d.evidence||'').trim()))d.experiences.push({role:'',employer:'',startDate:'',endDate:'',experience:d.experience||'',evidence:d.evidence||'',bullets:d.evidence?[d.evidence]:[]});if(!Number.isInteger(d.activeExperience))d.activeExperience=0;if(!d.careerTarget)d.careerTarget=d.target||'';if(!Array.isArray(d.versions)||!d.versions.length)d.versions=[{name:'Résumé 1',target:d.target||'',jobDescription:d.jobDescription||'',summary:'',format:d.resumeFormat||'hybrid'}];if(!Number.isInteger(d.activeVersion)||d.activeVersion<0||d.activeVersion>=d.versions.length)d.activeVersion=0;const v=d.versions[d.activeVersion];v.name=v.name||('Résumé '+(d.activeVersion+1));v.target=v.target||'';v.jobDescription=v.jobDescription||'';v.summary=v.summary||'';v.format=v.format||d.resumeFormat||'hybrid';v.visualStyle=v.visualStyle||'modern';if(!d.studioVersion||d.studioVersion<3){if(!v.summary&&d.versions.length===1)v.summary=d.summary||'';d.studioVersion=3;saveState()}d.target=v.target;d.jobDescription=v.jobDescription;d.summary=v.summary;d.resumeFormat=v.format;if(!v.alignment&&d.alignment&&d.alignment.jobDescription===v.jobDescription)v.alignment=d.alignment;d.alignment=v.alignment||null;if(window.R2WOccupationTitles?.migrate(d))saveState();return d; }
  function syncActiveExperience(d){if(!Array.isArray(d.experiences))d.experiences=[];const has=String(d.experience||'').trim()||String(d.evidence||'').trim();if(has){const i=d.activeExperience||0,x=d.experiences[i]||{};d.experiences[i]={...x,role:d.role||x.role||'',employer:d.employer||x.employer||'',startDate:d.startDate||x.startDate||'',endDate:d.endDate||x.endDate||'',experience:d.experience||'',evidence:d.evidence||'',bullets:Array.isArray(x.bullets)?x.bullets:[]};}}
  function loadExperience(d,i){syncActiveExperience(d);const x=d.experiences[i]||{experience:'',evidence:''};d.activeExperience=i;d.role=x.role||'';d.employer=x.employer||'';d.startDate=x.startDate||'';d.endDate=x.endDate||'';d.experience=x.experience||'';d.evidence=x.evidence||'';saveState();renderResumeBuilder();}
  function addResumeExperience(){const d=resumeData();syncActiveExperience(d);d.experiences.push({role:'',employer:'',startDate:'',endDate:'',experience:'',evidence:'',bullets:[]});d.activeExperience=d.experiences.length-1;d.role='';d.employer='';d.startDate='';d.endDate='';d.experience='';d.evidence='';saveState();renderResumeBuilder();$('rbExperience')?.focus();}
  function normalizeOccupationEntry(value){return window.R2WOccupationTitles?.resolve(value).title||String(value||'').trim();}
  function renderResumeBuilder(){
    const d=resumeData(),v=d.versions[d.activeVersion]; resumeStep=Math.max(0,Math.min(3,d.step||0));
    const fields={rbTarget:'target',rbSummary:'summary',rbExperience:'experience',rbEvidence:'evidence',rbSkills:'skills',rbEducation:'education',rbRoleTitle:'role',rbEmployer:'employer',rbStartDate:'startDate',rbEndDate:'endDate',rbJobDescription:'jobDescription'};
    Object.entries(fields).forEach(([id,key])=>{ const el=$(id);if(!el)return;el.value=d[key]||''; el.oninput=e=>{d[key]=e.target.value;if(key==='target'){v.target=e.target.value;const match=window.R2WOccupationTitles?.resolve(e.target.value);v.onetOccupationTitle=match?.onetTitle||'';v.onetOccupationCode='';v.onetOccupationConfirmed=!!match?.matched;}if(key==='summary')v.summary=e.target.value;if(key==='jobDescription')v.jobDescription=e.target.value; if(['role','employer','startDate','endDate','experience','evidence'].includes(key))syncActiveExperience(d);saveState(); renderResumePreview();if(key==='jobDescription')evidenceWorkflow?.render();}; }); const contactFields={rbContactName:'name',rbEmail:'email',rbPhone:'phone',rbLocation:'location'};Object.entries(contactFields).forEach(([id,key])=>{const el=$(id);if(!el)return;el.value=d.contact[key]||'';el.oninput=e=>{d.contact[key]=e.target.value;saveState();renderResumePreview();if(key==='email'&&$('rbEmailReview')){const v=e.target.value.trim().toLowerCase();const local=(v.split('@')[0]||'');const informal=/sexy|hot|420|69|party|princess|king|queen|boss|crazy|gamer|stud|cutie/.test(local);$('rbEmailReview').innerHTML=informal?'<strong>Email check • Review suggested</strong><p>This address may read as informal on a résumé. Consider a simple name-based email if you have one.</p>':'<strong>Email check</strong><p>'+(v?'This address does not contain an obvious informal handle.':'Add the email you plan to use for employers.')+'</p>'}};}); $('rbTarget').onchange=e=>{const exact=e.target.value.trim();if(exact!==e.target.value){e.target.value=exact;d.target=exact;v.target=exact;saveState();renderResumePreview();}};window.R2WOccupationSearch?.init({get:()=>{const current=resumeData();return {data:current,version:current.versions[current.activeVersion]};},save:saveState,preview:renderResumePreview})?.refresh();
    document.querySelectorAll('[data-format]').forEach(b=>{b.classList.toggle('selected',b.dataset.format===v.format);b.setAttribute('aria-pressed',String(b.dataset.format===v.format));b.onclick=()=>{if(!['chronological','hybrid','functional'].includes(b.dataset.format))return;v.format=b.dataset.format;d.resumeFormat=v.format;saveState();renderResumePreview();};});
    $('rbIntegrity').checked=!!d.integrity; $('rbReady').checked=!!d.ready;
    $('rbIntegrity').onchange=e=>{d.integrity=e.target.checked; saveState();}; $('rbReady').onchange=e=>{d.ready=e.target.checked; saveState();};
    document.querySelectorAll('.resume-step').forEach((el,i)=>el.hidden=i!==resumeStep);
    const stepper=$('resumeStepper'); stepper.innerHTML=''; ['Studio setup','Experience discovery','Skills, education & target','Format, build & verify'].forEach((x,i)=>{const b=document.createElement('span');b.className='resume-step-dot '+(i<resumeStep?'done':i===resumeStep?'current':'');b.textContent=(i<resumeStep?'✓ ':i===resumeStep?'→ ':'')+x;stepper.appendChild(b);});
    $('rbPrev').disabled=resumeStep===0; $('rbNext').textContent=resumeStep===3?(d.complete?'Résumé complete ✓':'Complete Résumé ✓'):resumeStep===1?'Continue to Skills & Education →':'Continue →';
    $('resumeBuilderStatus').textContent=d.complete?'Complete':'Step '+(resumeStep+1)+' of 4';
    const rosieGuidance=[
      {title:'Set up your Résumé Studio.',message:"Give me the basics employers need, then tell me where you're headed. If you already have a résumé, we'll be able to bring it into this same evidence-based process.",example:'For privacy, this QA version keeps contact information in this browser while we build secure participant storage.'},
      {title:'Build this experience one real bullet at a time.',message:"Start with one thing you did in this role, in normal words. I’ll ask follow-up questions about responsibilities, tools, scale, problems solved, safety, or results—but I won't fill in facts for you.",example:'Try something simple like: “I opened the store and counted the register.” We can uncover the résumé evidence together.'},
      {title:'What can you actually demonstrate?',message:"Think about tools, software, equipment, technical abilities, workplace skills, education, training, licenses, and credentials. Only claim what you can explain or demonstrate.",example:'If your experience already shows a skill, you can still list it here—but keep it specific and truthful.'},
      {title:'Now we build the top of the résumé.',message:"I have your target, experience, evidence, skills, and education. I can draft a professional summary from those facts. Then you make the final call.",example:'Before you finish, ask yourself: “Could I comfortably explain every statement in an interview?”'}
    ], rg=rosieGuidance[resumeStep]; if($('rosieStepTitle'))$('rosieStepTitle').textContent=rg.title;if($('rosieStepMessage'))$('rosieStepMessage').textContent=rg.message;if($('rosieStepExample'))$('rosieStepExample').textContent=rg.example;
    if(resumeStep===1){syncActiveExperience(d);const bx=d.experiences[d.activeExperience||0]||{};const bl=$('rbBulletList');if(bl){const bullets=(bx.bullets||[]).filter(Boolean);bl.innerHTML=bullets.length?bullets.map((b,i)=>'<div class="saved-bullet"><span>Bullet '+(i+1)+'</span><p>'+escapeHtml(b)+'</p></div>').join(''):'<div class="empty-bullets">No résumé bullets saved yet. Tell Nova what you did, then build the first bullet.</div>';}const list=$('rbExperienceList');if(list){list.innerHTML=d.experiences.map((x,i)=>'<button type="button" class="experience-chip '+(i===d.activeExperience?'active':'')+'" data-exp-index="'+i+'"><span>Experience '+(i+1)+'</span><small>'+(escapeHtml(([x.role,x.employer].filter(Boolean).join(' • ')).slice(0,48))||'New employer / role')+'</small></button>').join('');list.querySelectorAll('[data-exp-index]').forEach(b=>b.onclick=()=>loadExperience(d,Number(b.dataset.expIndex)));}}
    renderResumePreview();
    if(resumeStep===1)window.dispatchEvent(new Event('levelup-nova-discovery-refresh'));
    if(resumeStep===2)evidenceWorkflow?.render();
    document.querySelector('.resume-workspace')?.classList.remove('alignment-preview-open');
    if($('rbTogglePreview'))$('rbTogglePreview').textContent='Show résumé preview';
  }
  function renderResumePreview(){ const d=resumeData();syncActiveExperience(d); $('rpName').textContent=d.contact?.name||state.participantName||'Your Name';if($('rpContact'))$('rpContact').textContent=[d.contact?.email,d.contact?.phone,d.contact?.location].filter(Boolean).join(' • '); $('rpTarget').textContent=d.versions[d.activeVersion]?.target||d.careerTarget||'Target job'; $('rpSummary').textContent=d.versions[d.activeVersion]?.summary||'Your professional summary will appear here.';const pl=$('rpExperienceList');if(pl){const xs=d.experiences.filter(x=>String(x.experience||'').trim()||String(x.evidence||'').trim());pl.innerHTML=xs.map((x,i)=>{const head=[x.role,x.employer].filter(Boolean).join(' • ')||('Experience '+(i+1));const dates=[x.startDate,x.endDate].filter(Boolean).join(' – ');const bullets=(x.bullets||[]).filter(Boolean);return '<div class="preview-experience"><strong>'+escapeHtml(head)+'</strong>'+(dates?'<small>'+escapeHtml(dates)+'</small>':'')+(bullets.length?'<ul>'+bullets.map(b=>'<li>'+escapeHtml(b)+'</li>').join('')+'</ul>':(x.evidence?'<p>'+escapeHtml(x.evidence)+'</p>':''))+'</div>'}).join('');$('rpExperience').hidden=xs.length>0;$('rpEvidence').hidden=xs.length>0;} $('rpExperience').textContent=d.experience||'Experience'; $('rpEvidence').textContent=d.evidence||'Evidence and accomplishments'; $('rpSkills').textContent=d.skills||'Skills'; $('rpEducation').textContent=d.education||'Education, training, and credentials'; window.R2WResumeFormat?.render(d); }
  // Thin Level Up AI adapter: same Northern request/response modes and UI.
  const R2W_AI_URL='https://dnijrzotfyvmmnmueknk.supabase.co/functions/v1/levelup-nova-staged-resume-ai';
  const R2W_AI_KEY='sb_publishable_qSEo4iczJBozMaSIvTKisw_BsJy-iPc';
  async function callR2WResumeAI(body){
    const ctx=window.LEVELUP_NOVA_R2W;
    if(!ctx?.verified)throw new Error('Sign in to Level Up to use Nova');
    const {data:session,error}=await ctx.client.auth.getSession();
    if(error||!session?.session?.access_token)throw new Error('Your Level Up session expired. Sign in again.');
    const res=await fetch(R2W_AI_URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:R2W_AI_KEY,Authorization:'Bearer '+session.session.access_token},body:JSON.stringify(body)});
    let data={};try{data=await res.json()}catch(_){}
    if(!res.ok)throw new Error(data?.message||data?.error||'Nova AI is unavailable right now.');
    return data;
  }
  function showResumeCoach(id,html){const el=$(id);if(!el)return;el.hidden=false;el.innerHTML=html}
  async function rosieBuildBullet(){
    const d=resumeData(),btn=$('rbBuildBullet'),choices=$('rbBulletChoices');if(!String(d.evidence||'').trim()){showResumeCoach('rbBulletCoach','<b>Tell me one thing you did in this role.</b><br>Use normal words. I’ll ask questions and help turn it into strong résumé evidence.');$('rbEvidence').focus();return}
    btn.disabled=true;btn.textContent='Nova is working…';choices.innerHTML='';showResumeCoach('rbBulletCoach','<b>Working from your real experience…</b><br>I won’t add facts you didn’t give me.');
    const askInline=(question,label)=>{const box=$('rbBulletCoach');box.hidden=false;box.innerHTML='<div class="rosie-live-convo"><div class="rosie-convo-label">'+label+'</div><div class="rosie-speaking"><b>Nova</b><div class="rosie-typed-question"></div></div><div class="rosie-reply-wrap"><label>Your answer</label><textarea rows="3" placeholder="Answer Nova in your own words…"></textarea><button type="button" class="rosie-send-btn">Send to Nova →</button></div></div>';const q=box.querySelector('.rosie-typed-question'),reply=box.querySelector('textarea'),send=box.querySelector('button');q.textContent='';let i=0;const timer=setInterval(()=>{q.textContent=question.slice(0,++i);if(i>=question.length){clearInterval(timer);reply.focus()}},18);send.onclick=async()=>{const answer=reply.value.trim();if(!answer){reply.focus();return}d.evidence=[d.evidence,answer].filter(Boolean).join(d.evidence?'\\n':'');$('rbEvidence').value=d.evidence;saveState();showResumeCoach('rbBulletCoach','<b>Got it.</b> Let me use that with what you already told me…');await rosieBuildBullet()}};
    try{const data=await callR2WResumeAI({mode:'bullet',evidence:{targetOccupation:d.target,experience:d.experience,currentEvidence:d.evidence,previousBullets:((d.experiences[d.activeExperience||0]||{}).bullets||[])}});
      if(data.needsClarification){askInline(data.question||'Tell me one more detail about what you did.','One more detail');return}
      if(data.integrityFailed){askInline(data.question||'Can you give me one more factual detail so I can verify that wording?','Quick fact check');return}
      const drafts=[{label:'Clear & Direct',text:data.clearDirect},{label:'Skills Forward',text:data.skillsForward}].filter(x=>x.text);
      showResumeCoach('rbBulletCoach','<b>Nova drafted two truthful options.</b><br>Select one, then click <b>Add selected bullet to résumé</b>. No wording is added on selection alone.');
      choices.innerHTML=drafts.map((x,i)=>'<button type="button" class="rosie-draft" data-rb-draft="'+i+'" aria-pressed="false"><b>'+escapeHtml(x.label)+'</b><span>'+escapeHtml(x.text)+'</span></button>').join('')+
       '<button type="button" class="primary-btn" id="rbCommitSelectedBullet" disabled style="margin-top:10px;padding:12px;border-radius:12px">＋ Add selected bullet to résumé</button>';
      let selectedIndex=-1;
      const commit=choices.querySelector('#rbCommitSelectedBullet');
      choices.querySelectorAll('[data-rb-draft]').forEach(b=>b.onclick=()=>{
        selectedIndex=Number(b.dataset.rbDraft);
        choices.querySelectorAll('.rosie-draft').forEach(x=>{const selected=x===b;x.classList.toggle('selected',selected);x.setAttribute('aria-pressed',String(selected))});
        commit.disabled=false;
        commit.textContent='＋ Add selected bullet to résumé';
      });
      commit.onclick=()=>{
        if(selectedIndex<0)return;
        const text=drafts[selectedIndex]?.text;
        if(!text)return;
        const x=d.experiences[d.activeExperience||0]||(d.experiences[d.activeExperience||0]={bullets:[]});
        x.bullets=Array.isArray(x.bullets)?x.bullets:[];
        // Change the choice from this pair without creating two résumé bullets.
        if(x.novaPairLastApproved&&x.novaPairLastApproved!==text)
          x.bullets=x.bullets.filter(b=>b!==x.novaPairLastApproved);
        if(!x.bullets.includes(text))x.bullets.push(text);
        x.novaPairLastApproved=text;
        syncActiveExperience(d);saveState();renderResumePreview();
        const list=$('rbBulletList');
        if(list)list.innerHTML=x.bullets.map((bullet,i)=>'<div class="saved-bullet"><span>Bullet '+(i+1)+'</span><p>'+escapeHtml(bullet)+'</p></div>').join('');
        commit.disabled=true;commit.textContent='✓ Bullet added to résumé';
        showResumeCoach('rbBulletCoach','<b>Selected bullet saved.</b><br>It appears in your live résumé preview. Choose the other draft and click Add if you want to replace this choice.');
      };
    }catch(e){showResumeCoach('rbBulletCoach','<b>Nova could not complete that draft.</b><br>'+escapeHtml(e.message||'Your own words are still saved. Please try again.'))}finally{btn.disabled=false;btn.textContent='✦ Nova: Turn This Into Résumé Evidence'}
  }
  async function rosieBuildSummary(){
    const d=resumeData(),btn=$('rbDraftSummary');btn.disabled=true;btn.textContent='Nova is drafting…';showResumeCoach('rbSummaryCoach','<b>Building from your résumé evidence…</b>');
    try{const data=await callR2WResumeAI({mode:'summary',evidence:{targetOccupation:d.target,experience:d.experience,evidence:d.evidence,skills:d.skills,education:d.education}});
      if(data.needsClarification){showResumeCoach('rbSummaryCoach','<b>I need a little more evidence first.</b><br>'+escapeHtml(data.question||'Add more experience or skills, then try again.'));return}
      if(!data.summary)throw new Error('No summary was returned.');d.summary=data.summary;d.versions[d.activeVersion].summary=data.summary;$('rbSummary').value=d.summary;saveState();renderResumePreview();showResumeCoach('rbSummaryCoach','<b>Draft ready.</b><br>Read it and change anything that doesn’t sound like you.');
    }catch(e){showResumeCoach('rbSummaryCoach','<b>Nova AI is temporarily unavailable.</b><br>'+escapeHtml(e.message||'Your current résumé is still saved.'))}finally{btn.disabled=false;btn.textContent='✦ Nova: Help Build My Summary'}
  }
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

  function validateResumeStep(){ const d=resumeData(); if(resumeStep===0)return d.target.trim(); if(resumeStep===1){syncActiveExperience(d);const xs=d.experiences||[];return xs.some(x=>String(x.employer||'').trim()&&String(x.role||'').trim()&&((x.bullets||[]).filter(Boolean).length||String(x.evidence||'').trim()));} if(resumeStep===2)return d.skills.trim()||d.education.trim(); return d.summary.trim()&&d.integrity&&d.ready; }

  function renderSkillHud(changed={}){
    const grid=$('skillGrid'); const compact=$('compactSkillStrip'); grid.innerHTML=''; compact.innerHTML='';
    skillOrder.forEach(k=>{
      const m=mastery(k); const delta=Number(changed[k]||0);
      const item=document.createElement('div'); item.className='skill-item';
      item.innerHTML=`<div class="skill-row"><span>${skillNames[k]}</span><span>${m.label}</span></div><div class="meter"><i style="width:${m.pct}%"></i></div>`; grid.appendChild(item);
      const bar=document.createElement('i'); bar.style.setProperty('--w',`${m.pct}%`); bar.title=`${skillNames[k]}: ${m.label}`; if(delta<0) bar.style.filter='saturate(.5)'; compact.appendChild(bar);
    });
  }

  // Fixed balanced presentation order: keeps canonical stored A/B/C/D evidence, audio impacts, and cloud history unchanged.
  // Each entry gives the display letter that should contain the canonical strongest C response.
  const strongestDisplay=['B','D','A','C','D','B','A','C','B','D','C','A','D','B','C','A','D','B','A','C','D','A'];
  const letters=['A','B','C','D'];
  function optionOrder(s){
    const i=scenes.findIndex(x=>x.id===s.id), target=strongestDisplay[i]||'C';
    const remaining=letters.filter(x=>x!==target);
    const canonicalOther=['A','B','D'];
    const mapping={C:target};
    canonicalOther.forEach((k,n)=>mapping[k]=remaining[(n+i)%3]);
    return letters.map(label=>({label,key:Object.keys(mapping).find(key=>mapping[key]===label)}));
  }
  function displayLetter(s,k){return optionOrder(s).find(x=>x.key===k)?.label||k;}
  function promptText(s){return `${s.title}. ${s.setup} What do you do? ${optionOrder(s).map(o=>`${o.label}. ${s.choices[o.key]}`).join(' ')}`;}
  function stopAudio(){
    if('speechSynthesis' in window) speechSynthesis.cancel();
    [promptAudio,impactAudio].forEach(a=>{ if(a){a.pause(); try{a.currentTime=0}catch(e){}} });
  }
  function speak(text,onend){ if(onend) onend(); }
  function attachTrack(audio,src){ audio.querySelectorAll('track').forEach(t=>t.remove()); if(!src)return; const t=document.createElement('track'); t.kind='captions';t.srclang='en';t.label='English';t.src=src;t.default=state.ccOn; audio.appendChild(t); }
  function updateAudioControl(){ $('listenBtn').textContent=state.audioOn?'🔊 Audio On':'🔇 Audio Off'; $('listenBtn').setAttribute('aria-pressed',state.audioOn?'true':'false'); }
  function playPrompt(s){ if(!state.audioOn||!s?.promptFile)return; stopAudio(); attachTrack(promptAudio,s.promptVtt); promptAudio.src=s.promptFile; promptAudio.play().catch(()=>{}); }

  function renderScene(){
    updateOverall(); recalcScores(); saveState(); lastImpact=null;
    const s=scenes[state.currentScene]; activeStage=s.stage;
    const sceneImg=$('sceneImg');
    const mediaUrl=new URL(s.img,document.baseURI).href;
    const sceneVisual=sceneImg.closest('.scene-visual');
    sceneImg.classList.remove('media-failed');
    sceneVisual?.classList.remove('media-loaded');
    sceneVisual?.classList.remove('media-failed');
    sceneImg.alt=`${s.title} scenario`;
    sceneImg.onerror=null;
    sceneImg.onload=()=>{ sceneImg.classList.remove('media-failed'); sceneVisual?.classList.add('media-loaded'); };
    sceneImg.onerror=()=>{
      sceneImg.classList.add('media-failed');
      sceneImg.alt='';
      sceneImg.removeAttribute('src');
      sceneVisual?.classList.remove('media-loaded'); sceneVisual?.classList.add('media-failed');
    };
    sceneImg.src=mediaUrl;
    $('sceneBadge').textContent=`R2W-S${String(s.id).padStart(2,'0')} • ${s.stage}`;
    $('sceneStageChip').textContent=s.stage; $('sceneTitle').textContent=s.title; $('sceneSetup').textContent=s.setup;
    $('sceneProgressBar').style.width=`${((state.currentScene+1)/scenes.length)*100}%`;
    $('sceneProgressText').textContent=`${state.currentScene+1} of ${scenes.length} published scenarios`;
    const inStage=stageScenes(s.stage), pos=inStage.findIndex(x=>x.id===s.id)+1; $('stageProgressText').textContent=`${pos} of ${inStage.length} in ${s.stage}`;
    $('promptCaption').textContent=promptText(s); $('promptCaption').classList.toggle('show',state.ccOn);
    $('inlineFeedback').hidden=true; $('impactCaption').classList.remove('show');
    renderSkillHud();
    const box=$('choices'); box.innerHTML='';
    const previous=state.sceneSelections[s.id];
    for(const {label,key} of optionOrder(s)){
      const b=document.createElement('button'); b.className=`choice ${previous===key?'selected':''}`;
      b.innerHTML=`<strong>${label}</strong>${s.choices[key]}`; b.onclick=()=>choose(s,key,b); box.appendChild(b);
    }
    if(previous){ showInline(s,previous); }
    $('prevSceneBtn').disabled=state.currentScene===0;
    const stageList=stageScenes(s.stage), isStageEnd=s.id===stageList[stageList.length-1].id;
    if(!isStageEnd) $('nextSceneBtn').textContent='Next scenario →';
    else if(s.stage==='Soft Skills Base Camp') $('nextSceneBtn').textContent='Continue to Resume Retreat →';
    else if(s.stage==='Resume Retreat') $('nextSceneBtn').textContent='Continue to Résumé Builder →';
    else $('nextSceneBtn').textContent='View Work Readiness Progress →';
    $('ccBtn').textContent=state.ccOn?'CC':'CC Off'; updateAudioControl();
    if(state.audioOn) setTimeout(()=>playPrompt(s),120);
  }

  function showInline(s,k){ const im=s.impact[k]; lastImpact={s,k,im}; $('inlineFeedback').hidden=false; $('inlineFeedbackTitle').textContent=`You chose ${displayLetter(s,k)}`; $('inlineFeedbackText').textContent=im.feedback||im.narration||''; $('impactCaption').textContent=im.narration||''; $('impactCaption').classList.toggle('show',state.ccOn); }

  function choose(s,k,b){
    document.querySelectorAll('.choice').forEach(x=>x.classList.remove('selected')); b.classList.add('selected');
    state.sceneSelections[s.id]=k; recalcScores(); saveState(); updateOverall(); showInline(s,k); renderSkillHud(weights[s.id]?.[k]||{}); showImpactDialog(s,k); playImpact(s,k);
  }

  function showImpactDialog(s,k){
    const im=s.impact[k]; $('impactDialogTitle').textContent=`You chose ${displayLetter(s,k)}`; $('impactDialogText').textContent=im.feedback||im.narration||'';
    const grid=$('impactSkillGrid'); grid.innerHTML=''; const delta=weights[s.id]?.[k]||{};
    skillOrder.forEach(skill=>{
      const m=mastery(skill); const d=Number(delta[skill]||0); const el=document.createElement('div'); el.className=`impact-skill ${d!==0?'changed':''} ${d<0?'risk':''}`;
      const note=d>0?'Evidence strengthened':d<0?'Development opportunity':'No new evidence this decision';
      el.innerHTML=`<div class="skill-row"><strong>${skillNames[skill]}</strong><strong>${m.label}</strong></div><div class="meter"><i style="width:${m.pct}%"></i></div><div class="delta">${note}</div>`; grid.appendChild(el);
    });
    if(typeof $('impactDialog').showModal==='function') $('impactDialog').showModal(); else $('impactDialog').setAttribute('open','');
  }
  function closeImpact(){ try{$('impactDialog').close()}catch(e){$('impactDialog').removeAttribute('open')} }

  function playImpact(s,k){
    const im=s.impact[k]; stopAudio(); attachTrack(impactAudio,im.vtt);
    if(state.audioOn && im.file){ impactAudio.src=im.file; impactAudio.play().catch(()=>{}); }
  }

  function certificateId(){
    const key=`${state.participantName||'participant'}|${state.firstOpened||''}|BOOST-R2W`;
    let h=2166136261; for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619)}
    return `PINAL-R2W-${(h>>>0).toString(36).toUpperCase().padStart(7,'0')}`;
  }
  function renderCertificate(){
    updateOverall(); recalcScores();
    const certificateName=(state.participantName||state.resumeBuilder?.contact?.name||'').trim();
    if(certificateName&&!state.participantName){state.participantName=certificateName;saveState();}
    $('participantName').value=certificateName;
    const earned=allComplete(), n=answeredCount(), total=scenes.length;
    $('readinessProgressTitle').textContent=earned?'Work Ready Certificate earned':'Your progress so far';
    $('readinessProgressMeta').textContent=earned?`${total} of ${total} scenarios complete • all Ready 2 Work areas complete`:`${n} of ${total} scenarios complete • your skill profile updates with every decision`;
    $('readinessProgressBar').style.width=`${(n/total)*100}%`;
    const stageStatus=$('readinessStageStatus'); stageStatus.innerHTML='';
    stageOrder.forEach(stage=>{ const done=stageComplete(stage), unlocked=stageUnlocked(stage), el=document.createElement('div'); el.className=`readiness-stage-chip ${done?'complete':unlocked?'current':'locked'}`; el.innerHTML=`<strong>${done?'✓':unlocked?'→':'🔒'} ${stage}</strong><span>${done?'Complete':unlocked?(stageAnswered(stage)?`${stageAnswered(stage)} of ${stageScenes(stage).length} complete`:'Available'):'Locked'}</span>`; stageStatus.appendChild(el); });
    $('masteryProfileTitle').textContent=earned?'Final Soft Skill Mastery Profile':'Current Soft Skill Progress';
    const grid=$('certificateSkills'); grid.innerHTML='';
    skillOrder.forEach(k=>{ const m=mastery(k,earned?'final':'live'); const r=document.createElement('div'); r.className='cert-skill'; r.innerHTML=`<strong>${skillNames[k]}</strong><strong>${m.label}</strong>`; grid.appendChild(r); });
    const resumeDone=stageComplete('Resume Retreat'), interviewDone=stageComplete('Interview Landing');
    $('resumeReadiness').textContent=resumeDone?'Complete':'In Progress'; $('interviewReadiness').textContent=interviewDone?'Complete':'In Progress';
    $('certificateDate').textContent=allComplete()?new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(new Date()):'Pending completion';
    $('certificateId').textContent=certificateId();
    $('certificateStatus').textContent=earned?'Certificate earned':'Work Readiness Progress';
    $('certificateLock').classList.toggle('show',!earned);
    $('certificateLock').querySelector('strong').textContent='Certificate in Progress';
    $('certificateLockText').textContent=`Keep building your work-readiness evidence. ${n} of ${total} scenarios are complete. Your current skill profile is shown above; the final credential unlocks when all Ready 2 Work requirements are complete.`;
    $('printCertificateBtn').disabled=!earned;
  }

  // Restore saved progress BEFORE any résumé control calls resumeData().
  // Previously the version-button setup initialized and saved an empty résumé
  // before loadState() ran, overwriting the participant's saved progress.
  loadState();
  lastResumeSnapshot=resumeFingerprint(state.resumeBuilder);
  window.addEventListener('boost-r2w-external-update',event=>{
    const incoming=event.detail?.progress;
    if(!incoming?.resumeBuilder)return;
    state.resumeBuilder=incoming.resumeBuilder;
    saveState();
    if(location.hash==='#resume-builder')renderResumeBuilder();
  });

  window.addEventListener('boost-r2w-format-changed',()=>{renderResumePreview();});
  document.addEventListener('click',e=>{
    const r=e.target.closest('[data-route]'); if(r){ e.preventDefault(); route(r.dataset.route); }
    const s=e.target.closest('[data-stage]'); if(s){ e.preventDefault(); const stage=s.dataset.stage; if(stageUnlocked(stage)) route('stage',{stage}); }
  });
  $('backToStage').onclick=()=>route('stage',{stage:scenes[state.currentScene].stage});
  $('prevSceneBtn').onclick=()=>{ if(state.currentScene>0) route('scene',{index:state.currentScene-1}); };
  $('nextSceneBtn').onclick=()=>{
    const current=scenes[state.currentScene], list=stageScenes(current.stage), isStageEnd=current.id===list[list.length-1].id;
    if(isStageEnd){
      if(current.stage==='Soft Skills Base Camp'){ route('map'); return; }
      if(current.stage==='Resume Retreat'){ route('resume-builder'); return; }
      if(current.stage==='Interview Landing'){ route('stage',{stage:'Interview Landing'}); return; }
    }
    if(state.currentScene<scenes.length-1) route('scene',{index:state.currentScene+1});
  };
  $('resumeBackBtn').onclick=()=>window.LEVELUP_NOVA_R2W?.navigateBack?.();
  if($('rbVersionSlots')){const d=resumeData();const box=$('rbVersionSlots');box.innerHTML=[0,1,2].map(i=>i<d.versions.length?'<button type="button" data-version="'+i+'" class="'+(i===d.activeVersion?'selected':'')+'">'+escapeHtml(d.versions[i].name)+' • '+escapeHtml(d.versions[i].target||'Set target')+(i===d.activeVersion?' • Current':'')+'</button>':'<button type="button" data-version-add="'+i+'">＋ Résumé '+(i+1)+'</button>').join('');box.querySelectorAll('[data-version]').forEach(b=>b.onclick=()=>{const x=resumeData();x.versions[x.activeVersion].target=x.target;x.versions[x.activeVersion].jobDescription=x.jobDescription;x.versions[x.activeVersion].summary=x.summary;x.versions[x.activeVersion].format=x.resumeFormat;x.versions[x.activeVersion].alignment=x.alignment||null;x.activeVersion=Number(b.dataset.version);const v=x.versions[x.activeVersion];x.alignment=v.alignment||null;x.target=v.target||'';x.jobDescription=v.jobDescription||'';x.summary=v.summary||'';x.resumeFormat=v.format||'hybrid';saveState();renderResumeBuilder()});box.querySelectorAll('[data-version-add]').forEach(b=>b.onclick=()=>{const x=resumeData();if(x.versions.length>=3)return;x.versions.push({name:'Résumé '+(x.versions.length+1),target:'',jobDescription:'',summary:'',format:'hybrid',visualStyle:'modern'});x.activeVersion=x.versions.length-1;x.alignment=null;x.target='';x.jobDescription='';x.summary='';x.resumeFormat='hybrid';saveState();renderResumeBuilder();$('rbTarget')?.focus()})}
  if($('rbBuildBullet')) $('rbBuildBullet').onclick=rosieBuildBullet;
  if($('rbAddExperience')) $('rbAddExperience').onclick=addResumeExperience;
  if($('rbAddBullet')) $('rbAddBullet').onclick=()=>{const d=resumeData();syncActiveExperience(d);d.evidence='';$('rbEvidence').value='';$('rbBulletChoices').innerHTML='';$('rbBulletCoach').hidden=true;saveState();if($('rbEvidenceLabel'))$('rbEvidenceLabel').childNodes[0].nodeValue='What else did you do or accomplish in this role?';$('rbEvidence').focus()};
  const evidenceWorkflow=window.R2WEvidenceWorkflow?.create({resumeData,saveState,renderResumePreview,callR2WResumeAI,showResumeCoach,syncActiveExperience,escapeHtml,$});
  evidenceWorkflow?.bind();
  // Parse résumé files locally, review source text, then import as a draft — never invent experience.
  let importedResumeName='';
  function importStatus(message){const el=$('rbImportStatus');if(el)el.textContent=message;}
  if($('rbResumeUpload')) $('rbResumeUpload').onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    const ext=file.name.split('.').pop().toLowerCase();
    if(!['pdf','docx','txt'].includes(ext)){importStatus('Use a PDF, DOCX or plain-text résumé. For older .doc files, save as .docx first.');return}
    if(file.size>5*1024*1024){importStatus('Choose a résumé smaller than 5 MB.');return}
    importStatus('Reading '+file.name+'…');
    try{
      let text='';
      if(ext==='txt')text=await file.text();
      if(ext==='docx'){
        if(!window.mammoth)throw Error('Word reader unavailable. Try PDF or TXT.');
        const result=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
        text=result.value||'';
      }
      if(ext==='pdf'){
        if(!window.pdfjsLib)throw Error('PDF reader unavailable. Try DOCX or TXT.');
        const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
        const parts=[];
        for(let n=1;n<=Math.min(pdf.numPages,20);n++){
          const page=await pdf.getPage(n),data=await page.getTextContent();
          parts.push(data.items.map(x=>x.str||'').join(' '));
        }
        text=parts.join('\n');
      }
      text=text.replace(/\u0000/g,'').trim();
      if(!text)throw Error('No selectable text was found. Scanned résumés need OCR or a text-based file.');
      if(text.length>60000)text=text.slice(0,60000);
      importedResumeName=file.name;
      $('rbImportedText').value=text;
      $('rbImportReview').hidden=false;
      importStatus('Text extracted. Review it, then choose “Use this résumé in Studio.”');
    }catch(err){importStatus('Could not read résumé: '+(err.message||String(err)))}
  };
  if($('rbApplyImport')) $('rbApplyImport').onclick=()=>{
    const text=$('rbImportedText').value.trim();
    if(!text){importStatus('Review text is empty.');return}
    const d=resumeData();
    d.importedResume={fileName:importedResumeName,text,importedAt:new Date().toISOString(),reviewed:true};
    // Preserve all prior structured fields. Imported content becomes editable source evidence.
    if(!String(d.evidence||'').trim()&&!d.experiences?.some(x=>String(x.evidence||'').trim())){
      d.evidence=text.slice(0,12000);
    }
    saveState();
    importStatus('Résumé imported as draft source material and saved automatically. Review and organize your experience in the next step.');
    renderResumeBuilder();
  };
  if($('rbSaveLater')) $('rbSaveLater').onclick=async()=>{
    const d=resumeData();syncActiveExperience(d);d.step=resumeStep;d.savedForLaterAt=new Date().toISOString();saveState();
    const btn=$('rbSaveLater');btn.disabled=true;
    try{
      const ok=await window.LEVELUP_NOVA_R2W?.flush?.();
      if(!ok){alert('Your draft remains saved on this device, but Level Up cloud saving has not been confirmed. Please try again.');return;}
      route('map');
    }finally{btn.disabled=false}
  };
  if($('rbDraftSummary')) $('rbDraftSummary').onclick=rosieBuildSummary;
  $('rbPrev').onclick=()=>{ if(resumeStep>0){resumeStep--; resumeData().step=resumeStep; saveState(); renderResumeBuilder();} };
  $('rbNext').onclick=async()=>{
    if(!validateResumeStep()){alert('Complete the required fields on this step before continuing.');return}
    const d=resumeData();
    if(resumeStep<3){resumeStep++;d.step=resumeStep;saveState();renderResumeBuilder();return}
    const btn=$('rbNext');btn.disabled=true;btn.textContent='Saving completed résumé…';
    try{
      d.complete=true;d.completedAt=new Date().toISOString();saveState();
      await window.LEVELUP_NOVA_R2W.complete();
      renderResumeBuilder();updateOverall();
      window.LEVELUP_NOVA_R2W?.navigateBack?.();
    }catch(error){
      d.complete=false;saveState();renderResumeBuilder();
      alert(error.message||'Level Up could not confirm completion. Your draft remains saved.');
    }finally{btn.disabled=false}
  };
  $('listenBtn').onclick=()=>{ state.audioOn=!state.audioOn; saveState(); updateAudioControl(); if(state.audioOn) playPrompt(scenes[state.currentScene]); else stopAudio(); };
  $('replayBtn').onclick=()=>{ if(lastImpact) playImpact(lastImpact.s,lastImpact.k); };
  $('ccBtn').onclick=()=>{ state.ccOn=!state.ccOn; saveState(); $('ccBtn').textContent=state.ccOn?'CC':'CC Off'; $('promptCaption').classList.toggle('show',state.ccOn); $('impactCaption').classList.toggle('show',state.ccOn&&!$('inlineFeedback').hidden); };
  $('skillToggle').onclick=()=>{ const h=$('skillHud'); h.classList.toggle('expanded'); $('skillToggle').textContent=h.classList.contains('expanded')?'Hide skills':'View skills'; };
  $('impactClose').onclick=closeImpact; $('impactContinue').onclick=closeImpact;
  $('impactDialog').addEventListener('click',e=>{ if(e.target===$('impactDialog')) closeImpact(); });
  $('participantName').addEventListener('input',e=>{ state.participantName=e.target.value; saveState(); $('certificateId').textContent=certificateId(); });
  $('printCertificateBtn').onclick=()=>window.print();
  $('resetBtn').onclick=()=>{alert('To preserve your existing Level Up progress, this isolated résumé test cannot reset the whole course.');};

  // Persist Nova's discovery backlog inside the same résumé and cloud-save pathway.
  window.addEventListener('levelup-nova-discovery-update',event=>{
    const detail=event.detail;
    if(!detail||!Number.isInteger(detail.index)||detail.index<0)return;
    const d=resumeData();
    d.novaDiscoveryCollections=d.novaDiscoveryCollections||{};
    d.novaDiscoveryCollections[detail.index]=detail.collection;
    saveState();
  });
  window.addEventListener('boost-r2w-cloud-restored',event=>{
    const incoming=event.detail?.progress;
    if(!incoming||typeof incoming!=='object')return;
    const current=state;
    state={...current,...incoming,sceneSelections:{...(current.sceneSelections||{}),...(incoming.sceneSelections||{})}};
    recalcScores();updateOverall();
    const hash=location.hash||'#map';
    if(hash.startsWith('#scene-'))renderScene();
    else if(hash==='#certificate')renderCertificate();
    else if(hash.startsWith('#stage-'))route('stage',{stage:stageOrder.find(s=>slug(s)===hash.slice(7))||stageOrder[0]});
    else if(hash==='#resume-builder')renderResumeBuilder();
    else route('map');
  });
  recalcScores(); updateOverall();
  const hash=location.hash||'#map';
  if(hash.startsWith('#scene-')){ const id=Number(hash.split('-')[1]); const idx=scenes.findIndex(s=>s.id===id); route('scene',{index:idx>=0?idx:0}); }
  else if(hash==='#certificate') route('certificate');
  else if(hash==='#resume-builder'){ route('resume-builder'); }
  else if(hash.startsWith('#stage-')){ const wanted=hash.slice(7); const stage=stageOrder.find(s=>slug(s)===wanted)||stageOrder[0]; route('stage',{stage}); }
  else route('map');
})();
