export async function refreshViralScores({supabaseUrl,serviceRoleKey,approved=false,fetchImpl=fetch}={}){
  if(!approved)return held('VIRAL_SCORE_REFRESH_APPROVAL_REQUIRED');
  if(!supabaseUrl||!serviceRoleKey)return held('SUPABASE_SERVICE_CONFIGURATION_REQUIRED');
  const res=await fetchImpl(`${String(supabaseUrl).replace(/\/$/,'')}/rest/v1/rpc/refresh_viral_candidate_scores_v1`,{method:'POST',headers:{'content-type':'application/json',apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`},body:'{}'});
  if(!res.ok)throw new Error(`VIRAL_SCORE_REFRESH_FAILED_${res.status}:${await res.text()}`);
  const receipt=await res.json();
  if(receipt.providerDataSpendEur!==0||receipt.purchaseAuthorized!==false||receipt.romaniaMissingAsScarcity!==false)throw new Error('VIRAL_SCORE_RECEIPT_POLICY_INVARIANT_FAILED');
  return receipt;
}
function held(reason){return {schema:'MPR_VIRAL_SCORE_REFRESH_RECEIPT_V1',status:'HELD',reason,scoresRefreshed:0,providerDataSpendEur:0,purchaseAuthorized:false,claimsSales:false,romaniaMissingAsScarcity:false};}
