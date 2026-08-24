import {profitEngineV2} from './profit-engine-v2.js';
import {verifySupplierQuote} from './supplier-quote-verifier.js';

const n=v=>Number.isFinite(Number(v))?Number(v):0;
const arr=v=>Array.isArray(v)?v:[];
const hasOwn=(o,k)=>Boolean(o&&Object.prototype.hasOwnProperty.call(o,k));
const explicitNumber=(o,k)=>hasOwn(o,k)&&o[k]!==''&&o[k]!==null&&Number.isFinite(Number(o[k]));

export const normalizeProductKey=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

function sameProduct(record,name){return normalizeProductKey(record?.productName||record?.product||record?.name||record?.productCanonicalKey||record?.__radarKey)===normalizeProductKey(name);}
function sourceUrl(x){return String(x?.sourceUrl||x?.url||x?.payload?.sourceUrl||x?.payload?.url||'').trim();}
function domainOf(url){try{return new URL(url).hostname.replace(/^www\./,'').toLowerCase();}catch{return'';}}
function payloadOf(x){return x?.payload&&typeof x.payload==='object'?x.payload:x||{};}
function verifiedObservation(x){return x?.verified===true;}

function completeSupplierLegacy(x){
  const p=payloadOf(x),supplier=String(p.supplier||p.supplierName||x?.supplierName||'').trim(),platform=String(p.platform||x?.platform||'').trim(),url=sourceUrl(x)||String(p.url||'').trim();
  const unitPrice=n(p.unitPrice||p.quotedPrice||x?.quotedPrice),moq=n(p.moq||x?.moq),shipping=explicitNumber(p,'shippingRon')?n(p.shippingRon):NaN,sample=explicitNumber(p,'sampleCostRon')?n(p.sampleCostRon):(explicitNumber(p,'sampleCost')?n(p.sampleCost):NaN),lead=explicitNumber(p,'leadTimeDays')?n(p.leadTimeDays):NaN;
  return Boolean(supplier&&platform&&url&&unitPrice>0&&moq>0&&Number.isFinite(shipping)&&shipping>=0&&Number.isFinite(sample)&&sample>=0&&Number.isFinite(lead)&&lead>0);
}
function strictSupplierReady(x){const quote=x?.strictQuote&&typeof x.strictQuote==='object'?x.strictQuote:(x?.quote&&typeof x.quote==='object'?x.quote:null);if(!quote)return false;const v=verifySupplierQuote(quote);return v.verified===true&&v.evidenceStatus==='MANUALLY_VERIFIED_QUOTE';}
function privateSupplierReady(name,state){const records=Object.entries(state?.supplierRecords||{}).map(([key,value])=>({...((value&&typeof value==='object')?value:{}),__radarKey:key})).filter(x=>sameProduct(x,name));const offers=arr(state?.supplierOffers).filter(x=>sameProduct(x,name));const observations=arr(state?.observations).filter(x=>sameProduct(x,name)&&x.kind==='SUPPLIER_QUOTE'&&verifiedObservation(x));return [...records,...offers,...observations].some(x=>strictSupplierReady(x)||((x?.commercialVerified===true||x?.verified===true||x?.manualVerified===true||verifiedObservation(x))&&completeSupplierLegacy(x)));}
function privatePricingReady(name,state){const rows=arr(state?.observations).filter(x=>sameProduct(x,name)&&x.kind==='ROMANIA_PRICE'&&verifiedObservation(x));const valid=rows.filter(x=>n(payloadOf(x).priceRon)>0&&sourceUrl(x));return valid.length>=2&&new Set(valid.map(x=>domainOf(sourceUrl(x))).filter(Boolean)).size>=2;}
function privateReviewReady(name,state){const rows=arr(state?.observations).filter(x=>sameProduct(x,name)&&x.kind==='REVIEW_EVIDENCE'&&verifiedObservation(x)&&String(payloadOf(x).text||'').trim());return rows.length>=2&&new Set(rows.map(x=>String(x.sourceUrl||payloadOf(x).source||'manual').trim()).filter(Boolean)).size>=1;}
function actualSalesReady(name,state){return arr(state?.observations).some(x=>sameProduct(x,name)&&x.kind==='COMPETITOR_SALES'&&verifiedObservation(x)&&(n(payloadOf(x).units30d)>0||n(payloadOf(x).revenue30dRon)>0));}
function confirmedLanded(name,state){const records=state?.landedCosts||{};const direct=records[normalizeProductKey(name)]||Object.entries(records).find(([key,value])=>normalizeProductKey(key)===normalizeProductKey(name)||sameProduct(value,name))?.[1];if(!direct||direct.confirmed!==true)return null;const landed=n(direct.landedPerUnit||direct.landedCost||direct.unitLanded);return landed>0?{...direct,landedPerUnit:landed}:null;}
function targetSalePrice(p){return n(p?.profitEngineV2?.derivedSalePrice||p?.economics?.salePrice||p?.economics?.sell||p?.sellTarget||p?.sell||p?.testBuyDecision?.targetSalePrice);}

function latestMeasuredExecution(name,state){
  const rows=arr(state?.testExecutions).filter(x=>sameProduct(x,name)&&x?.status==='MEASURED'&&x?.outcome&&typeof x.outcome==='object');
  if(!rows.length)return null;
  return rows.sort((a,b)=>Date.parse(a.measuredAt||a.updatedAt||0)-Date.parse(b.measuredAt||b.updatedAt||0)).at(-1);
}
function legacyCommercialTest(name,state){
  const tests=arr(state?.observations).filter(x=>sameProduct(x,name)&&x.kind==='COMMERCIAL_TEST'&&verifiedObservation(x)).map(payloadOf);
  const complete=tests.filter(x=>x.completedAt&&n(x.quantity)>0&&explicitNumber(x,'unitsSold')&&n(x.unitLandedCostRon)>0&&n(x.salePriceRon)>0);
  if(!complete.length)return null;
  const x=complete.at(-1),sold=n(x.unitsSold),revenue=sold*n(x.salePriceRon),gross=revenue-sold*n(x.unitLandedCostRon)-n(x.adSpendRon)-n(x.returnCostRon);
  return {source:'LEGACY_COMMERCIAL_TEST',passed:n(x.quantity)>0&&sold/n(x.quantity)*100>=60&&revenue>0&&gross/revenue*100>=15&&sold>0&&gross/sold>0,testOutcome:'LEGACY_MEASURED',sellThroughPct:n(x.quantity)>0?sold/n(x.quantity)*100:0,actualMarginPct:revenue>0?gross/revenue*100:0,actualUnitProfitRon:sold>0?gross/sold:0,returnRatePct:null,measuredAt:x.completedAt};
}
function completedCommercialTest(name,state){
  const run=latestMeasuredExecution(name,state);
  if(run){
    const outcome=run.outcome||{},metrics=outcome.metrics||{},sold=n(run.unitsSold),profit=n(metrics.contributionProfitRon),status=String(outcome.status||'UNKNOWN');
    const evidenceComplete=Number.isFinite(Number(metrics.sellThroughPct))&&Number.isFinite(Number(metrics.netMarginPct))&&Number.isFinite(Number(metrics.contributionProfitRon));
    const passed=status==='TEST_PASS_CANDIDATE'&&evidenceComplete&&n(metrics.sellThroughPct)>=60&&n(metrics.netMarginPct)>=15&&profit>0&&sold>0;
    return {source:'TEST_EXECUTION',passed,testOutcome:status,sellThroughPct:evidenceComplete?n(metrics.sellThroughPct):null,actualMarginPct:evidenceComplete?n(metrics.netMarginPct):null,actualUnitProfitRon:sold>0?profit/sold:null,returnRatePct:Number.isFinite(Number(metrics.returnRatePct))?n(metrics.returnRatePct):null,measuredAt:run.measuredAt||run.updatedAt||null};
  }
  return legacyCommercialTest(name,state);
}

export function evaluateCommercialDecision(p={},state={}){
  const c=p.commercialHardening||{},baseGates=c.gates||{},roDemand=p.romaniaDemand||{},salesModel=p.salesEstimation||{};
  const demandReady=roDemand.readyForTestDemandGate===true||(p?.keywordDemand?.verifiedSearchVolume===true&&n(p?.keywordDemand?.searchVolume)>0);
  const actualSalesObserved=baseGates.salesVerified===true||actualSalesReady(p.name,state);
  const estimatedSalesReady=actualSalesObserved||(['ACTUAL_OBSERVED','ESTIMATED_HIGH_CONFIDENCE'].includes(String(salesModel.status||''))&&n(salesModel.estimatedUnits30d)>0&&n(salesModel.confidence)>=75);
  const pricingVerified=baseGates.pricingVerified===true||privatePricingReady(p.name,state),supplierVerified=baseGates.supplierVerified===true||privateSupplierReady(p.name,state),reviewVerified=baseGates.reviewVerified===true||privateReviewReady(p.name,state);
  const marketEvidence=Boolean(p?.launchScore?.enoughEvidence)&&p?.evidenceCoverage?.evidenceReady===true&&n(p?.competitors?.evidenceMarkets)>0,landed=confirmedLanded(p.name,state),sell=targetSalePrice(p),economics=landed&&sell>0?profitEngineV2({sellTarget:sell,confirmedLanded:landed.landedPerUnit}):null;
  const economicsHealthy=Boolean(landed&&economics?.priceComplete&&n(economics.margin)>=20&&n(economics.roi)>=45&&n(economics.profit)>0),confidenceReady=n(p?.dataConfidence?.overall)>=50,trendStatus=String(p?.trendIntelligence?.status||'').trim().toUpperCase(),trendSafe=Boolean(trendStatus)&&trendStatus!=='DECLINING';
  const gates={demandReady,pricingVerified,estimatedSalesReady,supplierVerified,reviewVerified,marketEvidence,economicsHealthy,confidenceReady,trendSafe};
  const labels={demandReady:'cerere România suficient validată pentru TEST',pricingVerified:'pricing România verificat',estimatedSalesReady:'sales estimate cu confidence ≥75 sau vânzări observate',supplierVerified:'ofertă furnizor completă și verificată',reviewVerified:'review evidence verificat',marketEvidence:'market evidence concret suficient',economicsHealthy:landed?'economics reale: marjă ≥20%, ROI ≥45%, profit pozitiv':'landed cost confirmat din costurile reale de import',confidenceReady:'Data Confidence ≥50',trendSafe:'trend verificat și non-declining'};
  const blockers=Object.entries(gates).filter(([,ok])=>!ok).map(([k])=>labels[k]),testReady=blockers.length===0,feedback=completedCommercialTest(p.name,state),buyReady=testReady&&feedback?.passed===true;
  let quantity=0;if(testReady&&!buyReady){quantity=20;if(n(p?.dataConfidence?.overall)>=60&&n(economics?.roi)>=60&&n(salesModel.confidence)>=80)quantity=25;if(n(p?.dataConfidence?.overall)>=70&&n(economics?.roi)>=80&&n(salesModel.confidence)>=85&&['RISING','ACCELERATING'].includes(String(p?.trendIntelligence?.status||'')))quantity=30;}
  const commercialAction=buyReady?'BUY':testReady?'TEST':'HOLD',status=buyReady?'BUY':testReady?'TEST_BUY':'HOLD',verdict=buyReady?'BUY — TEST REAL VALIDAT':testReady?`TEST — CUMPĂRĂ ${quantity} BUCĂȚI`:'NU TESTA ÎNCĂ';
  return {version:'3.1-private-real-outcome',status,commercialAction,verdict,quantity,gates,gateCount:9,passedGates:Object.values(gates).filter(Boolean).length,blockers,commercialReadiness:Math.round(Object.values(gates).filter(Boolean).length/9*100),unitLandedCost:landed?.landedPerUnit??null,landedCostConfirmed:Boolean(landed),targetSalePrice:sell||null,testBudget:testReady?quantity*n(landed?.landedPerUnit):null,expectedRevenue:testReady?quantity*sell:null,expectedGrossProfit:testReady?quantity*n(economics?.profit):null,confidenceScore:n(p?.dataConfidence?.overall),economics:economics?{profit:economics.profit,margin:economics.margin,roi:economics.roi,breakEvenSell:economics.breakEvenSell}:null,estimationEvidence:{salesEstimateStatus:salesModel.status||'UNKNOWN',estimatedUnits30d:salesModel.estimatedUnits30d??null,salesEstimateConfidence:salesModel.confidence??null,actualCompetitorSalesObserved:actualSalesObserved},buyGate:{completedRealTest:feedback?.passed===true,source:feedback?.source??null,testOutcome:feedback?.testOutcome??null,sellThroughPct:feedback?.sellThroughPct??null,actualMarginPct:feedback?.actualMarginPct??null,actualUnitProfitRon:feedback?.actualUnitProfitRon??null,returnRatePct:feedback?.returnRatePct??null,measuredAt:feedback?.measuredAt??null},nextAction:buyReady?'Planifică reaprovizionarea controlată folosind rezultatele reale ale testului.':blockers[0]||'Comandă lotul de test și înregistrează rezultatul real în Test Execution.',policy:'Private money gate: TEST requires verified supplier + confirmed landed cost + healthy economics. BUY additionally requires the latest measured real test to pass. A failed latest Test Execution blocks BUY and cannot be overridden by older legacy feedback.'};
}
