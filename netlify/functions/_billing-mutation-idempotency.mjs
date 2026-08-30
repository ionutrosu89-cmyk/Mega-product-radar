import {createHash} from 'node:crypto';

export function billingMutationIdempotencyKey({workspaceId,subscriptionId,lastStripeEventId,operation,target=''}){
  const parts=[workspaceId,subscriptionId,lastStripeEventId||'foundation',operation,String(target||'')].map(value=>String(value||'').trim());
  if(parts.slice(0,4).some(value=>!value))return null;
  const digest=createHash('sha256').update(parts.join('|'),'utf8').digest('hex');
  return `mpr-billing-${String(operation).toLowerCase()}:${digest}`;
}
