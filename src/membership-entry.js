(() => {
'use strict';
const state=globalThis.ZovoMembershipState;let cancelled=false;
const remove=()=>{cancelled=true;document.getElementById('zovo-membership-entry')?.remove();};
chrome.storage.onChanged.addListener((changes,area)=>{if((area==='sync'&&['licenseKey','tier','isPro','proStatus'].some(k=>k in changes))||(area==='local'&&'zovoLicense' in changes))remove();});
(async()=>{try{
 const result=await state.read();if(cancelled||result.status!=='free')return;
 if(result.notice.dismissedCampaign===state.CAMPAIGN||Date.now()-result.notice.shownAt<30*864e5)return;
 await state.record({shownAt:Date.now()});if(cancelled)return;
 const card=document.createElement('section');card.id='zovo-membership-entry';card.setAttribute('aria-labelledby','membership-note-title');
 const title=document.createElement('h2');title.id='membership-note-title';title.textContent='A note from Michael';
 const copy=document.createElement('p');copy.textContent='I build and maintain Clipboard History Pro. See how Zovo membership supports the work.';
 const link=document.createElement('a');link.href=chrome.runtime.getURL('membership/index.html');link.target='_blank';link.rel='noopener noreferrer';link.textContent='Explore membership';
 const button=document.createElement('button');button.type='button';button.textContent='Not now';button.setAttribute('aria-label','Dismiss membership note');button.addEventListener('click',()=>{remove();state.record({dismissedCampaign:state.CAMPAIGN,shownAt:Date.now()}).catch(()=>{});});
 const actions=document.createElement('div');actions.append(link,button);card.append(title,copy,actions);document.body.append(card);
}catch{}})();
})();
