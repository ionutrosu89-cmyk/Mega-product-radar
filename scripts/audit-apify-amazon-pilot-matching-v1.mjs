import fs from 'node:fs/promises';
import path from 'node:path';
import {adaptStructuredSupplierProviderRows} from '../structured-supplier-provider-adapter-v1.js';
import {generateSupplierCandidates,runOpportunityFunnel} from '../opportunity-funnel-v1.js';
import {buildProductFingerprint} from '../product-fingerprint-v1.js';
import {matchMarketplaceToSupplier} from '../marketplace-supplier-matching-v1.js';

const amazonPath=process.argv[2]||'artifacts/amazon-r1/scale-ledger.json';
const supplierRawPath=process.argv[3]||'artifacts/apify-recovery/raw.json';
const outDir=process.argv[4]||'artifacts/apify-amazon-matching-audit';
const amazon=JSON.parse(await fs.readFile(amazonPath,'utf8'));
const supplierRawDoc=JSON.parse(await fs.readFile(supplierRawPath,'utf8'));
const rawRows=Array.isArray(supplierRawDoc)?supplierRawDoc:(supplierRawDoc.rows??[]);
const supplierInput=adaptStructuredSupplierProviderRows(rawRows,{provider:'APIFY_MEMO23_ALIBABA_SCRAPER',platform:'ALIBABA',observedAt:'2026-08-29T19:00:40.581Z'});
const marketplaceListings=Array.isArray(amazon.listings)?amazon.listings:[];
const supplierListings=supplierInput.observations;
const candidates=generateSupplierCandidates(marketplaceListings,supplierListings,{minTitleOverlap:0.2,maxPerMarketplace:10});

const compact=[];
for(const pair of candidates){
  const mp=buildProductFingerprint({category:pair.marketplace.category,sourceTitle:pair.marketplace.title});
  const sp=buildProductFingerprint({category:pair.supplier.category,sourceTitle:pair.supplier.title});
  const match=matchMarketplaceToSupplier(mp,sp,{screeningThreshold:80});
  const snap=Array.isArray(pair.marketplace.snapshots)&&pair.marketplace.snapshots.length?pair.marketplace.snapshots.at(-1):pair.marketplace;
  compact.push({
    marketplaceListingKey:pair.marketplaceListingKey,
    amazonAsin:pair.marketplace.externalProductId??null,
    marketplaceTitle:pair.marketplace.title,
    marketplacePrice:snap?.price??null,
    marketplaceCurrency:snap?.currency??null,
    reviewCount:snap?.reviewCount??null,
    rating:snap?.rating??null,
    amazonDisplayedBoughtPastMonth:snap?.provenance?.amazonDisplayedBoughtPastMonth??null,
    supplierListingKey:pair.supplierListingKey,
    supplierTitle:pair.supplier.title,
    supplierPriceMin:pair.supplier.publicPriceMin??null,
    supplierPriceMax:pair.supplier.publicPriceMax??null,
    supplierCurrency:pair.supplier.currency??null,
    supplierMoq:pair.supplier.moq??null,
    supplierPriceTiers:pair.supplier.priceTiers??[],
    titleOverlap:pair.titleOverlap,
    matchConfidence:match.matchConfidence,
    matchClass:match.matchClass,
    screeningEconomicsEligible:match.screeningEconomicsEligible,
    evidenceCoverage:match.evidenceCoverage,
    hardMismatches:match.hardMismatches,
    evidence:match.evidence,
    sourceRefs:{marketplace:snap?.sourceUrl??pair.marketplace.sourceUrl??null,supplier:pair.supplier.sourceUrl??null},
    truthPolicy:{titleOverlapIsMatch:false,boughtPastMonthIsVerifiedSales:false,publicSupplierPriceIsVerifiedQuote:false}
  });
}
compact.sort((a,b)=>b.titleOverlap-a.titleOverlap||(b.amazonDisplayedBoughtPastMonth??0)-(a.amazonDisplayedBoughtPastMonth??0)||(b.reviewCount??0)-(a.reviewCount??0));
const eligible=compact.filter(x=>x.screeningEconomicsEligible);
const enrichmentQueue=compact.filter(x=>!x.screeningEconomicsEligible).slice(0,50).map((x,i)=>({...x,priority:i+1,requiredNextEvidence:['PRODUCT_TYPE','MATERIAL','DIMENSIONS_OR_TECHNICAL_SPECS','PACK_COUNT_WHERE_APPLICABLE']}));
const funnel=runOpportunityFunnel({marketplaceListings,supplierListings,candidateOptions:{minTitleOverlap:0.2,maxPerMarketplace:10},assumptions:{},topN:100});
const moqKnown=supplierListings.filter(x=>Number.isFinite(Number(x.moq))&&Number(x.moq)>0).length;
const tierKnown=supplierListings.filter(x=>Array.isArray(x.priceTiers)&&x.priceTiers.length>0).length;
const summary={
  schemaVersion:'MPR_APIFY_AMAZON_PILOT_MATCHING_AUDIT_V1',
  generatedAt:new Date().toISOString(),
  marketplaceListingCount:marketplaceListings.length,
  supplierListingCount:supplierListings.length,
  supplierMoqKnownCount:moqKnown,
  supplierTierPricingKnownCount:tierKnown,
  candidatePairCount:compact.length,
  maxTitleOverlap:compact.length?compact[0].titleOverlap:null,
  maxMatchConfidence:compact.length?Math.max(...compact.map(x=>x.matchConfidence)):null,
  screeningEligibleMatchCount:eligible.length,
  conservativeEconomicsScreenedCount:funnel.screenedCount,
  blockedEconomicsCount:funnel.blockedEconomicsCount,
  detailEnrichmentQueueCount:enrichmentQueue.length,
  topCandidatePairs:compact.slice(0,20),
  truthPolicy:{candidatePairIsMatch:false,titleSimilarityAloneIsSufficient:false,unknownEqualsZero:false,publicSupplierListingIsVerifiedQuote:false,marketplacePriceIsRealizedSale:false,reviewCountIsVerifiedSales:false,boughtPastMonthIsVerifiedSales:false,screeningEstimateIsConfirmedEconomics:false,purchaseAuthorized:false,negotiationIncluded:false}
};
await fs.mkdir(outDir,{recursive:true});
await fs.writeFile(path.join(outDir,'summary.json'),JSON.stringify(summary,null,2)+'\n');
await fs.writeFile(path.join(outDir,'candidate-pairs.json'),JSON.stringify({schemaVersion:'MPR_APIFY_AMAZON_CANDIDATE_PAIRS_V1',rows:compact},null,2)+'\n');
await fs.writeFile(path.join(outDir,'detail-enrichment-queue.json'),JSON.stringify({schemaVersion:'MPR_DETAIL_ENRICHMENT_QUEUE_V1',rows:enrichmentQueue},null,2)+'\n');
await fs.writeFile(path.join(outDir,'normalized-supplier-ledger-input.json'),JSON.stringify(supplierInput,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
