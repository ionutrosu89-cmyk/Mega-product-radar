import fs from 'node:fs/promises';

const BASE='discovery-themes.json';
const WIDE='discovery-themes-wide.json';
const original=await fs.readFile(BASE,'utf8');
const base=JSON.parse(original);
let wide=[];
try{wide=JSON.parse(await fs.readFile(WIDE,'utf8'));}catch{}
const themes=[...base,...wide].filter(x=>x?.query&&x?.cat);
const now=new Date();
const day=Math.floor(Date.now()/86400000);
const slot=Math.floor(now.getUTCHours()/6);
const idx=themes.length?(day*5+slot*13)%themes.length:0;
const theme=themes[idx];
try{
  if(theme){
    await fs.writeFile(BASE,JSON.stringify([theme],null,2)+'\n');
    await import(`./discovery-scan.mjs?wideSlot=${day}-${slot}`);
  }
}finally{
  await fs.writeFile(BASE,original);
}
console.log('Wide discovery pass completed:',theme?.query||'no theme');
