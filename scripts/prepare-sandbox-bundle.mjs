import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export const SANDBOX_HANDLERS=['billing-webhook','billing-readiness','paid-beta-runtime-readiness','legal-readiness','sandbox-preflight-readiness','billing-e2e-acceptance','billing-e2e-sandbox-transition'];
export async function prepareSandboxBundle(root,target){
 root=path.resolve(root);target=path.resolve(target);
 if(target===root||!target.startsWith(root+path.sep))throw new Error('SANDBOX_OUTPUT_OUTSIDE_WORKSPACE');
 // A new directory only: never replace an existing deployment or copy env files.
 await fs.mkdir(target);
 const visited=new Set();
 async function copy(relative){
  const source=path.resolve(root,relative);
  if(!source.startsWith(root+path.sep))throw new Error('SANDBOX_IMPORT_OUTSIDE_WORKSPACE');
  if(visited.has(relative))return;visited.add(relative);
  const content=await fs.readFile(source,'utf8');
  if(/\bimport\s*\(\s*[^\s'"]/.test(content))throw new Error('SANDBOX_DYNAMIC_IMPORT_REVIEW_REQUIRED:'+relative);
  const destination=path.join(target,relative);
  await fs.mkdir(path.dirname(destination),{recursive:true});
  await fs.writeFile(destination,content);
  for(const m of content.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/g)){
   await copy(path.relative(root,path.resolve(path.dirname(source),m[1])).split(path.sep).join('/'));
  }
 }
 for(const name of SANDBOX_HANDLERS)await copy('netlify/functions/'+name+'.mjs');
 await copy('netlify/edge-functions/sandbox-perimeter.js');
 for(const name of ['package.json','package-lock.json'])await fs.copyFile(path.join(root,name),path.join(target,name));
 // Suppress committed production Supabase defaults even if the runtime env is missing.
 const config=path.join(target,'saas-config.js');
 if(visited.has('saas-config.js')){
  let text=await fs.readFile(config,'utf8');
  text=text.replace(/https:\/\/[a-z0-9-]+\.supabase\.co/g,'https://unconfigured-sandbox.invalid');
  text=text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'SANDBOX_ANON_KEY_REQUIRED');
  await fs.writeFile(config,text);
 }
 await fs.mkdir(path.join(target,'public'));
 await fs.writeFile(path.join(target,'public','robots.txt'),'User-agent: *\nDisallow: /\n');
 await fs.writeFile(path.join(target,'netlify.toml'),`[build]
  command = "node --version"
  publish = "public"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[[edge_functions]]
  function = "sandbox-perimeter"
  path = "/*"
`);
 const manifest={mode:'SANDBOX_ONLY',activated:false,handlers:SANDBOX_HANDLERS,files:[...visited].sort(),requiredReview:['isolated database credentials','Stripe test keys only','dedicated hostname and workspace','quotas and costs','external endpoint exposure approval']};
 await fs.writeFile(path.join(target,'sandbox-bundle-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const destination=process.argv[2];
 if(!destination)throw new Error('Provide a new output directory inside the repository');
 console.log(JSON.stringify(await prepareSandboxBundle(process.cwd(),destination),null,2));
}
