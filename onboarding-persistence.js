import {accountBrowserStorageKey} from './account-browser-storage.js';

export function onboardingBudget(value){
  if(value===null||value===undefined||String(value).trim()==='')return 3000;
  const budget=Number(value);
  return Number.isFinite(budget)&&budget>=0?budget:3000;
}

// Server profile persistence and optional device preferences have different
// outcomes. A browser quota/privacy failure must not undo a successful profile.
export async function persistOnboarding(profile,choices,{storageKey,getSession,saveProfile,storage=()=>globalThis.localStorage}={}){
  const session=await getSession();
  if(!session?.user?.id||!storageKey||accountBrowserStorageKey('mpr_plan_finder_v1',session.user.id)!==storageKey)throw new Error('Contul s-a schimbat. Reîncarcă pagina înainte să salvezi profilul.');
  const savedProfile=await saveProfile(profile,{expectedUserId:session.user.id});
  let localChoicesSaved=false;
  try{storage().setItem(storageKey,JSON.stringify(choices));localChoicesSaved=true;}catch{}
  return {savedProfile,localChoicesSaved};
}
