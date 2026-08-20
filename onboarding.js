import {getCurrentSession} from './supabase-client.js';
import {loadSellerPreferences,saveSellerPreferences} from './seller-preferences.js';

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
  }catch(e){$('#status').textContent=`Nu am putut încărca profilul: ${e.message}`;}
}

$('#form').addEventListener('submit',async e=>{
  e.preventDefault();
  $('#status').textContent='Salvez profilul…';
  try{
    await saveSellerPreferences({experience_level:$('#experience').value,monthly_budget_ron:Number($('#budget').value||0),goal:$('#goal').value,risk_profile:$('#risk').value,sourcing_preference:$('#sourcing').value,marketplaces:selected($('#marketplaces')),categories:selected($('#categories'))});
    $('#status').textContent='Profil salvat. Radarul și Launch vor folosi aceste preferințe.';
    setTimeout(()=>{location.href='commercial-launch.html';},500);
  }catch(error){$('#status').textContent=`Eroare: ${error.message}`;}
});
load();
