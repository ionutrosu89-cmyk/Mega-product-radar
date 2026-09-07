import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'_site');
await fs.access(out);

for(const publicFile of ['cookies.html','subprocessors.html','account-privacy.js']){
  await fs.copyFile(path.join(root,publicFile),path.join(out,publicFile));
}

const accountPath=path.join(out,'account.html');
let account=await fs.readFile(accountPath,'utf8');
if(!account.includes('id="exportAccountData"')){
  const privacySection='<section class="card"><h2>Datele și confidențialitatea contului</h2><p class="status">Poți descărca o copie structurată a datelor contului. Ștergerea este definitivă și elimină contul și workspace-urile deținute; un abonament activ trebuie rezolvat înainte.</p><div class="row"><button id="exportAccountData">Descarcă datele mele</button><button class="danger" id="deleteAccount">Șterge definitiv contul</button></div><p class="status" id="privacyActionStatus" aria-live="polite"></p></section>';
  account=account.replace('<section class="card"><button class="danger" id="logout"',`${privacySection}<section class="card"><button class="danger" id="logout"`);
}
if(!account.includes('account-privacy.js'))account=account.replace('</body>','<script type="module" src="account-privacy.js"></script></body>');
await fs.writeFile(accountPath,account);

for(const privateFile of ['STRIPE_SANDBOX_RUNBOOK.md','BETA_LAUNCH_CHECKLIST.md','INCIDENT_RESPONSE_RUNBOOK.md','PUBLIC_FREE_LAUNCH_AUDIT.md']){
  await fs.rm(path.join(out,privateFile),{force:true});
}

console.log('Public bundle hardening PASS: public legal/privacy controls included; internal runbooks/audits excluded.');
