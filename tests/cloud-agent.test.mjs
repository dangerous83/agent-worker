import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCloudAgent} from '../cloud/agent.mjs';
test('cloud check requires a schema-valid real response and classifies credit failures',async()=>{
 const bad=createCloudAgent({run:async()=>{throw Error('customer_verification_required');}});
 assert.equal((await bad.verify()).state,'error');assert.match(bad.status().message,/verification/);
 const malformed=createCloudAgent({run:async()=>({output:{ok:false}})});assert.equal((await malformed.verify()).state,'error');
 const ready=createCloudAgent({run:async()=>({output:{ok:true}})});assert.equal((await ready.verify()).state,'ready');
});
test('specialists run in order and failed generation never reports completed',async()=>{
 const draft={title:'Studio launch',summary:'Missing contact details.',caption:'Meet our studio.',imageHeadline:'Meet the studio',imageSubline:'',imagePrompt:'Studio desk',emailSubject:'Meet our studio',emailBody:'Welcome.'};
 let calls=0;const events=[];
 const agent=createCloudAgent({run:async()=>{calls++;if(calls===2)throw Error('rate limit 429');return {output:draft};}});
 await assert.rejects(()=>agent.generate('Introduce studio',{},event=>events.push(event)),/rate limited/);
 assert.equal(calls,2);assert.equal(events.some(e=>e.worker==='reviewer'),false);
 assert.equal(events.some(e=>e.worker==='manager'&&e.state==='completed'),false);assert.equal(agent.status().state,'error');
});
