import fs from 'node:fs';
import {buildImportabilityBusinessFit} from '../importability-business-fit-gate-v1.js';

const arg=name=>process.argv.find(x=>x.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const profile=JSON.parse(fs.readFileSync(arg('profile'),'utf8'));
const candidate=arg('asin')||profile.candidateAsin||'B00INKVS82';
const out=arg('out')||'artifacts/importability-business-fit.json';
const result=buildImportabilityBusinessFit({candidateAsin:candidate,profile});
fs.mkdirSync(new URL('.',`file://${process.cwd()}/${out}`).pathname,{recursive:true});
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,candidateAsin:result.candidateAsin,hardBlockers:result.hardBlockers,unknowns:result.unknowns,warnings:result.warnings},null,2));
