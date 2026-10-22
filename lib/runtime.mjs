import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { resolve, join } from 'node:path';

// Dashboard startup owns its AI runtime. A separately running, healthy runtime is reused.
export function createRuntime({ port = 2000 } = {}) {
  let child, starting = false, lastError = '', lastExit = null;
  const host = `http://127.0.0.1:${port}`;
  async function online() {
    try { const response = await fetch(`${host}/eve/v1/health`, { signal: AbortSignal.timeout(1500) }); const result = await response.json(); return response.ok && result.ok === true && result.status === 'ready'; } catch { return false; }
  }
  return {
    async start() {
      if (await online()) return { state: 'online' };
      if (child || starting) return { state: 'starting' };
      starting = true; lastError = '';
      const dataDir=process.env.DATA_DIR||'data';mkdirSync(dataDir, { recursive: true });
      const log = createWriteStream(join(dataDir,'agent-runtime.log'), { flags: 'a', mode: 0o600 });
      try {
        const command=process.env.NODE_ENV==='production'?['start','--host','127.0.0.1','--port',String(port)]:['dev','--no-ui','--host','127.0.0.1','--port',String(port),'--no-default-extensions'];
        child = spawn(process.execPath, ['--env-file-if-exists=.env.local', resolve('node_modules/eve/bin/eve.js'), ...command], { cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
        child.stdout.pipe(log); child.stderr.pipe(log);
        child.on('error', () => { lastError = 'The AI service could not start. Check the local runtime log.'; });
        child.on('exit', code => { lastExit = code; lastError = code ? 'The AI service stopped. Retry startup or check data/agent-runtime.log.' : ''; child = undefined; log.end(); });
      } finally { starting = false; }
      return { state: 'starting' };
    },
    async status() { return { state: await online() ? 'online' : child || starting ? 'starting' : 'offline', error: lastError, lastExit }; },
    stop() { if (child) child.kill(); },
  };
}
