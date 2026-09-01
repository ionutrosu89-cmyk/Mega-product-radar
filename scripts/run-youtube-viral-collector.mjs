import fs from 'node:fs/promises';
import path from 'node:path';
import {buildYouTubeQueryPlan,collectYouTubeSignals} from '../youtube-viral-collector.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...v]=x.replace(/^--/,'').split('=');return [k,v.join('=')||true];}));
const input=String(args.input||'data/youtube-viral-concepts-pilot.json');
const output=String(args.output||'artifacts/youtube-viral-collector-report.json');
const payload=JSON.parse(await fs.readFile(input,'utf8'));
const plan=buildYouTubeQueryPlan(payload.concepts||[],{markets:payload.markets,maxQueries:Number(args.maxQueries||payload.maxQueries||20),publishedAfter:payload.publishedAfter});
const execute=String(args.execute||'false')==='true';
const report=execute?await collectYouTubeSignals(plan,{apiKey:process.env.YOUTUBE_API_KEY,termsApproved:process.env.MPR_YOUTUBE_TERMS_APPROVED==='true',sourceEnabled:process.env.MPR_YOUTUBE_SOURCE_ENABLED==='true'}):{schema:'MPR_YOUTUBE_VIRAL_COLLECTION_V1',status:'DRY_RUN',plannedQueries:plan.length,plan,apiCalls:0,observations:[],policy:{maxQueries:20,providerDataSpendEur:0,purchaseAuthorized:false,claimsSales:false}};
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
