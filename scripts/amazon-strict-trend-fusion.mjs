import fs from 'node:fs';
import { buildAmazonStrictTrendFusion } from '../amazon-strict-trend-fusion-v1.js';

const arg=name=>process.argv.find(x=>x.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const leadersPath=arg('leaders')||'data/amazon-round2-preliminary-leaders-v1.json';
const rankPath=arg('rank')||'artifacts/amazon-leader-bsr-history-round2.json';
const out=arg('out')||'artifacts/amazon-strict-trend-fusion-round2.json';
const leaders=JSON.parse(fs.readFileSync(leadersPath,'utf8'));
const rankHistory=JSON.parse(fs.readFileSync(rankPath,'utf8'));
const result=buildAmazonStrictTrendFusion({leaders,rankHistory});
fs.mkdirSync(out.split('/').slice(0,-1).join('/')||'.',{recursive:true});
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,productsEvaluated:result.productsEvaluated,confirmedAccelerationCount:result.confirmedAccelerationCount,confirmedAsins:result.confirmedAsins}));
if(!result.ok) process.exitCode=2;
