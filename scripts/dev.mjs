import { spawn } from 'node:child_process';
const children = [spawn(process.execPath, ['node_modules/eve/bin/eve.js','dev','--no-ui','--host','127.0.0.1','--port','2000','--no-default-extensions'],{stdio:'inherit'}),spawn(process.execPath,['--env-file-if-exists=.env.local','workspace.mjs'],{stdio:'inherit'})];
let closing=false;
function stop(code=0){if(closing)return;closing=true;for(const child of children)child.kill();process.exitCode=code;}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
for(const child of children){child.on('error',e=>{console.error(e.message);stop(1)});child.on('exit',code=>stop(code??1));}
