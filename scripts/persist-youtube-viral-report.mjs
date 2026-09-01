import fs from 'node:fs/promises';import path from 'node:path';import {persistViralObservations} from '../viral-supabase-writer.js';
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...v]=x.replace(/^--/,'').split('=');return[k,v.join('=')||true];}));
const input=String(args.input||'artifacts/youtube-viral-collector-report.json'),output=String(args.output||'artifacts/youtube-viral-persistence-receipt.json');
const report=JSON.parse(await fs.readFile(input,'utf8'));
const receipt=await persistViralObservations(report,{supabaseUrl:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY,approved:process.env.MPR_VIRAL_PRODUCTION_WRITE_APPROVED==='true'});
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
