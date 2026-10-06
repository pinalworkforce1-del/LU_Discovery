from pathlib import Path

p = Path('public/mock-interview.html')
s = p.read_text(encoding='utf-8')

# Add recorder state to the existing runtime declaration.
decl = "let stream=null,faceLandmarker=null,visionReady=false,cameraEnabled=false,calibration=null,raf=0,recognition=null,listening=false,answerStart=0;"
if decl in s:
    s = s.replace(decl, decl[:-1] + ",voiceRecorder=null,voiceRecorderStream=null,voiceChunks=[];", 1)

# Add a microphone chooser to the answer screen so USB/headset mics can be selected explicitly.
ui_old = '<div id="listenStatus"></div><div class="actions">'
ui_new = '<label class="field"><span>Microphone</span><select id="micSelect"><option value="">System default microphone</option></select></label><div id="listenStatus"></div><div class="actions">'
if ui_old in s:
    s = s.replace(ui_old, ui_new, 1)

# Populate microphone choices whenever a question screen is rendered.
hook_old = "$('speak').onclick=toggleRecognition;$('submit').onclick=submitAnswer;setTimeout(()=>speakQuestion(q.prompt),250)"
hook_new = "$('speak').onclick=toggleRecognition;$('submit').onclick=submitAnswer;void populateMicrophones();setTimeout(()=>speakQuestion(q.prompt),250)"
if hook_old in s:
    s = s.replace(hook_old, hook_new, 1)

# Source contains the original non-async function; deployed builds may contain the earlier async patch.
starts = [s.find('async function toggleRecognition(){'), s.find('function toggleRecognition(){')]
starts = [x for x in starts if x >= 0]
start = min(starts) if starts else -1
end = s.find('\nasync function submitAnswer()', start)
if start < 0 or end < 0:
    raise SystemExit('Voice function markers not found')

fn = r'''async function populateMicrophones(){
  const select=$('micSelect');
  if(!select||!navigator.mediaDevices?.enumerateDevices)return;
  try{
    const current=select.value;
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
    select.innerHTML='<option value="">System default microphone</option>'+devices.map((d,i)=>'<option value="'+esc(d.deviceId)+'">'+esc(d.label||('Microphone '+(i+1)))+'</option>').join('');
    if([...select.options].some(o=>o.value===current))select.value=current;
  }catch(_){}
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
    status.innerHTML='<div class="statusBox">Turning your recorded answer into text…</div>';
    try{voiceRecorder?.stop()}catch(_){}
    return;
  }

  try{questionAudio?.pause()}catch(_){}
  try{speechSynthesis.cancel()}catch(_){}

  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
    status.innerHTML='<div class="statusBox bad">Voice recording is not available in this browser. Try Chrome or Edge, or type your answer instead.</div>';
    return;
  }

  const selectedId=micSelect?.value||'';
  const audioConstraints={echoCancellation:true,noiseSuppression:true,autoGainControl:true};
  if(selectedId)audioConstraints.deviceId={exact:selectedId};

  try{
    voiceRecorderStream=await navigator.mediaDevices.getUserMedia({audio:audioConstraints});
  }catch(e){
    status.innerHTML='<div class="statusBox bad">Microphone access is blocked or the selected microphone is unavailable. Check browser permissions or choose a different microphone.</div>';
    return;
  }

  await populateMicrophones();
  const track=voiceRecorderStream.getAudioTracks()[0];
  const micName=track?.label||'selected microphone';
  const choices=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  const mimeType=choices.find(t=>{try{return MediaRecorder.isTypeSupported(t)}catch(_){return false}})||'';
  voiceChunks=[];

  try{
    voiceRecorder=mimeType?new MediaRecorder(voiceRecorderStream,{mimeType}):new MediaRecorder(voiceRecorderStream);
  }catch(e){
    voiceRecorderStream?.getTracks().forEach(t=>t.stop());
    voiceRecorderStream=null;
    status.innerHTML='<div class="statusBox bad">Voice recording could not start with '+esc(micName)+'. Choose another microphone or type your answer.</div>';
    return;
  }

  voiceRecorder.ondataavailable=e=>{if(e.data?.size)voiceChunks.push(e.data)};
  voiceRecorder.onstart=()=>{
    listening=true;
    button.disabled=false;
    button.textContent='■ Stop Voice Answer';
    status.innerHTML='<div class="listening"><span class="pulse"></span>Recording from <b>'+esc(micName)+'</b>… speak naturally, then click Stop Voice Answer.</div>';
  };
  voiceRecorder.onerror=()=>{
    listening=false;
    button.disabled=false;
    button.textContent='🎙 Start Voice Answer';
    status.innerHTML='<div class="statusBox bad">The selected microphone stopped recording. Choose another microphone or try again.</div>';
    voiceRecorderStream?.getTracks().forEach(t=>t.stop());
    voiceRecorderStream=null;
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
      status.innerHTML='<div class="statusBox good">Transcript ready from '+esc(micName)+'. Review or edit your answer, then submit when ready.</div>';
    }catch(e){
      console.warn('Voice transcription failed',e);
      status.innerHTML='<div class="statusBox bad">The audio was recorded, but transcription did not finish. Try again or type your answer.</div>';
    }
    button.disabled=false;
    button.textContent='🎙 Start Voice Answer';
  };

  try{voiceRecorder.start(250)}catch(e){
    voiceRecorderStream?.getTracks().forEach(t=>t.stop());
    voiceRecorderStream=null;
    voiceRecorder=null;
    status.innerHTML='<div class="statusBox bad">Voice recording could not start. Choose another microphone or refresh and try again.</div>';
  }
}
'''

s = s[:start] + fn + s[end:]
p.write_text(s, encoding='utf-8')
print('Mock interview voice recorder patched with microphone selection and server transcription.')
