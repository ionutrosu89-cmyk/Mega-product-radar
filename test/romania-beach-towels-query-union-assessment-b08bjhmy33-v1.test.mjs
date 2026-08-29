import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRomaniaCanonicalQueryUnion } from '../romania-canonical-query-union-v1.js';

const fixture=JSON.parse(fs.readFileSync(new URL('../data/romania-beach-towels-query-union-assessment-b08bjhmy33-v1.json', import.meta.url),'utf8'));

for(const platform of fixture.platforms){
  test(`B08BJHMY33 ${platform.platform} sampled evidence fails closed under canonical query union`,()=>{
    const result=buildRomaniaCanonicalQueryUnion({
      platform:platform.platform,
      nicheKey:fixture.nicheKey,
      requiredAliases:fixture.requiredAliases,
      queryEnumerations:platform.queryEnumerations,
      aliasSetManuallyApproved:platform.aliasSetManuallyApproved,
      marketCoverageConfirmed:platform.marketCoverageConfirmed
    });
    assert.equal(result.marketComparableExact,platform.expectedMarketComparableExact);
    assert.equal(result.canonicalListingCount,platform.expectedCanonicalListingCount);
    for(const blocker of platform.expectedBlockers) assert.ok(result.blockers.includes(blocker),`${platform.platform} missing blocker ${blocker}`);
    assert.equal(result.verifiedSales,false);
    assert.equal(result.purchaseAuthorized,false);
  });
}

test('sampled explicit zero query surfaces are not treated as market-wide zero competition',()=>{
  assert.equal(fixture.truthPolicy.declaredZeroQuerySurfaceIsMarketWideZero,false);
  assert.equal(fixture.truthPolicy.sampledSurfaceIsExact,false);
  assert.equal(fixture.truthPolicy.unknownIsZero,false);
});
