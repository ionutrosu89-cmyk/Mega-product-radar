import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveDeploymentReadiness} from '../deployment-readiness-state.js';

const checks={allConfigured:true,allPricesValid:true,amountsMatch:true};

test('sandbox readiness never reports live billing GO',()=>{
  const state=deriveDeploymentReadiness({ready:true,stripeMode:'SANDBOX',publicLaunchBillingReady:false,checks});
  assert.equal(state.technicalReady,true);
  assert.equal(state.sandboxReady,true);
  assert.equal(state.liveBillingReady,false);
  assert.equal(state.sandboxLabel,'GO');
  assert.equal(state.liveBillingLabel,'NO-GO');
});

test('live billing GO requires backend live launch readiness',()=>{
  const state=deriveDeploymentReadiness({ready:true,stripeMode:'LIVE',publicLaunchBillingReady:true,checks});
  assert.equal(state.sandboxReady,false);
  assert.equal(state.liveBillingReady,true);
  assert.equal(state.liveBillingLabel,'GO');
});

test('technically valid unknown mode remains live billing NO-GO',()=>{
  const state=deriveDeploymentReadiness({ready:true,stripeMode:'UNKNOWN',publicLaunchBillingReady:false,checks});
  assert.equal(state.technicalReady,true);
  assert.equal(state.sandboxReady,false);
  assert.equal(state.liveBillingReady,false);
  assert.match(state.status,/nu autorizează/i);
});

test('missing technical checks stays blocked',()=>{
  const state=deriveDeploymentReadiness({ready:false,stripeMode:'UNCONFIGURED',checks:{allConfigured:false,allPricesValid:false,amountsMatch:false}});
  assert.equal(state.technicalLabel,'BLOCKED');
  assert.equal(state.configured,false);
  assert.equal(state.prices,false);
  assert.equal(state.liveBillingLabel,'NO-GO');
});
