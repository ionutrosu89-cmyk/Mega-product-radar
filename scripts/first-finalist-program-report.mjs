import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildFirstFinalistProgram} from '../first-finalist-program-v1.js';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const inputArg=process.argv[2]||'data/first-finalist-program-current-v1.json';
const outputArg=process.argv[3]||'artifacts/first-finalist-program-report-v1.json';
const inputPath=path.resolve(root,inputArg);
const outputPath=path.resolve(root,outputArg);
if(!fs.existsSync(inputPath))throw new Error(`First Finalist input missing: ${inputArg}`);
const state=JSON.parse(fs.readFileSync(inputPath,'utf8'));
const report={generatedAt:new Date().toISOString(),...buildFirstFinalistProgram(state)};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(`First Finalist Program: phase=${report.phase} evidence=${report.evidenceCompletionPct}% next=${report.nextAction}`);
console.log(`KPIs: 2live=${report.metrics.productsWithTwoLiveSnapshots} trend=${report.metrics.productsWithConfirmedTrendFusion} ROexact=${report.metrics.nichesWithExactRomaniaGap} supplier=${report.metrics.productsWithVerifiedSupplierPackage} economics=${report.metrics.productsWithConfirmedLandedEconomics} promising=${report.metrics.promisingProducts} validate=${report.metrics.validateProducts} finalist=${report.metrics.finalistProducts}`);
console.log(`Safety: paidCalls=${report.spend.paidCallsTriggered} approvedSpendEur=${report.spend.approvedSpendEur} purchase=${report.purchaseAuthorized}`);
