import {readFile} from 'node:fs/promises';
import {evaluateFreeGoLive} from '../free-go-live-gate-v1.js';

const file=process.argv[2];
if(!file){console.error('Usage: node scripts/report-free-go-live.mjs <evidence.json>');process.exitCode=2;}
else{
  try{
    const evidence=JSON.parse(await readFile(file,'utf8'));
    console.log(JSON.stringify(evaluateFreeGoLive(evidence),null,2));
  }catch(error){console.error(`Unable to evaluate Free evidence: ${error.message}`);process.exitCode=2;}
}
