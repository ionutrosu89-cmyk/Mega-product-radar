import fs from 'node:fs';
import {buildFirstFinalistDecision} from '../first-finalist-decision-gate-v1.js';

const arg=name=>process.argv.find(x=>x.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const fusion=JSON.parse(fs.readFileSync(arg('fusion'),'utf8'));
const romania=JSON.parse(fs.readFileSync(arg('romania'),'utf8'));
const supplier=JSON.parse(fs.readFileSync(arg('supplier'),'utf8'));
const economics=JSON.parse(fs.readFileSync(arg('economics'),'utf8'));
const candidate=arg('asin')||'B00INKVS82';
const out=arg('out')||'artifacts/first-finalist-decision.json';
const result=buildFirstFinalistDecision({candidateAsin:candidate,trendFusion:fusion,romaniaEvidence:romania,supplierEvidence:supplier,economicsEvidence:economics});
fs.mkdirSync(new URL('.',`file://${process.cwd()}/${out}`).pathname,{recursive:true});
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,candidateAsin:result.candidateAsin,gates:result.gates,blockers:result.blockers},null,2));
