import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'_site');
await fs.access(out);

for(const publicFile of ['cookies.html','subprocessors.html']){
  await fs.copyFile(path.join(root,publicFile),path.join(out,publicFile));
}

for(const privateFile of ['STRIPE_SANDBOX_RUNBOOK.md','BETA_LAUNCH_CHECKLIST.md','INCIDENT_RESPONSE_RUNBOOK.md','PUBLIC_FREE_LAUNCH_AUDIT.md']){
  await fs.rm(path.join(out,privateFile),{force:true});
}

console.log('Public bundle hardening PASS: public legal pages included; internal runbooks/audits excluded.');
