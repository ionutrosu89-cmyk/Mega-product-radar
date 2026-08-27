import fs from 'node:fs/promises';
import path from 'node:path';
import {serializeCheckpointForPersistence,evaluatePersistenceRestoreEvidence} from '../production-persistence-restore-evidence-v1.js';

const outDir=path.resolve(process.env.MPR_PERSISTENCE_RESTORE_DIR||'artifacts/local-persistence-restore-v1');
const checkpointPath=path.join(outDir,'checkpoint.json');
const reportPath=path.resolve(process.env.MPR_PERSISTENCE_RESTORE_REPORT||'artifacts/production-persistence-restore-evidence.json');

const checkpoint={
  runId:process.env.MPR_PERSISTENCE_RESTORE_RUN_ID||'LOCAL_PERSISTENCE_RESTORE_DRILL',
  sequence:1,
  processedCount:1000,
  canonicalCount:1000,
  cursor:'local-restore-cursor-1',
  ingestionFingerprint:'local-restore-ingestion-fingerprint',
  artifactContentSha256:'a'.repeat(64)
};

await fs.mkdir(outDir,{recursive:true});
const persisted=serializeCheckpointForPersistence(checkpoint);
await fs.writeFile(checkpointPath,persisted.bytes,'utf8');
const restoredBytes=await fs.readFile(checkpointPath,'utf8');
const restoredCheckpoint=JSON.parse(restoredBytes);
const restored=serializeCheckpointForPersistence(restoredCheckpoint);

const result=evaluatePersistenceRestoreEvidence({
  persistedCheckpoint:checkpoint,
  restoredCheckpoint,
  persistedContentSha256:persisted.contentSha256,
  restoredContentSha256:restored.contentSha256
},{
  attestation:{
    observationMode:'LOCAL_SIMULATION',
    environment:'local',
    evidenceRef:null,
    observedAt:new Date().toISOString(),
    collectorVersion:'production-persistence-restore-evidence-v1-local-drill',
    contentSha256:'0'.repeat(64),
    storageKind:'LOCAL_FILESYSTEM',
    storageRef:checkpointPath,
    restoreProcedureVersion:'local-file-roundtrip-v1',
    persistedContentSha256:persisted.contentSha256,
    restoredContentSha256:restored.contentSha256,
    independentReadBack:true
  }
});

if(result.localRestoreVerified!==true)throw new Error('Local persistence restore drill must verify exact round trip');
if(result.productionRestoreVerified!==false)throw new Error('Local persistence restore drill must not claim production restore verification');
if(result.decision!=='HOLD_PRODUCTION_RESTORE')throw new Error('Local persistence restore drill must remain fail-closed');

const report={
  schema:'MPR_LOCAL_PERSISTENCE_RESTORE_DRILL_V1',
  checkpointPath,
  result,
  policy:{
    productionRestoreVerified:false,
    persistenceRestoreClaim:'LOCAL_ROUND_TRIP_ONLY',
    productionStorageContacted:false,
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES'
  },
  note:'Local filesystem round-trip proves deterministic persistence behavior only; it is not production persistence restore evidence.'
};

await fs.mkdir(path.dirname(reportPath),{recursive:true});
await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
