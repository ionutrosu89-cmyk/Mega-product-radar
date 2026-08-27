import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createMemoryStorageAdapter,createFilesystemStorageAdapter,persistCheckpoint,validateProductionStorageAttestation} from '../production-storage-adapter-v1.js';

const checkpoint={schema:'MPR_INGESTION_CHECKPOINT_V1',runId:'r1',sequence:1,processedCount:10,canonicalCount:10,cursor:'c1',ingestionFingerprint:'f1',artifactContentSha256:'a'.repeat(64)};

test('memory adapter persists and restores deterministically but never proves production storage',async()=>{
  const adapter=createMemoryStorageAdapter();
  const receipt=await persistCheckpoint(adapter,'checkpoint/r1',checkpoint,{storedAt:'2026-08-27T10:00:00Z'});
  assert.equal(receipt.localRestoreVerified,true);
  assert.equal(receipt.productionPersistenceVerified,false);
  assert.ok(receipt.productionAttestationErrors.includes('LOCAL_ADAPTER_CANNOT_PROVE_PRODUCTION_STORAGE'));
});

test('filesystem adapter performs real local round trip',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'mpr-storage-'));
  const adapter=createFilesystemStorageAdapter(root);
  const receipt=await persistCheckpoint(adapter,'checkpoint/r1',checkpoint,{storedAt:'2026-08-27T10:00:00Z'});
  assert.equal(receipt.localRestoreVerified,true);
  assert.equal(receipt.adapterKind,'LOCAL_FILESYSTEM');
  await fs.rm(root,{recursive:true,force:true});
});

test('production attestation requires reviewed non-local storage evidence',()=>{
  const result=validateProductionStorageAttestation({schema:'MPR_PRODUCTION_STORAGE_ATTESTATION_V1',observationMode:'PRODUCTION_OBSERVED',environment:'production',storageKind:'PRODUCTION_OBJECT_STORE',storageRef:'object://prod/checkpoints',evidenceRef:'artifact://review/1',reviewedAt:'2026-08-27T10:00:00Z',reviewer:'reviewer-1',basis:'reviewed storage contract',adapterKind:'PRODUCTION_OBJECT_STORE'});
  assert.equal(result.ok,true);
});
