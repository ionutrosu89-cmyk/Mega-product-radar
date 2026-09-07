import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const bundle=path.join(root,'_site');
const forbidden=[
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'DATAFORSEO_PASSWORD',
  'EBAY_CLIENT_SECRET',
  'SECURITY_AUDIT_SALT',
  'OPENAI_API_KEY'
];
const textExtensions=new Set(['.html','.js','.mjs','.json','.css','.md','.txt','.xml','.webmanifest']);

async function walk(dir){
  const out=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

await fs.access(bundle);
const hits=[];
for(const file of await walk(bundle)){
  if(!textExtensions.has(path.extname(file).toLowerCase()))continue;
  const text=await fs.readFile(file,'utf8');
  for(const marker of forbidden){
    if(text.includes(marker))hits.push(`${path.relative(bundle,file)}:${marker}`);
  }
}
if(hits.length){
  console.error('PUBLIC_BUNDLE_SECRET_MARKER_EXPOSED');
  for(const hit of hits)console.error(hit);
  process.exit(1);
}
console.log(`Public bundle secret scan PASS: ${forbidden.length} forbidden server-secret markers absent.`);
