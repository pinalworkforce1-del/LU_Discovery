(() => {
  'use strict';
  const KEY='boost-northern-r2w-v1', STAGE='Interview Landing';
  const $=id=>document.getElementById(id);
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
  let lastSignature='';
  function refresh(){
    const title=$('stageHomeTitle'),grid=$('stageExperienceGrid');
    if(!title||!grid||title.textContent.trim()!==STAGE){lastSignature='';return}
    const scenes=(window.R2W_COURSE?.scenes||[]).filter(s=>s.stage===STAGE);
    const saved=read(), done=scenes.filter(s=>saved.sceneSelections?.[s.id]).length;
    const unlocked=scenes.length>0&&done===scenes.length;
    const finished=!!saved.jacquelineInterview?.verifiedComplete;
    const signature=[done,scenes.length,unlocked,finished].join('|');
    if(signature===lastSignature&&grid.querySelector('.mock-interview-card'))return;
    lastSignature=signature;
    let button=grid.querySelector('.mock-interview-card');
    if(!button){button=document.createElement('button');button.type='button';button.className='board-card mock-interview-card';grid.prepend(button)}
    button.classList.toggle('locked',!unlocked);
    button.disabled=!unlocked;
    button.innerHTML='<span class="card-kicker">REQUIRED • STEP 2</span><strong>Mock Interview</strong><small>'+(!unlocked?'Complete the five interview decisions to unlock.':finished?'Jacqueline mock interview complete ✓':'Practice five employer-style questions with Jacqueline in a live mock interview.')+'</small><span class="card-arrow">'+(finished?'✓':'→')+'</span>';
    button.onclick=()=>{if(unlocked)window.alert('Jacqueline integration is being validated for Northern BOOST. Your interview scenario progress is saved, but the live mock interview is not yet available.');};
    const status=$('stageHomeProgress'),path=$('requiredPathTitle'),meta=$('requiredPathMeta');
    if(path)path.textContent=unlocked?'Review Interview Decision Trail':'Continue Interview Decision Trail';
    if(meta)meta.textContent=done+' of '+scenes.length+' decisions complete • Mock Interview '+(finished?'complete':unlocked?'unlocked':'locked');
    if(status)status.textContent=finished?'Complete':unlocked?'Mock Interview required':done+' of '+scenes.length+' decisions';
  }
  // Observe only screen visibility/title changes, not our own card mutations.
  const title=$('stageHomeTitle'),view=$('viewStageHome');
  if(title)new MutationObserver(refresh).observe(title,{childList:true,characterData:true,subtree:true});
  if(view)new MutationObserver(refresh).observe(view,{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('hashchange',refresh);
  window.addEventListener('boost-r2w-cloud-restored',refresh);
  window.addEventListener('boost-r2w-saved',()=>{if($('stageHomeTitle')?.textContent.trim()===STAGE)refresh()});
  setTimeout(refresh,50);
})();