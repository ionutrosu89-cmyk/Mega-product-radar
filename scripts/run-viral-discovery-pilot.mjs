import fs from 'node:fs/promises';
import path from 'node:path';
import {buildViralPilotReport} from '../viral-collector-contract.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...v]=x.replace(/^--/,'').split('=');return [k,v.join('=')||true];}));
const input=String(args.input||'data/viral-discovery-pilot-input.json');
const output=String(args.output||'artifacts/viral-discovery-pilot-report.json');
const payload=JSON.parse(await fs.readFile(input,'utf8'));
if(payload.schema!=='MPR_VIRAL_PILOT_INPUT_V1')throw new Error('VIRAL_PILOT_INPUT_SCHEMA_REQUIRED');
const report=buildViralPilotReport(payload.observations||[],{sourcePolicies:payload.sourcePolicies||{}});
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.policy.providerDataSpendEur!==0||report.policy.purchaseAuthorized!==false||report.policy.romaniaMissingAsScarcity!==false)throw new Error('VIRAL_PILOT_POLICY_VIOLATION');
