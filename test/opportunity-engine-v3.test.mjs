import assert from 'node:assert/strict';
import test from 'node:test';
import {calculateOpportunityV3,buildOpportunityRadarV3} from '../opportunity-engine-v3.js';

test('market opportunity requires trend and ready Romania Gap',()=>{
  const x=calculateOpportunityV3({trend:{score:80,confidence:70},romaniaGap:{status:'INCOMPLETE',score:null}});
  assert.equal(x.status,'INCOMPLETE');
  assert.equal(x.marketOpportunityScore,null);
  assert.ok(x.blockers.includes('ROMANIA_GAP_INCOMPLETE'));
  assert.equal(x.purchaseAuthorized,false);
});

test('strong trend and Romania gap can be high opportunity before supplier research',()=>{
  const x=calculateOpportunityV3({trend:{score:88,confidence:80},romaniaGap:{status:'READY',score:84}});
  assert.equal(x.status,'READY');
  assert.ok(x.marketOpportunityScore>=65);
  assert.equal(x.commercialMaturityScore,null);
  assert.equal(x.commercialStatus,'MARKET_ONLY');
  assert.equal(x.salesEvidenceClass,'NOT_VERIFIED_SALES');
});

test('supplier and economics increase commercial maturity but never authorize purchase',()=>{
  const x=calculateOpportunityV3({
    trend:{score:82,confidence:75},
    romaniaGap:{status:'READY',score:78},
    supplier:{quoteCount:4,benchmarkConfidence:70,documentationCoveragePct:80},
    economics:{marginPct:24,roiPct:65,profitPerUnit:18}
  });
  assert.equal(x.commercialStatus,'COMMERCIAL_CONTEXT_READY');
  assert.ok(x.commercialMaturityScore>0);
  assert.equal(x.purchaseAuthorized,false);
});

test('missing supplier fields remain unknown instead of zero maturity',()=>{
  const x=calculateOpportunityV3({trend:{score:75,confidence:65},romaniaGap:{status:'READY',score:72},supplier:{},economics:{}});
  assert.equal(x.status,'READY');
  assert.equal(x.commercialMaturityScore,null);
  assert.equal(x.commercialStatus,'MARKET_ONLY');
});

test('Radar prioritizes stronger market opportunity before commercial maturity',()=>{
  const r=buildOpportunityRadarV3([
    {productKey:'commercial-but-weaker',trend:{score:65,confidence:70},romaniaGap:{status:'READY',score:62},supplier:{quoteCount:5,benchmarkConfidence:90},economics:{marginPct:30,roiPct:100}},
    {productKey:'strong-market',trend:{score:92,confidence:85},romaniaGap:{status:'READY',score:88}},
    {productKey:'incomplete',trend:{score:95,confidence:90},romaniaGap:{status:'INCOMPLETE'}}
  ]);
  assert.equal(r.rows[0].productKey,'strong-market');
  assert.equal(r.rows.at(-1).productKey,'incomplete');
  assert.equal(r.paidCallsTriggered,0);
  assert.equal(r.purchaseAuthorized,false);
});
