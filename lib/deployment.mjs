import { resolve, join } from 'node:path';
import { mkdirSync, existsSync, lstatSync, readdirSync, rmdirSync, symlinkSync, realpathSync } from 'node:fs';
import { verifyHttpBasic } from 'eve/channels/auth';

export function deploymentConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const dataDir = resolve(env.DATA_DIR || 'data');
  if (!production) return { production, dataDir, origin: null, owner: null };
  const rawOrigin = env.APP_ORIGIN || env.RENDER_EXTERNAL_URL;
  if (!rawOrigin) throw new Error('Set APP_ORIGIN to the public HTTPS address before production startup.');
  const url = new URL(rawOrigin);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('APP_ORIGIN must be a plain HTTPS origin.');
  const username = env.APP_OWNER_USER || 'owner', password = env.APP_OWNER_PASSWORD || '';
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(username) || password.length < 20) throw new Error('Set APP_OWNER_USER and a private APP_OWNER_PASSWORD of at least 20 characters.');
  if (!env.DATA_DIR) throw new Error('Set DATA_DIR to the persistent disk mount path.');
  if ((env.AI_RUNTIME_PASSWORD || '').length < 32) throw new Error('Set AI_RUNTIME_PASSWORD to a random value of at least 32 characters.');
  if (!env.AI_GATEWAY_API_KEY) throw new Error('Set AI_GATEWAY_API_KEY on the backend host. Local subscription logins cannot run cloud inference.');
  return { production, dataDir, origin: url.origin, owner: { username, password } };
}

export function validOwner(header, config) {
  return !config.production || verifyHttpBasic(header || null, config.owner).ok;
}

export function persistWorkflows(dataDir, root = process.cwd()) {
  const directory = join(dataDir, 'workflows'), link = join(root, '.eve', '.workflow-data');
  mkdirSync(directory, { recursive: true });mkdirSync(join(root, '.eve'), { recursive: true });
  if (existsSync(link)) {
    if (lstatSync(link).isSymbolicLink()) {
      if (realpathSync(link) !== realpathSync(directory)) throw new Error('Workflow storage points to a different persistent directory.');
      return;
    }
    if (readdirSync(link).length) throw new Error('Existing workflow data needs migration before changing its storage location.');
    rmdirSync(link);
  }
  symlinkSync(directory, link, process.platform === 'win32' ? 'junction' : 'dir');
}
