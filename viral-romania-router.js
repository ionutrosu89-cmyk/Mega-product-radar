export async function routeViralCandidatesToRomania({supabaseUrl,serviceRoleKey,approved=false,fetchImpl=fetch}={}){
  if(!approved)return held('VIRAL_ROMANIA_ROUTING_APPROVAL_REQUIRED');
  if(!supabaseUrl||!serviceRoleKey)return held('SUPABASE_SERVICE_CONFIGURATION_REQUIRED');
  const res=await fetchImpl(`${String(supabaseUrl).replace(/\/$/,'')}/rest/v1/rpc/route_viral_candidates_to_romania_v1`,{method:'POST',headers:{'content-type':'application/json',apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`},body:'{}'});
  if(!res.ok)throw new Error(`VIRAL_ROMANIA_ROUTING_FAILED_${res.status}:${await res.text()}`);
  const receipt=await res.json();
  if(receipt.providerDataSpendEur!==0||receipt.purchaseAuthorized!==false||receipt.romaniaGapAssigned!==false)throw new Error('VIRAL_ROMANIA_ROUTING_POLICY_INVARIANT_FAILED');
  return receipt;
}
function held(reason){return {schema:'MPR_VIRAL_ROMANIA_ROUTING_RECEIPT_V1',status:'HELD',reason,targetsRouted:0,providerDataSpendEur:0,purchaseAuthorized:false,romaniaGapAssigned:false};}
