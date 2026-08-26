import {getSupabaseClient,getCurrentSession} from './supabase-client.js';
import {ensurePersonalWorkspace} from './workspace-client.js';

export const CLOUD_DATASETS=Object.freeze([
  {key:'megaRadarSupplierRecordsV1',table:'suppliers',shape:'map',toRow:(x,w)=>({workspace_id:w,product_name:String(x.productName||x.name||x.__radarKey||'Produs'),supplier_name:x.supplierName||null,platform:x.platform||null,url:x.url||null,verified:Boolean(x.manualVerified||x.verified),payload:x})},
  {key:'megaRadarSupplierMatrixV6',table:'supplier_offers',shape:'array',toRow:(x,w)=>({workspace_id:w,product_name:String(x.product||x.productName||x.name||'Produs'),supplier_name:x.supplierName||null,platform:x.platform||null,url:x.url||null,quoted_price:Number(x.quotedPrice||0)||null,moq:Number(x.moq||0)||null,rating:Number(x.rating||0)||null,years:Number(x.years||0)||null,sample_cost:Number(x.sampleCost||0)||null,trade_assurance:Boolean(x.tradeAssurance),certifications:Array.isArray(x.certifications)?x.certifications:[],payload:x})},
  {key:'megaRadarRfqDispatchV1',table:'rfq_dispatch_states',shape:'array',toRow:(x,w)=>({workspace_id:w,product_key:String(x.productKey||x.productCanonicalKey||'').trim(),product_name:String(x.productName||'Produs'),supplier_name:String(x.supplierName||'Furnizor'),platform:x.platform||null,status:x.status||'NOT_SENT',sent_at:x.sentAt||null,sent_by:x.sentBy||null,channel:x.channel||null,response_received_at:x.responseReceivedAt||null,response_reference:x.responseReference||null,payload:x})},
  {key:'megaRadarLandedCostRecordsV1',table:'landed_costs',shape:'map',toRow:(x,w)=>({workspace_id:w,product_name:String(x.productName||x.name||x.__radarKey||'Produs'),landed_per_unit:Number(x.landedPerUnit||x.landedCost||x.unitLanded||0)||null,confirmed:Boolean(x.confirmed),payload:x})},
  {key:'megaRadarPurchaseRecordsV1',table:'purchases',shape:'map',toRow:(x,w)=>({workspace_id:w,product_name:String(x.productName||x.name||x.__radarKey||'Produs'),status:x.status||null,quantity:Number(x.quantity||x.qty||0)||null,capital:Number(x.capital||x.totalCost||0)||null,payload:x})},
  {key:'megaRadarPortfolioV6',legacyKey:'megaRadarPortfolioV1',table:'portfolio_items',shape:'array',toRow:(x,w)=>({workspace_id:w,product_name:String(x.productName||x.name||'Produs'),stock:Number(x.stock||0)||0,sales_30d:Number(x.sold30||x.sold30d||x.sales30d||0)||0,revenue_30d:Number(x.revenue30d||0)||0,payload:x})},
  {key:'megaRadarFeedbackV6',legacyKey:'megaRadarFeedbackV1',table:'feedback_events',shape:'array',toRow:(x,w)=>({workspace_id:w,product_name:String(x.productName||x.name||'Produs'),predicted_score:Number(x.predictedScore||0)||null,actual_margin:Number(x.actualMargin||x.actualMarginPct||0)||null,return_rate:Number(x.returnRate||x.returnsPct||0)||null,payload:x})},
  {key:'megaRadarDiscoveryRecordsV1',table:'discovery_candidates',shape:'map',toRow:(x,w)=>({workspace_id:w,name:String(x.name||x.productName||x.__radarKey||'Candidat'),stage:x.stage||x.manualStage||null,score:Number(x.score||x.megaScore||0)||null,quality:x.quality||x.sourceStatus||null,payload:x})}
]);

let muted=false;
let installed=false;
const timers=new Map();
const chains=new Map();
let batchSequence=0;

function parseValue(raw,shape){
  try{
    const value=JSON.parse(raw|| (shape==='map'?'{}':'[]'));
    if(shape==='map') return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    return Array.isArray(value)?value:[];
  }catch{return shape==='map'?{}:[];}
}
function parseLocalDataset(d){
  const current=localStorage.getItem(d.key);
  if(current!=null)return parseValue(current,d.shape);
  if(d.legacyKey){
    const legacy=localStorage.getItem(d.legacyKey);
    if(legacy!=null){const value=parseValue(legacy,d.shape);muted=true;try{localStorage.setItem(d.key,JSON.stringify(value));}finally{muted=false;}return value;}
  }
  return d.shape==='map'?{}:[];
}
function localRecords(d){
  const raw=parseLocalDataset(d);
  if(d.shape==='map') return Object.entries(raw).map(([key,value])=>({...((value&&typeof value==='object')?value:{}),__radarKey:key}));
  return raw;
}
function localCount(d){const raw=parseLocalDataset(d);return d.shape==='map'?Object.keys(raw).length:raw.length;}
function stripMeta(record){if(!record||typeof record!=='object')return record;const {__radarKey,...clean}=record;return clean;}
function recordTime(record){
  if(!record||typeof record!=='object')return 0;
  for(const key of ['updatedAt','responseReceivedAt','sentAt','verifiedAt','orderedAt','at']){const t=Date.parse(record[key]||'');if(Number.isFinite(t))return t;}
  return 0;
}
function latestTime(records=[]){return records.reduce((m,r)=>Math.max(m,recordTime(r)),0);}
function stablePayload(records=[]){return JSON.stringify(records.map(r=>{const clean=stripMeta(r);return clean&&typeof clean==='object'?Object.keys(clean).sort().reduce((o,k)=>(o[k]=clean[k],o),{}):clean;}));}
function writeDatasetLocal(d,records){
  muted=true;
  try{
    if(d.shape==='map'){
      const out={};
      for(const record of records||[]){const key=String(record?.__radarKey||record?.productName||record?.name||'').trim();if(key)out[key]=stripMeta(record);}
      localStorage.setItem(d.key,JSON.stringify(out));
    }else localStorage.setItem(d.key,JSON.stringify((records||[]).map(stripMeta)));
  }finally{muted=false;}
}
async function context(){
  const client=await getSupabaseClient();
  const session=await getCurrentSession();
  if(!client||!session) throw new Error('Autentificare necesara.');
  const workspace=await ensurePersonalWorkspace('My Radar');
  return {client,workspace};
}
function datasetFor(key){return CLOUD_DATASETS.find(d=>d.key===key||d.legacyKey===key);}
function nextBatch(){
  const now=Date.now();
  batchSequence=(batchSequence+1)%1000000;
  const suffix=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`${now}-${batchSequence}`;
  return {id:suffix,at:new Date(now).toISOString()};
}

export function selectLatestSyncBatchRows(rows=[]){
  const modern=(rows||[]).filter(row=>row?.sync_batch_id&&Date.parse(row?.sync_batch_at||'')>0);
  if(!modern.length)return (rows||[]).filter(row=>row?.payload).map(row=>row.payload);
  let latest=modern[0];
  for(const row of modern){
    const rt=Date.parse(row.sync_batch_at),lt=Date.parse(latest.sync_batch_at);
    if(rt>lt||(rt===lt&&String(row.sync_batch_id)>String(latest.sync_batch_id)))latest=row;
  }
  return modern.filter(row=>row.sync_batch_id===latest.sync_batch_id&&row.sync_batch_at===latest.sync_batch_at).map(row=>row.payload).filter(Boolean);
}

async function cloudRows(client,d,workspaceId){
  const {data,error}=await client.from(d.table).select('payload,sync_batch_id,sync_batch_at').eq('workspace_id',workspaceId).order('created_at',{ascending:true});
  if(error)throw error;
  return selectLatestSyncBatchRows(data||[]);
}

export function localCloudSummary(){return CLOUD_DATASETS.map(d=>({key:d.key,table:d.table,count:localCount(d)}));}

export async function pushDatasetToCloud(key){
  const d=datasetFor(key);if(!d) return null;
  const {client,workspace}=await context();
  const records=localRecords(d);
  const batch=nextBatch();
  if(records.length){
    const rows=records.map(x=>({...d.toRow(x,workspace.id),sync_batch_id:batch.id,sync_batch_at:batch.at}));
    const {error:insertError}=await client.from(d.table).insert(rows);
    if(insertError)throw insertError;
  }
  // Destructive cleanup happens only after the replacement batch is safely persisted.
  // Older concurrent writers cannot delete a newer batch because cleanup is timestamp-bounded.
  const old=client.from(d.table).delete().eq('workspace_id',workspace.id).lt('sync_batch_at',batch.at);
  const {error:oldError}=await old;if(oldError)throw oldError;
  const legacy=client.from(d.table).delete().eq('workspace_id',workspace.id).is('sync_batch_at',null);
  const {error:legacyError}=await legacy;if(legacyError)throw legacyError;
  return {workspaceId:workspace.id,table:d.table,count:records.length,batchId:batch.id,batchAt:batch.at,mode:'INSERT_THEN_CLEAN'};
}

export async function pullDatasetFromCloud(key){
  const d=datasetFor(key);if(!d) return null;
  const {client,workspace}=await context();
  const records=await cloudRows(client,d,workspace.id);
  writeDatasetLocal(d,records);
  return {workspaceId:workspace.id,table:d.table,count:records.length};
}

export async function pushLocalToCloud(){const details=[];for(const d of CLOUD_DATASETS)details.push(await pushDatasetToCloud(d.key));return{workspaceId:details[0]?.workspaceId||'',details,total:details.reduce((s,x)=>s+(x?.count||0),0)};}
export async function pullCloudToLocal(){const details=[];for(const d of CLOUD_DATASETS)details.push(await pullDatasetFromCloud(d.key));return{workspaceId:details[0]?.workspaceId||'',details,total:details.reduce((s,x)=>s+(x?.count||0),0)};}

async function reconcileDataset(d){
  const {client,workspace}=await context();
  const cloud=await cloudRows(client,d,workspace.id),local=localRecords(d);
  if(!cloud.length&&!local.length)return 'EMPTY';
  if(!cloud.length&&local.length){await pushDatasetToCloud(d.key);return 'PUSHED';}
  if(cloud.length&&!local.length){writeDatasetLocal(d,cloud);return 'PULLED';}
  const localStamp=latestTime(local),cloudStamp=latestTime(cloud);
  if(localStamp>cloudStamp){await pushDatasetToCloud(d.key);return 'PUSHED';}
  if(cloudStamp>localStamp){writeDatasetLocal(d,cloud);return 'PULLED';}
  if(stablePayload(local)!==stablePayload(cloud)){writeDatasetLocal(d,cloud);return 'PULLED';}
  return 'SAME';
}

function queueSync(key,delay=700){
  if(muted||!datasetFor(key))return;
  clearTimeout(timers.get(key));
  timers.set(key,setTimeout(()=>{
    const prior=chains.get(key)||Promise.resolve();
    const next=prior.catch(()=>{}).then(()=>pushDatasetToCloud(key)).catch(e=>console.warn('Radar cloud autosync',key,e?.message||e));
    chains.set(key,next);
  },delay));
}

export async function installCloudAutosync({hydrate=true,reloadOnHydrate=true}={}){
  if(typeof window==='undefined'||typeof localStorage==='undefined')return{active:false,reason:'NO_BROWSER'};
  const session=await getCurrentSession();if(!session)return{active:false,reason:'NO_SESSION'};
  if(!installed){
    installed=true;
    const nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;
    Storage.prototype.setItem=function(key,value){nativeSet.call(this,key,value);if(this===localStorage)queueSync(String(key));};
    Storage.prototype.removeItem=function(key){nativeRemove.call(this,key);if(this===localStorage)queueSync(String(key));};
    window.addEventListener('storage',e=>{if(e.storageArea===localStorage&&datasetFor(e.key))queueSync(e.key,250);});
  }
  let changed=false;
  if(hydrate){for(const d of CLOUD_DATASETS){try{if(await reconcileDataset(d)==='PULLED')changed=true;}catch(e){console.warn('Radar cloud hydrate',d.key,e?.message||e);}}}
  if(changed&&reloadOnHydrate){const marker='radarCloudHydrated:'+location.pathname;if(sessionStorage.getItem(marker)!=='1'){sessionStorage.setItem(marker,'1');location.reload();}}
  return{active:true,changed};
}
