import test from 'node:test';
import assert from 'node:assert/strict';
import {extractAlibabaPublicPrice} from '../alibaba-public-price-extractor-v1.js';

test('extracts visible USD range, unit and MOQ',()=>{
  const html='<html><body><div>US $2.50 - $3.80 / Piece</div><div>Min. order: 100 Pieces</div></body></html>'.padEnd(600,' ');
  const r=extractAlibabaPublicPrice(html,{sourceUrl:'https://www.alibaba.com/product-detail/x_123456789.html',observedAt:'2026-08-29T10:00:00Z'});
  assert.equal(r.valid,true);
  assert.equal(r.currency,'USD');
  assert.equal(r.publicPriceMin,2.5);
  assert.equal(r.publicPriceMax,3.8);
  assert.equal(r.priceUnit,'PIECE');
  assert.equal(r.moq,100);
});

test('JSON-LD price needs an observable unit before acceptance',()=>{
  const html='<html><script type="application/ld+json">{"@type":"Product","offers":{"@type":"AggregateOffer","lowPrice":"4.2","highPrice":"5.1","priceCurrency":"USD"}}</script></html>'.padEnd(600,' ');
  const r=extractAlibabaPublicPrice(html);
  assert.equal(r.valid,false);
  assert.ok(r.blockers.includes('PRICE_UNIT_NOT_EXTRACTED'));
});

test('JSON-LD plus visible unit can be accepted',()=>{
  const html='<html><script type="application/ld+json">{"@type":"Product","offers":{"@type":"AggregateOffer","lowPrice":"4.2","highPrice":"5.1","priceCurrency":"USD"}}</script><body>US $4.20 - $5.10 / Set</body></html>'.padEnd(600,' ');
  const r=extractAlibabaPublicPrice(html);
  assert.equal(r.valid,true);
  assert.equal(r.priceUnit,'SET');
  assert.equal(r.publicPriceMax,5.1);
});

test('anti-bot page is never promoted to price evidence',()=>{
  const html='<html><body>Verify you are human captcha US $1.00 - $2.00 / Piece</body></html>'.padEnd(600,' ');
  const r=extractAlibabaPublicPrice(html);
  assert.equal(r.valid,false);
  assert.ok(r.blockers.includes('ANTI_BOT_OR_CHALLENGE'));
});

test('unknown price is not zero',()=>{
  const html='<html><body>Contact supplier for price</body></html>'.padEnd(600,' ');
  const r=extractAlibabaPublicPrice(html);
  assert.equal(r.valid,false);
  assert.equal(r.publicPriceMin,null);
  assert.equal(r.publicPriceMax,null);
  assert.ok(r.blockers.includes('PUBLIC_PRICE_NOT_EXTRACTED'));
});
