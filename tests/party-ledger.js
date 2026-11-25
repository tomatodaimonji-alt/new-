// The legacy first-active fields remain readable by pre-party saves/tools.
const POI_PARTY_LIMIT=3;
function poiPartySoulRecord(pending,members){
 const solo=members[0];
 return pending||solo?{version:1,pending,active:solo?.id??null,...(solo?{mode:solo.mode,members}:{})}:null;
}
function poiCompanionDecode(raw){
 if(raw?.version!==1)return null;
 const pending=poiCompanionType(raw.pending)?raw.pending:null;
 const input=Array.isArray(raw.members)?raw.members.slice(0,12):[{id:raw.active,mode:raw.mode}];
 const members=[];
 for(const r of input)if(poiCompanionType(r?.id)&&!members.some(q=>q.id===r.id)&&members.length<POI_PARTY_LIMIT)
  members.push({id:r.id,mode:poiCompanionNormalizeMode(r.mode)??'fight'});
 return poiPartySoulRecord(pending,members);
}
function poiPartySoulMembers(kit,slots=poiInventorySlots(kit)){
 return (poiCompanionDecode(kit?.companionSoul)?.members??[]).flatMap(r=>{
  const cell=slots.find(c=>c?.type===r.id),spec=poiCompanionType(r.id),hp=cell?.durability??spec.hp;
  return cell&&hp>0?[{...r,kind:'monster',hp,maxHp:spec.hp,name:spec.name.replace(/の魂$/,'')}]:[];
 });
}
function poiPartyMembers(kit){
 if(!kit)return [];
 const humans=typeof poiHumanPartyMembers==='function'?poiHumanPartyMembers(kit):[];
 return [...poiPartySoulMembers(kit),...humans].slice(0,POI_PARTY_LIMIT);
}
function poiPartyHasRoom(kit=poiHotbarRead()){
 return poiPartyMembers(kit).length<POI_PARTY_LIMIT;
}
function poiPartyActive(kit,id){
 return (poiCompanionDecode(kit?.companionSoul)?.members??[]).some(row=>row.id===id);
}
function poiPartySoulWrite(kit,records){
 const pending=poiCompanionDecode(kit.companionSoul)?.pending??null;
 const record=poiPartySoulRecord(pending,records.map(({id,mode})=>({id,mode})));
 const next={...kit};
 if(record)next.companionSoul=record;else delete next.companionSoul;
 return next;
}
function poiPartyDenySummon(){
 const message='これ以上召喚できない。';
 if(typeof poiMessagePush!=='function'||!poiMessagePush(message,'notice'))if(typeof toast==='function')toast(message);
 return {ok:false,reason:'party-full'};
}
