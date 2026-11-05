(() => {
'use strict';
const state=globalThis.ZovoMembershipState,letter=document.getElementById('letter'),closed=document.getElementById('closed'),title=document.getElementById('closedTitle');let generation=0,dismissed=false;
letter.hidden=true;
async function check(){const run=++generation;letter.hidden=true;const result=await state.read();if(run!==generation||dismissed)return;
 if(result.status==='free'){closed.hidden=true;letter.hidden=false;return;}
 closed.hidden=false;title.textContent=result.status==='member'?'Thank you for being a member.':'Check your membership.';
 const copy=closed.querySelector('p');if(copy)copy.textContent=result.status==='member'?'Your existing membership is respected. You can return to Clipboard History Pro below.':'Open Clipboard History Pro settings to restore your existing license.';
 if(!closed.querySelector('[data-recovery]')){const a=document.createElement('a');a.dataset.recovery='true';a.href='../src/popup.html';a.textContent='Open Clipboard History Pro settings';closed.append(a);}
}
document.addEventListener('zovo-membership-dismiss',event=>{event.preventDefault();dismissed=true;state.record({dismissedCampaign:state.CAMPAIGN,shownAt:Date.now()}).then(()=>window.close()).catch(()=>{});});
chrome.storage.onChanged.addListener((changes,area)=>{if((area==='sync'&&['licenseKey','tier','isPro','proStatus'].some(k=>k in changes))||(area==='local'&&'zovoLicense' in changes))check();});
window.addEventListener('focus',()=>{if(!dismissed)check();});check();
})();
