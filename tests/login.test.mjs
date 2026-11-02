import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorize,missingSettings} from '../cloud/security.mjs';
import {GET} from '../app/route.js';
const env={DATABASE_URL:'test',CREDENTIAL_ENCRYPTION_KEY:'ab'.repeat(32)};
test('Cloud opens without owner credentials and preserves origin and configuration checks',()=>{
 assert.deepEqual(missingSettings(env),[]);
 assert.equal(authorize(new Request('https://example.test/api/workspace'),env),'ok');
 assert.equal(authorize(new Request('https://example.test/api/workspace',{headers:{Origin:'https://attacker.test'}}),env),'origin');
 assert.equal(authorize(new Request('https://example.test/api/workspace'),{}),'setup');
 assert.ok(missingSettings({...env,CREDENTIAL_ENCRYPTION_KEY:'invalid'}).includes('CREDENTIAL_ENCRYPTION_KEY'));
});
test('Home page serves the actual office without a username or password form',async()=>{
 const original={...process.env};
 try{Object.assign(process.env,env);delete process.env.APP_OWNER_PASSWORD;
 const response=await GET(new Request('https://example.test/'));assert.equal(response.status,200);
 const html=await response.text();assert.match(html,/app.js/);assert.doesNotMatch(html,/owner-login|name="password"|Sign in/);
 }finally{for(const key of ['DATABASE_URL','CREDENTIAL_ENCRYPTION_KEY','APP_OWNER_PASSWORD']){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}}
});
