const portfolioKey=s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
const itemTime=x=>{const t=Date.parse(x?.updatedAt||x?.at||'');return Number.isFinite(t)?t:0;};

export function dedupePortfolio(rows=[]){
  const map=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    const key=portfolioKey(row?.name);if(!key)continue;
    const old=map.get(key);
    if(!old||itemTime(row)>=itemTime(old))map.set(key,row);
  }
  return [...map.values()];
}

export function upsertPortfolio(rows=[],item={}){
  const clean=dedupePortfolio(rows),key=portfolioKey(item.name),index=clean.findIndex(x=>portfolioKey(x.name)===key);
  if(!key)return clean;
  if(index>=0)clean[index]={...clean[index],...item};else clean.push(item);
  return clean;
}

export function removePortfolio(rows=[],name=''){
  const key=portfolioKey(name);
  return dedupePortfolio(rows).filter(x=>portfolioKey(x.name)!==key);
}
