import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRobustDimensions} from '../public-detail-fusion-evidence-v1.js';

test('parses Amazon Product Dimensions with numeric HTML quote entities',()=>{
  assert.deepEqual(
    parseRobustDimensions('Product Dimensions 12&#34;L x 12&#34;W x 12&#34;H Shape Rectangular'),
    {lengthCm:30.48,widthCm:30.48,heightCm:30.48}
  );
});

test('parses decimal Amazon dimensions with numeric HTML quote entities',()=>{
  assert.deepEqual(
    parseRobustDimensions('Product Dimensions 15.5&#34;L x 9&#34;W x 10.3&#34;H Shape Rectangular'),
    {lengthCm:39.37,widthCm:22.86,heightCm:26.162}
  );
});

test('preserves ordinary inch-word parsing',()=>{
  assert.deepEqual(
    parseRobustDimensions('Item dimensions L x W x H 10 x 3.62 x 16.06 inches'),
    {lengthCm:25.4,widthCm:9.195,heightCm:40.792}
  );
});
