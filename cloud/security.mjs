import { randomBytes,createCipheriv,createDecipheriv } from 'node:crypto';
export function missingSettings(env=process.env){return ['DATABASE_URL','CREDENTIAL_ENCRYPTION_KEY'].filter(key=>!env[key]||(key==='CREDENTIAL_ENCRYPTION_KEY'&&!/^[a-f0-9]{64}$/i.test(env[key])));}
// The owner explicitly chose a shared workspace without application sign-in.
export function authorize(request,env=process.env){if(missingSettings(env).length)return 'setup';if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return 'origin';return 'ok';}
export function cloudVault(store,key=process.env.CREDENTIAL_ENCRYPTION_KEY){
  if(!/^[a-f0-9]{64}$/i.test(key||''))throw new Error('Invalid credential encryption key.');
  const secret=Buffer.from(key,'hex');
  return {
    async get(name){const value=await store.get('secret',name);if(!value)return null;const decipher=createDecipheriv('aes-256-gcm',secret,Buffer.from(value.iv,'base64'));decipher.setAuthTag(Buffer.from(value.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString('utf8'));},
    async set(name,value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret,iv);const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);await store.put('secret',name,{iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});},
  };
}
