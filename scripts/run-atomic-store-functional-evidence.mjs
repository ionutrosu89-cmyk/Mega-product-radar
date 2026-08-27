import fs from 'node:fs/promises';
import path from 'node:path';
import {createMemoryAtomicClaimStore} from '../atomic-claim-store-v1.js';
import {runAtomicStoreFunctionalEvidenceDrill,buildAtomicStoreAttestationCandidateFromFunctionalEvidence} from '../atomic-store-functional-evidence-v1.js';
import {validateProductionAtomicStoreAttestation} from '../production-atomic-store-attestation-v1.js';

const outputPath=process.env.MPR_ATOMIC_FUNCTIONAL_EVIDENCE_OUTPUT||'artifacts/atomic-store-functional-evidence.json';
const observedAt=process.env.MPR_ATOMIC_FUNCTIONAL_EVIDENCE_OBSERVED_AT||'2026-08-27T12:00:00Z';
const store=createMemoryAtomicClaimStore();
const evidence=await runAtomicStoreFunctionalEvidenceDrill(store,{observedAt});
const candidate=buildAtomicStoreAttestationCandidateFromFunctionalEvidence(evidence,{
  evidenceRef:'local://atomic-store-functional-evidence',
  reviewedAt:observedAt,
  reviewer:'LOCAL_SELF_TEST',
  collectorVersion:'atomic-store-functional-evidence-v1'
});
const attestationValidation=validateProductionAtomicStoreAttestation(candidate);
const report={
  schema:'MPR_ATOMIC_STORE_FUNCTIONAL_EVIDENCE_REPORT_V1',
  evidence,
  attestationCandidate:candidate,
  attestationValidation,
  policy:{
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false,
    verifiedSalesRows:0,
    salesEvidenceClass:'NOT_VERIFIED_SALES',
    productionAtomicityVerified:false,
    persistenceRestoreVerified:false,
    exactlyOnceGuaranteed:false,
    status:'HOLD_PRODUCTION_ATOMICITY'
  },
  notes:[
    'Local memory CAS validates functional claim mechanics only.',
    'Read-back persistence is not a production restore drill.',
    'Production atomicity remains HOLD until reviewed production-observed adapter evidence and restore evidence exist.',
    'This runner performs no paid provider calls and authorizes no purchase.'
  ]
};
if(evidence.productionEvidenceEligible!==false)throw new Error('LOCAL_DRILL_MUST_NOT_BE_PRODUCTION_ELIGIBLE');
if(attestationValidation.valid!==false)throw new Error('LOCAL_DRILL_MUST_NOT_ATTEST_PRODUCTION_ATOMICITY');
await fs.mkdir(path.dirname(outputPath),{recursive:true});
await fs.writeFile(outputPath,JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({
  status:'HOLD_PRODUCTION_ATOMICITY',
  functionalEvidenceVerified:evidence.functionalEvidenceVerified,
  productionEvidenceEligible:evidence.productionEvidenceEligible,
  persistenceRestoreVerified:false,
  exactlyOnceGuaranteed:false,
  providerDataSpendEur:0,
  paidDataCallsTriggered:0,
  purchaseAuthorized:false,
  outputPath
},null,2));
