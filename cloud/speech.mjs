import {generateSpeech} from 'ai';
import {z} from 'zod';
const input=z.object({worker:z.enum(['manager','instagram','email','reviewer']),messageId:z.string().min(1).max(150)});
const voices={manager:'Charon',instagram:'Aoede',email:'Puck',reviewer:'Kore'};
export async function staffSpeech(body,{store,run=generateSpeech,env=process.env}){
 const {worker,messageId}=input.parse(body);
 const message=await store.get('message',messageId);
 if(!message||message.worker!==worker||message.role!=='assistant'||message.status!=='completed'||!message.text)throw Object.assign(Error('Choose a completed staff reply first.'),{statusCode:404});
 const attempts=await store.countAttempt('staff-speech',900);
 if(attempts>40)throw Object.assign(Error('Voice limit reached. Try again in a few minutes.'),{statusCode:429});
 try{
  const result=await run({model:env.AI_SPEECH_MODEL||'google/gemini-3.8-flash-lite-tts',text:message.text.slice(0,4000),voice:voices[worker],outputFormat:'wav',maxRetries:0,abortSignal:AbortSignal.timeout(60000)});
  if(!result.audio?.uint8Array?.length)throw Error('Empty speech');
  return new Response(result.audio.uint8Array,{headers:{'Content-Type':result.audio.mediaType||'audio/wav','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){console.error('Staff speech failed',{name:error?.name,statusCode:error?.statusCode});throw Object.assign(Error('Natural voice could not be generated. Check the speech model access and AI credit in Vercel.'),{statusCode:502});}
}
