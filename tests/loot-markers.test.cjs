const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function fixture(){
 const s=html.indexOf('const POI_LOOT_MARK_RADIUS='),e=html.indexOf('let poiHealingHerbIconCache',s);
 assert(s>=0&&e>s,'missing the dedicated collectible marker batch');
 const built=[],deleted=[],drawn=[],marks=[],terrainQueries=[];
 const scope=vm.createContext({poiWalkActive:true,pineAIActive:false,poiHotbarHasKit:()=>true,
  poiWalkX:10,poiWalkZ:10,poiWalkLevel:0,terrainY:(x,z)=>{terrainQueries.push([x,z]);return 2.8},
  validPos:(x,z)=>x>=0&&x<30&&z>=0&&z<30,isFloor:t=>t==='woodfloor',
  world:[{x:11,z:10,y:0,type:'woodfloor'},{x:10,z:11,y:0,type:'poiPottedPlant'}],
  poiEconomyMesh:{},poiEconomyCaches:new Map(),poiEconomyDrops:new Map(),
  poiInventoryMeshDrops:[{x:11,z:10,y:0,type:'healingHerb'},{x:11,z:11,y:1,type:'equipWoodSword'}],
  poiInventoryStack:type=>['healingHerb','equipWoodSword','kitchenKnife','cannedFood'].includes(type)?1:0,POI_INVENTORY_HERB:'healingHerb',POI_INVENTORY_SWORD:'equipWoodSword',
  mesh:()=>({p:[]}),upload:m=>{built.push(m);return {buf:m}},gl:{deleteBuffer:b=>deleted.push(b)},draw:m=>drawn.push(m),
  quad(m,...args){m.p.push(...args.slice(0,4).flat())},diamond(m,x,y,z,r,color){marks.push([x,y,z,r,color]);m.p.push(x,y,z)}
 });
 vm.runInContext(html.slice(s,e),scope);
 return {scope,built,deleted,drawn,marks,terrainQueries};
}
test('marker batch caches only near actionable loot, updates on pickup and never scans decorations as loot',()=>{
 const {scope,built,deleted,drawn,marks}=fixture();
 scope.poiEconomyDrops.set('11,10',{x:11,z:10,amount:3});
 scope.poiEconomyCaches.set('16,10',{x:16,z:10,amount:3});
 scope.poiEconomyCaches.set('17,10',{x:17,z:10,amount:3});
 scope.poiLootMarksDraw([]);scope.poiLootMarksDraw([]);
 assert.equal(built.length,1);assert.equal(drawn.length,2);
 assert.deepEqual(marks.map(m=>[m[0],m[2]]).sort(),[[11.5,10.5],[16.5,10.5]]);
 assert(marks[0][1]>2.8&&marks[0][1]<3.16,'ground glint remains close to the item');
 scope.poiEconomyDrops.clear();scope.poiEconomyCaches.clear();scope.poiEconomyMesh={};scope.poiInventoryMeshDrops=null;
 scope.poiLootMarksDraw([]);assert.equal(drawn.length,2);assert.equal(deleted.length,1);
});
test('nearest marks obey hard budget, actual floor and Play/AI transitions',()=>{
 const {scope,built,deleted,marks,terrainQueries}=fixture();
 scope.poiInventoryMeshDrops=[];
 for(let x=8;x<=12;x++)for(let z=8;z<=12;z++)scope.poiInventoryMeshDrops.push({x,z,y:0,type:'healingHerb'});
 scope.poiInventoryMeshDrops.push({x:10,z:10,y:1,type:'equipWoodSword'});
 scope.poiLootMarksDraw([]);assert.equal(marks.length,12);assert.equal(terrainQueries.length,12);
 scope.poiWalkLevel=1;scope.poiLootMarksDraw([]);assert.equal(marks.length,13);assert(marks.at(-1)[1]>4.2);
 scope.pineAIActive=true;scope.poiLootMarksDraw([]);assert.equal(built.length,2);assert.equal(deleted.length,2);
});
