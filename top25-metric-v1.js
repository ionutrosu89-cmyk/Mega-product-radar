const numeric=value=>(typeof value==='number'||typeof value==='string')&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;

export function formatTop25Metric(metric){
  if(!metric||typeof metric!=='object')return '—';
  if(metric.unit==='platform_rank'){
    const rank=numeric(metric.value);
    if(Number.isInteger(rank)&&rank>0)return `#${rank} · rangul sursei`;
    return metric.value==='BEST_SELLING'?'BEST_SELLING · indicatorul platformei':'—';
  }
  const value=numeric(metric.value);
  if(value===null||value<0)return '—';
  const shown=value.toLocaleString('ro-RO');
  if(metric.unit==='searches')return `${shown} căutări`;
  if(metric.unit==='results')return `${shown} rezultate`;
  if(metric.unit==='reviews_historical')return `${shown} recenzii istorice`;
  return `${shown}${metric.label?` · ${String(metric.label).slice(0,100)}`:''}`;
}

export function sortableTop25Statistic(product){
  const metric=product?.sourceMetric;
  if(metric?.unit!=='platform_rank'){
    const value=numeric(metric?.value);
    if(value!==null&&value>=0)return value;
  }
  const reviews=numeric(product?.reviewCount);
  return reviews!==null&&reviews>=0?reviews:-1;
}
