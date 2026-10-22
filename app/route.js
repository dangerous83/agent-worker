import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {authorize} from '../cloud/security.mjs';
import {setupResponse,handleCloud} from '../cloud/api.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){const access=authorize(request);if(access==='setup')return setupResponse();if(access!=='ok')return handleCloud(request);return new Response(await readFile(join(process.cwd(),'public','index.html'),'utf8'),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY'}});}
