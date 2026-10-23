export function createStaffVoice({dialog,textbox}){
 const synth=window.speechSynthesis,Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 const panel=document.createElement('div');panel.className='staff-voice';
 panel.innerHTML='<label><input type="checkbox" id="staff-voice-on"> Read new replies aloud</label><label>Free voice <select id="staff-voice-choice" aria-label="Free voice"></select></label><div class="setup-actions"><button type="button" class="button secondary" id="staff-mic">🎙 Speak</button><button type="button" class="button secondary" id="staff-read">▶ Read reply</button><button type="button" class="button secondary" id="staff-voice-stop">■ Stop voice</button></div><p class="muted" id="staff-voice-status" role="status"></p>';
 dialog.querySelector('#staff-messages').before(panel);
 const q=s=>panel.querySelector(s),status=message=>{q('#staff-voice-status').textContent=message;};
 let worker=null,seen=new Set(),latest=null,recognition=null,listening=false,generation=0;
 const names={manager:'Milo',instagram:'Luna',email:'Kai',reviewer:'Nova'};
 let voices=[],saved='';try{saved=localStorage.getItem('staff-free-voice')||'';}catch{}
 function loadVoices(){
  voices=(synth?.getVoices()||[]).filter(v=>/^en[-_]/i.test(v.lang));
  const score=v=>(/natural|neural|online|premium|enhanced/i.test(v.name)?100:0)+(/Google|Microsoft/i.test(v.name)?20:0)+(v.default?5:0);
  voices.sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name));
  const select=q('#staff-voice-choice');select.replaceChildren();
  for(const voice of voices){const option=document.createElement('option');option.value=voice.voiceURI;option.textContent=voice.name+' ('+voice.lang+')';select.append(option);}
  if(!voices.length){const option=document.createElement('option');option.value='';option.textContent='Device default';select.append(option);}
  if(voices.some(v=>v.voiceURI===saved))select.value=saved;
 }
 loadVoices();synth?.addEventListener('voiceschanged',loadVoices);
 q('#staff-voice-choice').onchange=()=>{saved=q('#staff-voice-choice').value;try{localStorage.setItem('staff-free-voice',saved);}catch{}stop();status('Free voice selected. Click Read reply to listen.');};
 function stop(){generation++;synth?.cancel();recognition?.abort();recognition=null;listening=false;q('#staff-mic').textContent='🎙 Speak';dialog.classList.remove('is-speaking');}
 function say(message){
  stop();if(!synth){status('Read-aloud is unavailable in this browser.');return;}
  const current=generation,utterance=new SpeechSynthesisUtterance(message.text.replace(/[*#]/g,''));
  const voice=voices.find(v=>v.voiceURI===q('#staff-voice-choice').value);if(voice){utterance.voice=voice;utterance.lang=voice.lang;}else utterance.lang='en-US';
  utterance.rate=0.96;utterance.pitch=1;utterance.volume=1;
  utterance.onstart=()=>{if(current!==generation)return;dialog.classList.add('is-speaking');status(names[worker]+' is speaking with your free device voice…');};
  utterance.onend=()=>{if(current!==generation)return;dialog.classList.remove('is-speaking');status('Ready to talk. Voice is free; quality depends on your device.');};
  utterance.onerror=event=>{if(current!==generation)return;dialog.classList.remove('is-speaking');status(event.error==='not-allowed'?'Click Read reply to allow playback.':'This voice could not play. Choose another free voice and retry.');};
  synth.speak(utterance);
 }
 q('#staff-voice-on').onchange=()=>{if(!q('#staff-voice-on').checked)stop();status(q('#staff-voice-on').checked?'New replies will be read aloud while this conversation is open.':'Read-aloud is off.');};
 q('#staff-read').onclick=()=>latest?say(latest):status('Send a message first to get a reply.');
 q('#staff-voice-stop').onclick=()=>{stop();status('Voice stopped.');};
 q('#staff-mic').disabled=!Recognition;
 q('#staff-voice-on').disabled=!synth;status('Free device voices. Choose a voice, then click Read reply. Voice quality varies by browser and device.');
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
 return {stop,open(id){stop();worker=id;seen=null;latest=null;},observe(messages){const complete=messages.filter(m=>m.role==='assistant'&&m.status!=='pending'&&m.status!=='failed'&&m.text);latest=complete.at(-1)||null;q('#staff-read').disabled=!latest||!synth;if(seen===null){seen=new Set(complete.map(m=>m.id));return;}const fresh=complete.filter(m=>!seen.has(m.id));complete.forEach(m=>seen.add(m.id));if(fresh.length&&q('#staff-voice-on').checked&&dialog.open&&!document.hidden)say(fresh.at(-1));}};
}
