import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeMarketEvidence,calculateRomaniaMarketGapV2,buildRomaniaGapMultiMarketRadar} from '../romania-market-gap-v2.js';

const at='2026-08-25T04:30:00Z';
const key='UNDER_DESK_CABLE_ORGANIZERS';

test('seller-scoped eMAG and Trendyol data cannot feed market-wide Romania Gap',()=>{
  const x=calculateRomaniaMarketGapV2({
    marketEvidence:[
      {platform:'EMAG',scope:'AUTHORIZED_SELLER_ACCOUNT_ONLY',sellerScoped:true,evidenceType:'SELLER_API',observedAt:at,listingCount:10,manualReviewed:true},
      {platform:'TRENDYOL',scope:'AUTHORIZED_SELLER_ACCOUNT_ONLY',sellerScoped:true,evidenceType:'SELLER_API',observedAt:at,listingCount:20,manualReviewed:true},
      {platform:'AMAZON',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_RANKING',rank:5,observedAt:at,manualReviewed:true,confidence:70}
    ],
    romaniaDemand:{searchVolume:1200,providerVerified:true}
  });
  assert.equal(x.status,'INCOMPLETE');
  assert.deepEqual(x.provenance.romaniaPublicPlatforms,[]);
  assert.deepEqual(x.provenance.rejectedScopedPlatforms.sort(),['EMAG','TRENDYOL']);
  assert.ok(x.blockers.includes('ROMANIA_COMPETITION_MISSING'));
  assert.equal(x.purchaseAuthorized,false);
});

test('reviewed comparable eMAG plus Trendyol evidence can form local competition component',()=>{
  const x=calculateRomaniaMarketGapV2({
    marketEvidence:[
      {platform:'AMAZON',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_RANKING',rank:8,observedAt:at,manualReviewed:true,confidence:65},
      {platform:'EBAY',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_RANKING',rank:12,observedAt:at,manualReviewed:true,confidence:60},
      {platform:'EMAG',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_MARKET_SIGNAL',listingCount:15,sellerCount:8,observedAt:at,manualReviewed:true,comparabilityKey:key,comparableScopeConfirmed:true},
      {platform:'TRENDYOL',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_MARKET_SIGNAL',listingCount:10,sellerCount:6,observedAt:at,manualReviewed:true,comparabilityKey:key,comparableScopeConfirmed:true}
    ],
    romaniaDemand:{searchVolume:1800,trendGrowthPct:30,providerVerified:true}
  });
  assert.equal(x.status,'READY');
  assert.equal(x.version,'2.1');
  assert.equal(x.confidenceClass,'MULTI_MARKET_STRONG');
  assert.equal(x.provenance.romaniaComparabilityKey,key);
  assert.deepEqual(x.provenance.globalDemandPlatforms.sort(),['AMAZON','EBAY']);
  assert.deepEqual(x.provenance.romaniaPublicPlatforms.sort(),['EMAG','TRENDYOL']);
  assert.equal(x.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('non-comparable local scopes are never summed and force Romania Gap incomplete',()=>{
  const x=calculateRomaniaMarketGapV2({
    marketEvidence:[
      {platform:'AMAZON',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_RANKING',rank:8,observedAt:at,manualReviewed:true,confidence:65},
      {platform:'EMAG',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_MARKET_SIGNAL',listingCount:15,observedAt:at,manualReviewed:true,comparabilityKey:'PACKING_CUBES',comparableScopeConfirmed:true},
      {platform:'TRENDYOL',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_MARKET_SIGNAL',listingCount:656,observedAt:at,manualReviewed:true,comparabilityKey:'TRAVEL_ORGANIZERS_BROAD',comparableScopeConfirmed:true}
    ],
    romaniaDemand:{searchVolume:1800,trendGrowthPct:30,providerVerified:true}
  });
  assert.equal(x.status,'INCOMPLETE');
  assert.equal(x.score,null);
  assert.equal(x.confidenceClass,'INSUFFICIENT');
  assert.ok(x.blockers.includes('ROMANIA_COMPARABLE_PLATFORM_PAIR_MISSING'));
});

test('lower-bound-only local evidence cannot become exact competition',()=>{
  const x=calculateRomaniaMarketGapV2({
    marketEvidence:[
      {platform:'AMAZON',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_RANKING',rank:8,observedAt:at,manualReviewed:true,confidence:65},
      {platform:'EMAG',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_MARKET_SIGNAL',listingCountLowerBound:12,listingCount:null,observedAt:at,manualReviewed:true,comparabilityKey:key,comparableScopeConfirmed:true},
      {platform:'TRENDYOL',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_MARKET_SIGNAL',listingCountLowerBound:12,listingCount:null,observedAt:at,manualReviewed:true,comparabilityKey:key,comparableScopeConfirmed:true}
    ],
    romaniaDemand:{searchVolume:1800,providerVerified:true}
  });
  assert.equal(x.status,'INCOMPLETE');
  assert.ok(x.blockers.includes('ROMANIA_COMPARABLE_EXACT_COMPETITION_VALUES_MISSING'));
});

test('public signal requires manual review and observation timestamp',()=>{
  const unreviewed=normalizeMarketEvidence({platform:'EMAG',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_MARKET_SIGNAL',listingCount:3,observedAt:at,comparabilityKey:key,comparableScopeConfirmed:true});
  assert.equal(unreviewed.localMarketEligible,false);
  const undated=normalizeMarketEvidence({platform:'EMAG',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_MARKET_SIGNAL',listingCount:3,manualReviewed:true,comparabilityKey:key,comparableScopeConfirmed:true});
  assert.equal(undated.localMarketEligible,false);
});

test('AliExpress and SHEIN are confirmations only, not substitutes for Amazon/eBay demand ranking',()=>{
  const x=calculateRomaniaMarketGapV2({
    marketEvidence:[
      {platform:'ALIEXPRESS',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_MARKET_SIGNAL',trendScore:90,observedAt:at,manualReviewed:true},
      {platform:'SHEIN',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_MARKET_SIGNAL',trendScore:90,observedAt:at,manualReviewed:true},
      {platform:'EMAG',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_MARKET_SIGNAL',listingCount:5,observedAt:at,manualReviewed:true,comparabilityKey:key,comparableScopeConfirmed:true}
    ],
    romaniaDemand:{searchVolume:900,providerVerified:true}
  });
  assert.equal(x.status,'INCOMPLETE');
  assert.deepEqual(x.provenance.globalDemandPlatforms,[]);
  assert.deepEqual(x.provenance.hybridConfirmationPlatforms.sort(),['ALIEXPRESS','SHEIN']);
  assert.ok(x.blockers.includes('GLOBAL_TREND_MISSING'));
});

test('latest observation per marketplace is used and duplicate platform does not inflate independence',()=>{
  const x=calculateRomaniaMarketGapV2({
    marketEvidence:[
      {platform:'AMAZON',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_RANKING',rank:30,observedAt:'2026-08-24T04:30:00Z',manualReviewed:true,confidence:60},
      {platform:'AMAZON',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_RANKING',rank:5,observedAt:at,manualReviewed:true,confidence:70},
      {platform:'EMAG',scope:'MARKET_WIDE',marketWide:true,evidenceType:'PUBLIC_MARKET_SIGNAL',listingCount:5,observedAt:at,manualReviewed:true,comparabilityKey:key,comparableScopeConfirmed:true}
    ],
    romaniaDemand:{searchVolume:1000,providerVerified:true}
  });
  assert.equal(x.status,'INCOMPLETE');
  assert.equal(x.provenance.independentPlatformCount,2);
  assert.equal(x.provenance.globalDemandPlatforms.length,1);
  assert.ok(x.blockers.includes('ROMANIA_COMPARABLE_PLATFORM_PAIR_MISSING'));
});

test('radar remains decision intelligence only',()=>{
  const r=buildRomaniaGapMultiMarketRadar([]);
  assert.equal(r.version,'2.1');
  assert.equal(r.purchaseAuthorized,false);
  assert.equal(r.paidCallsTriggered,0);
});
