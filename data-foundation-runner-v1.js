import {buildProductUniverse} from './product-universe-v1.js';
import {appendMarketObservationHistory,buildObservationHistoryMetrics} from './market-observation-history-v1.js';
import {adaptAmazonExplicitBsrSnapshot,adaptAmazonPublicRankingSnapshot,adaptAbsoluteProductSnapshot} from './real-data-adapters-v1.js';
import {buildDataQualityReport} from './data-quality-report-v1.js';
import {buildHistoricalSchedule} from './historical-scheduler-v1.js';

export function runDataFoundationV1({products=[],aliases=[],existingHistory=[],datasets=[],now=new Date().toISOString()}={}){
  const adapted=[],rejected=[],incoming=[];
  for(const item of datasets||[]){
    const type=String(item?.type||'').toUpperCase();
    let result;
    if(type==='AMAZON_PUBLIC_RANKING')result=adaptAmazonPublicRankingSnapshot(item.dataset||{},aliases);
    else if(type==='AMAZON_EXPLICIT_BSR')result=adaptAmazonExplicitBsrSnapshot(item.dataset||{},aliases);
    else if(type==='ABSOLUTE_PRODUCT_SNAPSHOT')result=adaptAbsoluteProductSnapshot(item.dataset||{},aliases,item.options||{});
    else {rejected.push({type,errors:['DATASET_ADAPTER_NOT_SUPPORTED']});continue;}
    adapted.push({type,adapter:result.adapter,accepted:result.observations.length,rejected:result.rejected.length,boundCount:result.boundCount,unboundCount:result.unboundCount});
    rejected.push(...result.rejected.map(x=>({type,errors:x.errors,input:x.input})));
    incoming.push(...result.observations);
  }
  const appended=appendMarketObservationHistory(existingHistory,incoming);
  const historyReport=buildObservationHistoryMetrics(appended.history);
  const universe=buildProductUniverse({products,aliases,observations:appended.history});
  const quality=buildDataQualityReport(universe,historyReport);
  const schedule=buildHistoricalSchedule(appended.history,{now});
  return Object.freeze({
    schemaVersion:'MPR_DATA_FOUNDATION_RUN_V1',generatedAt:now,adapted:Object.freeze(adapted),adapterRejected:Object.freeze(rejected),history:Object.freeze(appended.history),historyRejected:Object.freeze(appended.rejected),
    universe,historyReport,quality,schedule,
    readiness:Object.freeze({status:quality.status,scaleAuthorized:quality.scaleAuthorized,nextHistoricalDue:schedule.dueItems[0]||null}),
    policy:'ONE_CANONICAL_PIPELINE_FOR_PUBLIC_DATA; EXACT_ALIAS_BINDING_ONLY; APPEND_ONLY_HISTORY; QUALITY_BEFORE_SCALE; SCHEDULING_NEVER_EXECUTES_PROVIDER_CALLS',
    automaticPaidExpansionAllowed:false,automaticExecutionAllowed:false,paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false
  });
}
