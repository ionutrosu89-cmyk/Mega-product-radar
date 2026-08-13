import {getSupabaseClient,getCurrentSession} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';

export const CLOUD_DATASETS=Object.freeze([
  {key:'megaRadarSupplierRecordsV1',table:'suppliers',toRow:(x,w)=>({workspace_id:w,product_name:String(x.productName||x.name||'Produs'),supplier_name:x.supplierName||null,platform:x.platform||null,url:x.url||null,verified:Boolean(x.manualVerified||x.verified),payload:x})},
  {key:'megaRadarLandedCostRecordsV1',table:'landed_costs',toRow:(x,w)=>({workspace_id:w,product_name:String(x.productName||x.name||'Produs'),landed_per_unit:Number(x.landedPerUnit||x.landedCost||x.unitLanded||0)||null,confirmed:Boolean(x.confirmed),payload:x})},
  {key:'megaRadarPurchaseRecordsV1',table:'purchases',toRow:(x,w)=>({workspace_id:w,product_name:String(x.productName||x.name||'Produs'),status:x.status||null,quantity:Number(x.quantity||x.qty||0)||null,capital:Number(x.capital||x.totalCost||0)||null,payload:x})},
  {key:'megaRadarPortfolioV1',table:'portfolio_items',toRow:(x,w)=>({workspace_id:w,product_name:String(x.productName||x.name||'Produs'),stock:Number(x.stock||0)||0,sales_30d:Number(x.sold30d||x.sales30d||0)||0,revenue_30d:Number(x.revenue30d||0)||0,payload:x})},
  {key:'megaRadarFeedbackV1',table:'feedback_events',toRow:(x,w)=>({workspace_id:w,product_name:String(x.productName||x.name||'Produs'),predicted_score:Number(x.predictedScore||0)||null,actual_margin:Number(x.actualMarginPct||x.actualMargin||0)||null,return_rate:Number(x.returnsPct||x.returnRate||0)||null,payload:x})},
  {key:'megaRadarDiscoveryRecordsV1',table:'discovery_candidates',toRow:(x,w)=>({workspace_id:w,name:String(x.name||x.productName||'Candidat'),stage:x.stage||x.manualStage||null,score:Number(x.score||x.megaScore||0)||null,quality:x.quality||x.sourceStatus||null,payload:x})}
]);

function readLocal(key){
  try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return[];}
}
function writeLocal(key,value){localStorage.setItem(key,JSON.stringify(Array.isArray(value)?value:[]));}
async function context(){
  const client=await getSupabaseClient();
  const session=await getCurrentSession();
  if(!client||!session) throw new Error('Autentificare necesara.');
  const workspace=await ensurePersonalWorkspace('My Radar');
  return {client,workspace};
}

export function localCloudSummary(){
  return CLOUD_DATASETS.map(d=>({key:d.key,table:d.table,count:readLocal(d.key).length}));
}

export async function pushLocalToCloud(){
  const {client,workspace}=await context();
  const details=[];
  for(const d of CLOUD_DATASETS){
    const local=readLocal(d.key);
    const {error:delError}=await client.from(d.table).delete().eq('workspace_id',workspace.id);
    if(delError) throw delError;
    if(local.length){
      const rows=local.map(x=>d.toRow(x,workspace.id));
      const {error:insertError}=await client.from(d.table).insert(rows);
      if(insertError) throw insertError;
    }
    details.push({table:d.table,count:local.length});
  }
  return {workspaceId:workspace.id,details,total:details.reduce((s,x)=>s+x.count,0)};
}

export async function pullCloudToLocal(){
  const {client,workspace}=await context();
  const details=[];
  for(const d of CLOUD_DATASETS){
    const {data,error}=await client.from(d.table).select('payload').eq('workspace_id',workspace.id).order('created_at',{ascending:true});
    if(error) throw error;
    const records=(data||[]).map(x=>x.payload).filter(Boolean);
    writeLocal(d.key,records);
    details.push({table:d.table,count:records.length});
  }
  return {workspaceId:workspace.id,details,total:details.reduce((s,x)=>s+x.count,0)};
}
