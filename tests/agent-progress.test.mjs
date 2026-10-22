import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAgent } from '../lib/agent.mjs';
const draft={title:'A campaign',summary:'A plan',caption:'Hello',imageHeadline:'Hello',imageSubline:'',imagePrompt:'',emailSubject:'Hello',emailBody:'Hello'};
test('Only real task events report a specialist as working',async()=>{
  const events=[{type:'step.started',data:{}},{type:'task.started',data:{name:'eve:subagent:instagram',taskId:'test-task'}},{type:'task.settled',data:{name:'eve:subagent:instagram',status:'completed',taskId:'test-task'}},{type:'result.completed',data:{result:draft}}];
  const client={sessions:{create:async()=>({response:{sessionId:'test-session',async *[Symbol.asyncIterator](){yield*events;}}})}};
  const agent=createAgent({client}),progress=[];const result=await agent.generate('Introduce our studio.',{},event=>progress.push(event));
  assert.equal(result.sessionId,'test-session');assert.deepEqual(progress.filter(p=>p.worker==='instagram').map(p=>p.state),['working','completed']);assert.equal(progress.some(p=>p.worker==='email'),false);assert.equal(agent.status().state,'ready');
});
test('An unavailable model produces an actionable error and never reports ready',async()=>{const client={sessions:{create:async()=>({response:{async *[Symbol.asyncIterator](){yield{type:'turn.failed',data:{message:'The model connection is unavailable. Run /login to reconnect.'}};}}})}};const agent=createAgent({client});await assert.rejects(()=>agent.generate('Introduce our studio.',{}),/model needs sign-in/);assert.equal(agent.status().state,'error');});
