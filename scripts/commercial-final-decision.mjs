import fs from 'node:fs/promises';
const FILE='market-intelligence-live.json';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=v=>Math.round(num(v)*10)/10;
const arr=v=>Array.isArray(v)?v:[];
const data=JSON.parse(await fs.readFile(FILE,'utf8'));
for(const p of arr(data.products)){
  const c=p.commercialHardening||{};
  const g=c.gates||{};
  const base=p.testBuyDecision||{};
  const demandVerified=p?.keywordDemand?.verifiedSearchVolume===true&&num(p?.keywordDemand?.searchVolume)>0;
  const marketEvidence=Boolean(p?.launchScore?.enoughEvidence)&&num(p?.competitors?.evidenceMarkets)>0;
  const economicsHealthy=num(p?.economics?.margin)>=20&&num(p?.economics?.roi)>=45&&num(p?.economics?.profit)>0;
  const confidenceReady=num(p?.dataConfidence?.overall)>=50;
  const trendSafe=String(p?.trendIntelligence?.status||'').toUpperCase()!=='DECLINING';
  const gates={
    demandVerified,
    pricingVerified:g.pricingVerified===true,
    salesVerified:g.salesVerified===true,
    supplierVerified:g.supplierVerified===true,
    reviewVerified:g.reviewVerified===true,
    marketEvidence,
    economicsHealthy,
    confidenceReady,
    trendSafe
  };
  const labels={demandVerified:'cerere România verificată',pricingVerified:'pricing România verificat',salesVerified:'dovadă de vânzare/velocity verificată',supplierVerified:'ofertă furnizor completă și verificată',reviewVerified:'review evidence verificat',marketEvidence:'market evidence suficient',economicsHealthy:'marjă ≥20%, ROI ≥45%, profit pozitiv',confidenceReady:'Data Confidence ≥50',trendSafe:'trendul nu este declining'};
  const blockers=Object.entries(gates).filter(([,ok])=>!ok).map(([k])=>labels[k]);
  const ready=blockers.length===0;
  let quantity=0;
  if(ready){quantity=20;if(num(p?.dataConfidence?.overall)>=60&&num(p?.economics?.roi)>=60)quantity=25;if(num(p?.dataConfidence?.overall)>=70&&num(p?.economics?.roi)>=80&&['RISING','ACCELERATING'].includes(String(p?.trendIntelligence?.status||'')))quantity=30;}
  p.testBuyDecision={...base,version:'2.0',status:ready?'TEST_BUY':'HOLD',verdict:ready?`TEST — CUMPĂRĂ ${quantity} BUCĂȚI`:'NU TESTA ÎNCĂ',quantity,gates,blockers,nextAction:blockers[0]||'Comandă lotul de test și înregistrează rezultatul real în Feedback Loop.',commercialReadiness:round(Object.values(gates).filter(Boolean).length/Object.keys(gates).length*100),policy:'V2 requires verified demand, Romania pricing, real sales/velocity evidence, supplier quote, reviews, market evidence, healthy economics, confidence and safe trend. Proxies cannot satisfy verified commercial gates.'};
}
const ready=data.products.filter(p=>p?.testBuyDecision?.status==='TEST_BUY');
data.testBuyEngine={...(data.testBuyEngine||{}),version:'2.0',updatedAt:new Date().toISOString(),readyProducts:ready.length,policy:'Commercial hardening gates are mandatory before TEST.'};
data.stats={...(data.stats||{}),testBuyReady:ready.length};
data.updatedAt=new Date().toISOString();
await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
console.log(`Commercial final decision: ${ready.length}/${data.products.length} TEST-ready.`);
