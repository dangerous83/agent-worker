import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const teammates = {manager:'Milo, team manager',instagram:'Luna, Instagram creative',email:'Kai, email writer',reviewer:'Nova, quality reviewer'};
export function createStaff({store,agent}) {
  const read = () => store.getSetting('staff-inbox') || {threads:{},reminders:[],notices:[],seen:[]};
  const save = data => store.setSetting('staff-inbox',data);
  const addNotice = (data,id,worker,text) => {if(!data.seen.includes(id)&&!data.notices.some(n=>n.id===id))data.notices.push({id,worker,text,createdAt:new Date().toISOString()});};
  const initial=read();
  for(const messages of Object.values(initial.threads))for(const m of messages)if(m.status==='pending'){m.status='failed';m.error='The app restarted. Please send your message again.';}
  save(initial);
  return {
    snapshot(){
      const data=read();
      if(agent.status?.().state!=='ready')addNotice(data,'setup:model','manager','Connect your model in Connections so your team can reply.');
      if(!store.brand().description)addNotice(data,'setup:brand','instagram','Add your business details in Brand memory so I can write accurate captions.');
      if(!store.getSetting('secret:gmail-token'))addNotice(data,'setup:gmail','email','Connect Gmail in Connections before sending campaign emails.');
      for(const c of store.campaigns().filter(c=>c.status==='draft'))addNotice(data,'review:'+c.id,'reviewer','Your campaign “'+c.title+'” is waiting for your review.');
      for(const r of data.reminders)if(!r.delivered&&Date.parse(r.at)<=Date.now()){addNotice(data,r.id,r.worker,r.text);r.delivered=true;}
      for(const job of store.jobs().filter(j=>j.status==='completed'))addNotice(data,'job:'+job.id,'manager','Your campaign is ready in Campaign studio.');
      save(data);return {threads:data.threads,notices:data.notices,reminders:data.reminders.filter(r=>!r.delivered)};
    },
    acknowledge(worker){const data=read();const notices=data.notices.filter(n=>n.worker===worker);data.seen.push(...notices.map(n=>n.id));data.notices=data.notices.filter(n=>n.worker!==worker);for(const m of data.threads[worker]||[])m.unread=false;save(data);},
    reminder(input){const r=z.object({worker:z.enum(Object.keys(teammates)),text:z.string().trim().min(1).max(500),at:z.string().datetime()}).parse(input);if(Date.parse(r.at)<=Date.now())throw Object.assign(new Error('Choose a future reminder time.'),{statusCode:400});const data=read();const item={...r,id:randomUUID(),delivered:false};data.reminders.push(item);save(data);return item;},
    async message(worker,input){
      z.enum(Object.keys(teammates)).parse(worker);
      const {text}=z.object({text:z.string().trim().min(1).max(4000)}).parse(input);
      if(!agent.chat||!await agent.health()||agent.status?.().state==='error')throw Object.assign(new Error('Connect your AI model in Connections before messaging your team.'),{statusCode:409});
      const data=read(),thread=data.threads[worker]||=[];
      if(thread.some(m=>m.status==='pending'))throw Object.assign(new Error('This teammate is still replying.'),{statusCode:409});
      if(thread.length>=200)throw Object.assign(new Error('This conversation has reached its limit.'),{statusCode:409});
      thread.push({id:randomUUID(),role:'user',text,createdAt:new Date().toISOString()});
      const reply={id:randomUUID(),role:'assistant',text:'',status:'pending',createdAt:new Date().toISOString()};thread.push(reply);save(data);
      void agent.chat(worker,thread.filter(m=>m.text).slice(-24),store.brand()).then(text=>{
        const latest=read(),message=latest.threads[worker].find(m=>m.id===reply.id);Object.assign(message,{text,status:'completed',unread:true});save(latest);
      }).catch(error=>{const latest=read(),message=latest.threads[worker].find(m=>m.id===reply.id);Object.assign(message,{status:'failed',error:error.publicMessage||'Could not get a reply. Check your model connection and try again.'});addNotice(latest,'failed:'+reply.id,worker,message.error);save(latest);});
      return reply;
    },
  };
}
