import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildRomaniaManualReviewPack} from '../romania-manual-review-pack-v1.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const queuePath=path.join(root,'data','romania-comparable-evidence-review-queue-v1.json');
const outPath=path.join(root,'artifacts','romania-manual-review-pack-v1.json');
const queue=JSON.parse(await fs.readFile(queuePath,'utf8'));
const pack=buildRomaniaManualReviewPack({queueItems:queue.items||[]});
pack.generatedAt=new Date().toISOString();
await fs.mkdir(path.dirname(outPath),{recursive:true});
await fs.writeFile(outPath,JSON.stringify(pack,null,2)+'\n','utf8');
console.log(`Romania manual review pack: ${pack.totalTasks} tasks, paid calls=${pack.paidCallsTriggered}, purchase=${pack.purchaseAuthorized}.`);
console.log(outPath);
