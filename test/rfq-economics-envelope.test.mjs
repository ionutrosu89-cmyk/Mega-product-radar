import test from 'node:test';
import assert from 'node:assert/strict';
import {targetCostEnvelope} from '../rfq-economics-envelope.js';

test('target cost envelope is a negotiation ceiling, never confirmed economics',()=>{
  const r=targetCostEnvelope(44.74);
  assert.equal(r.feasible,true);
  assert.equal(r.maxLandedCostRon,3.57);
  assert.equal(r.bindingConstraint,'MARGIN');
  assert.match(r.policy,/not a confirmed landed cost/i);
  assert.match(r.policy,/not permission to TEST or BUY/i);
  assert.equal('confirmed' in r,false);
});

test('lower observed price tightens or eliminates allowable landed cost',()=>{
  const low=targetCostEnvelope(10.50);
  const mid=targetCostEnvelope(39);
  const high=targetCostEnvelope(44.74);
  assert.equal(low.feasible,false);
  assert.equal(low.maxLandedCostRon,0);
  assert.equal(mid.maxLandedCostRon,1.76);
  assert.ok(high.maxLandedCostRon>mid.maxLandedCostRon);
});

test('ROI or margin threshold can never increase the ceiling when made stricter',()=>{
  const base=targetCostEnvelope(49.9);
  const stricterMargin=targetCostEnvelope(49.9,{}, {minMarginPct:25,minRoiPct:45});
  const stricterRoi=targetCostEnvelope(49.9,{}, {minMarginPct:20,minRoiPct:60});
  assert.ok(stricterMargin.maxLandedCostRon<=base.maxLandedCostRon);
  assert.ok(stricterRoi.maxLandedCostRon<=base.maxLandedCostRon);
});
