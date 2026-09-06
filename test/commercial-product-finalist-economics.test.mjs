import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('commercial product detail exposes FINALIST economics without purchase authority',()=>{
  const js=fs.readFileSync('commercial-product.js','utf8');
  assert.match(js,/FINALIST Economics/);
  assert.match(js,/finalist-economics-live\.json/);
  assert.match(js,/TVA import nerecuperabil/);
  assert.match(js,/TVA import recuperabil/);
  assert.match(js,/screeningVerdictsByVatTreatment/);
  assert.match(js,/Brokeraj LCL public direct/);
  assert.match(js,/purchaseAuthorized=false/);
});
