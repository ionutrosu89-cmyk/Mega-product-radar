import {buildProductFingerprint} from './product-fingerprint-v1.js';
import {matchMarketplaceToSupplier} from './marketplace-supplier-matching-v1.js';
import {calculateScreeningEconomics} from './screening-economics-v1.js';

const clean=v=>String(v??'').trim();
const positive=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
const latestSnapshot=listing=>Array.isArray(listing?.snapshots)&&listing.snapshots.length?listing.snapshots.at(-1):listing;
const norm=v=>clean(v).toLowerCase().replace(/[^a-z0-9ăâîșşțţ]+/giu,' ').replace(/\s+/g,' ').trim();
const tokens=v=>new Set(norm(v).split(' ').filter(x=>x.length>=3));
function titleOverlap(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/Math.min(A.size,B.size);}

export function generateSupplierCandidates(marketplaceListings=[],supplierListings=[],options={}){
  const minTitleOverlap=Number(options.minTitleOverlap??0.2);
  const maxPerMarketplace=Math.max(1,Number(options.maxPerMarketplace??10));
  const out=[];
  for(const m of marketplaceListings){
    const scored=[];
    for(const s of supplierListings){
      const overlap=titleOverlap(m.title,s.title);
      const categoryKnown=clean(m.category)&&clean(s.category);
      const categoryCompatible=!categoryKnown||norm(m.category)===norm(s.category);
      if(overlap<minTitleOverlap||!categoryCompatible)continue;
      scored.push({marketplaceListingKey:m.listingKey??m.externalProductId,supplierListingKey:s.supplierListingKey??s.supplierListingId,titleOverlap:Number(overlap.toFixed(4)),marketplace:m,supplier:s,evidenceClass:'SUPPLIER_CANDIDATE_PAIR_ONLY',truthPolicy:{candidatePairIsMatch:false}});
    }
    scored.sort((a,b)=>b.titleOverlap-a.titleOverlap);
    out.push(...scored.slice(0,maxPerMarketplace));
  }
  return out;
}

function marketplaceFingerprintInput(listing){
  const snap=latestSnapshot(listing);
  return {category:listing.category??snap?.category,productType:listing.productType,primaryFunction:listing.primaryFunction,packCount:listing.packCount,material:listing.material,dimensions:listing.dimensions,unitWeightGrams:listing.unitWeightGrams,capacityMl:listing.capacityMl,powerWatts:listing.powerWatts,voltage:listing.voltage,formFactor:listing.formFactor,technicalSpecs:listing.technicalSpecs,sourceTitle:listing.title??snap?.title};
}
function supplierFingerprintInput(listing){
  const meta=listing.structuredMetadata??{};
  return {category:listing.category,productType:listing.productType,primaryFunction:listing.primaryFunction,packCount:listing.packCount??meta.packCount,material:listing.material??meta.material,dimensions:listing.dimensions??meta.dimensions,unitWeightGrams:listing.unitWeightGrams??meta.weight,capacityMl:listing.capacityMl??meta.capacity,powerWatts:listing.powerWatts??meta.power,voltage:listing.voltage??meta.voltage,formFactor:listing.formFactor,technicalSpecs:listing.technicalSpecs,sourceTitle:listing.title};
}

export function runOpportunityFunnel(input={}){
  const marketplaceListings=Array.isArray(input.marketplaceListings)?input.marketplaceListings:[];
  const supplierListings=Array.isArray(input.supplierListings)?input.supplierListings:[];
  const assumptions=input.assumptions??{};
  const candidates=generateSupplierCandidates(marketplaceListings,supplierListings,input.candidateOptions);
  const matches=[];const screened=[];const blocked=[];
  for(const pair of candidates){
    const mp=buildProductFingerprint(marketplaceFingerprintInput(pair.marketplace));
    const sp=buildProductFingerprint(supplierFingerprintInput(pair.supplier));
    const match=matchMarketplaceToSupplier(mp,sp,{screeningThreshold:80});
    matches.push({...pair,match});
    if(!match.screeningEconomicsEligible)continue;
    const marketSnap=latestSnapshot(pair.marketplace);
    const supplierPrice=positive(pair.supplier.normalizedPublicUnitPrice??pair.supplier.publicPriceMax??pair.supplier.publicPriceMin);
    const sellPrice=positive(marketSnap?.price??pair.marketplace.price);
    const economicsInput={...assumptions,supplierUnitPriceRon:supplierPrice&&assumptions.supplierFxToRon?Number((supplierPrice*Number(assumptions.supplierFxToRon)).toFixed(4)):null,sellPriceGrossRon:sellPrice&&assumptions.marketplaceFxToRon?Number((sellPrice*Number(assumptions.marketplaceFxToRon)).toFixed(4)):null,matchConfidence:match.matchConfidence,supplierPriceEvidenceRef:clean(pair.supplier.sourceUrl),marketplacePriceEvidenceRef:clean(marketSnap?.sourceUrl??pair.marketplace.sourceUrl)};
    const economics=calculateScreeningEconomics(economicsInput);
    const row={marketplaceListingKey:pair.marketplaceListingKey,supplierListingKey:pair.supplierListingKey,marketplaceTitle:pair.marketplace.title,supplierTitle:pair.supplier.title,matchConfidence:match.matchConfidence,matchClass:match.matchClass,economics,sourceRefs:{marketplace:economicsInput.marketplacePriceEvidenceRef,supplier:economicsInput.supplierPriceEvidenceRef},evidenceClass:'PUBLIC_PRICE_OPPORTUNITY_SCREENING'};
    if(economics.status==='SCREENED')screened.push(row);else blocked.push(row);
  }
  screened.sort((a,b)=>{
    const A=a.economics.scenarios.conservative,B=b.economics.scenarios.conservative;
    return (B.roi??-Infinity)-(A.roi??-Infinity)||(B.netMargin??-Infinity)-(A.netMargin??-Infinity)||(b.matchConfidence-a.matchConfidence);
  });
  return {schemaVersion:'MPR_OPPORTUNITY_FUNNEL_V1',candidatePairCount:candidates.length,matchCount:matches.length,screeningEligibleMatchCount:matches.filter(x=>x.match.screeningEconomicsEligible).length,screenedCount:screened.length,blockedEconomicsCount:blocked.length,topOpportunities:screened.slice(0,Number(input.topN??100)),screened,blocked,truthPolicy:{candidatePairIsMatch:false,screeningEstimateIsConfirmedEconomics:false,publicSupplierListingIsVerifiedQuote:false,marketplacePriceIsRealizedSale:false,unknownEqualsZero:false,negotiatedPriceIncluded:false,purchaseAuthorized:false}};
}
