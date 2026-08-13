import {LEGAL_CONFIG,LEGAL_MISSING} from './legal-config.js';
const q=s=>document.querySelector(s);
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
export function operatorHtml(){return `<b>${esc(LEGAL_CONFIG.operatorName)}</b><br>Sediu: ${esc(LEGAL_CONFIG.registeredOffice)}<br>Registrul Comertului: ${esc(LEGAL_CONFIG.tradeRegister)}<br>CUI/CIF: ${esc(LEGAL_CONFIG.taxId)}<br>Email juridic/GDPR: ${esc(LEGAL_CONFIG.legalEmail)}<br>Suport: ${esc(LEGAL_CONFIG.supportEmail)}<br>Telefon: ${esc(LEGAL_CONFIG.phone)}`;}
export function footerHtml(){return `<footer class="legal-footer"><b>${esc(LEGAL_CONFIG.productName)}</b> • operat de ${esc(LEGAL_CONFIG.operatorName)}<br><a href="legal-center.html">Legal Center</a><a href="privacy.html">Confidentialitate</a><a href="terms.html">Termeni</a><a href="cookies.html">Cookies</a><a href="subprocessors.html">Subprocesatori</a><a href="dpa.html">DPA</a><a href="account.html">Cont & date</a></footer>`;}
const operator=q('[data-operator]');if(operator)operator.innerHTML=operatorHtml();
const footer=q('[data-legal-footer]');if(footer)footer.innerHTML=footerHtml();
const updated=q('[data-legal-version]');if(updated)updated.textContent=LEGAL_CONFIG.version;
const readiness=q('[data-legal-readiness]');if(readiness){readiness.textContent=LEGAL_MISSING.length?'NU ESTE PREGATIT PENTRU LANSARE PUBLICA CU PLATA':'DATE OPERATOR COMPLETE';readiness.className='pill';}
const missing=q('[data-legal-missing]');if(missing)missing.textContent=LEGAL_MISSING.length?LEGAL_MISSING.join(', '):'Niciun camp lipsa';
