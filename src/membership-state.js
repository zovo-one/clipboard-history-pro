(() => {
'use strict';
const NOTICE='zovo_membership_notice_v1',CAMPAIGN='founder-membership-2026-09';
const deadline=p=>Promise.race([p,new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),2500))]);
async function record(extra){const current=await deadline(chrome.storage.local.get(NOTICE));await deadline(chrome.storage.local.set({[NOTICE]:{...(current[NOTICE]||{}),campaign:CAMPAIGN,...extra}}));}
async function read(){try{
 const [sync,local]=await deadline(Promise.all([chrome.storage.sync.get(['licenseKey','tier','isPro','proStatus']),chrome.storage.local.get(['zovoLicense',NOTICE])]));
 if(!sync||!local)return {status:'unknown'};const notice=local[NOTICE]||{},raw=local.zovoLicense;
 if(notice.previouslyMember===true)return {status:'member',notice};
 const paid=sync.isPro===true||sync.proStatus?.isPro===true||['pro','paid','lifetime','trial'].includes(sync.tier)||raw?.valid===true||raw?.activated===true||['pro','paid','lifetime','trial'].includes(raw?.tier);
 if(paid){await record({previouslyMember:true});return {status:'member',notice};}
 if(sync.licenseKey||raw?.key||raw?.licenseKey)return {status:'unknown',notice};
 if(sync.isPro!==undefined&&sync.isPro!==false)return {status:'unknown',notice};
 if(sync.proStatus!==undefined&&(typeof sync.proStatus!=='object'||sync.proStatus===null||sync.proStatus.isPro!==false))return {status:'unknown',notice};
 if(raw?.tier!==undefined&&raw.tier!=='free')return {status:'unknown',notice};
 if(sync.tier!==undefined&&sync.tier!=='free')return {status:'unknown',notice};
 if(raw!==undefined&&raw!==null&&(typeof raw!=='object'||raw.valid!==false))return {status:'unknown',notice};
 return {status:'free',notice};
}catch{return {status:'unknown'}}}
globalThis.ZovoMembershipState={read,record,NOTICE,CAMPAIGN};
})();
