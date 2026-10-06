from pathlib import Path

path = Path('public/mock-interview.html')
text = path.read_text(encoding='utf-8')
old = '''function toggleRecognition(){if(listening){try{recognition?.stop()}catch(_){}return}const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$('listenStatus').innerHTML='<div class="statusBox bad">Voice recognition is not available in this browser. Type your answer instead.</div>';return}recognition=new SR();recognition.lang='en-US';recognition.continuous=true;recognition.interimResults=true;let finalText=$('answer').value.trim();recognition.onstart=()=>{listening=true;$('speak').textContent='■ Stop Voice Answer';$('listenStatus').innerHTML='<div class="listening"><span class="pulse"></span>Listening… you can edit the transcript before submitting.</div>'};recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)finalText+=(finalText?' ':'')+t.trim();else interim+=t}$('answer').value=(finalText+(interim?' '+interim:'')).trim()};recognition.onerror=e=>{$('listenStatus').innerHTML='<div class="statusBox bad">Voice recognition stopped. You can keep typing your answer.</div>'};recognition.onend=()=>{listening=false;$('speak').textContent='🎙 Start Voice Answer';$('answer').value=finalText||$('answer').value};try{recognition.start()}catch(_){}}
'''
new = '''async function toggleRecognition(){
  if(listening){try{recognition?.stop()}catch(_){}return}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const status=$('listenStatus'),button=$('speak'),answer=$('answer');
  if(!SR){status.innerHTML='<div class="statusBox bad">Voice recognition is not available in this browser. Try Chrome or Edge, or type your answer instead.</div>';return}

  try{questionAudio?.pause()}catch(_){}
  try{speechSynthesis.cancel()}catch(_){}

  if(navigator.mediaDevices?.getUserMedia){
    try{
      const mic=await navigator.mediaDevices.getUserMedia({audio:true});
      mic.getTracks().forEach(track=>track.stop());
    }catch(e){
      const blocked=e?.name==='NotAllowedError'||e?.name==='SecurityError';
      status.innerHTML='<div class="statusBox bad">'+(blocked?'Microphone access is blocked. Allow microphone access for this site in your browser, then click Start Voice Answer again.':'I could not access a microphone on this device. Check your microphone and browser permissions, or type your answer instead.')+'</div>';
      return;
    }
  }

  recognition=new SR();
  recognition.lang='en-US';
  recognition.continuous=true;
  recognition.interimResults=true;
  recognition.maxAlternatives=1;
  let finalText=answer.value.trim();

  recognition.onstart=()=>{
    listening=true;
    button.textContent='■ Stop Voice Answer';
    status.innerHTML='<div class="listening"><span class="pulse"></span>Microphone connected — speak your answer. You can edit the transcript before submitting.</div>';
  };
  recognition.onaudiostart=()=>{
    status.innerHTML='<div class="listening"><span class="pulse"></span>Listening… speak naturally and your words will appear below.</div>';
  };
  recognition.onresult=e=>{
    let interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const t=e.results[i][0].transcript;
      if(e.results[i].isFinal)finalText+=(finalText?' ':'')+t.trim();
      else interim+=t;
    }
    answer.value=(finalText+(interim?' '+interim:'')).trim();
  };
  recognition.onerror=e=>{
    const messages={
      'not-allowed':'Microphone permission is blocked. Allow microphone access for this site, then try again.',
      'service-not-allowed':'Voice recognition is blocked by this browser or device policy. Try Chrome or Edge, or type your answer.',
      'audio-capture':'No working microphone was detected. Check your microphone and browser permissions.',
      'network':'The browser voice-recognition service could not be reached. Check your internet connection and try again.',
      'no-speech':'I did not hear any speech. Click Start Voice Answer and try again.'
    };
    status.innerHTML='<div class="statusBox bad">'+(messages[e.error]||('Voice recognition stopped ('+String(e.error||'unknown error')+'). You can try again or type your answer.'))+'</div>';
  };
  recognition.onend=()=>{
    listening=false;
    button.textContent='🎙 Start Voice Answer';
    answer.value=finalText||answer.value;
  };
  try{
    recognition.start();
  }catch(e){
    listening=false;
    button.textContent='🎙 Start Voice Answer';
    status.innerHTML='<div class="statusBox bad">Voice recognition could not start. Refresh the page and try again, or type your answer.</div>';
  }
}
'''
if old in text:
    text = text.replace(old, new, 1)
elif 'Microphone connected — speak your answer' in text:
    print('Voice-recognition patch already present.')
    raise SystemExit(0)
else:
    raise SystemExit('Mock interview voice-recognition signature changed; patch not applied')
path.write_text(text, encoding='utf-8')
print('Hardened mock interview voice recognition.')
