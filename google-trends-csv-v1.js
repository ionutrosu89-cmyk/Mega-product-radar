import {FREE_TOP25_EXPANDED_IDS} from './free-top25-expanded-registry.js';

const normalizeTerm=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ro-RO');
const normalizeRegion=value=>String(value||'').normalize('NFD').replace(/\p{M}/gu,'').trim().toLowerCase();

function fields(line){
  const parts=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){
    const char=line[i];
    if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
    else if(char===','&&!quoted){parts.push(value.trim());value='';}
    else value+=char;
  }
  if(quoted)throw new Error('TRENDS_CSV_QUOTE_INVALID');
  parts.push(value.trim());return parts;
}

export function parseGoogleTrendsCsv(csv){
  const lines=String(csv||'').replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const headerIndex=lines.findIndex(line=>/^(?:Day|Week|Month|Ziua|Săptămâna|Saptamana|Luna),/i.test(line));
  if(headerIndex<0)throw new Error('TRENDS_CSV_HEADER_MISSING');
  const header=fields(lines[headerIndex]);
  if(header.length!==2||!header[1])throw new Error('TRENDS_CSV_SINGLE_SERIES_REQUIRED');
  const series=header[1].match(/^(.+):\s*\(([^()]*)\)$/);
  if(!series||normalizeRegion(series[2])!=='romania')throw new Error('TRENDS_CSV_REGION_NOT_RO');
  const points=[];
  for(const line of lines.slice(headerIndex+1)){
    const row=fields(line);
    if(row.length!==2||!/^\d{4}-\d{2}-\d{2}(?:\s+-\s+\d{4}-\d{2}-\d{2})?$/.test(row[0])||!/^\d{1,3}$/.test(row[1]))throw new Error('TRENDS_CSV_ROW_INVALID');
    const [start,end=start]=row[0].split(/\s+-\s+/),value=Number(row[1]);
    if(![start,end].every(date=>{const parsed=new Date(`${date}T00:00:00Z`);return !Number.isNaN(parsed.getTime())&&parsed.toISOString().startsWith(date);})||value>100)throw new Error('TRENDS_CSV_ROW_INVALID');
    points.push({start,end,value});
  }
  if(points.length<2||points.some((point,index)=>index>0&&point.start<=points[index-1].end))throw new Error('TRENDS_CSV_SERIES_INVALID');
  return {query:series[1].trim(),periodStart:points[0].start,periodEnd:points.at(-1).end,pointCount:points.length,nonzeroPointCount:points.filter(point=>point.value>0).length,minIndex:Math.min(...points.map(point=>point.value)),maxIndex:Math.max(...points.map(point=>point.value)),latestIndex:points.at(-1).value};
}

export function stageGoogleTrendsObservation(csv,{nicheId,concept,sourceUrl,retrievedAt=new Date().toISOString()}={}){
  const niche=String(nicheId||'').trim().toUpperCase(),name=String(concept||'').trim(),summary=parseGoogleTrendsCsv(csv);
  let url;try{url=new URL(sourceUrl);}catch{throw new Error('TRENDS_SOURCE_URL_INVALID');}
  if(!FREE_TOP25_EXPANDED_IDS.includes(niche)||!name||name.length>100||url.protocol!=='https:'||url.hostname!=='trends.google.com'||url.pathname!=='/trends/explore'||url.searchParams.get('geo')!=='RO'||!url.searchParams.get('q'))throw new Error('TRENDS_SOURCE_OR_NICHE_INVALID');
  if(normalizeTerm(summary.query)!==normalizeTerm(url.searchParams.get('q'))||normalizeTerm(summary.query)!==normalizeTerm(name))throw new Error('TRENDS_QUERY_MISMATCH');
  const date=new Date(retrievedAt);
  if(Number.isNaN(date.getTime())||date.getTime()>Date.now())throw new Error('TRENDS_RETRIEVED_AT_INVALID');
  const endMs=Date.parse(`${summary.periodEnd}T00:00:00Z`);
  if(endMs>date.getTime()||date.getTime()-endMs>35*86_400_000)throw new Error('TRENDS_PERIOD_STALE_OR_FUTURE');
  const originalSummary=`Export Google Trends RO pentru „${summary.query}”, ${summary.pointCount} intervale (${summary.periodStart}–${summary.periodEnd}); indice relativ 0–100: ultimul ${summary.latestIndex}, interval ${summary.minIndex}–${summary.maxIndex}, valori >0 în ${summary.nonzeroPointCount}/${summary.pointCount}. Zero nu înseamnă zero căutări; nu arată vânzări.`;
  if(originalSummary.length>240)throw new Error('TRENDS_SUMMARY_TOO_LONG');
  return {schema:'MPR_FREE_SIGNAL_DRAFT_V1',nicheId:niche,sourceKey:'GOOGLE_TRENDS',claim:'SEARCH_INTEREST',concept:name,sourceUrl:url.href,observedAt:date.toISOString(),periodStart:summary.periodStart,periodEnd:summary.periodEnd,nonzeroPointCount:summary.nonzeroPointCount,pointCount:summary.pointCount,summary:originalSummary,reviewer:'',publicStatus:'PENDING_REVIEW'};
}
