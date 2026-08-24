import assert from 'node:assert/strict';
import test from 'node:test';
import {DATA_PROVIDER_REGISTRY,providerFor,estimateProviderCost,authorizeAcquisitionRun,acquisitionRecommendation} from '../data-acquisition-registry.js';

test('provider registry keeps every external source non-automatic',()=>{
  assert.ok(Object.keys(DATA_PROVIDER_REGISTRY).length>=6);
  for(const provider of Object.values(DATA_PROVIDER_REGISTRY))assert.equal(provider.autoExecute,false);
});

test('Keepa stays blocked until the active subscription price is explicitly configured',()=>{
  const estimate=estimateProviderCost('KEEPA');
  assert.equal(estimate.status,'PRICE_CONFIGURATION_REQUIRED');
  assert.equal(estimate.costEur,null);
  const auth=authorizeAcquisitionRun('KEEPA',{explicitApproval:true,budgetRemainingEur:100});
  assert.equal(auth.authorized,false);
  assert.equal(auth.reason,'PRICE_CONFIGURATION_REQUIRED');
});

test('DataForSEO cost uses explicit provider billable units and explicit FX only',()=>{
  const withoutUnits=estimateProviderCost('DATAFORSEO_AMAZON_STANDARD',{fxUsdEur:.9});
  assert.equal(withoutUnits.status,'BILLABLE_UNITS_REQUIRED');
  const withoutFx=estimateProviderCost('DATAFORSEO_AMAZON_STANDARD',{billableUnits:10000});
  assert.equal(withoutFx.status,'FX_REQUIRED');
  assert.equal(withoutFx.costUsd,15);
  const estimate=estimateProviderCost('DATAFORSEO_AMAZON_STANDARD',{billableUnits:10000,fxUsdEur:.9});
  assert.equal(estimate.status,'ESTIMATED_PAYG');
  assert.equal(estimate.costUsd,15);
  assert.equal(estimate.costEur,13.5);
});

test('paid providers require explicit approval and enough remaining budget',()=>{
  const noApproval=authorizeAcquisitionRun('DATAFORSEO_AMAZON_STANDARD',{billableUnits:10000,fxUsdEur:.9,budgetRemainingEur:100});
  assert.equal(noApproval.authorized,false);
  assert.equal(noApproval.reason,'EXPLICIT_PAID_APPROVAL_REQUIRED');
  const tooSmall=authorizeAcquisitionRun('DATAFORSEO_AMAZON_STANDARD',{explicitApproval:true,billableUnits:10000,fxUsdEur:.9,budgetRemainingEur:10});
  assert.equal(tooSmall.authorized,false);
  assert.equal(tooSmall.reason,'BUDGET_INSUFFICIENT');
  const approved=authorizeAcquisitionRun('DATAFORSEO_AMAZON_STANDARD',{explicitApproval:true,billableUnits:10000,fxUsdEur:.9,budgetRemainingEur:100});
  assert.equal(approved.authorized,true);
  assert.equal(approved.executeAutomatically,false);
});

test('SellerSprite high-cost enrichment is deferred from seed phase',()=>{
  assert.equal(providerFor('SELLERSPRITE_ASIN_DETAILS').status,'DEFER_FOR_BUDGET');
  assert.equal(providerFor('SELLERSPRITE_SALES_ESTIMATOR').recommendedPhase,'LATER_VALIDATION');
});

test('10k acquisition recommendation is breadth-first and never authorizes paid execution',()=>{
  const plan=acquisitionRecommendation({currentProducts:65,targetProducts:10000});
  assert.equal(plan.productGap,9935);
  assert.equal(plan.seedOrder[0].provider,'KEEPA');
  assert.equal(plan.seedOrder[1].provider,'DATAFORSEO_AMAZON_STANDARD');
  assert.equal(plan.paidRunAuthorized,false);
  assert.equal(plan.purchaseAuthorized,false);
});
