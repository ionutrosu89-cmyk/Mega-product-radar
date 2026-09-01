import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const script = fs.readFileSync(
  new URL('../scripts/build-amazon-kaggle-million-new-v1.py', import.meta.url),
  'utf8',
);
const workflow = fs.readFileSync(
  new URL('../.github/workflows/amazon-kaggle-500k-overlap-v1.yml', import.meta.url),
  'utf8',
);

test('million registry selection targets a real reserve above one million', () => {
  assert.match(script, /BASELINE_DISTINCT_ASINS = 500_000/);
  assert.match(script, /TARGET_NEW_ASINS = 510_001/);
  assert.match(script, /EXPECTED_FINAL_ASINS = BASELINE_DISTINCT_ASINS \+ TARGET_NEW_ASINS/);
  assert.match(workflow, /expectedFinalDistinctAsins==1010001/);
});

test('selection remains read-only, zero-cost and exact-ASIN scoped', () => {
  assert.match(script, /ASIN_RE = re\.compile\(r"\^\[A-Z0-9\]\{10\}\$"\)/);
  assert.match(script, /writePerformed": False/);
  assert.match(script, /verifiedSales": False/);
  assert.match(script, /providerSpendEur": 0/);
  assert.match(script, /paidCallsTriggered": 0/);
  assert.match(script, /purchaseAuthorized": False/);
  assert.match(workflow, /id-token: write/);
  assert.doesNotMatch(workflow, /KAGGLE_KEY|SUPABASE_SERVICE_ROLE_KEY/);
});

test('workflow publishes the pinned manifest and receipt for the import gate', () => {
  assert.match(workflow, /build-amazon-kaggle-million-new-v1\.py/);
  assert.match(workflow, /amazon-kaggle-million-selection-receipt\.json/);
  assert.match(workflow, /amazon-kaggle-million-new-asins\.txt/);
  assert.match(workflow, /retention-days: 30/);
  assert.doesNotMatch(workflow, /purchaseAuthorized==false' \+/);
});
