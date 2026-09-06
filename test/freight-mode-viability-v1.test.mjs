import test from 'node:test';
import assert from 'node:assert/strict';
import {freightModeViabilityV1} from '../freight-mode-viability-v1.js';

test('minimum freight above ceiling is safely rejected',()=>{
 const r=freightModeViabilityV1({freightCeilingRon:519,modes:[
  {id:'AIR',knownMinimumFreightRon:1845},
  {id:'SEA',knownMinimumFreightRon:348.03},
  {id:'RAIL',knownMinimumFreightRon:1039.58}
 ]});
 assert.deepEqual(r.rejectedModes,['AIR','RAIL']);
 assert.equal(r.modes.find(x=>x.id==='SEA').status,'POTENTIALLY_FEASIBLE');
});

test('tight headroom never becomes final viable freight',()=>{
 const r=freightModeViabilityV1({freightCeilingRon:356,modes:[{id:'SEA',knownMinimumFreightRon:348.03}]});
 assert.equal(r.modes[0].status,'VERY_TIGHT_HEADROOM');
 assert.equal(r.modes[0].purchaseAuthorized,false);
});
