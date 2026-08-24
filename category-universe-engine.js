const keyPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function flattenCategoryUniverse(universe={}){
  const rows=[];
  for(const department of universe.departments||[]){
    rows.push({key:department.key,label:department.label,level:'DEPARTMENT',parentKey:null});
    for(const category of department.children||[]){
      rows.push({key:category.key,label:category.label,level:'CATEGORY',parentKey:department.key});
      for(const niche of category.niches||[]){
        rows.push({key:niche,label:niche.replaceAll('-',' '),level:'NICHE',parentKey:category.key});
      }
    }
  }
  return rows;
}

export function validateCategoryUniverse(universe={}){
  const errors=[];
  if(universe.version!=='2.0')errors.push('version must be 2.0');
  if(Number(universe.targetArchitectureProducts||0)<100000)errors.push('architecture target must be at least 100000 products');
  const rows=flattenCategoryUniverse(universe);
  const seen=new Set();
  for(const row of rows){
    if(!keyPattern.test(row.key))errors.push(`invalid key ${row.key}`);
    const compound=`${row.level}:${row.key}`;
    if(seen.has(compound))errors.push(`duplicate ${compound}`);
    seen.add(compound);
  }
  const departmentCount=(universe.departments||[]).length;
  const categoryCount=rows.filter(r=>r.level==='CATEGORY').length;
  const nicheCount=rows.filter(r=>r.level==='NICHE').length;
  if(departmentCount<10)errors.push('insufficient department breadth');
  if(categoryCount<20)errors.push('insufficient category breadth');
  if(nicheCount<80)errors.push('insufficient niche breadth');
  return {valid:errors.length===0,errors,stats:{departmentCount,categoryCount,nicheCount,totalNodes:rows.length}};
}

export function categoryBreadcrumb(universe,key){
  const rows=flattenCategoryUniverse(universe);
  const byKey=new Map(rows.map(r=>[`${r.level}:${r.key}`,r]));
  const target=rows.find(r=>r.key===key);
  if(!target)return [];
  const out=[target];
  let current=target;
  while(current.parentKey){
    const parent=[...byKey.values()].find(r=>r.key===current.parentKey);
    if(!parent)break;
    out.unshift(parent);
    current=parent;
  }
  return out;
}

export function categoryCapacityPlan(universe={}){
  const niches=flattenCategoryUniverse(universe).filter(r=>r.level==='NICHE');
  const target=Number(universe.targetArchitectureProducts||0);
  return {
    targetProducts:target,
    nicheCount:niches.length,
    averageProductsPerNiche:niches.length?Math.ceil(target/niches.length):0,
    rankingTop:Number(universe.rankingTargets?.defaultTop||100),
    minimumUsefulPerNiche:Number(universe.rankingTargets?.minimumUsefulPerNiche||25)
  };
}
