export function createStaffVoice({dialog,textbox}){
 const synth=window.speechSynthesis,Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 const panel=document.createElement('div');panel.className='staff-voice';
 panel.innerHTML='<label><input type="checkbox" id="staff-voice-on"> Read new replies aloud</label><div class="setup-actions"><button type="button" class="button secondary" id="staff-mic">🎙 Speak</button><button type="button" class="button secondary" id="staff-read">▶ Read reply</button><button type="button" class="button secondary" id="staff-voice-stop">■ Stop voice</button></div><p class="muted" id="staff-voice-status" role="status"></p>';
 dialog.querySelector('#staff-messages').before(panel);
 const q=s=>panel.querySelector(s),status=message=>{q('#staff-voice-status').textContent=message;};
 let worker=null,seen=new Set(),latest='',recognition=null,listening=false,generation=0;
 const names={manager:'Milo',instagram:'Luna',email:'Kai',reviewer:'Nova'};
 function stop(){generation++;synth?.cancel();recognition?.abort();recognition=null;listening=false;q('#staff-mic').textContent='🎙 Speak';dialog.classList.remove('is-speaking');}
 function say(text){
  if(!synth||!window.SpeechSynthesisUtterance){status('Read-aloud is unavailable in this browser.');return;}
  stop();const current=generation,utterance=new SpeechSynthesisUtterance(text);
  utterance.lang=navigator.language||'en-US';utterance.rate=1;utterance.pitch={manager:1,instagram:1.15,email:0.9,reviewer:1.05}[worker]||1;
  const voices=synth.getVoices().filter(v=>v.lang.startsWith(utterance.lang.split('-')[0]));
  if(voices.length)utterance.voice=voices[Object.keys(names).indexOf(worker)%voices.length];
  utterance.onstart=()=>{if(current!==generation)return;dialog.classList.add('is-speaking');status(names[worker]+' is speaking…');};
  utterance.onend=()=>{if(current!==generation)return;dialog.classList.remove('is-speaking');status('Ready to talk.');};
  utterance.onerror=()=>{if(current!==generation)return;dialog.classList.remove('is-speaking');status('Audio could not play. Try Read reply or check your device sound.');};
  synth.speak(utterance);
 }
 q('#staff-voice-on').disabled=!synth;
 q('#staff-voice-on').onchange=()=>{if(!q('#staff-voice-on').checked)stop();status(q('#staff-voice-on').checked?'New replies will be read aloud while this conversation is open.':'Read-aloud is off.');};
 q('#staff-read').onclick=()=>latest?say(latest):status('Send a message first to get a reply.');
 q('#staff-voice-stop').onclick=()=>{stop();status('Voice stopped.');};
 q('#staff-mic').disabled=!Recognition;
 status(Recognition?'Speak fills your message. Review it, then press Send. Your browser may process audio through its speech service.':'Microphone dictation is unavailable in this browser. You can type and use Read reply.');
 q('#staff-mic').onclick=()=>{
  if(listening){recognition?.stop();return;}
  stop();const current=generation,base=textbox.value;recognition=new Recognition();recognition.lang=navigator.language||'en-US';recognition.continuous=false;recognition.interimResults=true;
  recognition.onstart=()=>{if(current!==generation)return;listening=true;q('#staff-mic').textContent='■ Finish speaking';status('Listening…');};
  recognition.onresult=event=>{if(current!==generation)return;const transcript=Array.from(event.results).map(r=>r[0].transcript).join(' ');textbox.value=(base+(base?' ':'')+transcript).slice(0,4000);};
  recognition.onerror=event=>{if(current!==generation)return;status(event.error==='not-allowed'?'Microphone permission was denied. Enable it in your browser, or type your message.':'Could not hear speech. Try again or type your message.');};
  recognition.onend=()=>{if(current!==generation)return;listening=false;q('#staff-mic').textContent='🎙 Speak';if(textbox.value!==base)status('Review your message, then press Send.');};
  try{recognition.start();}catch{status('Microphone could not start. Try typing your message.');}
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 return {stop,open(id){stop();worker=id;seen=null;latest='';},observe(messages){const complete=messages.filter(m=>m.role==='assistant'&&m.status!=='pending'&&m.status!=='failed'&&m.text);latest=complete.at(-1)?.text||'';q('#staff-read').disabled=!latest||!synth;if(seen===null){seen=new Set(complete.map(m=>m.id));return;}const fresh=complete.filter(m=>!seen.has(m.id));complete.forEach(m=>seen.add(m.id));if(fresh.length&&q('#staff-voice-on').checked&&dialog.open&&!document.hidden)say(fresh.at(-1).text);}};
}
