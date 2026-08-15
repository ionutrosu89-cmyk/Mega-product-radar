import fs from 'node:fs/promises';
const read=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const exists=async f=>{try{await fs.access(f);return true}catch{return false}};
const required=['radar-live.json','discovery-live.json','organic-rising-live.json','market-intelligence-live.json','market-intelligence-history.json','watchlist-live.json','alerts-live.json','validation-queue-live.json','data-confidence-live.json','action-center.html','validation-workflow-v2.html','product-decision.html','supplier-intelligence.html','review-intelligence-v2.html'];
const checks=[];
for(const f of required)checks.push({id:f,ok:await exists(f),weight:1});
const mi=await read('market-intelligence-live.json');
const products=Array.isArray(mi.products)?mi.products:[];
checks.push({id:'market-products',ok:products.length>0,weight:3});
checks.push({id:'decision-layer',ok:products.some(p=>p.launchScore&&p.opportunityRanking&&p.dataConfidence),weight:3});
checks.push({id:'supplier-layer',ok:products.some(p=>p.chinaIntelligenceV2||p.sourcing),weight:2});
checks.push({id:'review-layer',ok:products.some(p=>p.reviewIntelligenceV2||p.reviews),weight:2});
checks.push({id:'profit-layer',ok:products.some(p=>p.profitEngineV2||p.economics),weight:2});
checks.push({id:'trend-layer',ok:products.some(p=>p.trendIntelligence),weight:2});
const total=checks.reduce((s,x)=>s+x.weight,0),passed=checks.reduce((s,x)=>s+(x.ok?x.weight:0),0);
const technicalReadiness=Math.round(passed/total*100);
const keywordProviders=[...new Set(products.map(p=>p.demand?.provider||p.keywordDemand?.provider).filter(Boolean))];
const paidDemandActive=keywordProviders.some(x=>String(x).toUpperCase().includes('DATAFORSEO'));
const bottlenecks=[
 {area:'Demand Intelligence România',status:paidDemandActive?'ENRICHED':'PAID_DATA_REQUIRED',reason:paidDemandActive?'Provider comercial activ.':'Search volume/CPC/competition reale necesită provider comercial.'},
 {area:'Keyword Intelligence',status:paidDemandActive?'ENRICHED':'PAID_DATA_REQUIRED',reason:'Proxy-urile gratuite nu sunt suficiente pentru keyword volume verificat.'},
 {area:'Competitor depth',status:'FREE_LIMIT',reason:'Domeniile observate sunt utile, dar nu oferă sales estimate sau market share verificat.'},
 {area:'Marketplace sales estimates',status:'PAID_DATA_REQUIRED',reason:'Nu sunt inventate din pagini publice.'}
];
const report={version:'1.0',generatedAt:new Date().toISOString(),technicalReadiness,freeStage:technicalReadiness>=88?'FREE_READY_FOR_PAID_DATA':'FREE_WORK_REMAINS',paidDemandActive,keywordProviders,checks,bottlenecks,policy:'TEST/CUMPĂRĂ rămân independente de scorul de readiness; necunoscut nu este tratat ca zero.'};
await fs.writeFile('free-readiness-live.json',JSON.stringify(report,null,2)+'\n');
console.log(`Free readiness audit: ${technicalReadiness}% · ${report.freeStage}`);
if(technicalReadiness<88)process.exitCode=1;
