import test from 'node:test';
import assert from 'node:assert/strict';
import {runMatchingCalibration,MatchingCalibrationCasesV1} from '../matching-calibration-v1.js';

test('curated calibration includes deliberate positives and near-miss negatives',()=>{
  assert.ok(MatchingCalibrationCasesV1.filter(x=>x.expected).length>=5);
  assert.ok(MatchingCalibrationCasesV1.filter(x=>!x.expected).length>=10);
});

test('curated fixture precision remains at least 90 percent',()=>{
  const r=runMatchingCalibration();
  assert.ok(r.precision>=0.9);
  assert.ok(r.accuracy>=0.9);
  assert.equal(r.policy.realWorldHighConfidenceSampleStillRequired,true);
});
