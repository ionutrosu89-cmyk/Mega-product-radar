import {profitEngineV2} from './profit-engine-v2.js';

const n=v=>Number.isFinite(Number(v))?Number(v):0;
const arr=v=>Array.isArray(v)?v:[];
const hasOwn=(o,k)=>Boolean(o&&Object.prototype.hasOwnProperty.call(o,k));
const explicitNumber=(o,k)=>hasOwn(o,k)&&o[k]!==''&&o[k]!==null&&Number.isFinite(Number(o[k]));

export const normalizeProductKey=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();

function sameProduct(record,name){return normalizeProductKey(record?.productName||record?.product||record?.name||record?.__radarKey)===normalizeProductKey(name);}
function sourceUrl(x){return String(x?.sourceUrl||x?.url||x?.payload?.sourceUrl||x?.payload?.url||'').trim();}
function domainOf(url){try{return new URL(url).hostname.replace(/^www\./,'').toLowerCase();}catch{return'';}}
function payloadOf(x){return x?.payload&&typeof x.payload==='object'?x.payload:x||{};}
function verifiedObservation(x){return x?.verified===true;}

function completeSupplier(x){
  const p=payloadOf(x);
  const supplier=String(p.supplier||p.supplierName||x?.supplierName||'').trim();
  const platform=String(p.platform||x?.platform||'').trim();
  const url=sourceUrl(x)||String(p.url||'').trim();
  const unitPrice=n(p.unitPrice||p.quotedPrice||x?.quotedPrice);
  const moq=n(p.moq||x?.moq);
  const shipping=explicitNumber(p,'shippingRon')?n(p.shippingRon):NaN;
  const sample=explicitNumber(p,'sampleCostRon')?n(p.sampleCostRon):(explicitNumber(p,'sampleCost')?n(p.sampleCost):NaN);
  const lead=explicitNumber(p,'leadTimeDays')?n(p.leadTimeDays):NaN;
  return Boolean(supplier&&platform&&url&&unitPrice>0&&moq>0&&Number.isFinite(shipping)&&shipping>=0&&Number.isFinite(sample)&&sample>=0&&Number.isFinite(lead)&&lead>0);
}

function privateSupplierReady(name,state){
  const records=Object.entries(state?.supplierRecords||{}).map(([key,value])=>({...((value&&typeof value==='object')?value:{}),__radarKey:key})).filter(x=>sameProduct(x,name));
  const offers=arr(state?.supplierOffers).filter(x=>sameProduct(x,name));
  const observations=arr(state?.observations).filter(x=>sameProduct(x,name)&&x.kind==='SUPPLIER_QUOTE'&&verifiedObservation(x));
  return [...records,...offers,...observations].some(x=>(x?.commercialVerified===true||x?.verified===true||x?.manualVerified===true||verifiedObservation(x))&&completeSupplier(x));
}

function privatePricingReady(name,state){
  const rows=arr(state?.observations).filter(x=>sameProduct(x,name)&&x.kind==='ROMANIA_PRICE'&&verifiedObservation(x));
  const valid=rows.filter(x=>n(payloadOf(x).priceRon)>0&&sourceUrl(x));
  return valid.length>=2&&new Set(valid.map(x=>domainOf(sourceUrl(x))).filter(Boolean)).size>=2;
}

function privateReviewReady(name,state){
  const rows=arr(state?.observations).filter(x=>sameProduct(x,name)&&x.kind==='REVIEW_EVIDENCE'&&verifiedObservation(x)&&String(payloadOf(x).text||'').trim());
  return rows.length>=2&&new Set(rows.map(x=>String(x.sourceUrl||payloadOf(x).source||'manual').trim()).filter(Boolean)).size>=1;
}

function actualSalesReady(name,state){
  return arr(state?.observations).some(x=>sameProduct(x,name)&&x.kind==='COMPETITOR_SALES'&&verifiedObservation(x)&&(n(payloadOf(x).units30d)>0||n(payloadOf(x).revenue30dRon)>0));
}

function confirmedLanded(name,state){
  const records=state?.landedCosts||{};
  const direct=records[normalizeProductKey(name)]||Object.entries(records).find(([key,value])=>normalizeProductKey(key)===normalizeProductKey(name)||sameProduct(value,name))?.[1];
  if(!direct||direct.confirmed!==true)return null;
  const landed=n(direct.landedPerUnit||direct.landedCost||direct.unitLanded);
  return landed>0?{...direct,landedPerUnit:landed}:null;
}

function targetSalePrice(p){return n(p?.profitEngineV2?.derivedSalePrice||p?.economics?.salePrice||p?.economics?.sell||p?.sellTarget||p?.sell||p?.testBuyDecision?.targetSalePrice);}

function completedCommercialTest(name,state){
  const tests=arr(state?.observations).filter(x=>sameProduct(x,name)&&x.kind==='COMMERCIAL_TEST'&&verifiedObservation(x)).map(payloadOf);
  const complete=tests.filter(x=>x.completedAt&&n(x.quantity)>0&&explicitNumber(x,'unitsSold')&&n(x.unitLandedCostRon)>0&&n(x.salePriceRon)>0);
  if(!complete.length)return null;
  const x=complete.at(-1),sold=n(x.unitsSold),revenue=sold*n(x.salePriceRon),gross=revenue-sold*n(x.unitLandedCostRon)-n(x.adSpendRon)-n(x.returnCostRon);
  return {...x,sellThroughPct:n(x.quantity)>0?sold/n(x.quantity)*100:0,actualMarginPct:revenue>0?gross/revenue*100:0,actualUnitProfitRon:sold>0?gross/sold:0};
}

export function evaluateCommercialDecision(p={},state={}){
  const c=p.commercialHardening||{},baseGates=c.gates||{},roDemand=p.romaniaDemand||{},salesModel=p.salesEstimation||{};
  const demandReady=roDemand.readyForTestDemandGate===true||(p?.keywordDemand?.verifiedSearchVolume===true&&n(p?.keywordDemand?.searchVolume)>0);
  const actualSalesObserved=baseGates.salesVerified===true||actualSalesReady(p.name,state);
  const estimatedSalesReady=actualSalesObserved||(['ACTUAL_OBSERVED','ESTIMATED_HIGH_CONFIDENCE'].includes(String(salesModel.status||''))&&n(salesModel.estimatedUnits30d)>0&&n(salesModel.confidence)>=75);
  const pricingVerified=baseGates.pricingVerified===true||privatePricingReady(p.name,state);
  const supplierVerified=baseGates.supplierVerified===true||privateSupplierReady(p.name,state);
  const reviewVerified=baseGates.reviewVerified===true||privateReviewReady(p.name,state);
  const marketEvidence=Boolean(p?.launchScore?.enoughEvidence)&&p?.evidenceCoverage?.evidenceReady===true&&n(p?.competitors?.evidenceMarkets)>0;
  const landed=confirmedLanded(p.name,state);
  const sell=targetSalePrice(p);
  const economics=landed&&sell>0?profitEngineV2({sellTarget:sell,confirmedLanded:landed.landedPerUnit}):null;
  const economicsHealthy=Boolean(landed&&economics?.priceComplete&&n(economics.margin)>=20&&n(economics.roi)>=45&&n(economics.profit)>0);
  const confidenceReady=n(p?.dataConfidence?.overall)>=50;
  const trendSafe=String(p?.trendIntelligence?.status||'').toUpperCase()!=='DECLINING';
  const gates={demandReady,pricingVerified,estimatedSalesReady,supplierVerified,reviewVerified,marketEvidence,economicsHealthy,confidenceReady,trendSafe};
  const labels={demandReady:'cerere România suficient validată pentru TEST',pricingVerified:'pricing România verificat',estimatedSalesReady:'sales estimate cu confidence ≥75 sau vânzări observate',supplierVerified:'ofertă furnizor completă și verificată',reviewVerified:'review evidence verificat',marketEvidence:'market evidence concret suficient',economicsHealthy:landed?'economics reale: marjă ≥20%, ROI ≥45%, profit pozitiv':'landed cost confirmat din costurile reale de import',confidenceReady:'Data Confidence ≥50',trendSafe:'trendul nu este declining'};
  const blockers=Object.entries(gates).filter(([,ok])=>!ok).map(([k])=>labels[k]);
  const testReady=blockers.length===0;
  const feedback=completedCommercialTest(p.name,state);
  const buyReady=testReady&&Boolean(feedback)&&n(feedback.sellThroughPct)>=60&&n(feedback.actualMarginPct)>=15&&n(feedback.actualUnitProfitRon)>0;
  let quantity=0;
  if(testReady&&!buyReady){quantity=20;if(n(p?.dataConfidence?.overall)>=60&&n(economics?.roi)>=60&&n(salesModel.confidence)>=80)quantity=25;if(n(p?.dataConfidence?.overall)>=70&&n(economics?.roi)>=80&&n(salesModel.confidence)>=85&&['RISING','ACCELERATING'].includes(String(p?.trendIntelligence?.status||'')))quantity=30;}
  const commercialAction=buyReady?'BUY':testReady?'TEST':'HOLD';
  const status=buyReady?'BUY':testReady?'TEST_BUY':'HOLD';
  const verdict=buyReady?'BUY — TEST REAL VALIDAT':testReady?`TEST — CUMPĂRĂ ${quantity} BUCĂȚI`:'NU TESTA ÎNCĂ';
  return {version:'3.0-private',status,commercialAction,verdict,quantity,gates,gateCount:9,passedGates:Object.values(gates).filter(Boolean).length,blockers,commercialReadiness:Math.round(Object.values(gates).filter(Boolean).length/9*100),unitLandedCost:landed?.landedPerUnit??null,landedCostConfirmed:Boolean(landed),targetSalePrice:sell||null,testBudget:testReady?quantity*n(landed?.landedPerUnit):null,expectedRevenue:testReady?quantity*sell:null,expectedGrossProfit:testReady?quantity*n(economics?.profit):null,confidenceScore:n(p?.dataConfidence?.overall),economics:economics?{profit:economics.profit,margin:economics.margin,roi:economics.roi,breakEvenSell:economics.breakEvenSell}:null,estimationEvidence:{salesEstimateStatus:salesModel.status||'UNKNOWN',estimatedUnits30d:salesModel.estimatedUnits30d??null,salesEstimateConfidence:salesModel.confidence??null,actualCompetitorSalesObserved:actualSalesObserved},buyGate:{completedRealTest:Boolean(feedback),sellThroughPct:feedback?.sellThroughPct??null,actualMarginPct:feedback?.actualMarginPct??null,actualUnitProfitRon:feedback?.actualUnitProfitRon??null},nextAction:buyReady?'Planifică reaprovizionarea controlată folosind rezultatele reale ale testului.':blockers[0]||'Comandă lotul de test și înregistrează rezultatul real în Feedback Loop.',policy:'Private money gate: TEST requires the same nine evidence gates plus economics recalculated from a confirmed private landed cost. Missing private cost data never inherits an estimated landed cost as confirmed.'};
}
