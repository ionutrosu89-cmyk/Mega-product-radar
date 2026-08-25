import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLandedEconomicsPacket } from '../landed-economics-packet-v1.js';

const complete={supplierEvidenceLevel:'MANUALLY_VERIFIED',landedUnitCost:20,sellPrice:100,marketplaceCommissionRate:0.15,vatRate:0.19,adsRate:0.1,returnsReserveRate:0.05,fulfilmentCostPerUnit:5,landedCostEvidenceRef:'landed-1',sellPriceEvidenceRef:'market-1',currency:'RON',baseCurrency:'RON',fixedTestCost:200};

test('confirmed economics requires manually verified supplier evidence and explicit costs',()=>{
 const x=buildLandedEconomicsPacket(complete);
 assert.equal(x.confirmed,true);
 assert.equal(x.status,'CONFIRMED');
 assert.equal(x.economics.profitPerUnit,36);
 assert.equal(Math.round(x.economics.marginPct),36);
 assert.equal(Math.round(x.economics.roiPct),180);
 assert.equal(x.purchaseAuthorized,false);
});

test('supplier-stated evidence blocks economics',()=>{
 const x=buildLandedEconomicsPacket({...complete,supplierEvidenceLevel:'SUPPLIER_STATED'});
 assert.equal(x.confirmed,false);
 assert.ok(x.blockers.includes('SUPPLIER_NOT_MANUALLY_VERIFIED'));
 assert.equal(x.profitPerUnit,null);
});

test('null never becomes zero for required costs',()=>{
 const x=buildLandedEconomicsPacket({...complete,adsRate:null});
 assert.equal(x.confirmed,false);
 assert.ok(x.blockers.includes('ADS_RATE_UNKNOWN'));
 assert.equal(x.marginPct,null);
});

test('FX conversion requires rate and source',()=>{
 const x=buildLandedEconomicsPacket({...complete,currency:'USD',baseCurrency:'RON',fxRate:null,fxSource:null});
 assert.equal(x.confirmed,false);
 assert.ok(x.blockers.includes('FX_RATE_UNKNOWN'));
 assert.ok(x.blockers.includes('FX_SOURCE_UNKNOWN'));
});
