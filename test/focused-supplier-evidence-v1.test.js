import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFocusedSupplierDetailHtml} from '../focused-supplier-evidence-v1.js';

test('accepts exact distinctive configuration with labeled dimensions',()=>{
  const html=`<html><head><meta property="og:title" content="Mesh Desk Organizer With File Holder 5-Tier Paper Tray With Drawer and 2 Pen Holders Black"></head><body>
  Product Dimensions: 13.2 x 12.4 x 12.8 inches. Material: metal mesh. Price US $9.90-$10.66. MOQ: 1000 pieces.
  </body></html>`;
  const r=parseFocusedSupplierDetailHtml(html,{externalId:'1600000000000'});
  assert.equal(r.distinctiveConfigConfirmed,true);
  assert.equal(r.screeningCandidate,true);
  assert.equal(r.signals.black,true);
  assert.equal(r.signals.mesh,true);
  assert.equal(r.dimensions.lengthCm,33.528);
  assert.equal(r.priceCandidate.min,9.9);
  assert.equal(r.priceCandidate.max,10.66);
  assert.equal(r.moqCandidate.value,1000);
  assert.equal(r.evidenceScore,100);
});

test('does not accept unlabeled dimensions as direct supplier dimensions',()=>{
  const html=`<html><head><title>5-Tier Desk Organizer Drawer 2 Pen Holders</title></head><body>
  Carton 44 x 36 x 41 cm. US $8.50. MOQ 100 pieces.
  </body></html>`;
  const r=parseFocusedSupplierDetailHtml(html);
  assert.equal(r.distinctiveConfigConfirmed,true);
  assert.equal(r.dimensions,null);
  assert.equal(r.screeningCandidate,false);
});

test('does not accept generic organizer without distinctive components',()=>{
  const html=`<html><head><title>5 Tier Mesh Desk Organizer Black</title></head><body>
  Product Size: 33 x 30 x 32 cm. US $7.50. Minimum Order: 50 pieces.
  </body></html>`;
  const r=parseFocusedSupplierDetailHtml(html);
  assert.equal(r.distinctiveConfigConfirmed,false);
  assert.equal(r.screeningCandidate,false);
});
