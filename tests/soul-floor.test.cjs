const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function part(a0,b){const i=h.indexOf(a0),j=h.indexOf(b,i+1);a(i>=0&&j>i,a0);return h.slice(i,j)}
function state(kit){
 const valid={slimeSoul:{hp:36},orvasSoul:{hp:1050}},saves=[],sounds=[];
 const c=vm.createContext({POI_SOUL_FLOOR_MAX:4,poiWalkX:10,poiWalkZ:11,poiWalkLevel:0,MAX_MAP:128,performance:{now:()=>700},
  poiCompanionType:x=>Object.hasOwn(valid,x)?valid[x]:null,poiInventorySlots:k=>k.slots,poiInventoryAllowed:()=>true,
  poiInventoryEdited:(k,slots)=>({...k,slots}),poiHotbarRead:()=>kit,poiSoulFloorMotion:new Map(),
  poiEconomyWrite:k=>(saves.push(k),kit=k,true),poiEconomyRefresh(){},poiSound:(...x)=>sounds.push(x),
  poiInventoryAccept:(k,type,n,source)=>({slots:[...k.slots,{type,count:n,durability:source.durability}],accepted:n}),
  poiInventoryItemName:x=>x,toast(){}});
 vm.runInContext(part('function poiSoulFloorDecode(','function poiSoulFloorWorld(')+part('function poiSoulFloorCollect(','// END SOUL FLOOR STATE'),c);
 return {c,saves,sounds,get:()=>kit};
}
test('strict floor records keep known identity/durability, fixed realm and no duplicate types',()=>{
 const a0={x:10,z:11,y:0,type:'slimeSoul',durability:17},t=state({slots:[]});
 const out=t.c.poiSoulFloorDecode([null,{...a0,durability:0},a0,{...a0,x:20},{...a0,type:'orvasSoul',durability:1051},{...a0,type:'orvasSoul',durability:77,region:'evil'}]);
 a.deepEqual(JSON.parse(JSON.stringify(out)),[a0]);
});
test('exact pickup is one transaction with preserved durability and no auto-summon or premature sound',()=>{
 const drop={x:10,z:11,y:0,type:'slimeSoul',durability:7},t=state({slots:[],gold:3,soulDrops:[drop]});
 a.equal(t.c.poiSoulFloorCollect({...drop}),false);a.equal(t.sounds.length,0);
 a.equal(t.c.poiSoulFloorCollect(drop),true);a.equal(t.saves.length,1);a.equal(t.get().gold,3);
 a.equal(t.get().soulDrops.length,0);a.equal(t.get().slots[0].durability,7);a.equal(t.get().companionSoul,undefined);
 a.deepEqual(t.sounds,[['item-pickup','slimeSoul']]);
 a.equal(t.c.poiSoulFloorCollect(drop),false);
});
test('movement never invokes collection, and battle reuses durable real death reward',()=>{
 a.doesNotMatch(part('function poiWalkStepWithFallback','function poiNorthTrailForkSignReachable('),/poiSoulFloorCollect/);
 a.match(h,/const soul=typeof poiSoulFloorReachable[^\n]+poiSoulFloorCollect\(soul\)/);
 a.match(h,/poiDungeonRememberDefeat\(obj,state,debris\)/);
});
test('duplicate legacy hotbar order cannot replace the wounded held Orvas; floor pickup refuses identical owned token',()=>{
 const drop={x:10,z:11,y:0,type:'orvasSoul',durability:1050},full={type:'orvasSoul',count:1,durability:1050},wounded={...full,durability:317},k={slots:[full,null,wounded],soulDrops:[drop],companionSoul:{version:1,active:'orvasSoul'}};
 const t=state(k);t.c.poiCompanionDecode=x=>x;
 vm.runInContext(part('function poiCompanionReconcile(','function poiCompanionAllowed('),t.c);
 const reconciled=t.c.poiCompanionReconcile(k);
 a.equal(reconciled.slots[0],null);a.equal(reconciled.slots[2],wounded);a.equal(reconciled.companionSoul.active,'orvasSoul');
 a.equal(t.c.poiSoulFloorCollect(drop),false);a.equal(t.saves.length,0);a.equal(t.sounds.length,0);
});
test('full bag or rejected storage leaves the real floor miniature and existing inventory intact',()=>{
 const drop={x:10,z:11,y:0,type:'orvasSoul',durability:317},t=state({slots:[],soulDrops:[drop]});
 t.c.poiInventoryAccept=()=>({accepted:0,slots:[]});
 a.equal(t.c.poiSoulFloorCollect(drop),false);a.equal(t.get().soulDrops[0],drop);a.equal(t.saves.length,0);
 t.c.poiInventoryAccept=()=>({accepted:1,slots:[{type:'orvasSoul',durability:317}]});t.c.poiEconomyWrite=()=>false;
 a.equal(t.c.poiSoulFloorCollect(drop),false);a.equal(t.get().soulDrops[0],drop);a.equal(t.sounds.length,0);
});

test('region records stay in their respective coordinate spaces, including valid authored snowy approach extension',()=>{
 const t=state({slots:[]});
 const p={x:12,z:2,y:0,type:'slimeSoul',durability:7},q={x:12,z:2,y:0,type:'orvasSoul',durability:317,region:'snowpass'};
 const read=(...p)=>JSON.parse(JSON.stringify(t.c.poiSoulFloorDecode(p)));
 a.deepEqual(read(p,q),[p,q]);a.deepEqual(read(p,{...q,x:24},{...q,z:29},{...q,y:-1}),[p]);
 const sleeve=part('function poiDavidDepthGroundPoint(','function poiInventoryReadDrops(');
 const local=part('function poiSnowGroundIn(','function poiSnowGroundDecode(');
 const seam=h.includes('function poiSnowSleeveOwn(')?part('function poiSnowSleeveOwn(','function poiSnowSleeveRoute('):'';
 vm.runInContext(local+sleeve+seam,t.c);
 a.deepEqual(read(p,q),[p,q]);a.deepEqual(read(p,{...q,x:24},{...q,z:29},{...q,y:1}),[p]);
 const shoulder={...p,x:60,z:138,type:'orvasSoul',durability:317};
 a.deepEqual(read(shoulder),seam?[shoulder]:[]);
});
