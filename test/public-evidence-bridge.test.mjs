import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read=p=>fs.readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('market postprocess bridges only dated public observations without promoting supplier listings',async()=>{
  const src=await read('scripts/market-intelligence-postprocess.mjs');
  assert.match(src,/commercial-observations\.json/);
  assert.match(src,/validPublicOffers/);
  assert.match(src,/verifiedAt/);
  assert.match(src,/matchQuality/);
  assert.match(src,/DATED_PUBLIC_OBSERVATION/);
  assert.match(src,/publicMarketRows\(o\)/);
  const fn=src.slice(src.indexOf('function publicMarketRows'),src.indexOf('function competitorIntelligence'));
  assert.doesNotMatch(fn,/supplierQuotes/);
  assert.match(src,/never become verified sales or verified supplier quotes/i);
});

test('priority car sunglasses case has multi-domain RO pricing and concrete comparable review evidence',async()=>{
  const obs=JSON.parse(await read('commercial-observations.json'));
  const p=obs.products['car sunglasses magnetic visor holder'];
  assert.ok(p);
  const offers=p.romaniaPricing.offers.filter(x=>x.priceRon>0&&x.verifiedAt&&/^https:\/\//.test(x.url)&&String(x.matchQuality||'HIGH').toUpperCase()!=='LOW');
  const domains=new Set(offers.map(x=>new URL(x.url).hostname.replace(/^www\./,'')));
  assert.ok(offers.length>=2);
  assert.ok(domains.size>=2);
  const reviews=p.reviewEvidence.filter(x=>x.source&&x.verifiedAt&&x.text&&/^https:\/\//.test(x.url));
  assert.ok(reviews.length>=2);
  assert.ok(reviews.every(x=>Array.isArray(x.negativeThemes)&&x.negativeThemes.length));
  assert.ok(reviews.every(x=>!/(verified sales|units30d|revenue30d)/i.test(x.text)));
});
