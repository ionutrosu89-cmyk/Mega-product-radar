import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const clean=value=>String(value??'').trim();
const upper=value=>clean(value).toUpperCase();
const iso=value=>Number.isFinite(Date.parse(clean(value)))?new Date(Date.parse(clean(value))).toISOString():null;
const sha256=value=>/^[a-f0-9]{64}$/i.test(clean(value));
const clone=value=>JSON.parse(JSON.stringify(value??null));

function stableStringify(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function contentSha256(value){
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function validateHistoryStoreDescriptor(input={}){
  const descriptor={
    scope:upper(input.scope)||'LOCAL_FILE',
    environment:clean(input.environment).toLowerCase()||'local',
    evidenceRef:clean(input.evidenceRef)||null,
    reviewedAt:iso(input.reviewedAt),
    reviewer:clean(input.reviewer)||null,
    basis:clean(input.basis)||null,
    collectorVersion:clean(input.collectorVersion)||null
  };
  const productionScope=['PRODUCTION_OBJECT_STORE','PRODUCTION_DATABASE'].includes(descriptor.scope);
  const errors=[];
  if(productionScope){
    if(descriptor.environment!=='production')errors.push('PRODUCTION_ENVIRONMENT_REQUIRED');
    if(!descriptor.evidenceRef)errors.push('EVIDENCE_REF_REQUIRED');
    if(!descriptor.reviewedAt)errors.push('REVIEWED_AT_REQUIRED');
    if(!descriptor.reviewer)errors.push('REVIEWER_REQUIRED');
    if(!descriptor.basis)errors.push('BASIS_REQUIRED');
    if(!descriptor.collectorVersion)errors.push('COLLECTOR_VERSION_REQUIRED');
  }
  return{descriptor,productionScope,ok:errors.length===0,errors};
}

export function createMemoryHistoryStore(seed={}){
  const map=new Map(Object.entries(seed).map(([k,v])=>[k,clone(v)]));
  return{
    scope:'LOCAL_MEMORY',
    async get(key){return map.has(key)?clone(map.get(key)):null;},
    async put(key,value){map.set(key,clone(value));return{key,scope:'LOCAL_MEMORY'};},
    async list(prefix=''){return[...map.keys()].filter(k=>k.startsWith(prefix)).sort();}
  };
}

export function createFilesystemHistoryStore(root='artifacts/ranking-history-store'){
  const base=path.resolve(root);
  const fileFor=key=>path.join(base,`${clean(key).replace(/[^a-zA-Z0-9._-]/g,'_')}.json`);
  return{
    scope:'LOCAL_FILE',
    root:base,
    async get(key){
      try{return JSON.parse(await fs.readFile(fileFor(key),'utf8'));}catch(error){if(error?.code==='ENOENT')return null;throw error;}
    },
    async put(key,value){
      await fs.mkdir(base,{recursive:true});
      const file=fileFor(key);
      const tmp=`${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp,JSON.stringify(value,null,2));
      await fs.rename(tmp,file);
      return{key,scope:'LOCAL_FILE',storageRef:file};
    },
    async list(prefix=''){
      try{return(await fs.readdir(base)).filter(x=>x.endsWith('.json')&&x.startsWith(prefix.replace(/[^a-zA-Z0-9._-]/g,'_'))).sort();}catch(error){if(error?.code==='ENOENT')return[];throw error;}
    }
  };
}

export async function createNetlifyBlobsHistoryStore(options={}){
  if(options.writeAuthorized!==true)throw new Error('REMOTE_HISTORY_WRITE_NOT_AUTHORIZED');
  const name=clean(options.storeName)||'mpr-ranking-history-v1';
  const {getStore}=await import('@netlify/blobs');
  const store=getStore(name);
  return{
    scope:'PRODUCTION_OBJECT_STORE',
    async get(key){return await store.get(clean(key),{type:'json'});},
    async put(key,value){await store.setJSON(clean(key),value);return{key:clean(key),scope:'PRODUCTION_OBJECT_STORE',storageRef:`netlify-blobs://${name}/${clean(key)}`};},
    async list(prefix=''){const result=await store.list({prefix:clean(prefix)});return(result?.blobs||[]).map(x=>x.key).sort();}
  };
}

export function createHistoryStorageEnvelope(record={},options={}){
  const descriptorValidation=validateHistoryStoreDescriptor(options.descriptor||{});
  const payload={
    schema:'MPR_RANKING_HISTORY_STORAGE_ENVELOPE_V1',
    key:clean(options.key)||null,
    storeScope:upper(options.storeScope)||descriptorValidation.descriptor.scope,
    storedAt:iso(options.storedAt)||null,
    record:clone(record),
    recordFingerprint:deterministicFingerprint(record),
    descriptor:descriptorValidation.descriptor
  };
  return{
    ...payload,
    contentSha256:contentSha256(payload)
  };
}

export async function persistRankingHistoryRecord(store,key,record,options={}){
  if(!store||typeof store.put!=='function')throw new Error('HISTORY_STORE_REQUIRED');
  const descriptorValidation=validateHistoryStoreDescriptor(options.descriptor||{scope:store.scope});
  const envelope=createHistoryStorageEnvelope(record,{
    key,
    storeScope:store.scope,
    storedAt:options.storedAt||new Date().toISOString(),
    descriptor:descriptorValidation.descriptor
  });
  const storage=await store.put(key,envelope);
  const receipt={
    schema:'MPR_RANKING_HISTORY_STORAGE_RECEIPT_V1',
    key:clean(key),
    storeScope:upper(store.scope),
    storageRef:clean(storage?.storageRef)||descriptorValidation.descriptor.evidenceRef||null,
    storedAt:envelope.storedAt,
    contentSha256:envelope.contentSha256,
    recordFingerprint:envelope.recordFingerprint,
    descriptor:descriptorValidation.descriptor,
    descriptorValid:descriptorValidation.ok,
    productionVerified:false
  };
  return{...receipt,fingerprint:deterministicFingerprint(receipt)};
}

export async function restoreRankingHistoryRecord(store,receipt={},options={}){
  if(!store||typeof store.get!=='function')throw new Error('HISTORY_STORE_REQUIRED');
  const envelope=await store.get(receipt.key);
  const descriptorValidation=validateHistoryStoreDescriptor(options.descriptor||receipt.descriptor||{});
  if(!envelope)return{
    schema:'MPR_RANKING_HISTORY_RESTORE_PROOF_V1',
    key:clean(receipt.key)||null,
    found:false,
    hashMatch:false,
    fingerprintMatch:false,
    localVerified:false,
    productionVerified:false,
    decision:'RESTORE_NOT_VERIFIED',
    reasons:['RECORD_NOT_FOUND']
  };
  const recalculated=createHistoryStorageEnvelope(envelope.record,{
    key:envelope.key,
    storeScope:envelope.storeScope,
    storedAt:envelope.storedAt,
    descriptor:envelope.descriptor
  });
  const hashMatch=sha256(receipt.contentSha256)&&receipt.contentSha256===recalculated.contentSha256&&envelope.contentSha256===recalculated.contentSha256;
  const fingerprintMatch=receipt.recordFingerprint===recalculated.recordFingerprint;
  const localVerified=hashMatch&&fingerprintMatch;
  const scopeMatches=upper(store.scope)===descriptorValidation.descriptor.scope;
  const evidenceRefMatches=Boolean(descriptorValidation.descriptor.evidenceRef&&receipt.storageRef&&descriptorValidation.descriptor.evidenceRef===receipt.storageRef);
  const productionVerified=localVerified&&descriptorValidation.productionScope&&descriptorValidation.ok&&scopeMatches&&evidenceRefMatches;
  const reasons=[];
  if(!hashMatch)reasons.push('CONTENT_HASH_MISMATCH');
  if(!fingerprintMatch)reasons.push('RECORD_FINGERPRINT_MISMATCH');
  if(descriptorValidation.productionScope&&!descriptorValidation.ok)reasons.push(...descriptorValidation.errors);
  if(descriptorValidation.productionScope&&!scopeMatches)reasons.push('STORE_SCOPE_MISMATCH');
  if(descriptorValidation.productionScope&&!evidenceRefMatches)reasons.push('EVIDENCE_REF_MISMATCH');
  return{
    schema:'MPR_RANKING_HISTORY_RESTORE_PROOF_V1',
    key:clean(receipt.key)||null,
    found:true,
    hashMatch,
    fingerprintMatch,
    localVerified,
    productionVerified,
    decision:productionVerified?'PRODUCTION_RESTORE_VERIFIED':localVerified?'LOCAL_RESTORE_VERIFIED':'RESTORE_NOT_VERIFIED',
    reasons:[...new Set(reasons)],
    record:clone(envelope.record),
    contentSha256:recalculated.contentSha256,
    recordFingerprint:recalculated.recordFingerprint
  };
}
