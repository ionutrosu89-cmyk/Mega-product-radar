import {resolveCommercialAccess} from './commercial-access.js';

async function loadAcademy(){
  const access = await resolveCommercialAccess();
  const academy = document.getElementById('academy');
  const locked = document.getElementById('locked');
  if (!access.authenticated || !access.has('LAUNCH_PLAN')) {
    locked.style.display = 'block';
    academy.hidden = true;
    return;
  }
  academy.hidden = false;
  locked.style.display = 'none';
  document.getElementById('accessStatus').textContent = 'Plan Launch: Academy inclusă.';
}

loadAcademy();