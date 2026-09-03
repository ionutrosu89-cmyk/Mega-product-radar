import assert from 'node:assert/strict';
import test from 'node:test';
import {createFreeDemandEventHandler,normalizeFreeDemandEvent} from '../netlify/functions/free-demand-event.mjs';

const SESSION_ID='123e4567-e89b-42d3-a456-426614174000';

test('anonymous Free demand events are allowlisted and stripped of arbitrary personal data',()=>{
  const row=normalizeFreeDemandEvent({
    eventName:'FREE_NICHE_SELECTED',page:'top25.html',pageSessionId:SESSION_ID,nicheId:'AUTO',
    acquisitionSource:'tiktok',metadata:{nicheLabel:'Auto',email:'should-not-pass@example.com',secret:'nope'}
  });
  assert.equal(row.event_name,'FREE_NICHE_SELECTED');
  assert.equal(row.page_session_id,SESSION_ID);
  assert.deepEqual(row.metadata,{nicheLabel:'Auto'});
  assert.equal('email' in row,false);
  assert.equal(normalizeFreeDemandEvent({eventName:'UNKNOWN',page:'x',pageSessionId:SESSION_ID}),null);
});

test('Free demand endpoint inserts only server-side after rate limiting',async()=>{
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).includes('/rpc/consume_api_rate_limit'))return Response.json([{allowed:true,limit:40,hitCount:1}]);
    if(String(url).endsWith('/rest/v1/free_demand_events'))return new Response(null,{status:201});
    return new Response('not found',{status:404});
  };
  const handler=createFreeDemandEventHandler({fetch:fetchImpl,env:{SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'service',SECURITY_AUDIT_SALT:'salt'}});
  const response=await handler(new Request('https://mpr.example/api/free/demand-event',{method:'POST',headers:{origin:'https://mpr.example','content-type':'application/json'},body:JSON.stringify({eventName:'FREE_TOP25_VIEW',page:'top25.html',pageSessionId:SESSION_ID,metadata:{nicheCount:25,productCount:625}})}));
  assert.equal(response.status,202);
  const inserted=JSON.parse(calls.find(call=>call.url.endsWith('/free_demand_events')).options.body);
  assert.equal(inserted.event_name,'FREE_TOP25_VIEW');
  assert.equal(inserted.metadata.productCount,625);
  assert.equal('ip' in inserted,false);
  assert.equal('userAgent' in inserted,false);
});

test('Free demand endpoint rejects cross-origin telemetry',async()=>{
  let called=false;
  const handler=createFreeDemandEventHandler({fetch:async()=>{called=true;return new Response(null,{status:500});},env:{}});
  const response=await handler(new Request('https://mpr.example/api/free/demand-event',{method:'POST',headers:{origin:'https://attacker.example','content-type':'application/json'},body:'{}'}));
  assert.equal(response.status,403);
  assert.equal(called,false);
});
