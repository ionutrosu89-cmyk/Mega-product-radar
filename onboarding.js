import {getCurrentSession} from './supabase-client.js';
import {loadSellerPreferences,saveSellerPreferences} from './seller-preferences.js';
import {trackJourneyEvent} from './journey-events.js';

const $=s=>document.querySelector(s);
function selected(container){return [...container.querySelectorAll('.chip.active')].map(x=>x.dataset.value).filter(Boolean);}
function setSelected(container,values=[]){const set=new Set(values);container.querySelectorAll('.chip').forEach(x=>x.classList.toggle('active',set.has(x.dataset.value)));}
function installChips(container){container.querySelectorAll('.chip').forEach(x=>x.addEventListener('click',()=>x.classList.toggle('active')));}

async function load(){
  const session=await getCurrentSession();
  if(!session){location.href='login.html?next=onboarding.html';return;}
  installChips($('#marketplaces'));installChips($('#categories'));
  try{
    const p=await loadSellerPreferences();
    $('#experience').value=p.experience_level||'BEGINNER';
    $('#budget').value=Number(p.monthly_budget_ron||3000);
    $('#goal').value=p.goal||'FIND_PRODUCTS';
    $('#risk').value=p.risk_profile||'BALANCED';
    $('#sourcing').value=p.sourcing_preference||'CHINA';
    setSelected($('#marketplaces'),p.marketplaces?.length?p.marketplaces:['EMAG_RO']);
    setSelected($('#categories'),p.categories||[]);
    trackJourneyEvent('ONBOARDING_VIEW',{completed:Boolean(p.onboarding_completed)});
  }catch(e){$('#status').textContent=`Nu am putut încărca profilul: ${e.message}`;}
}

$('#form').addEventListener('submit',async e=>{
  e.preventDefault();
  $('#status').textContent='Salvez profilul…';
  try{
    const profile={experience_level:$('#experience').value,monthly_budget_ron:Number($('#budget').value||0),goal:$('#goal').value,risk_profile:$('#risk').value,sourcing_preference:$('#sourcing').value,marketplaces:selected($('#marketplaces')),categories:selected($('#categories'))};
    await saveSellerPreferences(profile);
    await trackJourneyEvent('ONBOARDING_COMPLETED',{experience:profile.experience_level,goal:profile.goal,budget:profile.monthly_budget_ron,marketplaceCount:profile.marketplaces.length,categoryCount:profile.categories.length});
    $('#status').textContent='Profil salvat. Recomandările vor folosi aceste preferințe.';
    setTimeout(()=>{location.href='home.html';},350);
  }catch(error){$('#status').textContent=`Eroare: ${error.message}`;}
});
load();
