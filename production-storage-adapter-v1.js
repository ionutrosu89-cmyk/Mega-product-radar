import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const iso=value=>Number.isFinite(Date.parse(clean(value)))?new Date(Date.parse(clean(value))).toISOString():null;

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}

function serialize(value){return JSON.stringify(stable(value));}

export function createMemoryStorageAdapter(){
  const map=new Map();
  return{
    kind:'LOCAL_MEMORY',
    async put(key,value){map.set(clean(key),serialize(value));return{key:clean(key),bytes:Buffer.byteLength(map.get(clean(key)))};},
    async get(key){const raw=map.get(clean(key));return raw===undefined?null:JSON.parse(raw);},
    async delete(key){return map.delete(clean(key));}
  };
}

export function createFilesystemStorageAdapter(root='artifacts/local-storage-v1'){
  const base=path.resolve(root);
  const fileFor=key=>path.join(base,`${hash(clean(key))}.json`);
  return{
    kind:'LOCAL_FILESYSTEM',
    root:base,
    async put(key,value){await fs.mkdir(base,{recursive:true});const raw=serialize(value);const file=fileFor(key);await fs.writeFile(file,raw,'utf8');return{key:clean(key),file,bytes:Buffer.byteLength(raw)};},
    async get(key){try{return JSON.parse(await fs.readFile(fileFor(key),'utf8'));}catch{return null;}},
    async delete(key){try{await fs.unlink(fileFor(key));return true;}catch{return false;}}
  };
}

export function validateProductionStorageAttestation(input={},adapter={}){
  const normalized={
    schema:clean(input.schema),
    observationMode:clean(input.observationMode).toUpperCase(),
    environment:clean(input.environment).toLowerCase(),
    storageKind:clean(input.storageKind).toUpperCase(),
    storageRef:clean(input.storageRef)||null,
    evidenceRef:clean(input.evidenceRef)||null,
    reviewedAt:iso(input.reviewedAt),
    reviewer:clean(input.reviewer)||null,
    basis:clean(input.basis)||null,
    adapterKind:clean(input.adapterKind||adapter.kind).toUpperCase()
  };
  const errors=[];
  if(normalized.schema!=='MPR_PRODUCTION_STORAGE_ATTESTATION_V1')errors.push('PRODUCTION_STORAGE_ATTESTATION_SCHEMA_REQUIRED');
  if(normalized.observationMode!=='PRODUCTION_OBSERVED')errors.push('PRODUCTION_OBSERVATION_REQUIRED');
  if(normalized.environment!=='production')errors.push('PRODUCTION_ENVIRONMENT_REQUIRED');
  if(!['PRODUCTION_OBJECT_STORE','PRODUCTION_DATABASE'].includes(normalized.storageKind))errors.push('PRODUCTION_STORAGE_KIND_REQUIRED');
  if(!normalized.storageRef)errors.push('STORAGE_REF_REQUIRED');
  if(!normalized.evidenceRef)errors.push('EVIDENCE_REF_REQUIRED');
  if(!normalized.reviewedAt)errors.push('REVIEWED_AT_REQUIRED');
  if(!normalized.reviewer)errors.push('REVIEWER_REQUIRED');
  if(!normalized.basis)errors.push('BASIS_REQUIRED');
  if(['LOCAL_MEMORY','LOCAL_FILESYSTEM'].includes(normalized.adapterKind))errors.push('LOCAL_ADAPTER_CANNOT_PROVE_PRODUCTION_STORAGE');
  return{ok:errors.length===0,errors,attestation:normalized};
}

export async function persistCheckpoint(adapter,key,checkpoint,options={}){
  if(!adapter||typeof adapter.put!=='function'||typeof adapter.get!=='function')throw new Error('STORAGE_ADAPTER_REQUIRED');
  const raw=serialize(checkpoint);
  const receiptBase={
    schema:'MPR_CHECKPOINT_STORAGE_RECEIPT_V1',
    key:clean(key),
    adapterKind:clean(adapter.kind).toUpperCase(),
    contentSha256:hash(raw),
    checkpointFingerprint:deterministicFingerprint(checkpoint),
    storedAt:iso(options.storedAt)||new Date(0).toISOString(),
    providerDataSpendEur:0,
    paidDataCallsTriggered:0,
    purchaseAuthorized:false
  };
  await adapter.put(receiptBase.key,checkpoint);
  const restored=await adapter.get(receiptBase.key);
  const restoredRaw=restored===null?null:serialize(restored);
  const localRestoreVerified=restoredRaw!==null&&hash(restoredRaw)===receiptBase.contentSha256&&deterministicFingerprint(restored)===receiptBase.checkpointFingerprint;
  const productionAttestation=validateProductionStorageAttestation(options.productionAttestation||{},adapter);
  const productionPersistenceVerified=localRestoreVerified&&productionAttestation.ok;
  const receipt={...receiptBase,localRestoreVerified,productionPersistenceVerified,productionAttestationErrors:productionAttestation.errors};
  return{...receipt,receiptFingerprint:deterministicFingerprint(receipt)};
}
