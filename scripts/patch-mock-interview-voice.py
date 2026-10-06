from pathlib import Path

p = Path('public/mock-interview.html')
s = p.read_text(encoding='utf-8')

# Add recorder state and a remembered microphone choice for the interview session/browser.
decl = "let stream=null,faceLandmarker=null,visionReady=false,cameraEnabled=false,calibration=null,raf=0,recognition=null,listening=false,answerStart=0;"
if decl in s:
    s = s.replace(
        decl,
        decl[:-1] + ",voiceRecorder=null,voiceRecorderStream=null,voiceChunks=[],preferredMicId=sessionStorage.getItem(storageKey+':preferredMic')||localStorage.getItem(storageKey+':preferredMic')||'';",
        1,
    )

# Make the recording state visually clean: red is reserved for the recording dot/error states,
# while the instructional status itself is a neutral blue information card.
css_old = ".listening{display:flex;align-items:center;gap:8px;color:#8a3b3b;font-weight:900;font-size:12px;margin-top:8px}"
css_new = ".listening{display:flex;align-items:flex-start;gap:10px;color:#355268;font-weight:800;font-size:12px;line-height:1.4;margin-top:10px;padding:10px 12px;border:1px solid #bcd9e3;border-radius:10px;background:#edf7fa}.listening b{color:#173850}.voiceSteps{margin-top:8px;padding:9px 11px;border-radius:10px;background:#eef3f5;color:#49616d;font-size:11px;line-height:1.45}.voiceSteps b{color:#173850}.voiceSteps span{color:#6d7f8c}"
if css_old in s:
    s = s.replace(css_old, css_new, 1)

# Add microphone selection to the setup screen so it can be chosen once before question 1.
perm_old = '<div class="statusBox">The interviewer voice is AI-generated and designed to sound calm, conversational, and professional.</div><div class="cameraWrap">'
perm_new = '<div class="statusBox">The interviewer voice is AI-generated and designed to sound calm, conversational, and professional.</div><label class="field"><span>Microphone for voice answers</span><select id="setupMicSelect"><option value="">System default microphone</option></select></label><div class="actions"><button class="btn alt" id="enableMic" type="button">🎙 Enable / Refresh Microphone List</button></div><div class="notice" id="setupMicStatus">Choose your microphone once here. Level Up will keep that microphone selected for every interview question.</div><div class="cameraWrap">'
if perm_old in s:
    s = s.replace(perm_old, perm_new, 1)

perm_hook_old = "$('enableCamera').onclick=enableCamera;$('skipCamera').onclick=()=>prepareQuestions();"
perm_hook_new = "void populateSetupMicrophones();$('enableMic').onclick=primeMicrophones;$('enableCamera').onclick=enableCamera;$('skipCamera').onclick=()=>prepareQuestions();"
if perm_hook_old in s:
    s = s.replace(perm_hook_old, perm_hook_new, 1)

# Keep the selector visible on each question as a confirmation/change control, but retain the setup choice.
ui_old = '<div id="listenStatus"></div><div class="actions">'
ui_new = '<label class="field"><span>Microphone</span><select id="micSelect"><option value="">System default microphone</option></select></label><div class="voiceSteps"><b>Voice answer:</b> 1 Record → 2 Stop → 3 Review → 4 Submit. <span>Typing instead? Enter your answer and submit when ready.</span></div><div id="listenStatus"></div><div class="actions">'
if ui_old in s:
    s = s.replace(ui_old, ui_new, 1)

# Populate microphone choices and wire Submit so it only becomes active when an answer exists.
hook_old = "$('speak').onclick=toggleRecognition;$('submit').onclick=submitAnswer;setTimeout(()=>speakQuestion(q.prompt),250)"
hook_new = "$('speak').onclick=toggleRecognition;$('submit').onclick=submitAnswer;void populateMicrophones();wireAnswerControls();setTimeout(()=>speakQuestion(q.prompt),250)"
if hook_old in s:
    s = s.replace(hook_old, hook_new, 1)

# Source contains the original non-async function; deployed builds may contain an earlier async patch.
starts = [s.find('async function toggleRecognition(){'), s.find('function toggleRecognition(){')]
starts = [x for x in starts if x >= 0]
start = min(starts) if starts else -1
end = s.find('\nasync function submitAnswer()', start)
if start < 0 or end < 0:
    raise SystemExit('Voice function markers not found')

fn = r'''function setPreferredMic(deviceId){
  preferredMicId=String(deviceId||'');
  try{
    if(preferredMicId){
      localStorage.setItem(storageKey+':preferredMic',preferredMicId);
      sessionStorage.setItem(storageKey+':preferredMic',preferredMicId);
    }else{
      localStorage.removeItem(storageKey+':preferredMic');
      sessionStorage.removeItem(storageKey+':preferredMic');
    }
  }catch(_){}
}

function microphoneOptions(devices){
  return '<option value="">System default microphone</option>'+devices.map((d,i)=>'<option value="'+esc(d.deviceId)+'">'+esc(d.label||('Microphone '+(i+1)))+'</option>').join('');
}

async function populateSetupMicrophones(){
  const select=$('setupMicSelect');
  if(!select||!navigator.mediaDevices?.enumerateDevices)return;
  try{
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
    select.innerHTML=microphoneOptions(devices);
    if(preferredMicId&&[...select.options].some(o=>o.value===preferredMicId))select.value=preferredMicId;
    else select.value='';
    select.onchange=()=>setPreferredMic(select.value);
  }catch(_){}
}

async function primeMicrophones(){
  const status=$('setupMicStatus'),button=$('enableMic');
  if(!navigator.mediaDevices?.getUserMedia){
    if(status)status.textContent='Microphone selection is not available in this browser. You can still type your answers.';
    return;
  }
  if(button){button.disabled=true;button.textContent='Checking microphones…'}
  try{
    const temp=await navigator.mediaDevices.getUserMedia({audio:true});
    temp.getTracks().forEach(t=>t.stop());
    await populateSetupMicrophones();
    if(status)status.innerHTML='<b>Microphones ready.</b> Choose one above. Your selection will stay active throughout this interview.';
  }catch(_){
    if(status)status.textContent='Microphone permission was not granted. You can continue and type your answers instead.';
  }finally{
    if(button){button.disabled=false;button.textContent='🎙 Enable / Refresh Microphone List'}
  }
}

async function populateMicrophones(){
  const select=$('micSelect');
  if(!select||!navigator.mediaDevices?.enumerateDevices)return;
  try{
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
    select.innerHTML=microphoneOptions(devices);
    if(preferredMicId&&[...select.options].some(o=>o.value===preferredMicId))select.value=preferredMicId;
    else select.value='';
    select.onchange=()=>setPreferredMic(select.value);
  }catch(_){}
}

function updateSubmitState(busy=false){
  const submit=$('submit'),answer=$('answer');
  if(!submit||!answer)return;
  submit.disabled=Boolean(busy||listening||String(answer.value||'').trim().length<8);
}

function wireAnswerControls(){
  const answer=$('answer');
  if(answer)answer.addEventListener('input',()=>updateSubmitState(false));
  updateSubmitState(false);
}

async function transcribeVoiceBlob(blob,mimeType){
  if(!blob||blob.size<500)throw new Error('empty_audio');
  if(!await ensureAuth())throw new Error('auth');
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token)throw new Error('auth');
  const ext=(mimeType||'').includes('mp4')?'m4a':(mimeType||'').includes('ogg')?'ogg':'webm';
  const form=new FormData();
  form.append('file',blob,'voice-answer.'+ext);
  const r=await fetch(SUPABASE_URL+'/functions/v1/interview-transcribe',{
    method:'POST',
    headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_KEY},
    body:form
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data?.text)throw new Error(data?.error||'transcription_failed');
  return String(data.text).trim();
}

async function toggleRecognition(){
  const status=$('listenStatus'),button=$('speak'),answer=$('answer'),micSelect=$('micSelect');
  if(listening){
    button.disabled=true;
    button.textContent='Transcribing…';
    updateSubmitState(true);
    status.innerHTML='<div class="statusBox">Recording stopped. Turning your answer into text…</div>';
    try{voiceRecorder?.stop()}catch(_){}
    return;
  }

  try{questionAudio?.pause()}catch(_){}
  try{speechSynthesis.cancel()}catch(_){}

  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
    status.innerHTML='<div class="statusBox bad">Voice recording is not available in this browser. Try Chrome or Edge, or type your answer instead.</div>';
    return;
  }

  const selectedId=micSelect?.value||preferredMicId||'';
  if(micSelect&&micSelect.value!==selectedId&&[...micSelect.options].some(o=>o.value===selectedId))micSelect.value=selectedId;
  if(selectedId)setPreferredMic(selectedId);
  const audioConstraints={echoCancellation:true,noiseSuppression:true,autoGainControl:true};
  if(selectedId)audioConstraints.deviceId={exact:selectedId};

  try{
    voiceRecorderStream=await navigator.mediaDevices.getUserMedia({audio:audioConstraints});
  }catch(e){
    status.innerHTML='<div class="statusBox bad">Microphone access is blocked or the selected microphone is unavailable. Check browser permissions or choose a different microphone.</div>';
    updateSubmitState(false);
    return;
  }

  await populateMicrophones();
  const track=voiceRecorderStream.getAudioTracks()[0];
  const micName=track?.label||'selected microphone';
  const actualId=track?.getSettings?.().deviceId||selectedId;
  if(selectedId&&actualId)setPreferredMic(actualId);
  const choices=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  const mimeType=choices.find(t=>{try{return MediaRecorder.isTypeSupported(t)}catch(_){return false}})||'';
  voiceChunks=[];

  try{
    voiceRecorder=mimeType?new MediaRecorder(voiceRecorderStream,{mimeType}):new MediaRecorder(voiceRecorderStream);
  }catch(e){
    voiceRecorderStream?.getTracks().forEach(t=>t.stop());
    voiceRecorderStream=null;
    status.innerHTML='<div class="statusBox bad">Voice recording could not start with '+esc(micName)+'. Choose another microphone or type your answer.</div>';
    updateSubmitState(false);
    return;
  }

  voiceRecorder.ondataavailable=e=>{if(e.data?.size)voiceChunks.push(e.data)};
  voiceRecorder.onstart=()=>{
    listening=true;
    button.disabled=false;
    button.textContent='■ Stop Recording';
    updateSubmitState(true);
    status.innerHTML='<div class="listening"><span class="pulse"></span><span><b>Recording:</b> '+esc(micName)+'<br>Speak naturally. When you finish, click <b>Stop Recording</b>. Submit will unlock after your transcript is ready.</span></div>';
  };
  voiceRecorder.onerror=()=>{
    listening=false;
    button.disabled=false;
    button.textContent='🎙 Record Voice Answer';
    status.innerHTML='<div class="statusBox bad">The selected microphone stopped recording. Choose another microphone or try again.</div>';
    voiceRecorderStream?.getTracks().forEach(t=>t.stop());
    voiceRecorderStream=null;
    updateSubmitState(false);
  };
  voiceRecorder.onstop=async()=>{
    listening=false;
    const type=voiceRecorder?.mimeType||mimeType||'audio/webm';
    const blob=new Blob(voiceChunks,{type});
    voiceRecorderStream?.getTracks().forEach(t=>t.stop());
    voiceRecorderStream=null;
    voiceRecorder=null;
    voiceChunks=[];
    try{
      const transcript=await transcribeVoiceBlob(blob,type);
      const existing=answer.value.trim();
      answer.value=(existing+(existing?' ':'')+transcript).trim();
      status.innerHTML='<div class="statusBox good"><b>Transcript ready.</b> Review or edit your answer, then click Submit Answer.</div>';
    }catch(e){
      console.warn('Voice transcription failed',e);
      status.innerHTML='<div class="statusBox bad">The audio was recorded, but transcription did not finish. Try recording again or type your answer.</div>';
    }
    button.disabled=false;
    button.textContent=answer.value.trim()?'🎙 Record More':'🎙 Record Voice Answer';
    updateSubmitState(false);
  };

  try{voiceRecorder.start(250)}catch(e){
    voiceRecorderStream?.getTracks().forEach(t=>t.stop());
    voiceRecorderStream=null;
    voiceRecorder=null;
    status.innerHTML='<div class="statusBox bad">Voice recording could not start. Choose another microphone or refresh and try again.</div>';
    updateSubmitState(false);
  }
}
'''

s = s[:start] + fn + s[end:]

# Defensive guard: Submit never tries to silently stop an active recording. The participant must
# complete the explicit Record -> Stop -> Review -> Submit sequence.
submit_old = "async function submitAnswer(){try{recognition?.stop()}catch(_){}stage='evaluating';"
submit_new = "async function submitAnswer(){if(listening||voiceRecorder){$('listenStatus').innerHTML='<div class=\"statusBox\">Stop your recording first. Submit will unlock when the transcript is ready.</div>';return}stage='evaluating';"
if submit_old in s:
    s = s.replace(submit_old, submit_new, 1)

p.write_text(s, encoding='utf-8')
print('Mock interview voice UX patched: remembered microphone, clean recording status, and gated Submit flow.')
