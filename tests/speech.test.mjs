import {test} from 'node:test';
import assert from 'node:assert/strict';
import {staffSpeech} from '../cloud/speech.mjs';
test('speech only reads a completed assistant reply owned by the selected worker',async()=>{
 let calls=0;const run=async()=>{calls++;return {audio:{uint8Array:new Uint8Array([1,2]),mediaType:'audio/wav'}};};
 const store={get:async()=>({worker:'manager',role:'assistant',status:'completed',text:'Hello.'}),countAttempt:async()=>1};
 await assert.rejects(()=>staffSpeech({worker:'email',messageId:'a'},{store,run}),/completed/);assert.equal(calls,0);
 const result=await staffSpeech({worker:'manager',messageId:'a'},{store,run});assert.equal(result.headers.get('content-type'),'audio/wav');assert.equal(calls,1);
 await assert.rejects(()=>staffSpeech({worker:'manager',messageId:'a'},{store:{...store,countAttempt:async()=>41},run}),/limit/);assert.equal(calls,1);
});
