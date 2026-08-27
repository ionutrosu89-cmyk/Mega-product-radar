import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryAtomicClaimStore} from '../atomic-claim-store-v1.js';
import {validateProductionAtomicStoreAttestation,evaluateProductionAtomicStoreReadiness} from '../production-atomic-store-attestation-v1.js';

const attestation={
  observationMode:'PRODUCTION_OBSERVED',environment:'production',adapterKind:'POSTGRES_TRANSACTIONAL_CAS',adapterId:'prod-claim-store-1',
  evidenceRef:'artifact://atomic-store-review/1',reviewedAt:'2026-08-27T12:00:00Z',reviewer:'SECURITY_REVIEW',collectorVersion:'atomic-store-attestation-v1',contentSha256:'a'.repeat(64),
  compareAndSetVerified:true,fencingMonotonicityVerified:true,conflictSafetyVerified:true,persistenceRestoreVerified:true
};

function productionStore(overrides={}){
  const validation=validateProductionAtomicStoreAttestation(attestation);
  return{
    scope:'PRODUCTION_DATABASE',
    adapterKind:'POSTGRES_TRANSACTIONAL_CAS',
    adapterId:'prod-claim-store-1',
    evidenceRef:attestation.evidenceRef,
    attestationFingerprint:validation.fingerprint,
    async read(){},
    async compareAndSet(){},
    ...overrides
  };
}

test('attestation fails closed without reviewed evidence',()=>{
  const v=validateProductionAtomicStoreAttestation({});
  assert.equal(v.valid,false);
  assert.ok(v.reasons.includes('PRODUCTION_OBSERVATION_REQUIRED'));
  assert.ok(v.reasons.includes('EVIDENCE_REF_REQUIRED'));
});

test('unsupported adapter cannot be attested',()=>{
  const v=validateProductionAtomicStoreAttestation({...attestation,adapterKind:'LOCAL_MEMORY_CAS'});
  assert.equal(v.valid,false);
  assert.ok(v.reasons.includes('SUPPORTED_ATOMIC_ADAPTER_REQUIRED'));
});

test('local memory store cannot be promoted by a production attestation',()=>{
  const store=createMemoryAtomicClaimStore();
  const result=evaluateProductionAtomicStoreReadiness(store,attestation);
  assert.equal(result.productionAtomicityVerified,false);
  assert.equal(result.decision,'HOLD_PRODUCTION_ATOMICITY');
  assert.ok(result.reasons.includes('PRODUCTION_STORE_SCOPE_REQUIRED'));
});

test('adapter identity mismatch fails closed',()=>{
  const result=evaluateProductionAtomicStoreReadiness(productionStore({adapterId:'different'}),attestation);
  assert.equal(result.productionAtomicityVerified,false);
  assert.ok(result.reasons.includes('ADAPTER_ID_MISMATCH'));
});

test('evidence reference mismatch fails closed',()=>{
  const result=evaluateProductionAtomicStoreReadiness(productionStore({evidenceRef:'artifact://different-review'}),attestation);
  assert.equal(result.productionAtomicityVerified,false);
  assert.ok(result.reasons.includes('EVIDENCE_REF_BINDING_MISMATCH'));
});

test('attestation fingerprint mismatch fails closed',()=>{
  const result=evaluateProductionAtomicStoreReadiness(productionStore({attestationFingerprint:'stale-attestation'}),attestation);
  assert.equal(result.productionAtomicityVerified,false);
  assert.ok(result.reasons.includes('ATTESTATION_FINGERPRINT_BINDING_MISMATCH'));
});

test('synthetic contract path verifies production atomicity only with complete exact evidence binding',()=>{
  const result=evaluateProductionAtomicStoreReadiness(productionStore(),attestation);
  assert.equal(result.productionAtomicityVerified,true);
  assert.equal(result.distributedLockingVerified,true);
  assert.equal(result.exactlyOnceGuaranteed,false);
  assert.equal(result.binding.adapterKindMatches,true);
  assert.equal(result.binding.adapterIdMatches,true);
  assert.equal(result.binding.evidenceRefMatches,true);
  assert.equal(result.binding.attestationFingerprintMatches,true);
  assert.equal(result.providerDataSpendEur,0);
  assert.equal(result.purchaseAuthorized,false);
  assert.equal(result.salesEvidenceClass,'NOT_VERIFIED_SALES');
});
