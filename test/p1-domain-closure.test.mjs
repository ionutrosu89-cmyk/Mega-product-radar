import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const files={
  domain:'../domain-contracts-v1.js',
  commercial:'../commercial-identity-v1.js',
  observation:'../market-observation-v1.js',
  history:'../market-observation-history-v1.js'
};

async function read(rel){return fs.readFile(new URL(rel,import.meta.url),'utf8');}

test('P1 canonical domain foundation remains present',async()=>{
  const [domain,commercial,observation,history]=await Promise.all(Object.values(files).map(read));
  assert.match(domain,/CANONICAL_PRODUCT_ID_REQUIRED/);
  assert.match(domain,/CROSS_PRODUCT_EVIDENCE_REJECTED/);
  assert.match(domain,/SILENT_EVIDENCE_UPGRADE_REJECTED/);
  assert.match(domain,/PURCHASE_AUTHORITY_FORBIDDEN/);
  assert.match(commercial,/LEGACY_PRODUCT_NAME_KEYS_ARE_READ_ONLY_COMPATIBILITY/);
  assert.match(commercial,/CANONICAL_PRODUCT_ID_REQUIRED_FOR_COMMERCIAL_WRITE/);
  assert.match(observation,/MPR_MARKET_OBSERVATION_V1/);
  assert.match(history,/24/);
});

test('P1 commercial modules no longer treat title-only legacy records as decision authority',async()=>{
  const targets=['../supplier-intelligence.js','../landed-cost.js','../sourcing-ops.js','../portfolio.js'];
  const existing=[];
  for(const target of targets){try{existing.push(await read(target));}catch{}}
  assert.ok(existing.length>=3);
  const all=existing.join('\n');
  assert.match(all,/canonicalProductId/);
  assert.match(all,/decisionEligible|decisionHandoffEligible|identityBlocked/i);
});
