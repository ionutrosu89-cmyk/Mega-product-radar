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
const picks=[];
const OFFSETS=[0,7,19,31];
for(let i=0;i<OFFSETS.length&&themes.length;i++){
  const idx=(day*5+slot*13+OFFSETS[i])%themes.length;
  const theme=themes[idx];
  if(theme&&!picks.some(x=>x.query===theme.query))picks.push(theme);
}
try{
  for(let i=0;i<picks.length;i++){
    await fs.writeFile(BASE,JSON.stringify([picks[i]],null,2)+'\n');
    await import(`./discovery-scan.mjs?widePass=${Date.now()}-${slot}-${i}`);
  }
}finally{
  await fs.writeFile(BASE,original);
}
console.log('Wide discovery passes completed:',picks.map(x=>x.query).join(' | '));
