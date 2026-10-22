import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function createVault(store, keyFile = join(process.env.DATA_DIR || 'data', '.secret-key')) {
  // Credentials stay encrypted at rest; the key and database are both excluded from Git.
  mkdirSync(dirname(keyFile), { recursive: true });
  if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32), { mode: 0o600, flag: 'wx' });
  const key = readFileSync(keyFile);
  if (key.length !== 32) throw new Error('Invalid local credential encryption key.');
  return {
    set(name, value) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
      store.setSetting(`secret:${name}`, { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
    },
    get(name) {
      const value = store.getSetting(`secret:${name}`); if (!value) return null;
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'));
    },
  };
}
