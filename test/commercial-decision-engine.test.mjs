import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCommercialDecision,normalizeProductKey} from '../commercial-decision-engine.js';

function product(){return{
  name:'Under desk headphone hanger clamp',
  romaniaDemand:{readyForTestDemandGate:true},
  commercialHardening:{gates:{pricingVerified:true,salesVerified:false,supplierVerified:false,reviewVerified:true}},
  salesEstimation:{status:'ESTIMATED_HIGH_CONFIDENCE',estimatedUnits30d:220,confidence:82},
  launchScore:{enoughEvidence:true},evidenceCoverage:{evidenceReady:true},competitors:{evidenceMarkets:2},
  dataConfidence:{overall:68},trendIntelligence:{status:'RISING'},profitEngineV2:{derivedSalePrice:100}
};}
function state(){const key=normalizeProductKey('Under desk headphone hanger clamp');return{
  supplierRecords:{[key]:{productName:'Under desk headphone hanger clamp',supplierName:'Verified Supplier',platform:'Alibaba',url:'https://example.com/offer',quotedPrice:10,moq:20,shippingRon:80,sampleCost:25,leadTimeDays:12,verified:true,commercialVerified:true}},
  supplierOffers:[],observations:[],
  landedCosts:{[key]:{productName:'Under desk headphone hanger clamp',confirmed:true,landedPerUnit:20}}
};}

test('private bridge can legitimately promote a fully evidenced product to TEST_BUY',()=>{const d=evaluateCommercialDecision(product(),state());assert.equal(d.status,'TEST_BUY');assert.equal(d.passedGates,9);assert.equal(d.landedCostConfirmed,true);assert.ok(d.economics.margin>=20);assert.ok(d.economics.roi>=45);assert.ok(d.quantity>=20&&d.quantity<=30);});

test('missing confirmed landed cost blocks money recommendation even when static economics look good',()=>{const p=product();p.economics={margin:50,roi:200,profit:40};const s=state();s.landedCosts={};const d=evaluateCommercialDecision(p,s);assert.equal(d.status,'HOLD');assert.equal(d.gates.economicsHealthy,false);assert.match(d.blockers.join(' '),/landed cost confirmat/i);});

test('incomplete supplier data never passes supplier gate',()=>{const s=state();const key=normalizeProductKey(product().name);delete s.supplierRecords[key].shippingRon;const d=evaluateCommercialDecision(product(),s);assert.equal(d.gates.supplierVerified,false);assert.equal(d.status,'HOLD');});

test('high-confidence sales estimate satisfies sales gate without pretending it is actual sales',()=>{const d=evaluateCommercialDecision(product(),state());assert.equal(d.gates.estimatedSalesReady,true);assert.equal(d.estimationEvidence.actualCompetitorSalesObserved,false);assert.equal(d.estimationEvidence.salesEstimateStatus,'ESTIMATED_HIGH_CONFIDENCE');});

test('missing trend evidence fails closed instead of passing Trend by default',()=>{const p=product();delete p.trendIntelligence;const d=evaluateCommercialDecision(p,state());assert.equal(d.gates.trendSafe,false);assert.equal(d.status,'HOLD');assert.match(d.blockers.join(' '),/trend verificat/i);});
