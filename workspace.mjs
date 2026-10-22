import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { createStore } from './lib/store.mjs';
import { createAgent, campaignSchema } from './lib/agent.mjs';
import { z } from 'zod';
import { createRuntime } from './lib/runtime.mjs';
import { createVault } from './lib/vault.mjs';
import { createGmail } from './lib/gmail.mjs';
import { deploymentConfig, validOwner, persistWorkflows } from './lib/deployment.mjs';
import { createStaff } from './lib/staff.mjs';

const brandSchema = z.object({name:z.string().max(120),audience:z.string().max(1000),voice:z.string().max(400),description:z.string().max(4000),color:z.string().regex(/^#[0-9a-f]{6}$/i)});
const editsSchema = campaignSchema.partial().extend({ status: z.enum(['draft','approved']), plannedAt: z.string().max(50).optional() }).partial();

export function createApp({store=createStore(),agent=createAgent(),runtime=null,gmail=null,config=deploymentConfig()}={}) {
  // A restart cannot safely redeliver an interrupted campaign without risking duplicate model charges.
  for (const job of store.jobs().filter(j=>j.status==='running')) store.updateJob(job.id,{status:'failed',error:'The app restarted before the campaign finished. Please try again.'});
  let running = false;
  const staff=createStaff({store,agent});
  const send = (res,status,data) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data)); };
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'");
    res.setHeader('Cache-Control','no-store');
    try {
      const host=req.headers.host || '';
      if(req.method==='GET'&&req.url==='/healthz')return send(res,200,{ok:true});
      if(config.production){
        if(host!==new URL(config.origin).host)return send(res,403,{error:'Host rejected.'});
        if(!validOwner(req.headers.authorization,config)){res.setHeader('WWW-Authenticate','Basic realm="Agent Worker", charset="UTF-8"');return send(res,401,{error:'Owner sign-in required.'});}
        res.setHeader('Strict-Transport-Security','max-age=31536000');
      }else if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))return send(res,403,{error:'Local workspace only.'});
      const origin=config.origin||`http://${host}`;
      if(req.headers.origin&&req.headers.origin!==origin)return send(res,403,{error:'Origin rejected.'});
      const url=new URL(req.url,'http://localhost');
      let body={};
      if(['POST','PATCH','PUT'].includes(req.method)){
        if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>64000)return send(res,413,{error:'Request too large.'});}
        try{body=JSON.parse(raw);}catch{return send(res,400,{error:'Invalid JSON.'});}
      }
      if(req.method==='GET'&&url.pathname==='/api/workspace'){
        const online=await agent.health();
        return send(res,200,{brand:store.brand(),campaigns:store.campaigns(),jobs:store.jobs(),connections:{ai:online,aiModel:agent.status?.()||{state:'unverified'},runtime:runtime?await runtime.status():{state:online?'online':'offline'},instagram:false,instagramAccountType:'personal',email:gmail?.status().connected||false,gmail:gmail?.status()||{configured:false,connected:false},hosting:{state:config.production?'hosted':'local',origin:config.origin,message:config.production?'Running on the backend host with owner sign-in and persistent storage.':'This app is currently running on your computer. Public hosting is not configured.'}}});
      }
      if(req.method==='GET'&&url.pathname==='/api/staff')return send(res,200,staff.snapshot());
      if(req.method==='POST'&&url.pathname==='/api/staff/reminders')return send(res,201,staff.reminder(body));
      const staffRoute=url.pathname.match(/^\/api\/staff\/(manager|instagram|email|reviewer)\/(messages|read)$/);
      if(req.method==='POST'&&staffRoute){
        if(staffRoute[2]==='read'){staff.acknowledge(staffRoute[1]);return send(res,200,{ok:true});}
        return send(res,202,await staff.message(staffRoute[1],body));
      }
      if(req.method==='POST'&&url.pathname==='/api/runtime/start'){
        if(!runtime)return send(res,409,{error:'Start the app with npm start to manage the AI service.'});
        return send(res,202,await runtime.start());
      }
      if(req.method==='POST'&&url.pathname==='/api/connections/ai/check'){
        if(!await agent.health())return send(res,503,{error:'Start the AI service first, then check the model connection.'});
        if(!agent.verify)return send(res,409,{error:'Model check unavailable.'});
        const result=await agent.verify();return send(res,result.state==='ready'?200:409,result);
      }
      if(req.method==='PUT'&&url.pathname==='/api/connections/gmail/config'){
        if(!gmail)return send(res,503,{error:'Gmail integration unavailable.'});
        gmail.configure(body);return send(res,200,gmail.status());
      }
      if(req.method==='POST'&&url.pathname==='/api/connections/gmail/disconnect'){
        gmail?.disconnect();return send(res,200,{connected:false});
      }
      if(req.method==='POST'&&url.pathname==='/api/connections/gmail/start'){
        if(!gmail)return send(res,503,{error:'Gmail integration unavailable.'});
        const result=gmail.start(origin);
        res.setHeader('Set-Cookie',`gmail_oauth_state=${result.state}; HttpOnly; SameSite=Lax; Path=/auth/gmail/callback; Max-Age=600${config.production?'; Secure':''}`);
        return send(res,200,{url:result.url});
      }
      if(req.method==='GET'&&url.pathname==='/auth/gmail/callback'){
        if(!gmail)return send(res,503,{error:'Gmail integration unavailable.'});
        const cookieState=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('gmail_oauth_state='))?.split('=')[1];
        res.setHeader('Set-Cookie',`gmail_oauth_state=; HttpOnly; SameSite=Lax; Path=/auth/gmail/callback; Max-Age=0${config.production?'; Secure':''}`);
        try{
          if(url.searchParams.has('error'))throw new Error('Authorization declined.');
          await gmail.complete({state:url.searchParams.get('state'),cookieState,code:url.searchParams.get('code')});
          res.writeHead(303,{Location:'/?gmail=connected#connections'});res.end();
        }catch{res.writeHead(303,{Location:'/?gmail=failed#connections'});res.end();}
        return;
      }
      if(req.method==='POST'&&url.pathname==='/api/email/send'){
        if(!gmail)return send(res,503,{error:'Gmail integration unavailable.'});
        return send(res,200,await gmail.send(body));
      }
      if(req.method==='PUT'&&url.pathname==='/api/brand')return send(res,200,store.saveBrand(brandSchema.parse(body)));
      if(req.method==='POST'&&url.pathname==='/api/campaigns'){
        const data=campaignSchema.parse(body);return send(res,201,store.addCampaign({...data,source:'manual',brand:store.brand()}));
      }
      if(req.method==='PATCH'&&url.pathname.startsWith('/api/campaigns/')){
        const result=store.updateCampaign(url.pathname.split('/').pop(),editsSchema.parse(body));
        return send(res,result?200:404,result||{error:'Campaign not found.'});
      }
      if(req.method==='POST'&&url.pathname==='/api/generate'){
        const {brief}=z.object({brief:z.string().trim().min(10).max(4000)}).parse(body);
        if(running)return send(res,409,{error:'Your staff is already working on a brief. Wait for it to finish.'});
        if(!await agent.health())return send(res,503,{error:'The AI service is offline. Open Connections and click Start AI service. Then sign in to your model and check the connection.'});
        const job=store.addJob(brief), brand=store.brand();running=true;
        send(res,202,job);
        const onProgress=progress=>{
          const current=store.jobs().find(item=>item.id===job.id);
          store.updateJob(job.id,{agents:{...current.agents,[progress.worker]:progress.state},activity:[...(current.activity||[]),{...progress,at:new Date().toISOString()}].slice(-20)});
        };
        void agent.generate(brief,brand,onProgress).then(data=>{
          const campaign=store.addCampaign({...data,brief,brand,source:'ai'});
          store.updateJob(job.id,{status:'completed',campaignId:campaign.id});
        }).catch(error=>store.updateJob(job.id,{status:'failed',error:error.publicMessage||'The model could not finish this campaign. Check the model connection in Connections.'})).finally(()=>{running=false;});
        return;
      }
      if(url.pathname.startsWith('/api/'))return send(res,404,{error:'Not found.'});
      if(req.method!=='GET')return send(res,405,{error:'Method not allowed.'});
      const paths={'/':'index.html','/app.js':'app.js','/office.js':'office.js','/staff.js':'staff.js','/connections.js':'connections.js','/styles.css':'styles.css','/office.css':'office.css'};
      const name=paths[url.pathname];if(!name)return send(res,404,{error:'Not found.'});
      const content=await readFile(new URL(`./public/${name}`,import.meta.url));
      res.writeHead(200,{'Content-Type':({'html':'text/html','js':'text/javascript','css':'text/css'})[extname(name).slice(1)]+'; charset=utf-8'});res.end(content);
    }catch(error){if(error instanceof z.ZodError)return send(res,400,{error:'Please check the form fields.',details:error.issues.map(x=>x.path.join('.')+': '+x.message)});if(error.statusCode)return send(res,error.statusCode,{error:error.message});console.error('Request failed:',error.name);send(res,500,{error:'Could not complete the request.'});}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const config=deploymentConfig();if(config.production)persistWorkflows(config.dataDir);
  const port=Number(process.env.PORT||3100),store=createStore();
  for(const campaign of store.campaigns())if(campaign.title==='Example campaign — editable sample'&&campaign.caption==='Share your next idea with us.'&&campaign.source==='manual')store.archiveCampaign(campaign.id);
  const runtime=createRuntime(),gmail=createGmail({store,vault:createVault(store)});
  const server=createApp({store,runtime,gmail,config});
  server.listen(port,config.production?'0.0.0.0':'127.0.0.1',()=>{console.log(`Agent Worker: ${config.origin||`http://127.0.0.1:${port}`}`);if(process.env.AUTO_START_AGENT!=='0')void runtime.start().catch(()=>console.log('AI startup needs attention. Open Connections.'));});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{runtime.stop();server.close(()=>{store.close();process.exit(0);});});
}
