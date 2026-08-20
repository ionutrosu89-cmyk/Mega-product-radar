import {planByCode,hasFeature} from './billing-plans.js';
import {listWorkspaces} from './workspace-client.js';

export async function resolveCommercialAccess(){
  try{
    const workspaces=await listWorkspaces();
    const workspace=workspaces[0]||null;
    const plan=planByCode(workspace?.plan||'FREE');
    return {
      authenticated:Boolean(workspace),
      workspaceId:workspace?.id||null,
      workspaceName:workspace?.name||null,
      rawPlan:workspace?.plan||'FREE',
      plan,
      has:feature=>hasFeature(plan.code,feature)
    };
  }catch{
    const plan=planByCode('FREE');
    return {authenticated:false,workspaceId:null,workspaceName:null,rawPlan:'FREE',plan,has:feature=>hasFeature(plan.code,feature)};
  }
}

export function commercialPlanRank(code='FREE'){
  return ({FREE:0,DISCOVER:1,RADAR:2,LAUNCH:3})[planByCode(code).code]??0;
}
