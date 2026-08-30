import fs from 'node:fs/promises';
import path from 'node:path';
import {buildAmazonRound1CanonicalBridge} from '../amazon-round1-canonical-bridge-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const input=String(args.input||'artifacts/amazon-round1-source/amazon-round1-remaining.compact.json');
const out=String(args.out||'artifacts/amazon-round1-canonical/amazon-round1-canonical-bridge.json');
const sourceRunId=String(args.sourceRunId||'33322314894');
const expectedCount=Math.max(1,Number(args.expectedCount||294));

const payload=JSON.parse(await fs.readFile(input,'utf8'));
const result=buildAmazonRound1CanonicalBridge(payload,{sourceRunId});
if(result.manifest.canonicalCount!==expectedCount)throw new Error(`AMAZON_ROUND1_EXPECTED_COUNT_MISMATCH:${result.manifest.canonicalCount}:${expectedCount}`);
if(result.policy.purchaseAuthorized!==false)throw new Error('AMAZON_ROUND1_PURCHASE_POLICY_INVALID');
if(result.policy.salesEvidenceClass!=='NOT_VERIFIED_SALES')throw new Error('AMAZON_ROUND1_SALES_POLICY_INVALID');
if(result.policy.trendAuthorized!==false)throw new Error('AMAZON_ROUND1_TREND_POLICY_INVALID');
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({schemaVersion:result.schemaVersion,canonicalCount:result.manifest.canonicalCount,rejectedCount:result.manifest.rejectedCount,logicalDuplicateCount:result.manifest.logicalDuplicateCount,coverage:result.source.coverage,sourceRunId:result.source.sourceRunId,policy:result.policy},null,2));
