const EBAY_SCOPE='https://api.ebay.com/oauth/api_scope/buy.marketing';
const TOKEN_URL='https://api.ebay.com/identity/v1/oauth2/token';
let cached=null;

const clean=value=>String(value??'').trim();
const approved=(env,key)=>clean(env[key]).toLowerCase()==='true';

export function ebayBuyAccessState(env=process.env){
  if(!clean(env.EBAY_CLIENT_ID)||!clean(env.EBAY_CLIENT_SECRET))return 'ACCESS_REQUIRED';
  if(!approved(env,'MPR_EBAY_TERMS_APPROVED')||!approved(env,'MPR_EBAY_PRODUCTION_ACCESS_APPROVED'))return 'TERMS_REVIEW_REQUIRED';
  return 'READY_TO_COLLECT';
}

function basicAuth(clientId,clientSecret){
  return Buffer.from(`${clientId}:${clientSecret}`,'utf8').toString('base64');
}

export async function getEbayApplicationToken({env=process.env,fetchImpl=fetch,now=()=>Date.now()}={}){
  if(ebayBuyAccessState(env)!=='READY_TO_COLLECT')throw new Error('EBAY_ACCESS_NOT_READY');
  const current=Number(now());
  if(cached?.token&&cached.expiresAt-current>60_000)return cached.token;

  const body=new URLSearchParams({grant_type:'client_credentials',scope:EBAY_SCOPE});
  const response=await fetchImpl(TOKEN_URL,{
    method:'POST',
    headers:{
      authorization:`Basic ${basicAuth(clean(env.EBAY_CLIENT_ID),clean(env.EBAY_CLIENT_SECRET))}`,
      'content-type':'application/x-www-form-urlencoded',
      accept:'application/json'
    },
    body
  });
  if(!response.ok)throw new Error(`EBAY_OAUTH_HTTP_${response.status}`);
  const payload=await response.json();
  const token=clean(payload?.access_token);
  const expiresIn=Number(payload?.expires_in);
  if(!token||!Number.isFinite(expiresIn)||expiresIn<=0)throw new Error('EBAY_OAUTH_INVALID_RESPONSE');
  cached={token,expiresAt:current+expiresIn*1000};
  return token;
}

export function resetEbayTokenCacheForTests(){cached=null;}
export const EBAY_BUY_AUTH={scope:EBAY_SCOPE,tokenUrl:TOKEN_URL};
