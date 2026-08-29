import fs from 'node:fs/promises';
import path from 'node:path';
import {buildProductFingerprint} from '../product-fingerprint-v1.js';
import {matchMarketplaceToSupplier} from '../marketplace-supplier-matching-v1.js';

const fusionPath=process.argv[2]||'artifacts/fusion/post-detail-fusion-match.json';
const corroborationPath=process.argv[3]||'data/v2-secondary-public-corroboration-b09k5927b5.json';
const outPath=process.argv[4]||'artifacts/secondary-corroborated-match.json';
const [fusion,corroboration]=await Promise.all([
  fs.readFile(fusionPath,'utf8').then(JSON.parse),
  fs.readFile(corroborationPath,'utf8').then(JSON.parse)
]);
if(corroboration.evidenceClass!=='SECONDARY_PUBLIC_CORROBORATION'||corroboration.directMarketplaceObservation!==false)throw new Error('INVALID_SECONDARY_EVIDENCE_CLASS');
if(corroboration.truthPolicy?.secondaryEvidenceIsDirectAmazonEvidence!==false)throw new Error('SECONDARY_PROMOTED_TO_DIRECT');
if(corroboration.truthPolicy?.purchaseAuthorized!==false)throw new Error('PURCHASE_AUTHORIZATION_FORBIDDEN');
const asin=String(corroboration.externalProductId||'');
const target=(fusion.rows||[]).find(x=>String(x.amazonAsin)===asin&&String(x.supplierListingKey)==='1601573810318');
if(!target)throw new Error('TARGET_PAIR_NOT_FOUND');
const c=corroboration.corroboratedAttributes||{};
const existing=target.amazonEvidence||{};
const marketplaceInput={
  category:existing.category,
  productType:c.productType??existing.productType,
  primaryFunction:c.primaryFunction??existing.primaryFunction,
  packCount:c.packCount??existing.packCount,
  material:c.material??existing.material,
  dimensions:c.dimensions??existing.dimensions,
  unitWeightGrams:existing.unitWeightGrams,
  capacityMl:existing.capacityMl,
  powerWatts:existing.powerWatts,
  voltage:existing.voltage,
  formFactor:c.formFactor??existing.formFactor,
  technicalSpecs:{...(existing.technicalSpecs||{}),...(c.technicalSpecs||{})},
  sourceTitle:target.marketplaceTitle
};
const supplierInput={...(target.supplierEvidence||{}),sourceTitle:target.supplierTitle};
const match=matchMarketplaceToSupplier(buildProductFingerprint(marketplaceInput),buildProductFingerprint(supplierInput),{screeningThreshold:80});
const output={
  schemaVersion:'MPR_SECONDARY_CORROBORATED_MATCH_V1',generatedAt:new Date().toISOString(),
  target:{amazonAsin:asin,supplierListingKey:String(target.supplierListingKey),marketplaceTitle:target.marketplaceTitle,supplierTitle:target.supplierTitle,marketplacePrice:target.marketplacePrice,supplierPriceMax:target.supplierPriceMax,supplierMoq:target.supplierMoq,supplierPriceTiers:target.supplierPriceTiers},
  marketplaceFingerprintEvidence:marketplaceInput,supplierFingerprintEvidence:supplierInput,match,
  evidenceRefs:{secondary:corroboration.sources,supplierDetailRunId:'33270914349',postDetailFusionRunId:'33271253483'},
  truthPolicy:{secondaryEvidenceIsDirectAmazonEvidence:false,secondaryEvidenceIsVerifiedSale:false,secondaryEvidenceProvesCrossMarketIdentityByItself:false,publicSupplierDetailIsVerifiedQuote:false,unknownEqualsZero:false,matchingThresholdRelaxed:false,purchaseAuthorized:false,negotiationIncluded:false},
  policy:{paidCallsTriggered:0,providerSpendUsd:0,screeningThreshold:80}
};
await fs.mkdir(path.dirname(outPath),{recursive:true});
await fs.writeFile(outPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({amazonAsin:asin,supplierListingKey:target.supplierListingKey,matchConfidence:match.matchConfidence,matchClass:match.matchClass,screeningEconomicsEligible:match.screeningEconomicsEligible,hardMismatches:match.hardMismatches,evidenceCoverage:match.evidenceCoverage,paidCallsTriggered:0,providerSpendUsd:0},null,2));
