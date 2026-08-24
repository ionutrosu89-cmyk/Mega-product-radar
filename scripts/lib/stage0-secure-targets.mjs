const ENDPOINT=String(process.env.MPR_STAGE0_TARGETS_ENDPOINT||'https://xqzsbebbuovcyeyxdqxo.supabase.co/functions/v1/stage0-targets').trim();
const AUDIENCE='mega-product-radar-supabase';

async function githubOidcToken(){
  const reqUrl=String(process.env.ACTIONS_ID_TOKEN_REQUEST_URL||'');
  const reqToken=String(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||'');
  if(!reqUrl||!reqToken)throw new Error('GitHub OIDC unavailable');
  const url=new URL(reqUrl);url.searchParams.set('audience',AUDIENCE);
  const response=await fetch(url,{headers:{Authorization:`Bearer ${reqToken}`,'accept':'application/json'}});
  if(!response.ok)throw new Error(`GitHub OIDC HTTP ${response.status}`);
  const payload=await response.json();
  const token=String(payload?.value||'');
  if(!token)throw new Error('GitHub OIDC token missing');
  return token;
}

export async function readStage0Targets(queue){
  const q=String(queue||'').toUpperCase();
  if(!['RO','DEEP'].includes(q))throw new Error('Invalid Stage 0 target queue');
  const token=await githubOidcToken();
  const response=await fetch(ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json','accept':'application/json'},body:JSON.stringify({queue:q})});
  if(!response.ok)throw new Error(`Stage 0 secure targets HTTP ${response.status}`);
  const payload=await response.json();
  if(payload?.ok!==true||!Array.isArray(payload?.targets))throw new Error('Stage 0 secure targets returned invalid payload');
  return payload.targets;
}
