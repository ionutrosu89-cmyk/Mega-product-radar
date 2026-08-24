import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateRomaniaMarketGap,buildRomaniaGapRadar} from '../romania-market-gap-v1.js';

test('Romania Gap fails closed when local demand is missing',()=>{
  const x=calculateRomaniaMarketGap({
    globalTrend:{score:82,confidence:70},
    romaniaDemand:{},
    romaniaCompetition:{sellerCount:8,listingCount:20}
  });
  assert.equal(x.status,'INCOMPLETE');
  assert.equal(x.score,null);
  assert.ok(x.blockers.includes('ROMANIA_DEMAND_MISSING'));
  assert.equal(x.purchaseAuthorized,false);
});

test('strong global trend plus local demand and low competition produces high gap',()=>{
  const x=calculateRomaniaMarketGap({
    globalTrend:{score:88,confidence:80},
    romaniaDemand:{searchVolume:2400,trendGrowthPct:45,providerVerified:true},
    romaniaCompetition:{sellerCount:6,listingCount:14,saturationScore:20,competitionVerified:true}
  });
  assert.equal(x.status,'READY');
  assert.ok(x.score>=65);
  assert.ok(['HIGH','VERY_HIGH'].includes(x.band));
  assert.equal(x.verification,'STRONG_LOCAL_EVIDENCE');
  assert.equal(x.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('heavy Romania saturation reduces opportunity score',()=>{
  const base={globalTrend:{score:85,confidence:80},romaniaDemand:{searchVolume:3000,trendGrowthPct:40,providerVerified:true}};
  const low=calculateRomaniaMarketGap({...base,romaniaCompetition:{sellerCount:5,listingCount:15,saturationScore:15}});
  const high=calculateRomaniaMarketGap({...base,romaniaCompetition:{sellerCount:60,listingCount:200,saturationScore:95}});
  assert.equal(low.status,'READY');
  assert.equal(high.status,'READY');
  assert.ok(low.score>high.score);
});

test('legacy or derived inputs never become verified sales or purchase authorization',()=>{
  const x=calculateRomaniaMarketGap({
    globalTrend:{score:75,confidence:60},
    romaniaDemand:{searchVolume:1000},
    romaniaCompetition:{sellerCount:10}
  });
  assert.equal(x.evidenceClass,'DERIVED_FROM_OBSERVED_INPUTS');
  assert.equal(x.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(x.purchaseAuthorized,false);
});

test('Radar sorts ready opportunities ahead of incomplete rows',()=>{
  const radar=buildRomaniaGapRadar([
    {productKey:'incomplete',globalTrend:{score:90,confidence:90},romaniaDemand:{},romaniaCompetition:{sellerCount:4}},
    {productKey:'good',globalTrend:{score:85,confidence:80},romaniaDemand:{searchVolume:2200,trendGrowthPct:30},romaniaCompetition:{sellerCount:7,listingCount:18}},
    {productKey:'weak',globalTrend:{score:50,confidence:55},romaniaDemand:{searchVolume:300},romaniaCompetition:{sellerCount:40,listingCount:140}}
  ]);
  assert.equal(radar.ready,2);
  assert.equal(radar.incomplete,1);
  assert.equal(radar.rows[0].productKey,'good');
  assert.equal(radar.rows.at(-1).productKey,'incomplete');
  assert.equal(radar.paidCallsTriggered,0);
});
