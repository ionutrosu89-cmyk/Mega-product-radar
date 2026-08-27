import test from 'node:test';
import assert from 'node:assert/strict';
import {getSourceRights,resolveSourceRights,SOURCE_RIGHTS_STATUS,isSourceRightsRecordReviewable} from '../source-rights-registry-v1.js';

test('unknown sources fail closed',()=>{
  const rights=getSourceRights('UNREGISTERED_SOURCE');
  assert.equal(rights.status,SOURCE_RIGHTS_STATUS.UNKNOWN);
  assert.equal(rights.analysisAllowed,false);
  assert.equal(rights.commercialUseAllowed,false);
});

test('Amazon public product page is UNKNOWN until a reviewed rights basis exists',()=>{
  const rights=getSourceRights('AMAZON_PUBLIC_PRODUCT_PAGE');
  assert.equal(rights.status,SOURCE_RIGHTS_STATUS.UNKNOWN);
  assert.equal(rights.basis,'NOT_CONFIRMED');
});

test('status-only overrides cannot elevate rights',()=>{
  const rights=resolveSourceRights('AMAZON_PUBLIC_PRODUCT_PAGE',{status:'COMMERCIAL_ALLOWED'});
  assert.equal(rights.status,SOURCE_RIGHTS_STATUS.UNKNOWN);
  assert.equal(rights.analysisAllowed,false);
  assert.equal(rights.commercialUseAllowed,false);
});

test('reviewed analysis rights elevate analysis only',()=>{
  const rights=resolveSourceRights('AMAZON_PUBLIC_PRODUCT_PAGE',{
    status:'ANALYSIS_ALLOWED',
    basis:'LEGAL_REVIEW_ANALYSIS_ONLY',
    reviewedAt:'2026-08-27T08:30:00Z',
    evidenceRef:'rights-review:123'
  });
  assert.equal(rights.status,SOURCE_RIGHTS_STATUS.ANALYSIS_ALLOWED);
  assert.equal(rights.analysisAllowed,true);
  assert.equal(rights.commercialUseAllowed,false);
  assert.equal(isSourceRightsRecordReviewable(rights),true);
});

test('reviewed commercial rights explicitly enable both uses',()=>{
  const rights=resolveSourceRights('AMAZON_PUBLIC_PRODUCT_PAGE',{
    status:'COMMERCIAL_ALLOWED',
    basis:'LEGAL_REVIEW_COMMERCIAL_ALLOWED',
    reviewedAt:'2026-08-27T08:31:00Z',
    evidenceRef:'rights-review:124'
  });
  assert.equal(rights.analysisAllowed,true);
  assert.equal(rights.commercialUseAllowed,true);
});
