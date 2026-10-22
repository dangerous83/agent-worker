import { randomBytes,createCipheriv,createDecipheriv,createHmac,timingSafeEqual } from 'node:crypto';
import { verifyHttpBasic } from 'eve/channels/auth';
export function missingSettings(env=process.env){return ['DATABASE_URL','APP_OWNER_PASSWORD','CREDENTIAL_ENCRYPTION_KEY'].filter(key=>!env[key]||(key==='APP_OWNER_PASSWORD'&&env[key].length<12)||(key==='CREDENTIAL_ENCRYPTION_KEY'&&!/^[a-f0-9]{64}$/i.test(env[key])));}
const sign=(value,env)=>createHmac('sha256',env.CREDENTIAL_ENCRYPTION_KEY).update(env.APP_OWNER_PASSWORD+'\0'+value).digest('base64url');
export function sessionToken(env=process.env,now=Date.now()){const value=`${Math.floor(now/1000)+604800}.${randomBytes(24).toString('base64url')}`;return value+'.'+sign(value,env);}
export function validSession(token,env=process.env,now=Date.now()){
 if(typeof token!=='string'||token.length>200)return false;
 const parts=token.split('.');if(parts.length!==3||!/^\d+$/.test(parts[0])||!/^[A-Za-z0-9_-]{32}$/.test(parts[1])||!/^[A-Za-z0-9_-]{43}$/.test(parts[2]))return false;
 const expires=Number(parts[0]);if(expires<=Math.floor(now/1000)||expires>Math.floor(now/1000)+604800)return false;
 const expected=sign(parts[0]+'.'+parts[1],env),actual=parts[2];return expected.length===actual.length&&timingSafeEqual(Buffer.from(expected),Buffer.from(actual));
}
export function authorize(request,env=process.env){if(missingSettings(env).length)return 'setup';const cookie=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-agent_worker='))?.slice('__Host-agent_worker='.length);if(!validSession(cookie,env)&&!verifyHttpBasic(request.headers.get('authorization'),{username:env.APP_OWNER_USER||'owner',password:env.APP_OWNER_PASSWORD}).ok)return 'unauthorized';if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return 'origin';return 'ok';}
export function cloudVault(store,key=process.env.CREDENTIAL_ENCRYPTION_KEY){
  if(!/^[a-f0-9]{64}$/i.test(key||''))throw new Error('Invalid credential encryption key.');
  const secret=Buffer.from(key,'hex');
  return {
    async get(name){const value=await store.get('secret',name);if(!value)return null;const decipher=createDecipheriv('aes-256-gcm',secret,Buffer.from(value.iv,'base64'));decipher.setAuthTag(Buffer.from(value.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString('utf8'));},
    async set(name,value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);await store.put('secret',name,{iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});},
  };
}
