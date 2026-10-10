import {sandboxPerimeterDecision} from '../../sandbox-perimeter-policy.mjs';
export default async function(request,context){
 const decision=sandboxPerimeterDecision(request,{
  MPR_SANDBOX_ISOLATION:Deno.env.get('MPR_SANDBOX_ISOLATION'),
  MPR_SANDBOX_HOST:Deno.env.get('MPR_SANDBOX_HOST')
 });
 return decision||context.next();
}
// Deliberately no exported path config: activate only on a dedicated Sandbox
// deployment with an explicit /* edge mapping after access/cost approval.
