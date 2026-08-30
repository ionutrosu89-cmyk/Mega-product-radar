import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {REQUIRED_STAGES} from './verify-billing-journey-evidence.mjs';

const text=value=>String(value??'').trim();

export function appendBillingCheckpoint(existing,stage,checkpoint){
  const normalizedStage=text(stage).toUpperCase();
  if(!REQUIRED_STAGES.includes(normalizedStage))throw new Error(`Unsupported checkpoint stage: ${normalizedStage||'(empty)'}`);
  if(checkpoint?.schema!=='MPR_STRIPE_SANDBOX_JOURNEY_CHECKPOINT_V1'||checkpoint?.environment!=='SANDBOX')throw new Error('Invalid sandbox checkpoint payload');
  const workspaceId=text(checkpoint.workspaceId);
  if(!workspaceId)throw new Error('Checkpoint workspace is missing');

  const evidence=existing&&typeof existing==='object'?structuredClone(existing):{
    schema:'MPR_STRIPE_SANDBOX_JOURNEY_EVIDENCE_V1',
    environment:'SANDBOX',
    workspaceId,
    checkout:{mode:'SUBSCRIPTION',currency:'EUR',realMoney:false},
    checkpoints:[]
  };
  if(evidence.schema!=='MPR_STRIPE_SANDBOX_JOURNEY_EVIDENCE_V1'||String(evidence.environment).toUpperCase()!=='SANDBOX')throw new Error('Existing evidence file is not sandbox billing evidence');
  if(text(evidence.workspaceId)!==workspaceId)throw new Error('Checkpoint workspace does not match evidence workspace');
  if(!Array.isArray(evidence.checkpoints))throw new Error('Existing evidence checkpoints are invalid');
  const expected=REQUIRED_STAGES[evidence.checkpoints.length];
  if(!expected)throw new Error('Billing journey evidence is already complete');
  if(normalizedStage!==expected)throw new Error(`Expected checkpoint ${expected}, received ${normalizedStage}`);
  if(evidence.checkpoints.some(row=>String(row?.stage||'').toUpperCase()===normalizedStage))throw new Error(`Checkpoint ${normalizedStage} already exists`);

  const {schema:_schema,environment:_environment,source:_source,...safeCheckpoint}=checkpoint;
  evidence.checkpoints.push({stage:normalizedStage,...safeCheckpoint});
  return evidence;
}

async function readExisting(path){
  try{return JSON.parse(await readFile(path,'utf8'));}
  catch(error){if(error?.code==='ENOENT')return null;throw error;}
}

async function main(){
  const stage=text(process.argv[2]).toUpperCase();
  const path=text(process.argv[3]||process.env.MPR_BILLING_JOURNEY_EVIDENCE||'billing-journey-evidence.json');
  const baseUrl=text(process.env.MPR_BASE_URL).replace(/\/+$/,'');
  const token=text(process.env.MPR_READINESS_PROBE_TOKEN);
  const workspaceId=text(process.env.MPR_BILLING_TEST_WORKSPACE_ID);
  if(!stage)throw new Error('Checkpoint stage is required');
  if(!baseUrl)throw new Error('MPR_BASE_URL is required');
  if(!token)throw new Error('MPR_READINESS_PROBE_TOKEN is required');
  if(!workspaceId)throw new Error('MPR_BILLING_TEST_WORKSPACE_ID is required');

  const response=await fetch(`${baseUrl}/api/internal/billing-journey-snapshot`,{headers:{authorization:`Bearer ${token}`,'x-mpr-workspace-id':workspaceId,accept:'application/json'}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok||!body?.ok||!body?.checkpoint)throw new Error(`Checkpoint snapshot failed (${response.status}): ${body?.code||body?.error||'unknown error'}`);
  const evidence=appendBillingCheckpoint(await readExisting(path),stage,body.checkpoint);
  await writeFile(path,`${JSON.stringify(evidence,null,2)}\n`,'utf8');
  console.log(JSON.stringify({ok:true,stage,workspaceId,path,checkpointCount:evidence.checkpoints.length,nextStage:REQUIRED_STAGES[evidence.checkpoints.length]||null},null,2));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{console.error(JSON.stringify({ok:false,error:String(error?.message||error)},null,2));process.exitCode=1;});
}
