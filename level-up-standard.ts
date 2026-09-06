const RAIL_ID = "level-up-scene-rail";

function hudButton(pattern: RegExp) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".level-up-topbar button"))
    .find((button) => pattern.test(button.getAttribute("aria-label") || ""));
}
function video(){return document.querySelector<HTMLVideoElement>(".scene-frame .caption-video")}
function originalContinue(){return document.querySelector<HTMLButtonElement>(".scene-frame .scene-continue, .scene-frame .next-level-button")}
function fallbackPlay(){return document.querySelector<HTMLButtonElement>(".scene-frame .resume-narration")}
function fallbackSkip(){return document.querySelector<HTMLButtonElement>(".scene-frame .skip-narration")}

function makeRail(){
  const rail=document.createElement("aside");
  rail.id=RAIL_ID; rail.className="level-up-scene-rail"; rail.setAttribute("aria-label","Scene controls");
  rail.innerHTML=`<small>SCENE CONTROLS</small>
    <button type="button" data-lu="audio"><span class="control-icon">🔊</span><span class="control-label">Audio on</span></button>
    <button type="button" data-lu="replay"><span class="control-icon">↻</span><span>Replay narration</span></button>
    <button type="button" data-lu="skip"><span class="control-icon">↠</span><span>Skip narration</span></button>
    <button type="button" data-lu="play"><span class="control-icon">▶</span><span class="control-label">Play narration</span></button>
    <button type="button" class="rail-continue" data-lu="continue">Continue <span>→</span></button>`;
  rail.querySelector<HTMLButtonElement>('[data-lu="audio"]')!.onclick=()=>{hudButton(/Mute narration|Turn on narration/i)?.click();queue()};
  rail.querySelector<HTMLButtonElement>('[data-lu="play"]')!.onclick=()=>{const b=hudButton(/Pause narration|Play narration/i);(b||fallbackPlay())?.click();queue()};
  rail.querySelector<HTMLButtonElement>('[data-lu="replay"]')!.onclick=()=>{const v=video();if(!v)return;v.currentTime=0;v.play().catch(()=>fallbackPlay()?.click());queue()};
  rail.querySelector<HTMLButtonElement>('[data-lu="skip"]')!.onclick=()=>{fallbackSkip()?.click();queue()};
  rail.querySelector<HTMLButtonElement>('[data-lu="continue"]')!.onclick=()=>{originalContinue()?.click();queue()};
  return rail;
}
function bind(v:HTMLVideoElement|null){if(!v||v.dataset.luRail)return;v.dataset.luRail="1";["play","pause","ended","volumechange","loadedmetadata"].forEach(e=>v.addEventListener(e,queue))}
function refresh(){
  const shell=document.querySelector<HTMLElement>("main.level-up-shell"); const stage=document.querySelector<HTMLElement>(".game-stage"); if(!shell||!stage)return;
  let rail=document.getElementById(RAIL_ID) as HTMLElement|null;if(!rail)rail=makeRail();if(rail.parentElement!==shell||rail.previousElementSibling!==stage)stage.insertAdjacentElement("afterend",rail);
  const v=video();bind(v);const has=!!v;
  const audio=rail.querySelector<HTMLButtonElement>('[data-lu="audio"]')!;const play=rail.querySelector<HTMLButtonElement>('[data-lu="play"]')!;const replay=rail.querySelector<HTMLButtonElement>('[data-lu="replay"]')!;const skip=rail.querySelector<HTMLButtonElement>('[data-lu="skip"]')!;const next=rail.querySelector<HTMLButtonElement>('[data-lu="continue"]')!;
  audio.disabled=!has;audio.querySelector<HTMLElement>(".control-icon")!.textContent=v?.muted?"🔇":"🔊";audio.querySelector<HTMLElement>(".control-label")!.textContent=v?.muted?"Audio off":"Audio on";
  replay.disabled=!has;skip.disabled=!fallbackSkip();play.disabled=!has;const playing=!!v&&!v.paused&&!v.ended;play.querySelector<HTMLElement>(".control-icon")!.textContent=playing?"Ⅱ":"▶";play.querySelector<HTMLElement>(".control-label")!.textContent=playing?"Pause narration":"Play narration";
  const source=originalContinue();next.hidden=!source;next.disabled=!source||source.disabled;
}
let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh()})}
new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","disabled","aria-label"]});
window.addEventListener("load",queue);queue();
