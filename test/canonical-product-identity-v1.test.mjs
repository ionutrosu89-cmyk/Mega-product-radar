import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {buildMarketplaceAlias,canonicalIdentitySeed,identityMatch,bindEvidenceToCanonicalProduct,sameCanonicalProduct,CANONICAL_IDENTITY_POLICY} from '../canonical-product-identity-v1.js';

test('Amazon ASIN identity remains stable when observed title changes',()=>{
  const a=canonicalIdentitySeed({platform:'AMAZON_US',externalId:'B00INKVS82',title:'Avery Binder old title'});
  const b=canonicalIdentitySeed({platform:'amazon us',externalId:'B00INKVS82',title:'Avery Binder updated title'});
  assert.equal(a.valid,true);assert.equal(a.canonicalKey,b.canonicalKey);assert.equal(a.alias.aliasKey,'AMAZON_US:B00INKVS82');
});

test('same platform and external id is exact identity evidence',()=>{
  const m=identityMatch({platform:'EMAG_RO',externalId:'123'},{platform:'emag ro',externalId:'123'});
  assert.equal(m.sameAlias,true);assert.equal(m.autoMergeAllowed,true);assert.equal(m.reason,'EXACT_PLATFORM_EXTERNAL_ID');
});

test('same title across different platforms is review hint only and never auto merged',()=>{
  const m=identityMatch({platform:'AMAZON_US',externalId:'A1',title:'Portable 3 Ring Binder'},{platform:'TRENDYOL_RO',externalId:'T9',title:'Portable 3 Ring Binder'});
  assert.equal(m.sameAlias,false);assert.equal(m.manualReviewHint,true);assert.equal(m.autoMergeAllowed,false);
});

test('different aliases remain distinct when titles do not match exactly',()=>{
  const m=identityMatch({platform:'AMAZON_US',externalId:'A1',title:'Binder 3 Ring'},{platform:'TRENDYOL_RO',externalId:'T9',title:'Binder 2 Ring'});
  assert.equal(m.sameAlias,false);assert.equal(m.manualReviewHint,false);assert.equal(m.autoMergeAllowed,false);
});

test('missing platform or external id fails closed',()=>{
  assert.equal(buildMarketplaceAlias({platform:'AMAZON_US'}).valid,false);
  assert.equal(canonicalIdentitySeed({externalId:'A1'}).valid,false);
});

test('commercial evidence must share the same canonical product id',()=>{
  const supplier=bindEvidenceToCanonicalProduct({supplierVerified:true},'cp-1');
  const economics=bindEvidenceToCanonicalProduct({economicsConfirmed:true},'cp-1');
  const other=bindEvidenceToCanonicalProduct({romaniaGap:true},'cp-2');
  assert.equal(sameCanonicalProduct(supplier,economics),true);
  assert.equal(sameCanonicalProduct(supplier,economics,other),false);
});

test('policy explicitly prohibits cross-platform title auto merge',()=>{
  assert.equal(CANONICAL_IDENTITY_POLICY.databaseIdentity,'UUID');
  assert.equal(CANONICAL_IDENTITY_POLICY.crossPlatformAutoMerge,false);
  assert.equal(CANONICAL_IDENTITY_POLICY.titleMatch,'MANUAL_REVIEW_HINT_ONLY');
});

test('migration creates global canonical identity and optional commercial bindings',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260826_canonical_product_identity_v1.sql',import.meta.url),'utf8');
  assert.match(sql,/create table if not exists public\.canonical_products/);
  assert.match(sql,/create table if not exists public\.product_aliases/);
  assert.match(sql,/unique\(platform,external_id\)/);
  assert.match(sql,/revoke insert,update,delete on public\.canonical_products from anon,authenticated/);
  for(const table of ['suppliers','supplier_offers','rfq_dispatch_states','landed_costs','purchases','portfolio_items','feedback_events','discovery_candidates'])
    assert.match(sql,new RegExp(`alter table if exists public\\.${table} add column if not exists canonical_product_id uuid`));
});
