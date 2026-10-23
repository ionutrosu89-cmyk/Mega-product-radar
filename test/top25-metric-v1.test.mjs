import assert from 'node:assert/strict';
import test from 'node:test';
import {formatTop25Metric,sortableTop25Statistic} from '../top25-metric-v1.js';

test('categorical eBay ranking is described without NaN or a sales count',()=>{
  assert.equal(formatTop25Metric({unit:'platform_rank',value:'BEST_SELLING'}),'BEST_SELLING · indicatorul platformei');
  assert.equal(formatTop25Metric({unit:'platform_rank',value:3}),'#3 · rangul sursei');
  assert.equal(sortableTop25Statistic({sourceMetric:{unit:'platform_rank',value:'BEST_SELLING'},reviewCount:12}),12);
});

test('missing statistics remain unknown and explicit zero remains zero',()=>{
  assert.equal(formatTop25Metric({unit:'results',value:null}),'—');
  assert.equal(formatTop25Metric({unit:'results',value:'unknown'}),'—');
  assert.equal(formatTop25Metric({unit:'results',value:0}),'0 rezultate');
  assert.equal(sortableTop25Statistic({sourceMetric:{value:null},reviewCount:null}),-1);
  assert.equal(sortableTop25Statistic({sourceMetric:{value:0},reviewCount:14}),0);
  assert.equal(sortableTop25Statistic({sourceMetric:{unit:'provider_latest_volume',value:20},reviewCount:5}),20);
});
