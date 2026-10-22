import {verifyHttpBasic} from 'eve/channels/auth';
import {missingSettings,sessionToken} from './security.mjs';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export const loginMarkup=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in — Agent Worker</title><link rel="stylesheet" href="/styles.css"></head><body><section class="panel cloud-setup"><p class="eyebrow">YOUR PRIVATE AI OFFICE</p><h1>Welcome to Agent Worker.</h1><p>Sign in to meet your team and open your workspace.</p><form id="owner-login"><label>Username<input name="username" autocomplete="username" value="owner" required maxlength="80"></label><label>Agent Worker password<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><button class="button primary" type="submit">Open my workspace ↗</button><p id="login-status" role="status" aria-live="polite"></p></form><p class="muted">Use the APP_OWNER_PASSWORD you saved in Vercel. This is separate from your GitHub and Gmail passwords.</p></section><script type="module" src="/login.js"></script></body></html>`;
export async function handleLogin(request,{env=process.env,storeFactory}={}){
 const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{...headers,...extra}});
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origin rejected.'},403);
 if(missingSettings(env).length)return json({error:'Workspace setup is incomplete.'},503);
 if(new URL(request.url).pathname==='/api/logout')return json({ok:true},200,{'Set-Cookie':'__Host-agent_worker=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required.'},415);
 const raw=await request.text();if(raw.length>2048)return json({error:'Request too large.'},413);
 let input;try{input=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
 if(typeof input.username!=='string'||input.username.length>80||typeof input.password!=='string'||input.password.length>256)return json({error:'Enter your username and password.'},400);
 try{
  // Global owner-only limit is persistent across Vercel instances and avoids trusting spoofable IP headers.
  if(await storeFactory().countAttempt(String(Math.floor(Date.now()/900000)))>30)return json({error:'Too many sign-in attempts. Wait 15 minutes and try again.'},429,{'Retry-After':'900'});
  const authorization='Basic '+Buffer.from(input.username+':'+input.password).toString('base64');
  if(!verifyHttpBasic(authorization,{username:env.APP_OWNER_USER||'owner',password:env.APP_OWNER_PASSWORD}).ok)return json({error:'Username or password is incorrect.'},401);
  return json({ok:true},200,{'Set-Cookie':`__Host-agent_worker=${sessionToken(env)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`});
 }catch{return json({error:'Sign-in is temporarily unavailable. Please try again shortly.'},503);}
}
