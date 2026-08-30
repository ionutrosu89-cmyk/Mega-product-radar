import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {buildFreeTop25LiveUniverse} from '../free-top25-live-v1.js';

async function readJson(path,fallback={}){
  try{return JSON.parse(await readFile(path,'utf8'));}catch{return fallback;}
}

const discovery=await readJson('discovery-live.json',{products:[]});
const organic=await readJson('organic-rising-live.json',{products:[]});
const amazonLive=await readJson('amazon-live-catalog.json',{products:[]});
const report=buildFreeTop25LiveUniverse({
  discoveryProducts:Array.isArray(discovery.products)?discovery.products:[],
  organicProducts:Array.isArray(organic.products)?organic.products:[],
  amazonLiveProducts:Array.isArray(amazonLive.products)?amazonLive.products:[]
});
const targetCompleteNiches=30;
const commercialReadiness={
  schema:'MPR_FREE_TOP25_MONETIZATION_COVERAGE_V1',
  generatedAt:new Date().toISOString(),
  pricingLocked:{free:0,discoverEur:17.90,radarEur:29,launchEur:89},
  targets:{minimumCompleteNichesForPaidBeta:targetCompleteNiches,productsPerNiche:25,minimumEligibleProductsAtTarget:targetCompleteNiches*25},
  inputs:{discoveryProducts:Array.isArray(discovery.products)?discovery.products.length:0,organicProducts:Array.isArray(organic.products)?organic.products.length:0,amazonLiveProducts:Array.isArray(amazonLive.products)?amazonLive.products.length:0},
  current:{
    eligibleCandidates:report.stats.eligibleCandidates,
    observedNicheCount:report.stats.observedNicheCount,
    completeNicheCount:report.stats.completeNicheCount,
    nearReadyNicheCount:report.stats.nearReadyNicheCount,
    top25EligibleProductSlots:report.stats.completeNicheCount*25,
    completeNicheDeficit:Math.max(0,targetCompleteNiches-report.stats.completeNicheCount)
  },
  decision:report.stats.completeNicheCount>=targetCompleteNiches?'FREE_TOP25_PAID_BETA_READY':'BUILD_COMMERCIAL_COVERAGE',
  truthPolicy:{
    onlyAcceptedLiveEvidenceCounts:true,
    incompleteNichesDoNotCountAsTop25:true,
    editorialFallbackDoesNotCountTowardCommercialCoverage:true,
    openFoodFactsCommercialUseNotAssumed:true,
    amazonLiveCatalogRequiresExactAsinBridge:true,
    amazonEngagementSignalIsNotSales:true,
    paidProviderSpendAuthorized:false,
    unknownEqualsZero:false,
    purchaseAuthorized:false
  },
  coverage:report.coverage
};
await mkdir('artifacts/free-top25-monetization-coverage',{recursive:true});
await writeFile('artifacts/free-top25-monetization-coverage/report.json',JSON.stringify(commercialReadiness,null,2)+'\n');
console.log(JSON.stringify(commercialReadiness,null,2));
