import {readFile} from 'node:fs/promises';
import {evaluateEditorialFreeBeta} from '../editorial-free-beta-gate-v1.js';

const evidenceFile=process.argv[2];
if(!evidenceFile){
  console.error('Usage: node scripts/report-editorial-free-beta.mjs <evidence.json>');
  process.exitCode=2;
}else{
  try{
    const [editorialCandidates,input]=await Promise.all([
      readFile(new URL('../data/editorial-radar-candidates-v1.json',import.meta.url),'utf8').then(JSON.parse),
      readFile(evidenceFile,'utf8').then(JSON.parse),
    ]);
    console.log(JSON.stringify(evaluateEditorialFreeBeta({...input,editorialCandidates}),null,2));
  }catch(error){
    console.error(`Unable to evaluate editorial Free beta: ${error.message}`);
    process.exitCode=2;
  }
}
