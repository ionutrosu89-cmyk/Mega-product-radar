import test from 'node:test';
import assert from 'node:assert/strict';
import {runScaleIngestionWindow} from '../scale-ingestion-orchestrator-v1.js';
import {createMemoryStorageAdapter} from '../production-storage-adapter-v1.js';

const rights={status:'ANALYSIS_ALLOWED',analysisAllowed:true,commercialUseAllowed:false,basis:'UNIT_TEST',reviewedAt:'2026-08-27T10:00:00Z',evidenceRef:'test://rights'};
const event=(asin,index)=>({eventId:`e${index}`,observation:{sourceKey:'TEST_SCALE_SOURCE',platform:'AMAZON',marketplace:'AMAZON',externalId:asin,url:`https://example.invalid/${asin}`,observedAt:'2026-08-27T10:00:00Z',contentSha256:`${String(index).padStart(64,'a')}`.slice(-64),evidenceStrength:'STRONG',evidenceClass:'VERIFIED_COMPETITOR_OBSERVATION',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false}});

test('local scale window deduplicates, checkpoints, replays deterministically and remains HOLD_SCALE',async()=>{
  const events=[event('B000000001',1),event('B000000002',2),event('B000000001',3)];
  const report=await runScaleIngestionWindow(events,{runId:'scale-test',observedAt:'2026-08-27T10:00:00Z',sourceRightsOverride:rights,storageAdapter:createMemoryStorageAdapter()});
  assert.equal(report.replay.deterministic,true);
  assert.equal(report.ingestionManifest.logicalDuplicateCount,1);
  assert.equal(report.ingestionManifest.canonicalCount,2);
  assert.equal(report.checkpointReceipt.localRestoreVerified,true);
  assert.equal(report.checkpointReceipt.productionPersistenceVerified,false);
  assert.equal(report.scaleDecision,'HOLD_SCALE');
  assert.equal(report.purchaseAuthorized,false);
});
