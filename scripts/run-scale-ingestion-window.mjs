import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {runScaleIngestionWindow} from '../scale-ingestion-orchestrator-v1.js';
import {createFilesystemStorageAdapter} from '../production-storage-adapter-v1.js';

const INPUT=process.argv[2]||'artifacts/real-public-seed-1000.json';
const OUTPUT=process.argv[3]||'artifacts/scale-ingestion-window-v1.json';
const STORAGE_ROOT=process.argv[4]||'artifacts/local-scale-storage-v1';

const payload=JSON.parse(await fs.readFile(INPUT,'utf8'));
const observations=Array.isArray(payload?.observations)?payload.observations:[];
const events=observations.map((observation,index)=>({
  eventId:`local-scale-${index+1}`,
  providerDataSpendEur:0,
  paidDataCallsTriggered:0,
  purchaseAuthorized:false,
  observation:{
    ...observation,
    purchaseAuthorized:false,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    verifiedSalesRows:0
  }
}));
const sourceRightsOverride={
  status:'ANALYSIS_ALLOWED',
  analysisAllowed:true,
  commercialUseAllowed:false,
  basis:'LOCAL_SCALE_DRILL_ONLY_NOT_COMMERCIAL_RIGHTS',
  reviewedAt:'2026-08-27T00:00:00.000Z',
  evidenceRef:'repo://local-scale-drill-rights-fixture'
};
const artifactContentSha256=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
const report=await runScaleIngestionWindow(events,{
  runId:'LOCAL_SCALE_INGESTION_WINDOW_V1',
  sequence:1,
  cursor:`seed:${observations.length}`,
  observedAt:'2026-08-27T00:00:00.000Z',
  artifactContentSha256,
  sourceRightsOverride,
  storageAdapter:createFilesystemStorageAdapter(STORAGE_ROOT),
  checkpointKey:'local-scale/checkpoint-v1'
});

if(report.providerDataSpendEur!==0||report.paidDataCallsTriggered!==0||report.purchaseAuthorized!==false)throw new Error('LOCAL_SCALE_SAFETY_BOUNDARY_FAILED');
if(report.verifiedSalesRows!==0||report.salesEvidenceClass!=='NOT_VERIFIED_SALES')throw new Error('LOCAL_SCALE_TRUTH_BOUNDARY_FAILED');
if(report.scaleDecision!=='HOLD_SCALE')throw new Error('LOCAL_SCALE_DRILL_MUST_REMAIN_HOLD_SCALE');
if(report.checkpointReceipt.productionPersistenceVerified!==false)throw new Error('LOCAL_FILESYSTEM_MUST_NOT_PROVE_PRODUCTION_PERSISTENCE');

const output={
  ...report,
  executionBoundary:{
    mode:'LOCAL_BOOTSTRAP_SCALE_DRILL',
    productionRuntimeContacted:false,
    productionStorageContacted:false,
    bootstrapDataIsNotLive:true,
    catalogueBootstrapIsNotRanking:true,
    syntheticOrBootstrapCountIsNotProductionCanonicalScaleProof:true,
    verifiedSalesClaim:false,
    note:'Local bootstrap ingestion validates deduplication, replay and checkpoint mechanics only. It is not live ranking evidence, verified sales evidence, or production scale authorization.'
  }
};
await fs.mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await fs.writeFile(OUTPUT,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',inputObservationCount:observations.length,canonicalCount:report.ingestionManifest.canonicalCount,logicalDuplicateCount:report.ingestionManifest.logicalDuplicateCount,replayDeterministic:report.replay.deterministic,localRestoreVerified:report.checkpointReceipt.localRestoreVerified,productionPersistenceVerified:false,scaleDecision:report.scaleDecision,providerDataSpendEur:0,paidDataCallsTriggered:0,purchaseAuthorized:false,verifiedSalesRows:0,salesEvidenceClass:'NOT_VERIFIED_SALES'},null,2));
