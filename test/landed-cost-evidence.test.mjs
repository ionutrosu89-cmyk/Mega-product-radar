import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateLandedCostEvidence} from '../landed-cost-evidence.js';
import {normalizeLandedRecord,calculateLandedCost,landedCostStatus} from '../landed-cost.js';

const canonicalProductId='123e4567-e89b-42d3-a456-426614174000';
const provided={fxRate:true,unitPriceForeign:true,quantity:true,internationalFreight:true,customsDutyRate:true,customsFixed:true,brokerage:true,domesticFreight:true,inspection:true,labelsPackaging:true,otherFixed:true};
const complete={canonicalProductId,productName:'Canonical test product',currency:'USD',fxRate:4.6,unitPriceForeign:0.5,quantity:100,internationalFreight:100,customsDutyRate:0,customsFixed:0,brokerage:0,domesticFreight:0,inspection:0,labelsPackaging:0,otherFixed:0,provided,fxSource:'bank statement 2026-08-24',fxVerifiedAt:'2026-08-24T06:00:00Z',customsStatus:'NOT_APPLICABLE',customsClassificationRef:'',importVatTreatment:'DEDUCTIBLE_EXCLUDED_FROM_COST',vatCostReference:'',freightEvidenceRef:'forwarder quote F-1',supplierQuoteRef:'supplier quote Q-1',manualVerifiedBy:'operator',manualVerifiedAt:'2026-08-24T06:05:00Z',confirmationRequested:true};

test('blank or legacy-normalized zero costs never become verified zero evidence',()=>{
  const legacy=normalizeLandedRecord({...complete,provided:undefined,confirmed:true,confirmationRequested:undefined});
  assert.equal(legacy.confirmed,false);
  assert.equal(legacy.evidence.readyForManualConfirmation,false);
  assert.ok(legacy.evidence.blockers.some(x=>/taxă vamală % explicit/.test(x)));
});

test('explicit zero values may pass only when all evidence metadata and canonical identity are complete',()=>{
  const e=evaluateLandedCostEvidence(complete);
  assert.equal(e.readyForManualConfirmation,true);
  const r=normalizeLandedRecord(complete);
  assert.equal(r.confirmed,true);
  assert.equal(landedCostStatus(r).status,'CONFIRMAT');
});

test('confirmation request stays SIMULAT when FX source or freight evidence is missing',()=>{
  const r=normalizeLandedRecord({...complete,fxSource:'',freightEvidenceRef:''});
  assert.equal(r.confirmed,false);
  const s=landedCostStatus(r);
  assert.equal(s.status,'SIMULAT');
  assert.match(s.reason,/Confirmarea este blocată/);
});

test('complete evidence without canonical identity remains simulation only',()=>{
  const {canonicalProductId:_,...legacy}=complete;
  const r=normalizeLandedRecord(legacy);
  assert.equal(r.confirmed,false);
  assert.equal(r.decisionEligible,false);
  assert.match(landedCostStatus(r).reason,/canonicalProductId/);
});

test('NOT_APPLICABLE customs status requires an explicitly provided zero duty rate',()=>{
  const invalid=evaluateLandedCostEvidence({...complete,customsDutyRate:1});
  assert.equal(invalid.readyForManualConfirmation,false);
  assert.ok(invalid.blockers.some(x=>/taxă vamală 0/.test(x)));
});

test('landed arithmetic still calculates simulation while evidence remains incomplete',()=>{
  const r=normalizeLandedRecord({...complete,manualVerifiedAt:'',confirmationRequested:false});
  const c=calculateLandedCost(r);
  assert.equal(c.valid,true);
  assert.ok(c.perUnit>0);
  assert.equal(landedCostStatus(r).status,'SIMULAT');
});

test('Landed Cost UI and Netlify build ship evidence checklist and explicit-zero warning',()=>{
  const html=fs.readFileSync('landed-cost.html','utf8');
  const build=fs.readFileSync('scripts/build-site.mjs','utf8');
  for(const id of ['lcFxSource','lcFxVerifiedAt','lcCustomsStatus','lcCustomsRef','lcVatTreatment','lcFreightRef','lcQuoteRef','lcVerifiedBy','lcVerifiedAt'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/un câmp gol nu devine cost 0/i);
  assert.match(build,/landed-cost-evidence\.js/);
});
