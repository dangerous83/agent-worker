import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {authorize} from '../cloud/security.mjs';
import {setupResponse,handleCloud} from '../cloud/api.mjs';
import {loginMarkup} from '../cloud/login.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request){const access=authorize(request);if(access==='setup')return setupResponse();if(access==='origin')return handleCloud(request);const html=access==='ok'?await readFile(join(process.cwd(),'public','index.html'),'utf8'):loginMarkup;return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'"}});}
