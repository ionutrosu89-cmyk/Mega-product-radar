import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryAtomicClaimStore} from '../atomic-claim-store-v1.js';
import {runAtomicStoreFunctionalEvidenceDrill,buildAtomicStoreAttestationCandidateFromFunctionalEvidence} from '../atomic-store-functional-evidence-v1.js';
import {validateProductionAtomicStoreAttestation} from '../production-atomic-store-attestation-v1.js';

const observedAt='2026-08-27T12:00:00Z';

test('local memory drill verifies functional CAS evidence but not production eligibility',async()=>{
  const evidence=await runAtomicStoreFunctionalEvidenceDrill(createMemoryAtomicClaimStore(),{observedAt});
  assert.equal(evidence.functionalEvidenceVerified,true);
  assert.equal(evidence.checks.compareAndSetVerified,true);
  assert.equal(evidence.checks.conflictSafetyVerified,true);
  assert.equal(evidence.checks.fencingMonotonicityVerified,true);
  assert.equal(evidence.checks.persistenceReadBackVerified,true);
  assert.equal(evidence.productionEvidenceEligible,false);
  assert.equal(evidence.persistenceRestoreVerified,false);
  assert.equal(evidence.exactlyOnceGuaranteed,false);
  assert.equal(evidence.providerDataSpendEur,0);
  assert.equal(evidence.purchaseAuthorized,false);
});

test('functional drill rejects a store without atomic contract',async()=>{
  await assert.rejects(()=>runAtomicStoreFunctionalEvidenceDrill({},{observedAt}),/ATOMIC_STORE_CONTRACT_REQUIRED/);
});

test('attestation candidate derives functional booleans but refuses restore proof',async()=>{
  const evidence=await runAtomicStoreFunctionalEvidenceDrill(createMemoryAtomicClaimStore(),{observedAt});
  const candidate=buildAtomicStoreAttestationCandidateFromFunctionalEvidence(evidence,{
    evidenceRef:'artifact://functional-drill/1',
    reviewedAt:'2026-08-27T12:10:00Z',
    reviewer:'SECURITY_REVIEW'
  });
  assert.equal(candidate.compareAndSetVerified,true);
  assert.equal(candidate.fencingMonotonicityVerified,true);
  assert.equal(candidate.conflictSafetyVerified,true);
  assert.equal(candidate.persistenceRestoreVerified,false);
  const validation=validateProductionAtomicStoreAttestation(candidate);
  assert.equal(validation.valid,false);
  assert.ok(validation.reasons.includes('PRODUCTION_OBSERVATION_REQUIRED'));
  assert.ok(validation.reasons.includes('PRODUCTION_ENVIRONMENT_REQUIRED'));
  assert.ok(validation.reasons.includes('PERSISTENCE_RESTORE_EVIDENCE_REQUIRED'));
});

test('production scope alone cannot create production evidence without explicit production observation metadata',async()=>{
  const memory=createMemoryAtomicClaimStore();
  const store={
    scope:'PRODUCTION_DATABASE',
    adapterKind:'POSTGRES_TRANSACTIONAL_CAS',
    adapterId:'synthetic-prod-store',
    read:key=>memory.read(key),
    compareAndSet:(key,expected,next)=>memory.compareAndSet(key,expected,next)
  };
  const evidence=await runAtomicStoreFunctionalEvidenceDrill(store,{observedAt});
  assert.equal(evidence.functionalEvidenceVerified,true);
  assert.equal(evidence.productionEvidenceEligible,false);
});

test('synthetic production-observed contract path can mark only functional evidence eligible',async()=>{
  const memory=createMemoryAtomicClaimStore();
  const store={
    scope:'PRODUCTION_DATABASE',
    adapterKind:'POSTGRES_TRANSACTIONAL_CAS',
    adapterId:'synthetic-prod-store',
    read:key=>memory.read(key),
    compareAndSet:(key,expected,next)=>memory.compareAndSet(key,expected,next)
  };
  const evidence=await runAtomicStoreFunctionalEvidenceDrill(store,{
    observedAt,
    observationMode:'PRODUCTION_OBSERVED',
    environment:'production',
    evidenceRef:'artifact://synthetic-functional-evidence/1'
  });
  assert.equal(evidence.productionEvidenceEligible,true);
  assert.equal(evidence.persistenceRestoreVerified,false);
  assert.equal(evidence.exactlyOnceGuaranteed,false);
});
