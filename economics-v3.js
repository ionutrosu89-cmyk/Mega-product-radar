const text=v=>String(v??'').trim();
const upper=v=>text(v).toUpperCase();
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(v))?Number(v):null);
const STRONG=new Set(['VERIFIED','DIRECT_OBSERVED','PROVIDER_VERIFIED','MANUALLY_VERIFIED']);

export const ECONOMICS_COST_KEYS_V3=Object.freeze(['supplierUnitCost','internationalFreightPerUnit','customsPerUnit','brokerPerUnit','vatPerUnit','domesticLogisticsPerUnit','packagingPerUnit','marketplaceFeePct','fulfillmentPerUnit','returnsPct','adsPct','paymentFeePct','warrantyPct']);
export const ECONOMICS_SCENARIOS_V3=Object.freeze(['BEST','BASE','WORST']);

function evidence(raw,key){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {key,value:null,evidenceClass:'UNKNOWN',source:null,observedAt:null,strong:false,known:false};
  const value=num(raw.value),evidenceClass=upper(raw.evidenceClass)||'UNKNOWN';
  return {key,value,evidenceClass,source:text(raw.source)||null,sourceUrl:text(raw.sourceUrl)||null,observedAt:text(raw.observedAt)||null,strong:STRONG.has(evidenceClass),known:value!==null};
}
function ratio(v){return v===null?null:v/100;}
function scenarioValue(base,key,scenario,assumptions={}){
  const configured=num(assumptions?.[scenario]?.[key]);
  if(configured!==null)return configured;
  const v=base[key]?.value;
  if(v===null||v===undefined)return null;
  const factor=scenario==='BEST'?0.95:scenario==='WORST'?1.10:1;
  if(key.endsWith('Pct'))return scenario==='BEST'?Math.max(0,v*0.9):scenario==='WORST'?v*1.15:v;
  return v*factor;
}

function calculateScenario(base,scenario,sellPrice,assumptions){
  const values=Object.fromEntries(ECONOMICS_COST_KEYS_V3.map(k=>[k,scenarioValue(base,k,scenario,assumptions)]));
  if(Object.values(values).some(v=>v===null))return Object.freeze({scenario,status:'UNKNOWN',values:Object.freeze(values),reason:'CRITICAL_COST_UNKNOWN'});
  const fixed=['supplierUnitCost','internationalFreightPerUnit','customsPerUnit','brokerPerUnit','vatPerUnit','domesticLogisticsPerUnit','packagingPerUnit','fulfillmentPerUnit'].reduce((s,k)=>s+values[k],0);
  const variablePct=values.marketplaceFeePct+values.returnsPct+values.adsPct+values.paymentFeePct+values.warrantyPct;
  const variableRatio=ratio(variablePct);
  if(variableRatio>=1)return Object.freeze({scenario,status:'INVALID',values:Object.freeze(values),reason:'VARIABLE_COST_RATE_AT_OR_ABOVE_100_PERCENT'});
  const breakEvenSellPrice=fixed/(1-variableRatio);
  const revenue=sellPrice===null?null:sellPrice;
  const variableCostAtSellPrice=revenue===null?null:revenue*variableRatio;
  const totalUnitCost=revenue===null?null:fixed+variableCostAtSellPrice;
  const unitProfit=revenue===null?null:revenue-totalUnitCost;
  const marginPct=revenue&&revenue>0?unitProfit/revenue*100:null;
  return Object.freeze({scenario,status:'CALCULATED',values:Object.freeze(values),fixedCostPerUnit:Number(fixed.toFixed(4)),variableCostPct:Number(variablePct.toFixed(4)),breakEvenSellPrice:Number(breakEvenSellPrice.toFixed(4)),sellPrice:revenue,totalUnitCost:totalUnitCost===null?null:Number(totalUnitCost.toFixed(4)),unitProfit:unitProfit===null?null:Number(unitProfit.toFixed(4)),marginPct:marginPct===null?null:Number(marginPct.toFixed(2))});
}

export function analyzeEconomicsV3({canonicalProductId=null,supplierQuote=null,costEvidence={},sellPrice=null,scenarioAssumptions={},targets={}}={}){
  const id=text(canonicalProductId).toLowerCase()||null;
  const quoteId=text(supplierQuote?.quoteId||supplierQuote?.id)||null;
  const quoteProductId=text(supplierQuote?.canonicalProductId).toLowerCase()||null;
  const supplierQuoteMatches=Boolean(id&&quoteProductId&&id===quoteProductId);
  const base={};
  for(const key of ECONOMICS_COST_KEYS_V3)base[key]=evidence(costEvidence[key],key);
  const unknownCosts=ECONOMICS_COST_KEYS_V3.filter(k=>!base[k].known);
  const weakCritical=ECONOMICS_COST_KEYS_V3.filter(k=>base[k].known&&!base[k].strong);
  const invalidCosts=ECONOMICS_COST_KEYS_V3.filter(k=>base[k].known&&base[k].value<0);
  const price=num(sellPrice);
  const scenarios=ECONOMICS_SCENARIOS_V3.map(s=>calculateScenario(base,s,price,scenarioAssumptions));
  const blockers=[];
  if(!id)blockers.push('CANONICAL_PRODUCT_ID_REQUIRED');
  if(!quoteId)blockers.push('SUPPLIER_QUOTE_ID_REQUIRED');
  if(!quoteProductId)blockers.push('SUPPLIER_QUOTE_CANONICAL_PRODUCT_ID_REQUIRED');
  else if(id&&quoteProductId!==id)blockers.push('SUPPLIER_QUOTE_PRODUCT_MISMATCH');
  if(unknownCosts.length)blockers.push('CRITICAL_COSTS_UNKNOWN');
  if(weakCritical.length)blockers.push('CRITICAL_COSTS_WEAK_EVIDENCE');
  if(invalidCosts.length)blockers.push('NEGATIVE_COST_INPUT_INVALID');
  if(price===null||price<=0)blockers.push('TARGET_SELL_PRICE_REQUIRED');
  if(scenarios.some(x=>x.status==='INVALID'))blockers.push('INVALID_SCENARIO_COST_STRUCTURE');
  const baseScenario=scenarios.find(x=>x.scenario==='BASE');
  const worstScenario=scenarios.find(x=>x.scenario==='WORST');
  const minBaseMargin=num(targets.minBaseMarginPct)??20;
  const minWorstMargin=num(targets.minWorstMarginPct)??5;
  let status='UNKNOWN_FAIL_CLOSED';
  const inputsComplete=Boolean(id&&quoteId&&supplierQuoteMatches&&!unknownCosts.length&&!weakCritical.length&&!invalidCosts.length&&price&&price>0&&scenarios.every(x=>x.status==='CALCULATED'));
  if(inputsComplete){
    if((baseScenario.marginPct??-Infinity)<minBaseMargin||(worstScenario.marginPct??-Infinity)<minWorstMargin){status='REVIEW';blockers.push('MARGIN_BELOW_TARGET');}
    else status='PASS';
  }
  const baseVariableRate=baseScenario?.status==='CALCULATED'?baseScenario.variableCostPct/100:null;
  const nonSupplierFixedKeys=['internationalFreightPerUnit','customsPerUnit','brokerPerUnit','vatPerUnit','domesticLogisticsPerUnit','packagingPerUnit','fulfillmentPerUnit'];
  const nonSupplierFixed=nonSupplierFixedKeys.every(k=>base[k].value!==null)?nonSupplierFixedKeys.reduce((s,k)=>s+base[k].value,0):null;
  const breakEvenSupplierUnitCost=price!==null&&baseVariableRate!==null&&nonSupplierFixed!==null?price*(1-baseVariableRate)-nonSupplierFixed:null;
  return Object.freeze({
    schemaVersion:'MPR_ECONOMICS_V3',canonicalProductId:id,supplierQuoteId:quoteId,supplierQuoteMatches,status,economicsConfirmed:status==='PASS',sellPrice:price,
    evidence:Object.freeze(base),unknownCosts:Object.freeze(unknownCosts),weakCriticalEvidence:Object.freeze(weakCritical),invalidCosts:Object.freeze(invalidCosts),blockers:Object.freeze([...new Set(blockers)]),
    targets:Object.freeze({minBaseMarginPct:minBaseMargin,minWorstMarginPct:minWorstMargin}),scenarios:Object.freeze(scenarios),breakEvenSupplierUnitCost:breakEvenSupplierUnitCost===null?null:Number(breakEvenSupplierUnitCost.toFixed(4)),
    decisionEligible:inputsComplete,evidenceClass:inputsComplete?'DERIVED':'UNKNOWN',canPromoteToFinalist:false,canPromoteToTestReady:false,canPromoteToBuyReady:false,purchaseAuthorized:false,paidCallsTriggered:0,providerSpendEur:0,
    policy:'CANONICAL_SUPPLIER_QUOTE_MATCH_REQUIRED; ALL_CRITICAL_COSTS_REQUIRE_STRONG_EVIDENCE; SUPPLIER_UNIT_COST_REQUIRES_EXPLICIT_COST_EVIDENCE; UNKNOWN_COSTS_STAY_UNKNOWN; BEST_BASE_WORST_EXPLICIT; BREAK_EVEN_IS_DERIVED_NOT_VERIFIED_SALES; ECONOMICS_NEVER_AUTHORIZES_PURCHASE'
  });
}
