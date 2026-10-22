import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export function createStore(filename = 'data/workspace.sqlite') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, data TEXT NOT NULL);`);
  const read = table => db.prepare(`SELECT data FROM ${table} ORDER BY rowid DESC`).all().map(r => JSON.parse(r.data));
  const put = (table, data) => { db.prepare(`INSERT INTO ${table}(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(data.id, JSON.stringify(data)); return data; };
  return {
    close: () => db.close(),
    brand: () => JSON.parse(db.prepare("SELECT value FROM settings WHERE key='brand'").get()?.value || '{"name":"","audience":"","voice":"Friendly and clear","description":"","color":"#bdff79"}'),
    saveBrand: brand => { db.prepare("INSERT INTO settings VALUES('brand',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(brand)); return brand; },
    campaigns: () => read('campaigns'), jobs: () => read('jobs'),
    addCampaign: data => put('campaigns', { ...data, id: randomUUID(), status: 'draft', createdAt: new Date().toISOString() }),
    updateCampaign(id, changes) {
      const old = read('campaigns').find(c => c.id === id);
      if (!old) return null;
      return put('campaigns', { ...old, ...changes, id, updatedAt: new Date().toISOString() });
    },
    addJob: brief => put('jobs', { id: randomUUID(), brief, status: 'running', createdAt: new Date().toISOString() }),
    updateJob(id, changes) { const job = read('jobs').find(j => j.id === id); return job ? put('jobs', { ...job, ...changes, id }) : null; },
  };
}
