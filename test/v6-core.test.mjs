import test from 'node:test';
import assert from 'node:assert/strict';
import {expandDiscoveryQueries,canonicalProductName,dedupeCandidates,supplierRisk,rankSuppliers,allocateCapital,portfolioMetrics,feedbackCalibration,calibratedScore,executiveActions} from '../v6-core.js';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';

test('Discovery 6 expands a theme across six locales without duplicate empty queries',()=>{const q=expandDiscoveryQueries('compact travel organizer');assert.ok(q.length>=20);assert.equal(new Set(q.map(x=>x.locale)).size,6);assert.ok(q.every(x=>x.query.includes('compact travel organizer')));});

test('Discovery 6 canonicalization deduplicates cosmetic bestseller naming',()=>{assert.equal(canonicalProductName('Premium Car Hook Bestseller 2026'),canonicalProductName('Car Hook'));const rows=dedupeCandidates([{name:'Premium Car Hook Bestseller 2026',score:60},{name:'Car Hook',score:80}]);assert.equal(rows.length,1);assert.equal(rows[0].score,80);});

test('Supplier Intelligence penalizes incomplete supplier and ranks verified supplier higher',()=>{const weak={supplierName:'A',rating:3.8,years:1,moq:0,tradeAssurance:false,certifications:[]},strong={supplierName:'B',rating:4.8,years:5,moq:50,tradeAssurance:true,certifications:['CE'],url:'https://example.com',quotedPrice:40};assert.ok(supplierRisk(strong)<supplierRisk(weak));const ranked=rankSuppliers([weak,strong],{targetQty:100,targetUnitCost:50});assert.equal(ranked[0].supplierName,'B');});

test('Capital Allocation keeps reserve and caps concentration',()=>{const plan=allocateCapital([{name:'A',unitCost:50,profitPerUnit:40,readiness:90,risk:20,score:90},{name:'B',unitCost:25,profitPerUnit:15,readiness:80,risk:25,score:85}],10000,{maxPerProductPct:35,minCashReservePct:10});assert.ok(plan.reserve>=1000);assert.ok(plan.deployed<=9000);assert.ok(plan.allocations.every(x=>x.capital<=3150.01));assert.ok(plan.expectedProfit>0);});

test('Portfolio Manager flags canonical fast stock for reorder and canonical dead stock for reduction',()=>{const p=portfolioMetrics([{canonicalProductId:A,name:'Fast',stock:10,sold30:30,unitCost:20,sellPrice:70,returnsRate:2},{canonicalProductId:B,name:'Dead',stock:100,sold30:2,unitCost:30,sellPrice:80,returnsRate:2}]);assert.equal(p.actions.find(x=>x.name==='Fast').action,'REORDER');assert.equal(p.actions.find(x=>x.name==='Dead').action,'STOP/REDUCE');assert.ok(p.capitalBlocked>0);});

test('legacy portfolio row remains measurable but cannot generate an executive action',()=>{const p=portfolioMetrics([{name:'Legacy fast',stock:1,sold30:30,unitCost:20,sellPrice:70}]);assert.equal(p.identityBlocked,1);assert.equal(p.actions[0].action,'IDENTITY_REQUIRED');assert.equal(p.reorder,0);});

test('Feedback Loop calibrates only canonical outcomes and blocks legacy title-only rows',()=>{const c=feedbackCalibration([{canonicalProductId:A,predictedScore:90,actualMargin:25,returnRate:8},{canonicalProductId:B,predictedScore:70,actualMargin:50,returnRate:3},{name:'Legacy',predictedScore:10,actualMargin:99,returnRate:0}]);assert.equal(c.sample,2);assert.equal(c.identityBlocked,1);assert.equal(c.confidence,'LOW');assert.ok(Number.isFinite(calibratedScore(80,c)));});

test('Executive actions keep buy/test and canonical portfolio actions separate',()=>{const r=executiveActions({radar:[{name:'Buy',buyingDecision:{label:'ORDER NOW'}}],discovery:[{name:'Test',suggestedStage:'TEST',discoveryAnalysis:{quality:{level:'LIVE'}}}],portfolio:[{canonicalProductId:A,name:'Reorder',stock:5,sold30:30,unitCost:20,sellPrice:60},{name:'Legacy reorder',stock:5,sold30:30,unitCost:20,sellPrice:60}]});assert.equal(r.buy[0].name,'Buy');assert.equal(r.test[0].name,'Test');assert.equal(r.reorder[0].name,'Reorder');assert.equal(r.reorder.length,1);});
