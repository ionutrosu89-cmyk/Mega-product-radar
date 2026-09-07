import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const bundle=path.join(root,'_site');
const textExtensions=new Set(['.html','.js','.mjs','.json','.css','.md','.txt','.xml','.webmanifest']);
const secretValuePatterns=[
  ['stripe-secret',/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g],
  ['stripe-webhook-secret',/\bwhsec_[A-Za-z0-9]{16,}\b/g],
  ['supabase-secret',/\bsb_secret_[A-Za-z0-9_-]{16,}\b/g],
  ['openai-secret',/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ['github-token',/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/g],
  ['generic-server-secret-literal',/\b(?:SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|DATAFORSEO_PASSWORD|EBAY_CLIENT_SECRET|SECURITY_AUDIT_SALT|OPENAI_API_KEY)\b\s*[:=]\s*['"`]([^'"`]{12,})['"`]/g]
];

async function walk(dir){
  const out=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}
function decodeBase64Url(value){try{return Buffer.from(value.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');}catch{return '';}}
function serviceRoleJwtPresent(text){
  const candidates=text.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g)||[];
  return candidates.some(token=>{const payload=token.split('.')[1];const decoded=decodeBase64Url(payload);try{return JSON.parse(decoded)?.role==='service_role';}catch{return false;}});
}

await fs.access(bundle);
const hits=[];
for(const file of await walk(bundle)){
  if(!textExtensions.has(path.extname(file).toLowerCase()))continue;
  const text=await fs.readFile(file,'utf8');
  for(const [label,pattern] of secretValuePatterns){
    pattern.lastIndex=0;
    if(pattern.test(text))hits.push(`${path.relative(bundle,file)}:${label}`);
  }
  if(serviceRoleJwtPresent(text))hits.push(`${path.relative(bundle,file)}:service-role-jwt`);
}
if(hits.length){
  console.error('PUBLIC_BUNDLE_SECRET_VALUE_EXPOSED');
  for(const hit of hits)console.error(hit);
  process.exit(1);
}
console.log(`Public bundle secret scan PASS: no server-secret values detected across ${secretValuePatterns.length} pattern classes plus service-role JWT detection.`);
