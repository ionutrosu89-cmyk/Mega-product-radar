import crypto from 'node:crypto';
import {normalizeProductSnapshot,buildProductHistoryMetrics} from './product-snapshot-ledger.js';

const text=v=>String(v??'').trim();

export function loadLiveSnapshotBatch(compact={}){
  const errors=[];
  if(compact?.schemaVersion!=='MPR_AMAZON_LIVE_SNAPSHOT_BATCH_V1')errors.push('SCHEMA_VERSION_INVALID');
  if(Number(compact?.policy?.providerSpendEur)!==0)errors.push('PROVIDER_SPEND_MUST_BE_ZERO');
  if(Number(compact?.policy?.paidCallsTriggered)!==0)errors.push('PAID_CALLS_MUST_BE_ZERO');
  if(compact?.policy?.purchaseAuthorized!==false)errors.push('PURCHASE_MUST_NOT_BE_AUTHORIZED');
  if(compact?.policy?.salesEvidenceClass!=='NOT_VERIFIED_SALES')errors.push('SALES_EVIDENCE_POLICY_INVALID');
  const fields=Array.isArray(compact?.fields)?compact.fields:[];
  const required=['externalId','price','currency','rating','reviewCount','observedAt','freshnessClass'];
  for(const f of required)if(!fields.includes(f))errors.push(`FIELD_MISSING:${f}`);
  const index=Object.fromEntries(fields.map((f,i)=>[f,i]));
  const rows=Array.isArray(compact?.snapshots)?compact.snapshots:[];
  const hash=crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  if(!text(compact?.snapshotSetSha256))errors.push('SNAPSHOT_HASH_REQUIRED');
  else if(hash!==text(compact.snapshotSetSha256))errors.push('SNAPSHOT_HASH_MISMATCH');
  const snapshots=[];const rejected=[];const seen=new Set();
  for(let i=0;i<rows.length;i++){
    const row=rows[i]||[];
    const n=normalizeProductSnapshot({
      platform:'AMAZON',externalId:row[index.externalId],price:row[index.price],currency:row[index.currency],rating:row[index.rating],reviewCount:row[index.reviewCount],observedAt:row[index.observedAt],freshnessClass:row[index.freshnessClass],sourceKey:compact.sourceKey,evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE'
    });
    if(!n.ok){rejected.push({row:i,errors:n.errors});continue;}
    const id=n.snapshot.externalId;
    if(seen.has(id)){rejected.push({row:i,errors:['DUPLICATE_EXTERNAL_ID']});continue;}
    seen.add(id);snapshots.push(n.snapshot);
  }
  if(snapshots.length!==Number(compact?.validObservations||0))errors.push('DECLARED_VALID_COUNT_MISMATCH');
  if(rejected.length)errors.push('SNAPSHOT_ROWS_REJECTED');
  return{ok:errors.length===0,errors,rejected,snapshots,snapshotSetSha256:hash,validObservations:snapshots.length,coverage:compact?.coverage||null,paidCallsTriggered:0,purchaseAuthorized:false};
}

export function liveSnapshotBatchHistoryStatus(compact={}){
  const loaded=loadLiveSnapshotBatch(compact);
  const history=buildProductHistoryMetrics(loaded.snapshots);
  return{ok:loaded.ok,validObservations:loaded.validObservations,trendReadyCount:history.trendReadyCount,allRemainInsufficientFreshHistory:history.products.every(x=>x.status==='INSUFFICIENT_FRESH_HISTORY'),rule:history.rule,paidCallsTriggered:0,purchaseAuthorized:false};
}
