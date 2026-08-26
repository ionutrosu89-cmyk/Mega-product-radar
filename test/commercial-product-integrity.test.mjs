import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Opportunity Detail uses canonical V5 truth instead of legacy score authority',async()=>{
  const js=await fs.readFile(new URL('../commercial-product.js',import.meta.url),'utf8');
  const html=await fs.readFile(new URL('../commercial-product.html',import.meta.url),'utf8');
  assert.match(js,/normalizeOpportunityUxV1/);
  assert.match(js,/canonicalProductId/);
  assert.match(js,/Opportunity V5/);
  assert.match(js,/Legacy BUY nu este autoritate/);
  assert.match(js,/purchaseAuthorized=false/);
  assert.match(js,/automaticPurchaseAllowed=false/);
  assert.match(html,/Opportunity Detail/);
  assert.doesNotMatch(js,/function scoreLabel\(p\)/);
  assert.doesNotMatch(js,/derivedRomaniaGap/);
  assert.doesNotMatch(js,/applyPrivateCommercialDecisions/);
});
