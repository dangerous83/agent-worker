import { request } from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, existsSync, realpathSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deploymentConfig, persistWorkflows } from '../lib/deployment.mjs';
import { createStore } from '../lib/store.mjs';
import { createApp } from '../workspace.mjs';

const env={NODE_ENV:'production',APP_ORIGIN:'https://office.example.com',APP_OWNER_USER:'owner',APP_OWNER_PASSWORD:'test-owner-password-long-enough',DATA_DIR:'/var/data/agent-worker',AI_RUNTIME_PASSWORD:'test-internal-password-long-enough-32',AI_GATEWAY_API_KEY:'test-model-key'};
test('Production configuration fails closed when critical settings are absent',()=>{const config=deploymentConfig(env);assert.equal(config.origin,'https://office.example.com');for(const name of ['APP_ORIGIN','APP_OWNER_PASSWORD','DATA_DIR','AI_RUNTIME_PASSWORD','AI_GATEWAY_API_KEY'])assert.throws(()=>deploymentConfig({...env,[name]:''}));assert.throws(()=>deploymentConfig({...env,APP_ORIGIN:'http://office.example.com'}));assert.equal(deploymentConfig({}).production,false);});
test('Public health is minimal; hosted dashboard and API require owner auth and the canonical origin',async()=>{
  const store=createStore(':memory:'),config=deploymentConfig(env),app=createApp({store,config,agent:{health:async()=>false}});
  app.listen(0,'127.0.0.1');await once(app,'listening');const url=`http://127.0.0.1:${app.address().port}`;
  const auth='Basic '+Buffer.from(env.APP_OWNER_USER+':'+env.APP_OWNER_PASSWORD).toString('base64');
  const get=(path,headers={})=>new Promise((resolve,reject)=>{const req=request(url+path,{headers},response=>{let text='';response.on('data',chunk=>text+=chunk);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,data:JSON.parse(text)}));});req.on('error',reject);req.end();});
  try{const health=await get('/healthz');assert.equal(health.status,200);assert.deepEqual(health.data,{ok:true});const noAuth=await get('/api/workspace',{Host:'office.example.com'});assert.equal(noAuth.status,401);assert.match(noAuth.headers['www-authenticate'],/Basic/);assert.equal((await get('/api/workspace',{Host:'office.example.com',Authorization:'Basic invalid'})).status,401);const valid=await get('/api/workspace',{Host:'office.example.com',Authorization:auth});assert.equal(valid.status,200);assert.equal(valid.data.connections.hosting.state,'hosted');assert.equal((await get('/api/workspace',{Host:'evil.example',Authorization:auth})).status,403);assert.equal((await get('/api/workspace',{Host:'office.example.com',Authorization:auth,Origin:'https://evil.example'})).status,403);}finally{app.closeAllConnections();await new Promise(r=>app.close(r));store.close();}
});
test('Workflow data links to persistent storage and can be reused on restart',()=>{
  const root=mkdtempSync(join(tmpdir(),'agent-worker-workflow-')),data=join(root,'persistent');
  try{persistWorkflows(data,root);const link=join(root,'.eve','.workflow-data');assert.ok(existsSync(link));assert.equal(realpathSync(link),realpathSync(join(data,'workflows')));persistWorkflows(data,root);}finally{const link=join(root,'.eve','.workflow-data');if(existsSync(link))unlinkSync(link);rmdirSync(join(root,'.eve'));rmdirSync(join(data,'workflows'));rmdirSync(data);rmdirSync(root);}
});
