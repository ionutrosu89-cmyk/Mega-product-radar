const n=v=>Number(v);
const finite=v=>Number.isFinite(n(v));
const text=v=>String(v??'').trim();
const nowIso=()=>new Date().toISOString();

export const TEST_THRESHOLDS=Object.freeze({minSellThroughPct:60,minNetMarginPct:15,maxReturnRatePct:10,minUnitsSold:10});

export function buildTestPlan(product,decision,{authorizedAt=nowIso()}={}){
  const d=decision||product?.testBuyDecision||{};
  const blockers=[];
  if(d.status!=='TEST_BUY')blockers.push('Commercial decision must be TEST_BUY.');
  if(d.landedCostConfirmed!==true)blockers.push('Confirmed landed cost is required.');
  if(!finite(d.unitLandedCost)||n(d.unitLandedCost)<=0)blockers.push('Valid landed cost per unit is required.');
  if(!Number.isInteger(n(d.quantity))||n(d.quantity)<20||n(d.quantity)>30)blockers.push('Test quantity must be 20–30 units.');
  if(!finite(d.testBudget)||n(d.testBudget)<=0)blockers.push('Positive test budget is required.');
  if(!finite(d.targetSalePrice)||n(d.targetSalePrice)<=0)blockers.push('Positive target sale price is required.');
  if(blockers.length)return{ok:false,blockers,record:null};
  const productName=text(product?.name||d.productName||'');
  const productKey=text(product?.canonicalKey||d.productCanonicalKey||productName).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(!productKey)return{ok:false,blockers:['Product identity is required.'],record:null};
  const stamp=Date.parse(authorizedAt);if(!Number.isFinite(stamp))return{ok:false,blockers:['Valid authorization timestamp is required.'],record:null};
  const record={
    runKey:`${productKey}::${new Date(stamp).toISOString()}`,
    productKey,productName:productName||productKey,status:'PLANNED',authorizedAt:new Date(stamp).toISOString(),
    decisionSnapshot:{status:d.status,passedGates:d.passedGates??null,gateCount:d.gateCount??9,confidenceScore:d.confidenceScore??null,verdict:d.verdict||null},
    plannedQuantity:n(d.quantity),landedPerUnit:n(d.unitLandedCost),targetSalePrice:n(d.targetSalePrice),maxTestBudget:n(d.testBudget),
    orderReference:'',startedAt:null,measuredAt:null,unitsReceived:null,unitsSold:null,revenueRon:null,adSpendRon:null,marketplaceFeesRon:null,fulfillmentCostRon:null,returnsCount:null,returnsCostRon:null,otherCostsRon:null,
    outcome:null,updatedAt:new Date(stamp).toISOString()
  };
  return{ok:true,blockers:[],record};
}

export function startRealTest(record,{orderReference,confirmedRealOrder=false,startedAt=nowIso()}={}){
  const blockers=[];
  if(record?.status!=='PLANNED')blockers.push('Only a PLANNED test can start.');
  if(confirmedRealOrder!==true)blockers.push('Explicit confirmation of the real order is required.');
  if(!text(orderReference))blockers.push('A real order/reference identifier is required.');
  const stamp=Date.parse(startedAt);if(!Number.isFinite(stamp))blockers.push('Valid start timestamp is required.');
  if(blockers.length)return{ok:false,blockers,record};
  return{ok:true,blockers:[],record:{...record,status:'RUNNING',orderReference:text(orderReference).slice(0,180),startedAt:new Date(stamp).toISOString(),updatedAt:new Date(stamp).toISOString()}};
}

export function measureRealTest(record,input={},thresholds=TEST_THRESHOLDS){
  const blockers=[];
  if(record?.status!=='RUNNING')blockers.push('Only a RUNNING test can be measured.');
  const fields=['unitsReceived','unitsSold','revenueRon','adSpendRon','marketplaceFeesRon','fulfillmentCostRon','returnsCount','returnsCostRon','otherCostsRon'];
  for(const f of fields)if(!finite(input[f])||n(input[f])<0)blockers.push(`${f} must be explicitly provided and non-negative.`);
  if(finite(input.unitsReceived)&&finite(input.unitsSold)&&n(input.unitsSold)>n(input.unitsReceived))blockers.push('Units sold cannot exceed units received.');
  if(finite(input.returnsCount)&&finite(input.unitsSold)&&n(input.returnsCount)>n(input.unitsSold))blockers.push('Returns cannot exceed units sold.');
  const stamp=Date.parse(input.measuredAt||'');if(!Number.isFinite(stamp))blockers.push('Valid measurement timestamp is required.');
  if(blockers.length)return{ok:false,blockers,record};
  const unitsReceived=n(input.unitsReceived),unitsSold=n(input.unitsSold),revenue=n(input.revenueRon),returns=n(input.returnsCount);
  const cogs=unitsSold*n(record.landedPerUnit);
  const variableCosts=n(input.adSpendRon)+n(input.marketplaceFeesRon)+n(input.fulfillmentCostRon)+n(input.returnsCostRon)+n(input.otherCostsRon);
  const contributionProfit=revenue-cogs-variableCosts;
  const sellThroughPct=unitsReceived>0?unitsSold/unitsReceived*100:0;
  const returnRatePct=unitsSold>0?returns/unitsSold*100:0;
  const netMarginPct=revenue>0?contributionProfit/revenue*100:0;
  const pass=unitsSold>=thresholds.minUnitsSold&&sellThroughPct>=thresholds.minSellThroughPct&&netMarginPct>=thresholds.minNetMarginPct&&returnRatePct<=thresholds.maxReturnRatePct&&contributionProfit>0;
  const outcome={status:pass?'TEST_PASS_CANDIDATE':'TEST_FAIL',automaticBuy:false,thresholds:{...thresholds},metrics:{sellThroughPct,returnRatePct,netMarginPct,contributionProfitRon:contributionProfit,cogsRon:cogs,variableCostsRon:variableCosts,unsoldUnits:Math.max(0,unitsReceived-unitsSold)},policy:'A passing real test is evidence for the BUY gate; it never creates BUY automatically.'};
  const measuredAt=new Date(stamp).toISOString();
  return{ok:true,blockers:[],record:{...record,status:'MEASURED',measuredAt,unitsReceived,unitsSold,revenueRon:revenue,adSpendRon:n(input.adSpendRon),marketplaceFeesRon:n(input.marketplaceFeesRon),fulfillmentCostRon:n(input.fulfillmentCostRon),returnsCount:returns,returnsCostRon:n(input.returnsCostRon),otherCostsRon:n(input.otherCostsRon),outcome,updatedAt:measuredAt},outcome};
}
