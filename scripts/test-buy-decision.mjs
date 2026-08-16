import fs from 'node:fs/promises';

const FILE='market-intelligence-live.json';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=v=>Math.round(num(v)*10)/10;
const arr=v=>Array.isArray(v)?v:[];

const data=JSON.parse(await fs.readFile(FILE,'utf8'));
const products=arr(data.products);

function buildDecision(p){
  const kd=p.keywordDemand||{};
  const profit=p.profitEngineV2||{};
  const sourcing=p.sourcing||{};
  const china=p.chinaIntelligenceV2||{};
  const reviews=p.reviewIntelligenceV2||{};
  const conf=p.dataConfidence||{};
  const trend=String(p.trendIntelligence?.status||'INSUFICIENT').toUpperCase();
  const economics=p.economics||{};

  const demandVerified=kd.verifiedSearchVolume===true && num(kd.searchVolume)>0;
  const pricingVerified=profit.pricingVerified===true || economics.pricingVerified===true;
  const supplierObserved=num(china.sources||sourcing.sources)>0;
  const supplierCommerciallyChecked=sourcing.requiresManualCommercialCheck===false;
  const supplierReady=supplierObserved && supplierCommerciallyChecked;
  const reviewEvidence=num(reviews.sourceCount)>0 && num(reviews.snippetCount)>=2;
  const marketEvidence=Boolean(p.launchScore?.enoughEvidence) && num(p.competitors?.evidenceMarkets)>0;
  const economicsHealthy=num(economics.margin)>=20 && num(economics.roi)>=45 && num(economics.profit)>0;
  const confidenceReady=num(conf.overall)>=50;
  const trendSafe=trend!=='DECLINING';

  const gates={
    demandVerified,
    pricingVerified,
    supplierReady,
    reviewEvidence,
    marketEvidence,
    economicsHealthy,
    confidenceReady,
    trendSafe
  };

  const labels={
    demandVerified:'cerere România verificată',
    pricingVerified:'preț de vânzare și landed cost verificate',
    supplierReady:'furnizor + MOQ/preț/transport confirmate comercial',
    reviewEvidence:'review evidence suficient',
    marketEvidence:'dovezi piață și competiție suficiente',
    economicsHealthy:'marjă ≥20%, ROI ≥45% și profit/unitate pozitiv',
    confidenceReady:'Data Confidence minimum MEDIE',
    trendSafe:'trendul nu este DECLINING'
  };

  const blockers=Object.entries(gates).filter(([,ok])=>!ok).map(([key])=>labels[key]);
  const ready=blockers.length===0;
  let quantity=0;
  if(ready){
    quantity=20;
    if(num(conf.overall)>=60 && num(economics.roi)>=60) quantity=25;
    if(num(conf.overall)>=70 && num(economics.roi)>=80 && ['RISING','ACCELERATING'].includes(trend)) quantity=30;
  }

  const landed=round(profit.derivedLandedCost||0);
  const sale=round(profit.derivedSalePrice||0);
  const unitProfit=round(economics.profit||0);
  const testBudget=ready?round(landed*quantity):0;
  const expectedRevenue=ready?round(sale*quantity):0;
  const expectedGrossProfit=ready?round(unitProfit*quantity):0;
  const status=ready?'TEST_BUY':'HOLD';
  const verdict=ready?`TEST — CUMPĂRĂ ${quantity} BUCĂȚI`:'NU TESTA ÎNCĂ';

  return {
    version:'1.0',
    status,
    verdict,
    quantity,
    unitLandedCost:landed,
    targetSalePrice:sale,
    unitProfit,
    testBudget,
    expectedRevenue,
    expectedGrossProfit,
    demandSearchVolume:demandVerified?num(kd.searchVolume):null,
    confidence:conf.level||'SCĂZUTĂ',
    confidenceScore:round(conf.overall),
    gates,
    blockers,
    nextAction:blockers[0]||'Comandă lotul de test și urmărește conversia, retururile și viteza de vânzare.',
    policy:'Recomandarea TEST se emite numai după confirmarea cererii, pricingului, furnizorului, review-urilor, dovezilor de piață și economiei. Cantitatea este limitată la 20–30 bucăți.'
  };
}

for(const p of products)p.testBuyDecision=buildDecision(p);
const ready=products.filter(p=>p.testBuyDecision?.status==='TEST_BUY');
data.testBuyEngine={
  version:'1.0',
  updatedAt:new Date().toISOString(),
  readyProducts:ready.length,
  policy:'Loturile de test sunt limitate la 20–30 bucăți și necesită toate gate-urile comerciale.'
};
data.stats={...(data.stats||{}),testBuyReady:ready.length};
data.updatedAt=new Date().toISOString();
await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
console.log(`Test Buy Decision: ${ready.length}/${products.length} produse gata pentru lot de 20–30 bucăți.`);
