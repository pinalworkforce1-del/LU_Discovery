import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/+esm';

const SUPABASE_URL='https://dnijrzotfyvmmnmueknk.supabase.co';
const SUPABASE_KEY='sb_publishable_qSEo4iczJBozMaSIvTKisw_BsJy-iPc';
const PUBLIC_ROOT='https://pinalworkforce1-del.github.io/LU_Discovery/';
const SHADOW_ROOT='https://pinalworkforce1-del.github.io/Level_Up_Portal/shadow-passage/';
const LIVE_VERSION='20260922shadow1';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const $=id=>document.getElementById(id),alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function randomCode(n=10){const a=new Uint8Array(n);crypto.getRandomValues(a);return Array.from(a,b=>alphabet[b%alphabet.length]).join('')}

const SCENES=[
 {n:1,title:'Shadow Passage Unlocked',img:'assets/images/scene-01.webp',media:'assets/video/narration-01.mp4',why:'This opens the Cave of Tomorrows as a thought experiment. The future shown here is possible—not predetermined.',message:'Small money habits are easy to ignore when they are still small.',focus:'Set the tone before you begin: this is not about shaming spending. It is about noticing patterns early enough to choose differently.'},
 {n:2,title:'First Paycheck',img:'assets/images/scene-02.webp',media:'assets/video/narration-02.mp4',why:'A first paycheck can feel larger before all of its jobs are visible. Convenience, entertainment, shopping, and subscriptions can compete with priorities quickly.',message:'The problem is not any one purchase. Repeated automatic choices can consume money before a plan exists.',focus:'Ask the group to notice how ordinary each purchase looks. The point is accumulation, not “good” versus “bad” spending.'},
 {n:3,title:'The Cycle',img:'assets/images/scene-03.webp',media:'assets/video/narration-03.mp4',why:'Patterns become powerful when they repeat: payday, spending, waiting, stress, and then another payday.',message:'The most useful interruption happens before the money disappears—not only after stress shows up.',focus:'Name the cycle out loud. Ask where a decision point could be inserted before the pattern repeats.'},
 {n:4,title:'Higher Income, Same Habits',img:'assets/images/scene-04.webp',media:'assets/video/narration-04.mp4',why:'More income can create opportunity, but it does not automatically create a system for using that income.',message:'Lifestyle inflation can cause spending and commitments to rise alongside earnings.',focus:'Keep this balanced: earning more absolutely can help. The lesson is that higher income works better when stronger habits grow with it.'},
 {n:5,title:'Twenty Years Later',img:'assets/images/scene-05.webp',media:'assets/video/narration-05.mp4',why:'The long time jump makes compounding visible. Small habits can grow into larger commitments, debt, minimum payments, and continued pressure.',message:'Income changed. The underlying pattern did not.',focus:'After the narration, launch the class decision. Use the responses to surface the difference between an income problem and a money-system problem.'},
 {n:6,title:'Future Unlocked',img:'assets/images/scene-06.webp',media:'assets/video/narration-06.mp4',why:'This final scene shifts from warning to agency. The future in the cave was one possible path, not a forecast.',message:'Money Moves is where participants build practical tools to create a different pattern.',focus:'End forward-looking. The takeaway is not “never spend.” It is: decide what your money needs to do before automatic habits decide for you.'}
];

const QUESTION={
 id:'shadow_future_pattern',
 phase:'SHADOW PASSAGE • CLASS DECISION',
 kind:'single',
 prompt:'Alex earns more than he did at the beginning. Why does financial stress still feel familiar?',
 help:'Choose the explanation that best matches what the Cave of Tomorrows is showing.',
 options:[
   'His income never really increased.',
   'His spending and commitments grew with income while the underlying habits stayed the same.',
   'One emergency created the entire problem.',
   'The only solution would be to find a different job.'
 ],
 correctIndex:1,
 feedback:'Income created more options, but the habits and commitments around the money expanded too. More income can help; it does not automatically create a financial system.',
 xp:'none'
};

const params=new URLSearchParams(location.search);let room=(params.get('room')||'').toUpperCase().replace(/[^A-Z2-9]/g,'');
if(room.length<8){room=randomCode();const u=new URL(location.href);u.searchParams.set('room',room);history.replaceState({},'',u)}
const participantUrl=new URL('join-live.html',PUBLIC_ROOT);participantUrl.searchParams.set('room',room);participantUrl.searchParams.set('v',LIVE_VERSION);
const displayUrl=new URL('presenter-discovery.html',location.href);displayUrl.searchParams.set('room',room);displayUrl.searchParams.set('v',LIVE_VERSION);
$('roomCode').textContent=room;$('joinUrl').textContent=participantUrl.toString();

const video=$('narrationVideo'),clientId='live-'+randomCode(12),channel=supabase.channel('levelup:facilitator:'+room,{config:{broadcast:{self:true},presence:{key:clientId}}});
const durationCache=new Map(),answers=new Map();
let sceneNo=1,mode='scene',revealed=false,connected=false,ended=false,facilitatorMuted=true,displayMuted=false,questionDone=false;
const scene=()=>SCENES.find(s=>s.n===sceneNo);
const imageUrl=()=>SHADOW_ROOT+scene().img;
const mediaUrl=()=>SHADOW_ROOT+scene().media;
const time=t=>Number.isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'--:--';

function currentResults(){const r=answers.get(QUESTION.id)||new Map();return{kind:'options',count:r.size,options:QUESTION.options,counts:QUESTION.options.map((_,i)=>[...r.values()].filter(v=>v===i).length)}}
function state(){const s=scene();return{mode,module:'shadow',stage:'shadow',stageLabel:'Shadow Passage',scene:{slide:s.n,title:s.title,total:6,imageUrl:imageUrl(),narrationUrl:mediaUrl()},question:mode==='activity'?QUESTION:null,questionIndex:0,totalQuestions:1,revealed,results:mode==='activity'?currentResults():null,ended:false}}
async function broadcast(){if(connected&&!ended)await channel.send({type:'broadcast',event:'facilitator_state',payload:state()})}
async function sendMedia(action){if(connected&&!ended)await channel.send({type:'broadcast',event:'display_media',payload:{module:'shadow',slide:sceneNo,action,time:video.currentTime||0,muted:displayMuted}})}
function updateClock(){$('narrationClock').textContent=time(video.currentTime||0)+' / '+time(Number.isFinite(video.duration)?video.duration:durationCache.get(sceneNo))}
function updatePresence(){let participants=0,display=false;Object.values(channel.presenceState()).forEach(arr=>arr.forEach(p=>{if(p.role==='participant')participants++;if(p.role==='display')display=true}));$('participantCount').textContent=String(participants);$('displayStatus').textContent=display?'Connected':'Not connected';$('displayStatus').className='displayStatus'+(display?' ok':'')}
function renderList(){$('sceneList').innerHTML=SCENES.map(s=>'<button type="button" class="sceneChip '+(s.n===sceneNo?'active':'')+'" data-scene="'+s.n+'">'+s.n+'. '+esc(s.title)+(durationCache.has(s.n)?' • '+time(durationCache.get(s.n)):'')+'</button>').join('');$('sceneList').querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>setScene(Number(b.dataset.scene)))}
function renderCue(){const s=scene();$('cueAnchor').textContent='SCENE '+s.n;$('facCueText').innerHTML='<strong>Why it matters:</strong> '+esc(s.why)+'<br><strong>Key message:</strong> '+esc(s.message)+'<br><strong>Facilitator focus:</strong> '+esc(s.focus)}
function setScene(n){const s=SCENES.find(x=>x.n===n);if(!s)return;sceneNo=n;mode='scene';revealed=false;$('facActivityMask').classList.remove('show');$('questionPanel').classList.remove('show');$('sceneControls').style.display='flex';$('liveControls').style.display='none';video.pause();$('sceneArtwork').src=imageUrl();$('sceneArtwork').alt=s.title;$('narrationSource').src=mediaUrl();video.load();video.muted=facilitatorMuted;$('screenTitle').textContent='Scene '+n+' • '+s.title;$('sceneMeta').textContent='Shadow Passage • '+n+' of 6';$('stageBadge').textContent='SHADOW PASSAGE • SCENE '+n;$('modeLabel').textContent='Shared cinematic';renderCue();$('prevScene').disabled=n===1;$('launchQuestion').style.display=n===5?'inline-flex':'none';$('nextScene').style.display='inline-flex';$('nextScene').disabled=n===5&&!questionDone;$('nextScene').textContent=n===6?'Complete Passage →':'Next Scene →';$('playStatus').textContent=n===5&&!questionDone?'Play the narration, then launch the class decision':'Ready';$('completion').classList.remove('show');renderList();updateClock();broadcast();if(n>1)setTimeout(()=>video.play().catch(()=>{}),220)}
function next(){if(sceneNo===6){complete();return}if(sceneNo===5&&!questionDone)return;setScene(sceneNo+1)}
function renderQuestion(){const r=currentResults(),total=Math.max(1,r.count||0);$('questionTitle').textContent=QUESTION.prompt;$('questionHelp').textContent=QUESTION.help;$('responseCount').textContent=String(r.count||0);$('responseStatus').textContent=(r.count||0)+' responses';$('bars').innerHTML=QUESTION.options.map((o,i)=>{const count=r.counts[i]||0,pct=Math.round(count/total*100),correct=revealed&&i===QUESTION.correctIndex;return'<div class="barRow"><div>'+(correct?'✓ ':'')+esc(o)+'</div><div class="bar"><span style="width:'+(r.count?pct:0)+'%"></span></div><div class="pct">'+(r.count?pct+'%':'—')+'</div></div>'}).join('')+(revealed?'<div class="facActivityNote"><b>Why:</b> '+esc(QUESTION.feedback)+'</div>':'');const body='<p class="facActivityPrompt">'+esc(QUESTION.prompt)+'</p><div class="facActivityChoices">'+QUESTION.options.map((o,i)=>{const count=r.counts[i]||0,pct=Math.round(count/total*100),correct=revealed&&i===QUESTION.correctIndex;return'<div class="facActivityChoice '+(correct?'correct':'')+'"><div>'+(correct?'✓ ':'')+esc(o)+'</div><div class="facActivityBar"><i style="width:'+(r.count?pct:0)+'%"></i></div><div class="facActivityPct">'+(r.count?pct+'%':'—')+'</div></div>'}).join('')+'</div><div class="facActivityNote">'+(revealed?'<b>Why:</b> '+esc(QUESTION.feedback):'Participants answer anonymously on their devices. Reveal the room pattern when you are ready to debrief.')+'</div>';$('facActivityTitle').textContent='Income changed. Why didn’t the stress?';$('facActivityBody').innerHTML=body}
function startQuestion(){if(sceneNo!==5)return;mode='activity';revealed=false;video.pause();$('sceneControls').style.display='none';$('liveControls').style.display='flex';$('questionPanel').classList.add('show');$('facActivityMask').classList.add('show');$('modeLabel').textContent='Live class decision';$('screenTitle').textContent='Shadow Passage • Class Decision';renderQuestion();broadcast()}
function backToScene(){questionDone=true;mode='scene';$('facActivityMask').classList.remove('show');$('questionPanel').classList.remove('show');$('sceneControls').style.display='flex';$('liveControls').style.display='none';$('modeLabel').textContent='Shared cinematic';$('screenTitle').textContent='Scene 5 • Twenty Years Later';$('nextScene').disabled=false;$('playStatus').textContent='Class decision complete — continue to Future Unlocked';broadcast()}
async function complete(){mode='stage_complete';video.pause();$('sceneControls').style.display='none';$('liveControls').style.display='none';$('questionPanel').classList.remove('show');$('facActivityMask').classList.remove('show');$('completion').classList.add('show');$('screenTitle').textContent='Shadow Passage Complete';$('modeLabel').textContent='Bridge complete';$('facCueText').innerHTML='<strong>Connect forward:</strong> The cave showed one possible future. Money Moves now gives participants practical tools to create a different pattern.<br><strong>Facilitator focus:</strong> Keep the transition hopeful and practical: income matters, and so does having a system for what the income needs to do.';await broadcast()}
async function returnMap(){const key='levelup-live-room:'+room;let st={completed:[]};try{st=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}if(!Array.isArray(st.completed))st.completed=[];if(mode==='stage_complete'&&!st.completed.includes('shadow'))st.completed.push('shadow');localStorage.setItem(key,JSON.stringify(st));await channel.send({type:'broadcast',event:'facilitator_state',payload:{mode:'map',stage:'map',stageLabel:'Level Up Live',mapState:{completed:st.completed,next:'money-moves',headline:'Shadow Passage Complete • Money Moves Next'},ended:false}});const u=new URL('level-up-live.html',location.href);u.searchParams.set('room',room);if(mode==='stage_complete')u.searchParams.set('completed','shadow');location.href=u.toString()}
async function makeQr(){const wrap=$('qrWrap');try{const QR=await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');wrap.innerHTML='<canvas id="qrCanvas" aria-label="QR code to join Level Up Live"></canvas><div class="small" style="text-align:center;margin-top:6px"><b>Scan to join this room</b><br>Shadow Passage • Room '+room+'</div>';await QR.toCanvas($('qrCanvas'),participantUrl.toString(),{width:300,margin:4,errorCorrectionLevel:'H',color:{dark:'#000000',light:'#ffffff'}})}catch{wrap.innerHTML='<div class="small"><b>QR unavailable.</b><br>Use the student link above.</div>'}}

channel.on('presence',{event:'sync'},updatePresence)
 .on('broadcast',{event:'participant_hello'},()=>broadcast())
 .on('broadcast',{event:'display_hello'},async()=>{updatePresence();await broadcast();await sendMedia(video.paused?'pause':'play')})
 .on('broadcast',{event:'participant_response'},({payload})=>{if(mode!=='activity'||payload?.question_id!==QUESTION.id||!payload.client_id)return;if(!answers.has(QUESTION.id))answers.set(QUESTION.id,new Map());answers.get(QUESTION.id).set(payload.client_id,Number(payload.answer));renderQuestion();broadcast()})
 .subscribe(async status=>{if(status==='SUBSCRIBED'){connected=true;$('connection').textContent='Realtime connected';$('connection').className='status ok';await channel.track({role:'facilitator',module:'shadow',online_at:new Date().toISOString()});broadcast()}else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){connected=false;$('connection').textContent='Realtime unavailable';$('connection').className='status bad'}});

video.addEventListener('loadedmetadata',()=>{if(Number.isFinite(video.duration))durationCache.set(sceneNo,video.duration);updateClock();renderList()});
video.addEventListener('durationchange',updateClock);video.addEventListener('timeupdate',updateClock);
video.addEventListener('play',()=>{$('captionMask').classList.add('show');$('playPause').textContent='❚❚ Pause Narration';$('playStatus').textContent='Narration playing on classroom display';sendMedia('play')});
video.addEventListener('pause',()=>{$('captionMask').classList.remove('show');$('playPause').textContent='▶ Play Narration';sendMedia('pause')});
video.addEventListener('ended',()=>{$('captionMask').classList.remove('show');$('playPause').textContent='▶ Play Narration';$('playStatus').textContent=sceneNo===5&&!questionDone?'Narration complete — launch the class decision':'Narration complete — connect the scene, then continue'});

$('playPause').onclick=()=>video.paused?video.play().catch(()=>{}):video.pause();
$('replay').onclick=()=>{video.currentTime=0;video.play().catch(()=>{});sendMedia('replay')};
$('mute').onclick=()=>{facilitatorMuted=!facilitatorMuted;video.muted=facilitatorMuted;$('mute').textContent=facilitatorMuted?'🔇 Facilitator Audio Off':'🔊 Facilitator Audio On'};
$('prevScene').onclick=()=>setScene(Math.max(1,sceneNo-1));$('nextScene').onclick=next;$('launchQuestion').onclick=startQuestion;$('backToScene').onclick=backToScene;
$('reveal').onclick=()=>{revealed=true;renderQuestion();broadcast()};$('resetResponses').onclick=async()=>{answers.delete(QUESTION.id);revealed=false;await channel.send({type:'broadcast',event:'responses_reset',payload:{question_id:QUESTION.id}});renderQuestion();broadcast()};
$('returnMap').onclick=returnMap;$('returnMapMain').onclick=returnMap;$('copyLink').onclick=async()=>{try{await navigator.clipboard.writeText(participantUrl.toString());$('copyLink').textContent='Student Link Copied!'}catch{$('copyLink').textContent='Copy failed'}setTimeout(()=>$('copyLink').textContent='Copy Student Link',1400)};
$('openDisplay').onclick=()=>window.open(displayUrl.toString(),'levelup-classroom-display','noopener');$('openParticipant').onclick=()=>window.open(participantUrl.toString(),'_blank','noopener');
$('endSession').onclick=async()=>{ended=true;video.pause();$('roomStatus').textContent='Room ended';$('roomStatus').className='status bad';await channel.send({type:'broadcast',event:'session_ended',payload:{room}});setTimeout(()=>supabase.removeChannel(channel),400)};
window.addEventListener('beforeunload',()=>{try{channel.untrack();supabase.removeChannel(channel)}catch{}});
video.muted=true;setScene(1);makeQr();
