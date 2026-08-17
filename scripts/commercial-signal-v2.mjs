import fs from 'node:fs/promises';

const FILE='market-intelligence-live.json';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,num(v)));
const round=v=>Math.round(num(v)*10)/10;
const arr=v=>Array.isArray(v)?v:[];

const data=JSON.parse(await fs.readFile(FILE,'utf8'));
const products=arr(data.products);

function confidence(p){
  const evidence=clamp(p.evidenceCoverage?.coverageScore);
  const markets=clamp(num(p.competitors?.evidenceMarkets)*25);
  const trendSamples=clamp(num(p.trendIntelligence?.sampleCount)*12.5);
  const reviews=clamp(num(p.reviewIntelligenceV2?.sourceCount||p.reviews?.sourceCount)*20+num(p.reviewIntelligenceV2?.snippetCount||p.reviews?.snippetCount)*8);
  const supplier=clamp(num(p.chinaIntelligenceV2?.sources||p.sourcing?.sources)*20);
  const pricing=(p.profitEngineV2?.pricingVerified===true||p.economics?.pricingVerified===true)?100:0;
  const score=round(evidence*.25+markets*.20+trendSamples*.20+reviews*.15+supplier*.10+pricing*.10);
  return {score,level:score>=75?'HIGH':score>=55?'MEDIUM':'LOW',components:{evidence,markets,trendSamples,reviews,supplier,pricing}};
}

function commercialSignal(p){
  const c=confidence(p);
  const trend=String(p.trendIntelligence?.status||'INSUFFICIENT').toUpperCase();
  const gap=num(p.marketGap?.score);
  const economics=p.economics||{};
  const supplierSources=num(p.chinaIntelligenceV2?.sources||p.sourcing?.sources);
  const supplierChecked=p.sourcing?.requiresManualCommercialCheck===false;
  const independentEvidence=num(p.competitors?.evidenceMarkets)+num(p.reviewIntelligenceV2?.sourceCount||p.reviews?.sourceCount);
  const gates={
    confidence:c.score>=55,
    trend:['RISING','ACCELERATING'].includes(trend)&&num(p.trendIntelligence?.sampleCount)>=3,
    romaniaGap:gap>=70&&p.marketGap?.evidenceReady===true&&num(p.competitors?.evidenceMarkets)>0,
    economics:num(economics.margin)>=20&&num(economics.roi)>=45&&num(economics.profit)>0&&economics.pricingVerified===true,
    sourcing:supplierSources>0&&supplierChecked,
    independentEvidence:independentEvidence>=2
  };
  const failed=Object.entries(gates).filter(([,ok])=>!ok).map(([k])=>k);
  const test=failed.length===0;
  const buy=test&&c.score>=75&&num(p.trendIntelligence?.sampleCount)>=5&&num(economics.roi)>=70&&independentEvidence>=3;
  const earlyWarning=!test&&['RISING','ACCELERATING'].includes(trend)&&num(p.trendIntelligence?.sampleCount)>=2&&c.score>=40;
  return {version:'2.0',confidence:c,gates,blockers:failed,status:buy?'BUY':test?'TEST':earlyWarning?'EARLY_WARNING':'WATCH',commerciallyValidated:buy||test,proxyNotice:'Romania Gap, seller/result counts and open-web demand remain signals/proxies unless their evidence gates are satisfied.'};
}

for(const p of products){p.commercialSignalV2=commercialSignal(p);p.dataConfidenceV2=p.commercialSignalV2.confidence;}
const counts=s=>products.filter(p=>p.commercialSignalV2.status===s).length;
data.commercialSignalV2={version:'2.0',updatedAt:new Date().toISOString(),policy:'Evidence-first: ranking never promotes a product to TEST/BUY. TEST/BUY require trend, Romania Gap evidence, verified economics, sourcing and independent evidence.',stats:{test:counts('TEST'),buy:counts('BUY'),earlyWarnings:counts('EARLY_WARNING'),watch:counts('WATCH')}};
data.stats={...(data.stats||{}),commercialTest:counts('TEST'),commercialBuy:counts('BUY'),earlyWarnings:counts('EARLY_WARNING')};
data.updatedAt=new Date().toISOString();
await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
console.log(`Commercial Signal V2: TEST ${counts('TEST')}, BUY ${counts('BUY')}, Early Warning ${counts('EARLY_WARNING')}.`);
