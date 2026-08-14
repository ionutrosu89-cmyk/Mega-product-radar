import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const files=['index.html','login.html','account.html','executive-ro.html','supplier-intelligence.html','radar-ro.html','discovery-inbox.html','organic-rising.html','market-intelligence.html','strict-audit-ro.html','todays-opportunities.html','fresh-finds.html','purchase-manager-ro.html','landed-cost.html','data-vault.html'];
const premium=await fs.readFile(path.join(root,'premium-ui.css'),'utf8');
const shared={responsive:/@media\s*\(/i.test(premium),mobileWidth:/max-width/i.test(premium),safeArea:/safe-area-inset-(top|bottom)/i.test(premium)};
const results=[];
for(const file of files){
  const text=await fs.readFile(path.join(root,file),'utf8');
  const usesPremium=/href=["'][^"']*premium-ui\.css/i.test(text);
  const checks={
    viewport:/name="viewport"[^>]*viewport-fit=cover/i.test(text),
    responsive:/@media\s*\(/i.test(text)||(usesPremium&&shared.responsive),
    mobileWidth:/max-width/i.test(text)||(usesPremium&&shared.mobileWidth),
    safeArea:/safe-area-inset-(top|bottom)/i.test(text)||(usesPremium&&shared.safeArea)
  };
  const failed=['viewport','responsive','mobileWidth','safeArea'].filter(k=>!checks[k]);
  results.push({file,checks,ok:failed.length===0,failed});
  if(failed.length)throw new Error(`${file} failed mobile QA: ${failed.join(', ')}`);
}
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
if(manifest.display!=='standalone')throw new Error('manifest display must remain standalone');
const report={version:'8.0-ro-market-intelligence',checkedAt:new Date().toISOString(),deviceTarget:'Web/iPhone/Android PWA static readiness',pagesSource:'GitHub Pages main:/',physicalDeviceTest:false,results};
await fs.mkdir(path.join(root,'_site'),{recursive:true});
await fs.writeFile(path.join(root,'_site','qa-mobile-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Cross-platform Romanian UI QA passed: ${results.length} canonical pages. Physical-device acceptance remains manual.`);
