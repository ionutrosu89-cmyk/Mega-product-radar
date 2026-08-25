import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRomaniaCanonicalQueryUnion } from '../romania-canonical-query-union-v1.js';

const base={platform:'TRENDYOL',nicheKey:'UNDER_DESK_CABLE_MANAGEMENT_TRAY',requiredAliases:['organizator cabluri sub birou','tava cabluri birou'],queryEnumerations:[{alias:'organizator cabluri sub birou',surfaceExact:true,canonicalListingIds:['a','b']},{alias:'tava cabluri birou',surfaceExact:true,canonicalListingIds:['b','c']}],aliasSetManuallyApproved:true,marketCoverageConfirmed:true};

test('complete approved exact alias union dedupes cross-query listings',()=>{
 const x=buildRomaniaCanonicalQueryUnion(base);
 assert.equal(x.marketComparableExact,true);
 assert.equal(x.canonicalListingCount,3);
 assert.deepEqual(x.canonicalListingIds,['a','b','c']);
 assert.equal(x.purchaseAuthorized,false);
});

test('missing alias blocks exact union',()=>{
 const x=buildRomaniaCanonicalQueryUnion({...base,queryEnumerations:[base.queryEnumerations[0]]});
 assert.equal(x.marketComparableExact,false);
 assert.equal(x.canonicalListingCount,null);
 assert.ok(x.blockers.includes('MISSING_REQUIRED_ALIASES'));
});

test('non-exact component blocks market exact',()=>{
 const q=structuredClone(base.queryEnumerations); q[1].surfaceExact=false;
 const x=buildRomaniaCanonicalQueryUnion({...base,queryEnumerations:q});
 assert.equal(x.marketComparableExact,false);
 assert.ok(x.blockers.includes('NON_EXACT_ALIAS_ENUMERATION'));
});

test('manual alias approval and market coverage confirmation are both required',()=>{
 const x=buildRomaniaCanonicalQueryUnion({...base,aliasSetManuallyApproved:false,marketCoverageConfirmed:false});
 assert.equal(x.marketComparableExact,false);
 assert.ok(x.blockers.includes('ALIAS_SET_NOT_MANUALLY_APPROVED'));
 assert.ok(x.blockers.includes('MARKET_COVERAGE_NOT_CONFIRMED'));
});
