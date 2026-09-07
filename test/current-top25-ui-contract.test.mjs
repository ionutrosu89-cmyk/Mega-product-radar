import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('current Top25 page defaults to 7D and offers 30D plus explicit archive',async()=>{
  const [html,js]=await Promise.all([readFile('current-top25.html','utf8'),readFile('current-top25.js','utf8')]);
  assert.match(html,/Ultimele 7 zile/);
  assert.match(html,/Ultimele 30 zile/);
  assert.match(html,/href="top25\.html">Arhivă 2023/);
  assert.match(js,/\/api\/free\/top25\?window=\$\{windowDays\}/);
  assert.match(js,/load\(7\)/);
  assert.match(js,/Nu folosim arhiva 2023 ca înlocuitor/);
});

test('public bundle makes current intelligence the primary beta CTA and labels archive',async()=>{
  const hardener=await readFile('scripts/harden-public-bundle.mjs','utf8');
  assert.match(hardener,/current-top25\.html/);
  assert.match(hardener,/replaceAll\('href="top25\.html"','href="current-top25\.html"'\)/);
  assert.match(hardener,/Aceasta este arhiva istorică 2023/);
});
