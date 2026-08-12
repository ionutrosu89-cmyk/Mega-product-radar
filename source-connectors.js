export const SOURCE_CONNECTORS={
  amazonDE:{label:'Amazon DE',type:'DIRECT_SEARCH',url:q=>`https://www.amazon.de/s?k=${encodeURIComponent(q)}`},
  allegroPL:{label:'Allegro PL',type:'DIRECT_SEARCH',url:q=>`https://allegro.pl/listing?string=${encodeURIComponent(q)}`},
  trendyolTR:{label:'Trendyol TR',type:'DIRECT_SEARCH',url:q=>`https://www.trendyol.com/sr?q=${encodeURIComponent(q)}`},
  emagRO:{label:'eMAG RO',type:'DIRECT_SEARCH',url:q=>`https://www.emag.ro/search/${encodeURIComponent(q)}`},
  alibaba:{label:'Alibaba',type:'DIRECT_SEARCH',url:q=>`https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(q)}`},
  china1688:{label:'1688',type:'DIRECT_SEARCH',url:q=>`https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(q)}`},
  youtube:{label:'YouTube',type:'DIRECT_SEARCH',url:q=>`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`},
  pinterest:{label:'Pinterest',type:'DIRECT_SEARCH',url:q=>`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`}
};
export function sourceLinks(term){return Object.entries(SOURCE_CONNECTORS).map(([key,c])=>({key,label:c.label,type:c.type,url:c.url(term),verifiedCommercial:false}));}
export function evidenceClass(signal={}){if(signal.apiVerified===true)return'API_VERIFIED';if(signal.directVerified===true)return'DIRECT_VERIFIED';if(signal.present===true)return'WEB_PROXY';return'NO_SIGNAL';}
export function evidenceConfidence(signals={}){const rows=Object.values(signals),api=rows.filter(x=>evidenceClass(x)==='API_VERIFIED').length,direct=rows.filter(x=>evidenceClass(x)==='DIRECT_VERIFIED').length,proxy=rows.filter(x=>evidenceClass(x)==='WEB_PROXY').length;const score=Math.min(100,api*25+direct*15+proxy*5);return{score,level:score>=70?'HIGH':score>=35?'MEDIUM':score>0?'LOW':'NONE',api,direct,proxy};}
