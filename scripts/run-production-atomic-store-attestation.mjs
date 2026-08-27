import fs from 'node:fs/promises';
import path from 'node:path';
import {createMemoryAtomicClaimStore} from '../atomic-claim-store-v1.js';
import {evaluateProductionAtomicStoreReadiness} from '../production-atomic-store-attestation-v1.js';

const arg=(name,fallback)=>{const p=`--${name}=`;const hit=process.argv.find(x=>x.startsWith(p));return hit?hit.slice(p.length):fallback;};
const out=arg('out','artifacts/production-atomic-store-attestation.json');
const store=createMemoryAtomicClaimStore();
const attestation={
  observationMode:'LOCAL_SIMULATION',
  environment:'local',
  adapterKind:'LOCAL_MEMORY_CAS',
  adapterId:'local-memory-cas',
  evidenceRef:null,
  reviewedAt:null,
  reviewer:null,
  collectorVersion:'production-atomic-store-attestation-v1',
  contentSha256:'0'.repeat(64),
  compareAndSetVerified:false,
  fencingMonotonicityVerified:false,
  conflictSafetyVerified:false,
  persistenceRestoreVerified:false
};
const readiness=evaluateProductionAtomicStoreReadiness(store,attestation);
const report={
  schema:'MPR_PRODUCTION_ATOMIC_STORE_ATTESTATION_DRILL_V1',
  mode:'local_contract_drill',
  readiness,
  productionAtomicityVerified:false,
  distributedLockingVerified:false,
  exactlyOnceGuaranteed:false,
  providerDataSpendEur:0,
  paidDataCallsTriggered:0,
  purchaseAuthorized:false,
  verifiedSalesRows:0,
  salesEvidenceClass:'NOT_VERIFIED_SALES',
  decision:'HOLD_PRODUCTION_ATOMICITY',
  notes:['No production adapter is contacted by this drill.','Local memory CAS cannot establish production atomicity.','A reviewed production evidence record is required before production atomicity may be asserted.']
};
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(report,null,2));
if(readiness.productionAtomicityVerified||report.productionAtomicityVerified||report.exactlyOnceGuaranteed)throw new Error('LOCAL_PRODUCTION_ATOMIC_ATTESTATION_MUST_FAIL_CLOSED');
console.log(JSON.stringify(report,null,2));
