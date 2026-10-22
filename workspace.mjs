import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { createStore } from './lib/store.mjs';
import { createAgent, campaignSchema } from './lib/agent.mjs';
import { z } from 'zod';

const brandSchema = z.object({name:z.string().max(120),audience:z.string().max(1000),voice:z.string().max(400),description:z.string().max(4000),color:z.string().regex(/^#[0-9a-f]{6}$/i)});
const editsSchema = campaignSchema.partial().extend({ status: z.enum(['draft','approved']), plannedAt: z.string().max(50).optional() }).partial();

export function createApp({store=createStore(),agent=createAgent()}={}) {
  // A restart cannot safely redeliver an interrupted campaign without risking duplicate model charges.
  for (const job of store.jobs().filter(j=>j.status==='running')) store.updateJob(job.id,{status:'failed',error:'The app restarted before the campaign finished. Please try again.'});
  let running = false;
  const send = (res,status,data) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data)); };
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'");
    res.setHeader('Cache-Control','no-store');
    try {
      const host=req.headers.host || '';
      if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))return send(res,403,{error:'Local workspace only.'});
      if(req.headers.origin && ![`http://${host}`,`https://${host}`].includes(req.headers.origin))return send(res,403,{error:'Origin rejected.'});
      const url=new URL(req.url,'http://localhost');
      let body={};
      if(['POST','PATCH','PUT'].includes(req.method)){
        if(!req.headers['content-type']?.startsWith('application/json'))return send(res,415,{error:'JSON required.'});
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>64000)return send(res,413,{error:'Request too large.'});}
        try{body=JSON.parse(raw);}catch{return send(res,400,{error:'Invalid JSON.'});}
      }
      if(req.method==='GET'&&url.pathname==='/api/workspace')return send(res,200,{brand:store.brand(),campaigns:store.campaigns(),jobs:store.jobs(),connections:{ai:await agent.health(),instagram:false,email:false}});
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
        if(!await agent.health())return send(res,503,{error:'AI staff is offline. Start the agent runtime and connect a model. You can still create and edit campaigns manually.'});
        const job=store.addJob(brief), brand=store.brand();running=true;
        send(res,202,job);
        void agent.generate(brief,brand).then(data=>{
          const campaign=store.addCampaign({...data,brief,brand,source:'ai'});
          store.updateJob(job.id,{status:'completed',campaignId:campaign.id});
        }).catch(()=>store.updateJob(job.id,{status:'failed',error:'Generation failed. Connect a model in the agent runtime and try again.'})).finally(()=>{running=false;});
        return;
      }
      if(url.pathname.startsWith('/api/'))return send(res,404,{error:'Not found.'});
      if(req.method!=='GET')return send(res,405,{error:'Method not allowed.'});
      const paths={'/':'index.html','/app.js':'app.js','/office.js':'office.js','/styles.css':'styles.css','/office.css':'office.css'};
      const name=paths[url.pathname];if(!name)return send(res,404,{error:'Not found.'});
      const content=await readFile(new URL(`./public/${name}`,import.meta.url));
      res.writeHead(200,{'Content-Type':({'html':'text/html','js':'text/javascript','css':'text/css'})[extname(name).slice(1)]+'; charset=utf-8'});res.end(content);
    }catch(error){if(error instanceof z.ZodError)return send(res,400,{error:'Please check the form fields.',details:error.issues.map(x=>x.path.join('.')+': '+x.message)});console.error(error.message);send(res,500,{error:'Could not complete the request.'});}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||3100);createApp().listen(port,'127.0.0.1',()=>console.log(`Agent Worker: http://127.0.0.1:${port}`));
}
