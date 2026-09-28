import fs from 'node:fs/promises';
import path from 'node:path';
import {stageGoogleTrendsObservation} from '../google-trends-csv-v1.js';

const args=process.argv.slice(2),option=name=>{const index=args.indexOf(`--${name}`);return index>=0?args[index+1]:null;};
const csvPath=option('csv'),nicheId=option('niche'),concept=option('concept'),sourceUrl=option('source-url');
if(!csvPath||!nicheId||!concept||!sourceUrl)throw new Error('Usage: node scripts/stage-google-trends.mjs --csv <official-export.csv> --niche BIROU_ORGANIZARE --concept <name> --source-url <trends.google.com/trends/explore?geo=RO&q=...>');
const csv=await fs.readFile(path.resolve(csvPath),'utf8');
const draft=stageGoogleTrendsObservation(csv,{nicheId,concept,sourceUrl});
const directory=path.resolve('artifacts/trends-imports');
await fs.mkdir(directory,{recursive:true});
const file=path.join(directory,`${new Date().toISOString().replace(/[:.]/g,'-')}-${draft.nicheId}.json`);
await fs.writeFile(file,JSON.stringify(draft,null,2)+'\n',{flag:'wx'});
console.log(`Draft saved for review: ${file}`);
