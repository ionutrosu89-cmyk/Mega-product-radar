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

let muted=false,installed=false,idSequence=0;
const timers=new Map(),chains=new Map();

function parseValue(raw,shape){try{const v=JSON.parse(raw||(shape==='map'?'{}':'[]'));return shape==='map'?(v&&typeof v==='object'&&!Array.isArray(v)?v:{}):(Array.isArray(v)?v:[]);}catch{return shape==='map'?{}:[];}}
function parseLocalDataset(d){
  const current=localStorage.getItem(d.key);if(current!=null)return parseValue(current,d.shape);
  if(d.legacyKey){const legacy=localStorage.getItem(d.legacyKey);if(legacy!=null){const v=parseValue(legacy,d.shape);muted=true;try{localStorage.setItem(d.key,JSON.stringify(v));}finally{muted=false;}return v;}}
  return d.shape==='map'?{}:[];
}
function nextRecordId(){idSequence=(idSequence+1)%1000000;return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`radar-${Date.now()}-${idSequence}-${Math.random().toString(36).slice(2,10)}`;}
function persistLocal(d,value){muted=true;try{localStorage.setItem(d.key,JSON.stringify(value));}finally{muted=false;}}
function localRecords(d){
  const raw=parseLocalDataset(d);
  if(d.shape==='map'){
    let changed=false;const next={...raw};
    const records=Object.entries(raw).map(([key,value])=>{const base=value&&typeof value==='object'?value:{};const rid=String(base.__cloudRecordId||`map:${key}`);if(base.__cloudRecordId!==rid){next[key]={...base,__cloudRecordId:rid};changed=true;}return {...base,__radarKey:key,__cloudRecordId:rid};});
    if(changed)persistLocal(d,next);return records;
  }
  let changed=false;const records=raw.map(value=>{const base=value&&typeof value==='object'?value:{};if(base.__cloudRecordId)return base;changed=true;return {...base,__cloudRecordId:nextRecordId()};});
  if(changed)persistLocal(d,records);return records;
}
function localCount(d){const raw=parseLocalDataset(d);return d.shape==='map'?Object.keys(raw).length:raw.length;}
function stripRadarMeta(record){if(!record||typeof record!=='object')return record;const {__radarKey,...clean}=record;return clean;}
function stripCloudMeta(record){if(!record||typeof record!=='object')return record;const {__radarKey,__cloudVersion,...clean}=record;return clean;}
function recordTime(record){if(!record||typeof record!=='object')return 0;for(const key of ['updatedAt','responseReceivedAt','sentAt','verifiedAt','orderedAt','at']){const t=Date.parse(record[key]||'');if(Number.isFinite(t))return t;}return 0;}
function latestTime(records=[]){return records.reduce((m,r)=>Math.max(m,recordTime(r)),0);}
function stablePayload(records=[]){return JSON.stringify(records.map(r=>{const clean=stripCloudMeta(r);return clean&&typeof clean==='object'?Object.keys(clean).sort().reduce((o,k)=>(o[k]=clean[k],o),{}):clean;}));}
function writeDatasetLocal(d,records){
  if(d.shape==='map'){const out={};for(const record of records||[]){const key=String(record?.__radarKey||record?.productName||record?.name||'').trim();if(key)out[key]=stripRadarMeta(record);}persistLocal(d,out);}
  else persistLocal(d,(records||[]).map(stripRadarMeta));
}
async function context(){const client=await getSupabaseClient(),session=await getCurrentSession();if(!client||!session)throw new Error('Autentificare necesara.');const workspace=await ensurePersonalWorkspace('My Radar');return{client,workspace};}
function datasetFor(key){return CLOUD_DATASETS.find(d=>d.key===key||d.legacyKey===key);}

// Kept for compatibility with migration-era tests/readers. New sync does not create replacement batches.
export function selectLatestSyncBatchRows(rows=[]){
  const modern=(rows||[]).filter(row=>row?.sync_batch_id&&Date.parse(row?.sync_batch_at||'')>0);if(!modern.length)return(rows||[]).filter(row=>row?.payload).map(row=>row.payload);
  let latest=modern[0];for(const row of modern){const rt=Date.parse(row.sync_batch_at),lt=Date.parse(latest.sync_batch_at);if(rt>lt||(rt===lt&&String(row.sync_batch_id)>String(latest.sync_batch_id)))latest=row;}
  return modern.filter(row=>row.sync_batch_id===latest.sync_batch_id&&row.sync_batch_at===latest.sync_batch_at).map(row=>row.payload).filter(Boolean);
}

export function planRecordUpserts(local=[],cloud=[]){
  const current=new Map((cloud||[]).filter(x=>x?.sync_record_id).map(x=>[String(x.sync_record_id),x])),operations=[];
  for(const record of local||[]){
    const recordId=String(record?.__cloudRecordId||'').trim();if(!recordId)throw new Error('CLOUD_SYNC_MISSING_STABLE_RECORD_ID');
    const existing=current.get(recordId);if(!existing){operations.push({kind:'INSERT',recordId,expectedVersion:0,nextVersion:1,record});continue;}
    const expectedVersion=Number(record?.__cloudVersion||0),actualVersion=Number(existing.sync_version||1);
    if(!Number.isInteger(expectedVersion)||expectedVersion<1||expectedVersion!==actualVersion){const e=new Error(`CLOUD_SYNC_VERSION_CONFLICT:${recordId}`);e.code='CLOUD_SYNC_VERSION_CONFLICT';e.recordId=recordId;e.expectedVersion=expectedVersion;e.actualVersion=actualVersion;throw e;}
    operations.push({kind:'UPDATE',recordId,expectedVersion,nextVersion:actualVersion+1,record});
  }
  return operations;
}

function withCloudMeta(row){const payload=row?.payload&&typeof row.payload==='object'?row.payload:{};return{...payload,__cloudRecordId:String(row?.sync_record_id||payload.__cloudRecordId||''),__cloudVersion:Number(row?.sync_version||1),__radarKey:payload.__radarKey};}
async function cloudStateRows(client,d,workspaceId){const {data,error}=await client.from(d.table).select('sync_record_id,sync_version,payload').eq('workspace_id',workspaceId).order('created_at',{ascending:true});if(error)throw error;return data||[];}
async function cloudRows(client,d,workspaceId){return(await cloudStateRows(client,d,workspaceId)).filter(x=>x?.sync_record_id).map(withCloudMeta);}
function rowForSync(d,record,workspaceId,recordId,version){const base=d.toRow(record,workspaceId),canonicalProductId=String(record?.canonicalProductId||record?.canonical_product_id||'').trim();return{...base,payload:stripCloudMeta(record),sync_record_id:recordId,sync_version:version,sync_batch_id:null,sync_batch_at:null,...(canonicalProductId?{canonical_product_id:canonicalProductId}:{})};}

export function localCloudSummary(){return CLOUD_DATASETS.map(d=>({key:d.key,table:d.table,count:localCount(d)}));}

export async function pushDatasetToCloud(key){
  const d=datasetFor(key);if(!d)return null;const {client,workspace}=await context(),records=localRecords(d),cloud=await cloudStateRows(client,d,workspace.id),operations=planRecordUpserts(records,cloud);
  for(const op of operations){
    const row=rowForSync(d,op.record,workspace.id,op.recordId,op.nextVersion);
    if(op.kind==='INSERT'){
      const {error}=await client.from(d.table).insert(row);if(error){const e=new Error(`CLOUD_SYNC_INSERT_CONFLICT:${op.recordId}`);e.code='CLOUD_SYNC_INSERT_CONFLICT';e.cause=error;throw e;}
    }else{
      const {data,error}=await client.from(d.table).update(row).eq('workspace_id',workspace.id).eq('sync_record_id',op.recordId).eq('sync_version',op.expectedVersion).select('sync_record_id,sync_version');if(error)throw error;
      if(!data?.length){const e=new Error(`CLOUD_SYNC_VERSION_CONFLICT:${op.recordId}`);e.code='CLOUD_SYNC_VERSION_CONFLICT';throw e;}
    }
  }
  // No delete on missing local rows. Safe deletion needs explicit tombstones; preservation wins until then.
  const refreshed=await cloudRows(client,d,workspace.id);writeDatasetLocal(d,refreshed);
  return{workspaceId:workspace.id,table:d.table,count:operations.length,mode:'RECORD_UPSERT_CAS'};
}

export async function pullDatasetFromCloud(key){const d=datasetFor(key);if(!d)return null;const {client,workspace}=await context(),records=await cloudRows(client,d,workspace.id);writeDatasetLocal(d,records);return{workspaceId:workspace.id,table:d.table,count:records.length};}
export async function pushLocalToCloud(){const details=[];for(const d of CLOUD_DATASETS)details.push(await pushDatasetToCloud(d.key));return{workspaceId:details[0]?.workspaceId||'',details,total:details.reduce((s,x)=>s+(x?.count||0),0)};}
export async function pullCloudToLocal(){const details=[];for(const d of CLOUD_DATASETS)details.push(await pullDatasetFromCloud(d.key));return{workspaceId:details[0]?.workspaceId||'',details,total:details.reduce((s,x)=>s+(x?.count||0),0)};}

async function reconcileDataset(d){
  const {client,workspace}=await context(),cloud=await cloudRows(client,d,workspace.id),local=localRecords(d);
  if(!cloud.length&&!local.length)return'EMPTY';if(!cloud.length&&local.length){await pushDatasetToCloud(d.key);return'PUSHED';}if(cloud.length&&!local.length){writeDatasetLocal(d,cloud);return'PULLED';}
  // A legacy client must adopt server IDs/versions before being allowed to write current cloud rows.
  if(local.some(x=>!x.__cloudVersion)){writeDatasetLocal(d,cloud);return'PULLED_METADATA';}
  const localStamp=latestTime(local),cloudStamp=latestTime(cloud);if(localStamp>cloudStamp){await pushDatasetToCloud(d.key);return'PUSHED';}if(cloudStamp>localStamp){writeDatasetLocal(d,cloud);return'PULLED';}if(stablePayload(local)!==stablePayload(cloud)){writeDatasetLocal(d,cloud);return'PULLED';}return'SAME';
}
function queueSync(key,delay=700){if(muted||!datasetFor(key))return;clearTimeout(timers.get(key));timers.set(key,setTimeout(()=>{const prior=chains.get(key)||Promise.resolve(),next=prior.catch(()=>{}).then(()=>pushDatasetToCloud(key)).catch(e=>console.warn('Radar cloud autosync',key,e?.message||e));chains.set(key,next);},delay));}
export async function installCloudAutosync({hydrate=true,reloadOnHydrate=true}={}){
  if(typeof window==='undefined'||typeof localStorage==='undefined')return{active:false,reason:'NO_BROWSER'};const session=await getCurrentSession();if(!session)return{active:false,reason:'NO_SESSION'};
  if(!installed){installed=true;const nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;Storage.prototype.setItem=function(key,value){nativeSet.call(this,key,value);if(this===localStorage)queueSync(String(key));};Storage.prototype.removeItem=function(key){nativeRemove.call(this,key);if(this===localStorage)queueSync(String(key));};window.addEventListener('storage',e=>{if(e.storageArea===localStorage&&datasetFor(e.key))queueSync(e.key,250);});}
  let changed=false;if(hydrate){for(const d of CLOUD_DATASETS){try{if((await reconcileDataset(d)).startsWith('PULLED'))changed=true;}catch(e){console.warn('Radar cloud hydrate',d.key,e?.message||e);}}}
  if(changed&&reloadOnHydrate){const marker='radarCloudHydrated:'+location.pathname;if(sessionStorage.getItem(marker)!=='1'){sessionStorage.setItem(marker,'1');location.reload();}}return{active:true,changed};
}
