import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('commercial dossier keeps legacy score and Romania Gap explicitly derived',async()=>{
  const js=await fs.readFile(new URL('../commercial-product.js',import.meta.url),'utf8');
  assert.match(js,/function scoreLabel\(p\)/);
  assert.match(js,/Derived score/);
  assert.match(js,/derivedRomaniaGap/);
  assert.match(js,/DERIVED \$\{Math\.round\(proxy\)\}\/100/);
  assert.match(js,/Scorurile și Romania Gap provenite din snapshot-ul legacy rămân marcate DERIVED/);
});
