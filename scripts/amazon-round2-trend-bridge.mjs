import fs from 'node:fs/promises';
import path from 'node:path';
import {parseCompactAmazonSnapshots} from '../amazon-round2-orchestrator-v1.js';
import {buildAmazonRound2PreliminaryTrendEvidence,appendAmazonRound2ToSnapshotLedger} from '../amazon-round2-trend-bridge-v1.js';

const root=process.cwd();
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...r]=x.replace(/^--/,'').split('=');return[k,r.join('=')||true];}));
const artifactPath=String(args.artifact||'artifacts/amazon-round2-refresh.json');
const outPath=String(args.out||'artifacts/amazon-round2-trend-bridge-v1.json');
const round1Files=[
  'data/live-snapshots/amazon-2026-08-25-batch-000.compact.json',
  'data/live-snapshots/amazon-round1-remaining.compact.json',
  'data/live-snapshots/amazon-round1-missing-retry.compact.json'
];

async function readJson(file){return JSON.parse(await fs.readFile(path.join(root,file),'utf8'));}

let artifact;
try{artifact=await readJson(artifactPath);}catch(error){
  const blocked={
    version:'1.0',status:'BLOCKED',blocker:'ROUND2_ARTIFACT_MISSING',artifactPath,
    preliminaryTrend:{eligible:0,rows:[]},history:{trendReadyCount:0,products:[]},
    policy:'ROUND2_ARTIFACT_REQUIRED; ROUND1_ONLY_CANNOT_CREATE_LONGITUDINAL_TREND; NO_NETWORK; NO_RANK_INFERENCE; NOT_VERIFIED_SALES; NO_PURCHASE_AUTHORIZATION',
    salesEvidenceClass:'NOT_VERIFIED_SALES',paidCallsTriggered:0,purchaseAuthorized:false
  };
  await fs.mkdir(path.dirname(path.join(root,outPath)),{recursive:true});
  await fs.writeFile(path.join(root,outPath),JSON.stringify(blocked,null,2)+'\n');
  console.error('ROUND2_ARTIFACT_MISSING');
  process.exitCode=3;
}

if(artifact){
  const payloads=await Promise.all(round1Files.map(readJson));
  const latest=new Map();
  for(const payload of payloads){
    for(const row of parseCompactAmazonSnapshots(payload)){
      const prev=latest.get(row.asin);
      if(!prev||row.observedAt>prev.observedAt)latest.set(row.asin,row);
    }
  }
  const round1Snapshots=[...latest.values()].map(row=>({
    platform:'AMAZON',externalId:row.asin,observedAt:row.observedAt,freshnessClass:'LIVE_PUBLIC_PAGE',
    price:row.price,currency:row.currency,rating:row.rating,reviewCount:row.reviewCount,sourceRank:null,
    sourceKey:'AMAZON_LIVE_PUBLIC_PAGE',evidenceClass:'LIVE_PUBLIC_PRODUCT_PAGE',salesEvidenceClass:'NOT_VERIFIED_SALES',purchaseAuthorized:false
  }));
  const preliminaryTrend=buildAmazonRound2PreliminaryTrendEvidence(artifact);
  const ledger=appendAmazonRound2ToSnapshotLedger({round1Snapshots,artifact});
  const result={
    version:'1.0',status:preliminaryTrend.ok?'READY':'BLOCKED',
    round1IdentityCount:round1Snapshots.length,
    round2ObservationCount:Array.isArray(artifact.observations)?artifact.observations.length:0,
    preliminaryTrend,
    history:{productCount:ledger.history?.productCount||0,trendReadyCount:ledger.history?.trendReadyCount||0,products:ledger.history?.products||[]},
    ledgerSnapshotCount:ledger.ledgerSnapshots?.length||0,
    policy:'OFFLINE_ROUND2_TO_APPEND_ONLY_HISTORY_TO_PRELIMINARY_TREND; MINIMUM_24H; REVIEW_VELOCITY_IS_NOT_SALES_VELOCITY; NO_RANK_INFERENCE; NO_DEMAND_CONFIRMATION; PROMISING_SUPPORT_ONLY; NO_NETWORK; NO_PURCHASE_AUTHORIZATION',
    salesEvidenceClass:'NOT_VERIFIED_SALES',paidCallsTriggered:0,purchaseAuthorized:false
  };
  await fs.mkdir(path.dirname(path.join(root,outPath)),{recursive:true});
  await fs.writeFile(path.join(root,outPath),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({status:result.status,round1IdentityCount:result.round1IdentityCount,round2ObservationCount:result.round2ObservationCount,preliminaryEligible:preliminaryTrend.eligible||0,trendReadyCount:result.history.trendReadyCount},null,2));
  if(!preliminaryTrend.ok)process.exitCode=4;
}
