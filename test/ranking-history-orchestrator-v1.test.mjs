import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryHistoryStore} from '../ranking-history-store-v1.js';
import {evaluateHistoryCycleDue,runRankingHistoryCycle} from '../ranking-history-orchestrator-v1.js';

function record(rank,observedAt,fingerprint){
  return{
    identityKey:'AMAZON:B001',evidenceClass:'EXPLICIT_PRODUCT_BEST_SELLERS_RANK',observedAt,
    fingerprint,trustedEligible:true,resolution:{decision:'SELECTED'},sourceName:'TEST',
    provenance:{contentSha256:'a'.repeat(64)},
    envelope:{source:{observedAt},payload:{explicitRank:rank,rankCategory:'TEST_CAT'}}
  };
}

function bundle(records,fingerprint){return{manifest:{fingerprint},trustedRecords:records,heldRecords:[]};}

test('cycle due requires new source and interval',()=>{
  const result=evaluateHistoryCycleDue({lastCompletedAt:'2026-08-27T10:30:00Z',lastSourceFingerprint:'old'},{now:'2026-08-27T11:00:00Z',intervalMs:3600000,sourceFingerprint:'new'});
  assert.equal(result.due,false);
  assert.ok(result.reasons.includes('INTERVAL_NOT_DUE'));
});

test('history cycle persists ledger, trends and state locally',async()=>{
  const store=createMemoryHistoryStore();
  const cycle=await runRankingHistoryCycle({resolvedBundle:bundle([record(100,'2026-08-27T08:00:00Z','s1')],'bundle-1')},{store,now:'2026-08-27T09:00:00Z',intervalMs:3600000,minIntervalMs:3600000});
  assert.equal(cycle.decision,'COMPLETED');
  assert.equal(cycle.appendedCount,1);
  assert.equal(cycle.productionPersistenceVerified,false);
  assert.equal(cycle.restoreProofs.ledger.localVerified,true);
  assert.equal(cycle.restoreProofs.trends.localVerified,true);
  assert.equal(cycle.restoreProofs.state.localVerified,true);
  assert.equal(cycle.salesEvidenceClass,'NOT_VERIFIED_SALES');
  assert.equal(cycle.purchaseAuthorized,false);
});

test('same resolved source is idempotently skipped',async()=>{
  const store=createMemoryHistoryStore();
  const resolved=bundle([record(100,'2026-08-27T08:00:00Z','s1')],'bundle-1');
  await runRankingHistoryCycle({resolvedBundle:resolved},{store,now:'2026-08-27T09:00:00Z',intervalMs:3600000});
  const second=await runRankingHistoryCycle({resolvedBundle:resolved},{store,now:'2026-08-27T11:00:00Z',intervalMs:3600000});
  assert.equal(second.decision,'SKIPPED');
  assert.ok(second.due.reasons.includes('SOURCE_ALREADY_PROCESSED'));
});

test('successive comparable observations derive trend without verified sales claim',async()=>{
  const store=createMemoryHistoryStore();
  await runRankingHistoryCycle({resolvedBundle:bundle([record(100,'2026-08-27T08:00:00Z','s1')],'bundle-1')},{store,now:'2026-08-27T09:00:00Z',intervalMs:3600000,minIntervalMs:3600000});
  const second=await runRankingHistoryCycle({resolvedBundle:bundle([record(80,'2026-08-27T10:00:00Z','s2')],'bundle-2')},{store,now:'2026-08-27T11:00:00Z',intervalMs:3600000,minIntervalMs:3600000});
  assert.equal(second.decision,'COMPLETED');
  assert.equal(second.comparableTrendCount,1);
  assert.equal(second.trends.trends[0].status,'IMPROVING');
  assert.equal(second.trends.trends[0].verifiedSalesRows,0);
  assert.equal(second.trends.trends[0].salesEvidenceClass,'NOT_VERIFIED_SALES');
});
