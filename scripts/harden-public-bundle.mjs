import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'_site');
await fs.access(out);

for(const publicFile of ['cookies.html','subprocessors.html','account-privacy.js','404.html','current-top25.html','current-top25.js']){
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

// Current 7D/30D intelligence is the primary Free experience. Historical 2023 remains
// explicitly available as archive only and must never be the implicit commercial Top25.
const betaPath=path.join(out,'beta.html');
try{
  let beta=await fs.readFile(betaPath,'utf8');
  beta=beta.replaceAll('href="top25.html"','href="current-top25.html"');
  beta=beta.replace('Explorează 25 de nișe documentate și spune-ne ce merită urmărit live.','Explorează topurile actuale pe 7 și 30 de zile, cu coverage și surse verificabile.');
  await fs.writeFile(betaPath,beta);
}catch(error){if(error?.code!=='ENOENT')throw error;}

const archivePath=path.join(out,'top25.html');
try{
  let archive=await fs.readFile(archivePath,'utf8');
  if(!archive.includes('current-top25.html'))archive=archive.replace(/<body(\s[^>]*)?>/i,match=>`${match}<div style="background:#fffaeb;border-bottom:1px solid #fedf89;padding:10px 16px;text-align:center;font:800 11px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;color:#7a2e0e">Aceasta este arhiva istorică 2023. <a href="current-top25.html" style="color:#175cd3">Deschide Top actual 7D / 30D →</a></div>`);
  await fs.writeFile(archivePath,archive);
}catch(error){if(error?.code!=='ENOENT')throw error;}

for(const privateFile of ['STRIPE_SANDBOX_RUNBOOK.md','BETA_LAUNCH_CHECKLIST.md','INCIDENT_RESPONSE_RUNBOOK.md','PUBLIC_FREE_LAUNCH_AUDIT.md']){
  await fs.rm(path.join(out,privateFile),{force:true});
}

console.log('Public bundle hardening PASS: current Top25 is primary; archive is explicitly labeled; internal runbooks/audits excluded.');
