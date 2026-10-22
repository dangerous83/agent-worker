import { spawn } from 'node:child_process';
const child=spawn(process.execPath,['--env-file-if-exists=.env.local','workspace.mjs'],{stdio:'inherit'});
process.on('SIGINT',()=>child.kill());process.on('SIGTERM',()=>child.kill());child.on('exit',code=>{process.exitCode=code??1});
