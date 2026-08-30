import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRobustDimensions,deriveSupplierSingleUnitPackEvidence,canonicalMaterialForMatching} from '../public-detail-fusion-evidence-v1.js';

test('parses labeled imperial dimensions',()=>{
  assert.deepEqual(parseRobustDimensions('Product Dimensions 12"D x 13.77"W x 11"H'),{lengthCm:30.48,widthCm:34.976,heightCm:27.94});
});

test('parses Amazon HTML-entity imperial dimensions',()=>{
  assert.deepEqual(parseRobustDimensions('Product Dimensions 12&#34;L x 12&#34;W x 12&#34;H Shape Rectangular'),{lengthCm:30.48,widthCm:30.48,heightCm:30.48});
  assert.deepEqual(parseRobustDimensions('Product Dimensions 15.5&quot;L x 9&quot;W x 10.3&quot;H'),{lengthCm:39.37,widthCm:22.86,heightCm:26.162});
});

test('parses HTML-entity multiplication separator',()=>{
  assert.deepEqual(parseRobustDimensions('Size 360&#215;290&#215;286mm'),{lengthCm:36,widthCm:29,heightCm:28.6});
});

test('parses star separated metric dimensions',()=>{
  assert.deepEqual(parseRobustDimensions('Size 360*290*286mm'),{lengthCm:36,widthCm:29,heightCm:28.6});
});

test('canonicalizes compatible metal descriptions without proving identity',()=>{
  assert.equal(canonicalMaterialForMatching('metal mesh'),'metal');
  assert.equal(canonicalMaterialForMatching('alloy steel'),'metal');
  assert.equal(canonicalMaterialForMatching('cotton'),'cotton');
});

test('derives pack one only for piece-priced single assembly durable product',()=>{
  const x=deriveSupplierSingleUnitPackEvidence({priceUnit:'piece',productType:'desk organizer',title:'5 Tier Paper Letter Tray Organizer'});
  assert.equal(x.packCount,1);assert.equal(x.derived,true);
});

test('does not derive pack one when multipack signal exists',()=>{
  const x=deriveSupplierSingleUnitPackEvidence({priceUnit:'piece',productType:'desk organizer',title:'Desk Organizer Pack of 2'});
  assert.equal(x.packCount,null);assert.equal(x.derived,false);assert.equal(x.reason,'MULTIPACK_SIGNAL_PRESENT');
});

test('does not derive pack one outside the single assembly allowlist',()=>{
  const x=deriveSupplierSingleUnitPackEvidence({priceUnit:'piece',productType:'cable clip',title:'Cable Clip'});
  assert.equal(x.packCount,null);assert.equal(x.derived,false);
});
