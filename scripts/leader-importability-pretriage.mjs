import fs from 'node:fs';
import {buildLeaderImportabilityPretriage} from '../leader-importability-pretriage-v1.js';
const arg=n=>process.argv.find(x=>x.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const input=JSON.parse(fs.readFileSync(arg('leaders')||'data/amazon-round2-preliminary-leaders-v1.json','utf8'));
const out=arg('out')||'artifacts/leader-importability-pretriage.json';
const result=buildLeaderImportabilityPretriage({leaders:input.leaders||[]});
fs.mkdirSync(new URL('.',`file://${process.cwd()}/${out}`).pathname,{recursive:true});
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({total:result.total,reviewFirstCount:result.reviewFirstCount,noTitleRiskSignalCount:result.noTitleRiskSignalCount},null,2));
