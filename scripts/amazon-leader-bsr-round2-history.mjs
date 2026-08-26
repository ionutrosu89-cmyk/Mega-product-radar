import fs from 'node:fs/promises';
import path from 'node:path';
import {buildLeaderBsrHistory} from '../amazon-leader-bsr-history-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...r]=x.replace(/^--/,'').split('=');return[k,r.join('=')||true];}));
const baselinePath=String(args.baseline||'data/amazon-leader-bsr-baseline-2026-08-26-v1.json');
const currentPath=String(args.current||'artifacts/amazon-leader-bsr-snapshot.json');
const out=String(args.out||'artifacts/amazon-leader-bsr-history.json');
const baseline=JSON.parse(await fs.readFile(baselinePath,'utf8'));
const current=JSON.parse(await fs.readFile(currentPath,'utf8'));
const result=buildLeaderBsrHistory({baseline,current,minimumIntervalHours:24});
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({ok:result.ok,status:result.status,elapsedHours:result.elapsedHours??null,eligibleProductCount:result.eligibleProductCount??0,conflictProductCount:result.conflictProductCount??0,comparableCategoryCount:result.comparableCategoryCount??0,blockedCount:result.blockedCount??0},null,2));
if(!result.ok)process.exitCode=result.status==='TOO_EARLY'?2:1;
