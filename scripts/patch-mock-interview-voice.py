from pathlib import Path

p=Path('public/mock-interview.html')
s=p.read_text(encoding='utf-8')

decl="let stream=null,faceLandmarker=null,visionReady=false,cameraEnabled=false,calibration=null,raf=0,recognition=null,listening=false,answerStart=0;"
if decl in s:
    s=s.replace(decl,decl[:-1]+",voiceRecorder=null,voiceRecorderStream=null,voiceChunks=[];",1)

start=s.find('async function toggleRecognition(){')
end=s.find('\nasync function submitAnswer()',start)
if start<0 or end<0: raise SystemExit('Voice function markers not found')

fn="""async function transcribeVoiceBlob(blob,mimeType){
  if(!await ensureAuth())throw new Error('auth');
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token)throw new Error('auth');
  const ext=(mimeType||'').includes('mp4')?'m4a':(mimeType||'').includes('ogg')?'ogg':'webm';
  const form=new FormData();form.append('file',blob,'voice-answer.'+ext);
  const r=await fetch(SUPABASE_URL+'/functions/v1/interview-transcribe',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_KEY},body:form});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data?.text)throw new Error(data?.error||'transcription_failed');
  return String(data.text).trim();
}
async function toggleRecognition(){
  const status=$('listenStatus'),button=$('speak'),answer=$('answer');
  if(listening){button.disabled=true;button.textContent='Transcribing…';status.innerHTML='<div class=\"statusBox\">Turning your recorded answer into text…</div>';try{voiceRecorder?.stop()}catch(_){}return}
  try{questionAudio?.pause()}catch(_){}try{speechSynthesis.cancel()}catch(_){}
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){status.innerHTML='<div class=\"statusBox bad\">Voice recording is not available in this browser. Try Chrome or Edge, or type your answer instead.</div>';return}
  try{voiceRecorderStream=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){status.innerHTML='<div class=\"statusBox bad\">Microphone access is blocked or unavailable. Allow microphone access for this site, then try again.</div>';return}
  const choices=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  const mimeType=choices.find(t=>MediaRecorder.isTypeSupported(t))||'';voiceChunks=[];
  voiceRecorder=mimeType?new MediaRecorder(voiceRecorderStream,{mimeType}):new MediaRecorder(voiceRecorderStream);
  voiceRecorder.ondataavailable=e=>{if(e.data?.size)voiceChunks.push(e.data)};
  voiceRecorder.onstart=()=>{listening=true;button.disabled=false;button.textContent='■ Stop Voice Answer';status.innerHTML='<div class=\"listening\"><span class=\"pulse\"></span>Recording… speak naturally. Click Stop Voice Answer when finished.</div>'};
  voiceRecorder.onstop=async()=>{listening=false;const type=voiceRecorder?.mimeType||mimeType||'audio/webm';const blob=new Blob(voiceChunks,{type});voiceRecorderStream?.getTracks().forEach(t=>t.stop());voiceRecorderStream=null;voiceRecorder=null;voiceChunks=[];try{const t=await transcribeVoiceBlob(blob,type);answer.value=(answer.value.trim()+(answer.value.trim()?' ':'')+t).trim();status.innerHTML='<div class=\"statusBox good\">Transcript ready. Review or edit your answer, then submit when ready.</div>'}catch(e){console.warn(e);status.innerHTML='<div class=\"statusBox bad\">I recorded your answer, but transcription could not finish. Try again or type your answer.</div>'}button.disabled=false;button.textContent='🎙 Start Voice Answer'};
  try{voiceRecorder.start(250)}catch(e){voiceRecorderStream?.getTracks().forEach(t=>t.stop());voiceRecorderStream=null;voiceRecorder=null;status.innerHTML='<div class=\"statusBox bad\">Voice recording could not start. Refresh the page and try again.</div>'}
}
"""

s=s[:start]+fn+s[end:]
p.write_text(s,encoding='utf-8')
print('Mock interview now records voice answers and transcribes them server-side.')
