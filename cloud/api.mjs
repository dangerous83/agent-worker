import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {Client} from 'eve/client';
import {getVercelOidcToken} from '@vercel/oidc';
import {waitUntil} from '@vercel/functions';
import {createAgent,campaignSchema} from '../lib/agent.mjs';
import {cloudStore} from './store.mjs';
import {authorize,cloudVault,missingSettings} from './security.mjs';
import {cloudGmail} from './gmail.mjs';
import {handleLogin} from './login.mjs';
const workers={manager:'Milo',instagram:'Luna',email:'Kai',reviewer:'Nova'};
const workerSchema=z.enum(Object.keys(workers));
const brandSchema=z.object({name:z.string().max(120),audience:z.string().max(1000),voice:z.string().max(400),description:z.string().max(4000),color:z.string().regex(/^#[0-9a-f]{6}$/i)});
const edits=campaignSchema.partial().extend({status:z.enum(['draft','approved']).optional(),plannedAt:z.string().max(50).optional()});
const defaults={name:'',audience:'',voice:'Friendly and clear',description:'',color:'#bdff79'};
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'"};
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{...headers,...extra}});
const failure=(message,statusCode=409)=>Object.assign(new Error(message),{statusCode});
export function setupResponse(){return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agent Worker — finish cloud setup</title><link rel="stylesheet" href="/styles.css"><body><section class="panel cloud-setup"><p class="eyebrow">AGENT WORKER · VERCEL</p><h1>Finish your private workspace setup.</h1><p>The application is deployed. Your campaigns and conversations remain locked until cloud storage and owner access are configured.</p><p>In this Vercel project's settings, connect a Neon database and set <strong>APP_OWNER_PASSWORD</strong> (at least 12 characters) and <strong>CREDENTIAL_ENCRYPTION_KEY</strong> (64 hexadecimal characters). Then redeploy.</p><p>Your username defaults to <strong>owner</strong>. Keep all credentials in Vercel's private environment settings.</p><p>AI and Gmail connections are configured after owner sign-in. Instagram publishing is not connected.</p></section></body></html>`,{status:503,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});}

export function createCloudHandler({env=process.env,storeFactory=cloudStore,agentFactory,keepAlive=waitUntil,fetcher=fetch}={}){
 return async function handle(request){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/login'||path==='/api/logout')return handleLogin(request,{env,storeFactory});
  if(path==='/healthz')return json({ok:true,configured:missingSettings(env).length===0});
  const access=authorize(request,env);
  if(access==='setup')return path.startsWith('/api/')?json({error:'Finish cloud setup in Vercel.',missing:missingSettings(env)},503):setupResponse();
  if(access==='unauthorized')return json({error:'Owner sign-in required.'},401);
  if(access==='origin')return json({error:'Origin rejected.'},403);
  try{
   const store=storeFactory(),vault=cloudVault(store,env.CREDENTIAL_ENCRYPTION_KEY),gmail=cloudGmail(store,vault,fetcher);
   const brand=await store.get('setting','brand')||defaults;
   const agent=agentFactory?agentFactory():createAgent({client:new Client({host:url.origin,auth:{vercelOidc:{token:async()=>await getVercelOidcToken()}},redirect:'error'})});
   let body={};if(['POST','PUT','PATCH'].includes(request.method)){if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);const raw=await request.text();if(raw.length>64000)return json({error:'Request too large.'},413);try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}}
   const post=request.method==='POST';
   async function background(task){keepAlive(task.catch(()=>{}));}
   if(path==='/api/workspace'&&request.method==='GET'){
    const [campaigns,jobs,mail,model]=await Promise.all([store.list('campaign'),store.list('job'),gmail.status(),store.get('setting','model')]);
    // Surface interrupted invocations honestly, without repeating model work or external sends.
    for(const job of jobs)if(job.status==='running'&&Date.parse(job.createdAt)<Date.now()-300000){job.status='failed';job.error='This background run timed out. Please check the model connection and retry.';await store.patch('job',job.id,{status:job.status,error:job.error});}
    return json({brand,campaigns,jobs,connections:{ai:true,aiModel:model||{state:'unverified',message:'Check your Vercel model connection.'},runtime:{state:'online'},email:mail.connected,gmail:mail,instagram:false,instagramAccountType:'personal',hosting:{state:'hosted',origin:url.origin,message:'Hosted on Vercel with cloud database storage and owner sign-in.'}}});
   }
   if(path==='/api/brand'&&request.method==='PUT')return json(await store.put('setting','brand',brandSchema.parse(body)));
   if(path==='/api/campaigns'&&post)return json(await store.add('campaign',{...campaignSchema.parse(body),brand,source:'manual',status:'draft'}),201);
   if(path.startsWith('/api/campaigns/')&&request.method==='PATCH'){const id=z.string().uuid().parse(path.split('/').pop());const item=await store.patch('campaign',id,{...edits.parse(body),updatedAt:new Date().toISOString()});return item?json(item):json({error:'Campaign not found.'},404);}
   if(path==='/api/runtime/start'&&post)return json({state:'online',message:'Vercel manages this runtime.'});
   if(path==='/api/connections/ai/check'&&post){const result=await agent.verify();await store.put('setting','model',result);return json(result,result.state==='ready'?200:409);}
   if(path==='/api/generate'&&post){
    const {brief}=z.object({brief:z.string().trim().min(10).max(4000)}).parse(body);
    const lease=await store.lock('campaign-generation',300);if(!lease)throw failure('Your staff is already working on a campaign.');
    let job;try{job=await store.add('job',{brief,status:'running'});}catch(error){await store.unlock('campaign-generation',lease);throw error;}
    const task=(async()=>{let progress=Promise.resolve(),agents={};try{
      const data=await agent.generate(brief,brand,event=>{agents={...agents,[event.worker]:event.state};const next={...agents};progress=progress.then(()=>store.patch('job',job.id,{agents:next,activity:[{...event,at:new Date().toISOString()}]}));});
      await progress;const campaign=await store.add('campaign',{...data,brief,brand,source:'ai',status:'draft'});await store.patch('job',job.id,{status:'completed',campaignId:campaign.id});await store.put('setting','model',agent.status());
     }catch(error){await progress.catch(()=>{});await store.patch('job',job.id,{status:'failed',error:error.publicMessage||'The model could not finish. Check Connections.'});await store.put('setting','model',agent.status());}finally{await store.unlock('campaign-generation',lease);}})();
    await background(task);return json(job,202);
   }
   if(path==='/api/connections/gmail/config'&&request.method==='PUT'){await gmail.configure(body);return json(await gmail.status());}
   if(path==='/api/connections/gmail/disconnect'&&post){await gmail.disconnect();return json({connected:false});}
   if(path==='/api/connections/gmail/start'&&post){const result=await gmail.start(url.origin);return json({url:result.url},200,{'Set-Cookie':`gmail_oauth_state=${result.state}; HttpOnly; Secure; SameSite=Lax; Path=/auth/gmail/callback; Max-Age=600`});}
   if(path==='/auth/gmail/callback'&&request.method==='GET'){
    const cookieState=request.headers.get('cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith('gmail_oauth_state='))?.split('=')[1];let result='failed';
    try{if(url.searchParams.has('error'))throw Error('Declined');await gmail.complete({state:url.searchParams.get('state'),code:url.searchParams.get('code'),cookieState});result='connected';}catch{}
    return new Response(null,{status:303,headers:{...headers,Location:`/?gmail=${result}#connections`,'Set-Cookie':'gmail_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/auth/gmail/callback; Max-Age=0'}});
   }
   if(path==='/api/email/send'&&post)return json(await gmail.send(body));
   if(path==='/api/staff'&&request.method==='GET'){
    const [messages,reminders,notices,seen,mail,campaigns,jobs]=await Promise.all([store.list('message'),store.list('reminder'),store.list('notice'),store.list('notice-read'),gmail.status(),store.list('campaign'),store.list('job')]);
    const add=(id,worker,text)=>{if(!notices.some(n=>n.id===id))notices.push({id,worker,text,createdAt:new Date().toISOString()});};
    if((await store.get('setting','model'))?.state!=='ready')add('setup:model','manager','Check your model connection so I can reply.');
    if(!brand.description)add('setup:brand','instagram','Add your business details in Brand memory.');
    if(!mail.connected)add('setup:gmail','email','Connect Gmail before sending campaign emails.');
    for(const c of campaigns.filter(c=>c.status==='draft'))add('review:'+c.id,'reviewer','Your campaign “'+c.title+'” is waiting for review.');
    for(const j of jobs.filter(j=>j.status==='completed'))add('job:'+j.id,'manager','Your campaign is ready in Campaign studio.');
    for(const r of reminders)if(Date.parse(r.at)<=Date.now())add(r.id,r.worker,r.text);
    const threads={};for(const m of messages.reverse()){
      if(m.status==='pending'&&Date.parse(m.createdAt)<Date.now()-300000){m.status='failed';m.error='The reply timed out. Check your model connection and try again.';await store.patch('message',m.id,{status:m.status,error:m.error});}
      (threads[m.worker]||=[]).push(m);
    }
    return json({threads,reminders:reminders.filter(r=>Date.parse(r.at)>Date.now()),notices:notices.filter(n=>!seen.some(s=>s.id===n.id))});
   }
   if(path==='/api/staff/reminders'&&post){const input=z.object({worker:workerSchema,text:z.string().trim().min(1).max(500),at:z.string().datetime()}).parse(body);if(Date.parse(input.at)<=Date.now())throw failure('Choose a future reminder time.',400);return json(await store.add('reminder',input),201);}
   const staffRoute=path.match(/^\/api\/staff\/(manager|instagram|email|reviewer)\/(read|messages)$/);
   if(staffRoute&&post){const worker=staffRoute[1];if(staffRoute[2]==='read'){
     const list=await store.list('message');for(const m of list.filter(m=>m.worker===worker&&m.unread))await store.patch('message',m.id,{unread:false});
     // The client acknowledges exactly the notices it has displayed, including computed setup notices.
     const input=z.object({noticeIds:z.array(z.string().max(150)).max(100).optional()}).parse(body);for(const id of input.noticeIds||[])await store.put('notice-read',id,{id,worker});return json({ok:true});
    }
    const {text}=z.object({text:z.string().trim().min(1).max(4000)}).parse(body);if((await store.get('setting','model'))?.state==='error')throw failure('Check your model connection in Connections.');
    const lease=await store.lock('chat:'+worker,150);if(!lease)throw failure('This teammate is still replying.');
    let reply;try{await store.add('message',{worker,role:'user',text});reply=await store.add('message',{worker,role:'assistant',text:'',status:'pending'});}catch(error){await store.unlock('chat:'+worker,lease);throw error;}
    await background((async()=>{try{const history=(await store.list('message')).filter(m=>m.worker===worker&&m.text).reverse().slice(-24);const text=await agent.chat(worker,history,brand);await store.patch('message',reply.id,{text,status:'completed',unread:true});await store.put('setting','model',agent.status());}catch(error){await store.patch('message',reply.id,{status:'failed',error:error.publicMessage||'Could not get a reply. Check Connections.',unread:true});await store.put('setting','model',agent.status());}finally{await store.unlock('chat:'+worker,lease);}})());return json(reply,202);
   }
   return json({error:'Not found.'},404);
  }catch(error){if(error instanceof z.ZodError)return json({error:'Please check the form fields.'},400);if(error.statusCode)return json({error:error.message},error.statusCode);console.error('Cloud request failed:',error.name);return json({error:'The cloud service could not complete the request. Check the database connection and deployment logs.'},503);}
 };
}
export const handleCloud=createCloudHandler();
