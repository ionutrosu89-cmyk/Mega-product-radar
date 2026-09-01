export async function persistViralObservations(report,{supabaseUrl,serviceRoleKey,approved=false,fetchImpl=fetch}={}){
  if(!approved)return receipt('HELD','VIRAL_PRODUCTION_WRITE_APPROVAL_REQUIRED',report,[]);
  if(!supabaseUrl||!serviceRoleKey)return receipt('HELD','SUPABASE_SERVICE_CONFIGURATION_REQUIRED',report,[]);
  if(report?.status!=='COMPLETED')return receipt('HELD','COMPLETED_COLLECTION_REQUIRED',report,[]);
  if(report.policy?.providerDataSpendEur!==0||report.policy?.purchaseAuthorized!==false||report.policy?.claimsSales!==false)throw new Error('VIRAL_REPORT_POLICY_INVARIANT_FAILED');
  const receipts=[];
  for(const observation of report.observations||[]){
    if(!observation.ingestEligible)throw new Error('INELIGIBLE_VIRAL_OBSERVATION');
    const res=await fetchImpl(`${String(supabaseUrl).replace(/\/$/,'')}/rest/v1/rpc/persist_viral_observation_v1`,{method:'POST',headers:{'content-type':'application/json',apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`},body:JSON.stringify({p_observation:observation})});
    if(!res.ok)throw new Error(`VIRAL_PERSIST_FAILED_${res.status}:${await res.text()}`);
    receipts.push(await res.json());
  }
  return receipt('COMPLETED',null,report,receipts);
}
function receipt(status,reason,report,receipts){return {schema:'MPR_VIRAL_PERSISTENCE_RUN_V1',status,reason,inputCount:report?.observations?.length||0,insertedCount:receipts.filter(x=>x.inserted).length,duplicateCount:receipts.filter(x=>x.inserted===false).length,receipts,policy:{providerDataSpendEur:0,purchaseAuthorized:false,claimsSales:false}};}
