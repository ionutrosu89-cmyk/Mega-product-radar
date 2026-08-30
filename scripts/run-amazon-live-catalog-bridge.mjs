import {readFile,writeFile} from 'node:fs/promises';
import {buildAmazonLiveCatalogBridge} from '../amazon-live-catalog-bridge-v1.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,...rest]=x.replace(/^--/,'').split('=');return[k,rest.join('=')||true];}));
const livePath=String(args.live||'artifacts/amazon-live-round1/amazon-round1-remaining.compact.json');
const outPath=String(args.out||'amazon-live-catalog.json');
const bootstrap=JSON.parse(await readFile('data/real-products-1000.compact.json','utf8'));
const liveCompact=JSON.parse(await readFile(livePath,'utf8'));
const report=buildAmazonLiveCatalogBridge({bootstrap,liveCompact},{categoryDepth:2});
await writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({schema:report.schema,stats:report.stats,truthPolicy:report.truthPolicy,topCategories:Object.entries(report.products.reduce((acc,p)=>{acc[p.category]=(acc[p.category]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]).slice(0,15)},null,2));
if(report.stats.missingBootstrapAsin!==0)process.exitCode=2;
if(report.truthPolicy.providerSpendEur!==0||report.truthPolicy.paidCallsTriggered!==0||report.truthPolicy.purchaseAuthorized!==false)process.exitCode=3;
