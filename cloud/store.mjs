import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';

export function cloudStore(query) {
  const sql=query||neon(process.env.DATABASE_URL);
  let ready;
  const run=async(text,args=[])=>{await (ready??=sql.query('CREATE TABLE IF NOT EXISTS agent_worker_documents (kind text NOT NULL, id text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(kind,id))'));return sql.query(text,args);};
  return {
    async get(kind,id){const rows=await run('SELECT data FROM agent_worker_documents WHERE kind=$1 AND id=$2',[kind,id]);return rows[0]?.data||null;},
    async list(kind){return (await run('SELECT data FROM agent_worker_documents WHERE kind=$1 ORDER BY created_at DESC',[kind])).map(r=>r.data);},
    async put(kind,id,data){await run('INSERT INTO agent_worker_documents(kind,id,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data',[kind,id,JSON.stringify(data)]);return data;},
    async patch(kind,id,changes){const rows=await run('UPDATE agent_worker_documents SET data=data || $3::jsonb WHERE kind=$1 AND id=$2 RETURNING data',[kind,id,JSON.stringify(changes)]);return rows[0]?.data||null;},
    async claim(kind,id,data){const rows=await run('INSERT INTO agent_worker_documents(kind,id,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(kind,id) DO NOTHING RETURNING id',[kind,id,JSON.stringify(data)]);return rows.length===1;},
    async remove(kind,id){await run('DELETE FROM agent_worker_documents WHERE kind=$1 AND id=$2',[kind,id]);},
    async countAttempt(id){const rows=await run("INSERT INTO agent_worker_documents(kind,id,data) VALUES('login-limit',$1,'{\"count\":1}'::jsonb) ON CONFLICT(kind,id) DO UPDATE SET data=jsonb_build_object('count',(agent_worker_documents.data->>'count')::int+1) RETURNING data",[id]);return rows[0].data.count;},
    async add(kind,data){const item={...data,id:randomUUID(),createdAt:new Date().toISOString()};return this.put(kind,item.id,item);},
    // A database lease prevents concurrent sends or overlapping background work across instances.
    async lock(id,ttl=300){const owner=randomUUID();const rows=await run(`INSERT INTO agent_worker_documents(kind,id,data) VALUES('lock',$1,jsonb_build_object('owner',$2::text,'expires',extract(epoch from now())+$3::int)) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data WHERE (agent_worker_documents.data->>'expires')::numeric < extract(epoch from now()) RETURNING id`,[id,owner,ttl]);return rows.length?owner:null;},
    async unlock(id,owner){await run("DELETE FROM agent_worker_documents WHERE kind='lock' AND id=$1 AND data->>'owner'=$2",[id,owner]);},
  };
}
