import fs from 'node:fs';
import path from 'node:path';
import {measureCompactBootstrapSource,planCanonicalBootstrapResolution} from '../bootstrap-source-coverage-v1.js';

const input=process.argv.find(x=>x.startsWith('--input='))?.slice('--input='.length)||'data/real-products-1000.compact.json';
const output=process.argv.find(x=>x.startsWith('--out='))?.slice('--out='.length)||null;
const dataset=JSON.parse(fs.readFileSync(input,'utf8'));
const sourceCoverage=measureCompactBootstrapSource(dataset);
const resolutionPlan=planCanonicalBootstrapResolution(dataset);
const report={
  schemaVersion:'MPR_P2_SOURCE_MEASUREMENT_RUN_V1',
  generatedAt:new Date().toISOString(),
  input:path.normalize(input),
  sourceSchemaVersion:dataset.schemaVersion||null,
  sourceProductSetSha256:dataset.productSetSha256||null,
  sourceCoverage,
  canonicalResolutionPlan:{itemCount:resolutionPlan.items.length,rejectedCount:resolutionPlan.rejected.length,serverResolutionRequired:resolutionPlan.serverResolutionRequired,clientGeneratedCanonicalUuid:false},
  readiness:{rawSourceBaseline:sourceCoverage.sourceProductCount>=1000?'BASELINE_1000_PRESENT':'BASELINE_BELOW_1000',canonicalScaleDecision:'HOLD_UNTIL_SERVER_ALIAS_RESOLUTION_MEASURED'},
  paidCallsTriggered:0,providerSpendEur:0,purchaseAuthorized:false
};
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
