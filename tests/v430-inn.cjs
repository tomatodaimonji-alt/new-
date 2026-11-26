const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2]||'inn-candidate.html','utf8');
const region=(start,end)=>{const i=h.indexOf(start),j=h.indexOf(end,i+start.length);a.ok(i>=0&&j>i,start);return h.slice(i,j)};
const map=region("const FRONTIER_VILLAGE_NAME=", "function frontierVillageTrack(");
const logic=region("const FRONTIER_INN_PRICE=10", "function poiTownNpcActorPinned(");
const p=(o)=>JSON.parse(JSON.stringify(o));
let kit, writes, ok, money, hero, available;
const humans=[{id:'human:frontierren',kind:'human',npcId:'frontierren',hp:21,maxHp:100},{id:'human:frontierregna',kind:'human',npcId:'frontierregna',hp:320,maxHp:550}];
const soul={id:'slimeSoul',kind:'monster',hp:8,maxHp:21};
const owner={role:{id:'frontierinnkeeper'}},act={id:'human:frontierren',hurtAt:1};
const ctx=vm.createContext({FRONTIER_WEST_OFFSET:64,frontierSmooth:(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)},
 facilitySite:{id:'frontier'},poiWalkLevel:0,poiWalkX:115,poiWalkZ:40,frontierPlayCave:false,
 get poiPlayerHP(){return hero},set poiPlayerHP(x){hero=x},poiPlayerMaxHp:()=>160,poiPlayerDying:()=>false,
 frontierHouseForTile:()=>available?{id:'frontierInn'}:null,
 poiHotbarRead:()=>kit,poiEconomyGold:()=>money,poiPartyMembers:()=>[...humans,soul],poiSkillManaDecode:raw=>({...raw}),
 poiInventorySlots:k=>k.slots,poiInventoryEdited:(k,slots)=>({...k,slots}),
 frontierVendorStock:()=>({gold:10,healingHerb:2,cannedFood:1}),POI_ECONOMY_GOLD_MAX:9999,
 frontierLifeStock:(k,id,stock)=>({...k,seller:{id,stock}}),
 poiEconomyWrite:k=>{writes.push(p(k));return ok},
 poiPartyActorById:id=>id===act.id?act:null,poiSkillManaBagSync(){},poiEconomyRefresh(){},poiCombatHud(){},workshopResumeWrite(){}
});
vm.runInContext(map+'\n'+logic+'\nglobalThis.f={homes:FRONTIER_HOMES,radius:frontierVillageRadius,fence:frontierVillageFence,rotate:frontierRotateFurniture,stay:frontierInnRest}',ctx);
const {homes,radius,fence,rotate,stay}=ctx.f,inn=homes.find(b=>b.id==='frontierInn');
a.ok(inn.frontNorth,'front entrance faces existing village road');
const items=rotate(inn,inn.furniture),beds=items.filter(x=>x[2]==='cot'),desk=items.filter(x=>x[2]==='shopDesk');
a.equal(beds.length,5);a.equal(beds.filter(b=>b[1]>Math.max(...desk.map(d=>d[1]))).length,1);
for(let z=inn.z1;z<=inn.z2;z++)for(let x=inn.x1;x<=inn.x2;x++){
 a.equal(fence(x,z),false,'wall does not overlap village fence at '+x+','+z);
 a.ok(Math.hypot(x+.5-108.5,z+.5-30.5)<radius(x+.5-108.5,z+.5-30.5));
}
// Run the same fractional furniture/wall collision geometry used by walking.
const liveHome={...inn,door:{x:inn.x1+inn.x2-inn.dx,z:inn.z1},furniture:items};
const body=vm.createContext({facilitySite:{id:'frontier',buildings:[liveHome]},POI_FREE_RADIUS:.18,
 frontierRotateFurniture:rotate});
const wall=region('function frontierHouseWallRects(', 'function frontierHomeGeometry(');
const safe=vm.runInContext(wall+';frontierHouseSafePoint',body);
for(let z=35;z<=40.01;z+=.1)a.ok(safe(115,z),'walk from plaza to counter at z='+z.toFixed(1));
for(const [x,z] of beds.filter(b=>b[1]<41))a.ok(safe(x<115?x+1:x-1,z),'door-to-bed aisle');
a.ok(safe(115,42),'owner can stand behind counter');a.equal(safe(115,41),false,'counter is solid');
const fixture=()=>{
 available=true;ok=true;money=12;hero=19;writes=[];
 kit={gold:12,skillManaUsed:{player:9,frontierregna:12,frontierlyzel:8},humanParty:[
 {id:'human:frontierren',hp:21,mode:'follow'},{id:'human:frontierregna',hp:320,mode:'fight'},{id:'human:frontierchief',hp:0,mode:'follow'}],
 slots:[{type:'slimeSoul',count:1,durability:8},{type:'goblinSoul',count:1,durability:7}]};
};
fixture();a.equal(stay(owner).ok,true);a.equal(writes.length,1);a.equal(writes[0].gold,2);a.equal(writes[0].seller.stock.gold,20);
a.deepEqual(writes[0].humanParty.map(r=>r.hp),[100,550,0]);
a.deepEqual(writes[0].skillManaUsed,{frontierlyzel:8});
a.deepEqual(writes[0].slots.map(r=>r.durability),[21,7]);
a.equal(hero,160);
// A second confirmation with already-restored vitals cannot charge again.
fixture();hero=160;kit.skillManaUsed={frontierlyzel:8};
const original=ctx.poiPartyMembers;ctx.poiPartyMembers=()=>[...humans,soul].map(m=>({...m,hp:m.maxHp}));
a.equal(stay(owner).reason,'already');a.equal(writes.length,0);ctx.poiPartyMembers=original;
fixture();money=9;a.equal(stay(owner).reason,'funds');a.equal(writes.length,0);a.equal(hero,19);
fixture();ok=false;a.equal(stay(owner).reason,'storage');a.equal(writes.length,1);a.equal(hero,19);
fixture();available=false;a.equal(stay(owner).reason,'unavailable');a.equal(writes.length,0);
for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
console.log('PASS inn location, 4 guest beds + owner bed, funds, atomic recovery and JS syntax');
