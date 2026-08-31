import {appendFile} from 'node:fs/promises';

const audience='mega-product-radar-readiness';
const requestUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
const githubEnv=process.env.GITHUB_ENV;

if(!requestUrl||!requestToken||!githubEnv){
  throw new Error('GitHub Actions OIDC environment is unavailable');
}

const url=new URL(requestUrl);
url.searchParams.set('audience',audience);
const result=await fetch(url,{headers:{Authorization:`Bearer ${requestToken}`,Accept:'application/json'}});
let body={};
try{body=await result.json();}catch{}
if(!result.ok||typeof body.value!=='string'||!body.value){
  throw new Error(`GitHub Actions OIDC token request failed (${result.status})`);
}
if(/[\r\n]/.test(body.value))throw new Error('OIDC token has an invalid format');
console.log(`::add-mask::${body.value}`);
await appendFile(githubEnv,`MPR_READINESS_PROBE_TOKEN=${body.value}\n`,{encoding:'utf8'});
console.log('Short-lived GitHub Actions readiness credential minted.');
