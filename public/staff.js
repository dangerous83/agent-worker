const people={manager:['Milo','Team manager'],instagram:['Luna','Instagram creative'],email:['Kai','Email writer'],reviewer:['Nova','Quality reviewer']};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createStaffInbox({api,toast}){
  let active=null,snapshot={threads:{},notices:[],reminders:[]},signature='',refreshing=false;
  const dialog=document.createElement('dialog');dialog.className='staff-dialog';
  dialog.innerHTML=`<div class="dialog-head"><div><p class="eyebrow" id="staff-role"></p><h2 id="staff-name"></h2></div><button class="icon-button" id="staff-close" aria-label="Close conversation">×</button></div><div id="staff-notices"></div><div id="staff-messages" class="staff-messages" role="log" aria-live="polite"></div><form id="staff-message-form"><label for="staff-text">Your message</label><textarea id="staff-text" required maxlength="4000" rows="3" placeholder="Ask your teammate anything about their work…"></textarea><div class="staff-compose-actions"><a href="/#connections">Model connection</a><button type="submit" class="button primary">Send message ↗</button></div><p id="staff-send-error" role="status"></p></form><details class="staff-reminder"><summary>Set a reminder from this teammate</summary><p class="muted">In-app reminders appear when this app is open, or when you return.</p><form id="staff-reminder-form"><label>Remind me about<input name="text" required maxlength="500"></label><label>When (your local time)<input name="at" type="datetime-local" required></label><button class="button secondary">Save reminder</button></form><div id="staff-upcoming"></div></details>`;
  document.body.append(dialog);
  const q=s=>dialog.querySelector(s);
  q('#staff-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{active=null;signature='';});
  dialog.querySelector('a').onclick=event=>{event.preventDefault();dialog.close();document.querySelector('nav [data-view=connections]').click();};
  function paint(){
    for(const [id,[name,role]] of Object.entries(people)){
      const count=snapshot.notices.filter(n=>n.worker===id).length+(snapshot.threads[id]||[]).filter(m=>m.unread).length;
      const button=document.querySelector(`[data-agent="${id}"]`);if(!button)continue;
      let badge=button.querySelector('.staff-notification');if(!badge){badge=document.createElement('b');badge.className='staff-notification';button.append(badge);}badge.textContent=count;badge.hidden=!count;
      button.setAttribute('aria-label',`Message ${name}, ${role}${count?`, ${count} unread notifications`:''}`);
    }
    if(!active||!dialog.open)return;
    const messages=snapshot.threads[active]||[];
    const next=JSON.stringify([messages,snapshot.notices,snapshot.reminders]);if(next===signature)return;signature=next;
    q('#staff-notices').innerHTML=snapshot.notices.filter(n=>n.worker===active).map(n=>`<p class="staff-notice">⌁ ${escape(n.text)}</p>`).join('');
    q('#staff-messages').innerHTML=messages.length?messages.map(m=>`<article class="staff-message ${m.role}"><strong>${m.role==='user'?'You':people[active][0]}</strong><p>${escape(m.status==='pending'?'Working on a reply…':m.status==='failed'?m.error:m.text)}</p>${m.status==='failed'?'<small>Reply unavailable. Check your model connection before trying again.</small>':''}</article>`).join(''):`<div class="empty"><h3>Talk with ${people[active][0]}</h3><p>Your conversation is saved here. Replies need a connected AI model.</p></div>`;
    q('#staff-messages').scrollTop=q('#staff-messages').scrollHeight;
    q('#staff-message-form button').disabled=messages.some(m=>m.status==='pending');
    q('#staff-upcoming').innerHTML=snapshot.reminders.filter(r=>r.worker===active).map(r=>`<p class="muted">${escape(r.text)} · ${escape(new Date(r.at).toLocaleString())}</p>`).join('');
  }
  async function refresh(){if(refreshing)return;refreshing=true;try{snapshot=await api('/api/staff');paint();if(active&&dialog.open)await api(`/api/staff/${active}/read`,'POST',{});}catch{}finally{refreshing=false;}}
  q('#staff-message-form').onsubmit=async event=>{event.preventDefault();const worker=active,button=event.target.querySelector('button');button.disabled=true;q('#staff-send-error').textContent='';try{await api(`/api/staff/${worker}/messages`,'POST',{text:q('#staff-text').value});q('#staff-text').value='';await refresh();}catch(e){q('#staff-send-error').textContent=e.message;}finally{button.disabled=(snapshot.threads[active]||[]).some(m=>m.status==='pending');}};
  q('#staff-reminder-form').onsubmit=async event=>{event.preventDefault();const form=event.target,button=form.querySelector('button');button.disabled=true;try{const input=Object.fromEntries(new FormData(form));await api('/api/staff/reminders','POST',{worker:active,text:input.text,at:new Date(input.at).toISOString()});form.reset();toast('Reminder saved for this teammate.');await refresh();}catch(e){toast(e.message);}finally{button.disabled=false;}};
  setInterval(()=>{if(!document.hidden)void refresh();},2500);
  return {refresh,isWorking:id=>(snapshot.threads[id]||[]).some(m=>m.status==='pending'),async open(person){active=person.id;signature='';q('#staff-name').textContent='Message '+person.name;q('#staff-role').textContent=person.role;q('#staff-text').value='';q('#staff-send-error').textContent='';dialog.showModal();await refresh();paint();q('#staff-text').focus();}};
}
