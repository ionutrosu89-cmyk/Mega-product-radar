import assert from 'node:assert/strict';
import test from 'node:test';
import {createHmac} from 'node:crypto';
import {aliexpressPublicDisplayAccessState,parseAliExpressTargets,buildAliExpressRequest,normalizeAliExpressHotProducts,collectAliExpressHotProductsTarget} from '../netlify/functions/_aliexpress-hot-products.mjs';
import {createAliExpressCrossMarketRefreshHandler} from '../netlify/functions/aliexpress-cross-market-refresh.mjs';
const env={ALIEXPRESS_APP_KEY:'key',ALIEXPRESS_APP_SECRET:'secret',ALIEXPRESS_TRACKING_ID:'tracking',MPR_ALIEXPRESS_TERMS_APPROVED:'true',MPR_ALIEXPRESS_PUBLIC_DISPLAY_APPROVED:'true',MPR_ALIEXPRESS_API_CURRENT_CONFIRMED:'true',MPR_INTERNAL_REFRESH_SECRET:'internal',MPR_ALIEXPRESS_TOP25_TARGETS_JSON:JSON.stringify([{nicheId:'AUTO',categoryIds:['123']}]),SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'service'};
const now=()=>new Date('2026-09-23T07:00:00Z');
const rows=()=>Array.from({length:25},(_,i)=>({product_id:String(i+1),product_title:`Product ${i+1}`,product_detail_url:`https://www.aliexpress.com/item/${i+1}.html`,target_sale_price:'10.50',lastest_volume:100-i}));
const payload=products=>({aliexpress_affiliate_hotproduct_query_response:{resp_result:{resp_code:200,result:{products:{product:products}}}}});
test('AliExpress gates make zero calls without display rights',async()=>{
 let calls=0;
 assert.equal(aliexpressPublicDisplayAccessState({}),'ACCESS_REQUIRED');
 const result=await collectAliExpressHotProductsTarget({env:{...env,MPR_ALIEXPRESS_PUBLIC_DISPLAY_APPROVED:'false'},fetchImpl:async()=>{calls++;}});
 assert.equal(result.ok,false);assert.equal(calls,0);
});
test('AliExpress deprecated endpoint needs current provider confirmation',async()=>{
 let calls=0;
 const pending={...env,MPR_ALIEXPRESS_API_CURRENT_CONFIRMED:'false'};
 assert.equal(aliexpressPublicDisplayAccessState(pending),'API_AVAILABILITY_REVIEW_REQUIRED');
 const result=await collectAliExpressHotProductsTarget({env:pending,fetchImpl:async()=>{calls++;}});
 assert.equal(result.code,'ALIEXPRESS_ACCESS_NOT_READY');
 assert.equal(calls,0);
});
test('AliExpress request has reproducible signature, category and Shanghai timestamp',()=>{
 const target=parseAliExpressTargets(env)[0];const {body}=buildAliExpressRequest({target,env,now:now()});
 assert.equal(body.get('timestamp'),'2026-09-23 15:00:00');assert.equal(body.get('category_ids'),'123');assert.equal(body.get('sort'),'LAST_VOLUME_DESC');
 const params=Object.fromEntries(body);delete params.sign;
 const expected=createHmac('md5','secret').update(Object.keys(params).sort().map(k=>k+params[k]).join('')).digest('hex').toUpperCase();
 assert.equal(body.get('sign'),expected);assert.equal(body.has('app_secret'),false);
});
test('AliExpress rejects incomplete, duplicate and malformed original top positions',()=>{
 const valid=rows();assert.equal(normalizeAliExpressHotProducts(payload(valid)).length,25);
 assert.equal(normalizeAliExpressHotProducts(payload(valid.slice(0,24))).length,0);
 const duplicate=rows();duplicate[1].product_id=duplicate[0].product_id;
 assert.equal(normalizeAliExpressHotProducts(payload(duplicate)).length,0);
 const invalid=rows();invalid[0].product_detail_url='https://evil.example/item/1';invalid.push(valid[0]);
 assert.equal(normalizeAliExpressHotProducts(payload(invalid)).length,0);
});
test('AliExpress authenticated refresh persists only current normalized results',async()=>{
 const calls=[];const handler=createAliExpressCrossMarketRefreshHandler({env,now,fetchImpl:async(url,options)=>{
 calls.push({url:String(url),options});return String(url).includes('eco.taobao.com')?Response.json(payload(rows())):new Response(null,{status:201});
 }});
 assert.equal((await handler(new Request('https://app.test',{method:'POST'}))).status,401);assert.equal(calls.length,0);
 const response=await handler(new Request('https://app.test',{method:'POST',headers:{'x-mpr-internal-secret':'internal'}}));
 assert.equal(response.status,200);assert.equal((await response.json()).published,1);
 assert.match(calls[1].url,/current_top25_snapshots_v1/);
 const saved=JSON.parse(calls[1].options.body)[0];assert.equal(saved.product_count,25);assert.equal(saved.products[0].observedAt,now().toISOString());assert.equal(saved.source_rights_status,'APPROVED');
});
