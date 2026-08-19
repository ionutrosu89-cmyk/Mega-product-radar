import fs from 'node:fs/promises';
const FILE='market-intelligence-live.json';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const round=v=>Math.round(num(v)*10)/10;
const arr=v=>Array.isArray(v)?v:[];
const data=JSON.parse(await fs.readFile(FILE,'utf8'));
for(const p of arr(data.products)){
  const c=p.commercialHardening||{},g=c.gates||{},base=p.testBuyDecision||{};
  const roDemand=p?.romaniaDemand||{};
  const salesModel=p?.salesEstimation||{};
  const demandReady=roDemand.readyForTestDemandGate===true||(p?.keywordDemand?.verifiedSearchVolume===true&&num(p?.keywordDemand?.searchVolume)>0);
  const actualSalesObserved=g.salesVerified===true;
  const estimatedSalesReady=actualSalesObserved||(['ACTUAL_OBSERVED','ESTIMATED_HIGH_CONFIDENCE'].includes(String(salesModel.status||''))&&num(salesModel.estimatedUnits30d)>0&&num(salesModel.confidence)>=75);
  const marketEvidence=Boolean(p?.launchScore?.enoughEvidence)&&p?.evidenceCoverage?.evidenceReady===true&&num(p?.competitors?.evidenceMarkets)>0;
  const economicsHealthy=num(p?.economics?.margin)>=20&&num(p?.economics?.roi)>=45&&num(p?.economics?.profit)>0;
  const confidenceReady=num(p?.dataConfidence?.overall)>=50;
  const trendSafe=String(p?.trendIntelligence?.status||'').toUpperCase()!=='DECLINING';
  const gates={demandReady,pricingVerified:g.pricingVerified===true,estimatedSalesReady,supplierVerified:g.supplierVerified===true,reviewVerified:g.reviewVerified===true,marketEvidence,economicsHealthy,confidenceReady,trendSafe};
  const labels={demandReady:'cerere România suficient validată pentru TEST',pricingVerified:'pricing România verificat',estimatedSalesReady:'sales estimate cu confidence ≥75 sau vânzări observate',supplierVerified:'ofertă furnizor completă și verificată',reviewVerified:'review evidence verificat',marketEvidence:'market evidence concret suficient',economicsHealthy:'marjă ≥20%, ROI ≥45%, profit pozitiv',confidenceReady:'Data Confidence ≥50',trendSafe:'trendul nu este declining'};
  const blockers=Object.entries(gates).filter(([,ok])=>!ok).map(([k])=>labels[k]);
  const testReady=blockers.length===0;
  const feedback=c?.feedback?.latest||null;
  const completedRealTest=Boolean(feedback?.completedAt)&&num(feedback?.quantity)>0;
  const buyReady=testReady&&completedRealTest&&num(feedback?.sellThroughPct)>=60&&num(feedback?.actualMarginPct)>=15&&num(feedback?.actualUnitProfitRon)>0;
  let quantity=0;
  if(testReady&&!buyReady){quantity=20;if(num(p?.dataConfidence?.overall)>=60&&num(p?.economics?.roi)>=60&&num(salesModel.confidence)>=80)quantity=25;if(num(p?.dataConfidence?.overall)>=70&&num(p?.economics?.roi)>=80&&num(salesModel.confidence)>=85&&['RISING','ACCELERATING'].includes(String(p?.trendIntelligence?.status||'')))quantity=30;}
  const status=buyReady?'BUY':testReady?'TEST_BUY':'HOLD';
  const verdict=buyReady?'BUY — TEST REAL VALIDAT':testReady?`TEST — CUMPĂRĂ ${quantity} BUCĂȚI`:'NU TESTA ÎNCĂ';
  p.testBuyDecision={...base,version:'2.5',status,commercialAction:buyReady?'BUY':testReady?'TEST':'HOLD',verdict,quantity,gates,gateCount:Object.keys(gates).length,passedGates:Object.values(gates).filter(Boolean).length,blockers,estimationEvidence:{romaniaDemandStatus:roDemand.status||'UNKNOWN',romaniaDemandScore:roDemand.score??null,salesEstimateStatus:salesModel.status||'UNKNOWN',estimatedUnits30d:salesModel.estimatedUnits30d??null,salesEstimateRange:[salesModel.rangeLow??null,salesModel.rangeHigh??null],salesEstimateConfidence:salesModel.confidence??null,actualCompetitorSalesObserved:actualSalesObserved,policy:'TEST may use high-confidence estimated sales. Estimates are never relabelled as verified competitor sales.'},buyGate:{completedRealTest,sellThroughPct:feedback?.sellThroughPct??null,actualMarginPct:feedback?.actualMarginPct??null,actualUnitProfitRon:feedback?.actualUnitProfitRon??null,requirements:'BUY necesită TEST real finalizat, sell-through ≥60%, marjă reală ≥15% și profit/unitate pozitiv.'},nextAction:buyReady?'Planifică reaprovizionarea controlată folosind rezultatele reale ale testului.':blockers[0]||'Comandă lotul de test și înregistrează rezultatul real în Feedback Loop.',commercialReadiness:round(Object.values(gates).filter(Boolean).length/Object.keys(gates).length*100),policy:'TEST requires nine evidence gates, but competitor sales may be a high-confidence estimate rather than unknowable private actual sales. BUY still requires our own completed real commercial test. Proxies below the confidence threshold cannot satisfy TEST.'};
}
const tests=data.products.filter(p=>p?.testBuyDecision?.commercialAction==='TEST');
const buys=data.products.filter(p=>p?.testBuyDecision?.commercialAction==='BUY');
data.testBuyEngine={...(data.testBuyEngine||{}),version:'2.5',updatedAt:new Date().toISOString(),readyProducts:tests.length+buys.length,testReady:tests.length,buyReady:buys.length,policy:'TEST folosește demand validat + sales estimation HIGH confidence; BUY cere suplimentar performanță reală după lotul nostru de test.'};
data.stats={...(data.stats||{}),testBuyReady:tests.length+buys.length,commercialTestReady:tests.length,commercialBuyReady:buys.length};
data.updatedAt=new Date().toISOString();
await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
console.log(`Commercial final decision V2.5: TEST ${tests.length}, BUY ${buys.length}, total ${data.products.length}.`);
