import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalFingerprint, freshnessTier, paidEnrichmentDecision } from '../scripts/lib/data-budget-v3.mjs';

test('hard cap can never be exceeded', () => {
  assert.equal(paidEnrichmentDecision({ spentEur: 99, estimatedCostEur: 2, informationValue: 90, opportunityScore: 90, explicitApproval: true }).reason, 'HARD_CAP');
});

test('soft stop requires explicit approval', () => {
  assert.equal(paidEnrichmentDecision({ spentEur: 79, estimatedCostEur: 2, informationValue: 90, opportunityScore: 90 }).reason, 'SOFT_STOP');
  assert.equal(paidEnrichmentDecision({ spentEur: 79, estimatedCostEur: 2, informationValue: 90, opportunityScore: 90, explicitApproval: true }).allow, true);
});

test('weak candidates do not consume paid data', () => {
  assert.equal(paidEnrichmentDecision({ spentEur: 10, estimatedCostEur: 0.5, informationValue: 20, opportunityScore: 90 }).reason, 'LOW_INFORMATION_VALUE');
  assert.equal(paidEnrichmentDecision({ spentEur: 10, estimatedCostEur: 0.5, informationValue: 90, opportunityScore: 10 }).reason, 'LOW_OPPORTUNITY');
});

test('finalists and test ready products are HOT', () => {
  assert.equal(freshnessTier({ stage: 'FINALIST' }), 'HOT');
  assert.equal(freshnessTier({ stage: 'TEST_READY' }), 'HOT');
  assert.equal(freshnessTier({ stage: 'VALIDATE' }), 'ACTIVE');
});

test('fingerprint normalizes Romanian diacritics and punctuation', () => {
  assert.equal(canonicalFingerprint({ brand: 'RedQuit', title: 'Cutie – Organizare Călătorie!', category: 'Casă' }), 'redquit|cutie organizare calatorie|casa');
});
