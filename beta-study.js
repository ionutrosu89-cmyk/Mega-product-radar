import {trackJourneyEvent} from './journey-events.js';
document.querySelector('#study').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),status=document.querySelector('#status');
 button.disabled=true;
 const values=new FormData(form),metadata={studyVersion:'STABILIZATION_1',product:values.get('product'),understoodEvidence:values.get('understood')==='yes',useful:values.get('useful')==='yes',completedWatchlist:values.get('watchlist')==='yes',completedIntervention:values.get('intervention')==='yes'};
 const saved=await trackJourneyEvent('BETA_VALIDATION_SESSION',metadata);
 status.textContent=saved?'Evaluarea a fost salvată. Mulțumim!':'Evaluarea nu a fost salvată. Autentifică-te și încearcă din nou.';button.disabled=false;
});
