const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function setup(raw){
 const a=html.indexOf('const POI_HOTBAR_KEY='),b=html.indexOf('function poiHotbarSwordIcon(',a);
 let mem=JSON.stringify(raw),fail=false;
 const x={facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,poiWalkX:3,poiWalkZ:4,poiWalkFacing:1,
  poiWalkCanStep:()=>true,poiHotbarRender(){},poiWalkAvatar(){},poiShopIsOpen:()=>false,toast(){},isFloor:t=>t==='river',
  world:[],localStorage:{getItem:()=>mem,setItem(_k,v){if(fail)throw Error('disk');mem=v}}};
 vm.createContext(x);vm.runInContext(html.slice(a,b),x);
 return {x,save:()=>JSON.parse(mem),fail:v=>{fail=v}};
}
test('sword drop is atomic, persists and re-picks without equipping or losing gold',()=>{
 const h=setup({version:1,weapon:'equipWoodSword',potions:2,gold:4,claimedCaches:['glade']}),{x}=h;
 assert.equal(x.poiInventorySnapshot().sword,true);
 h.fail(true);assert.equal(x.poiInventoryDrop(0).ok,false);assert.equal(x.poiInventorySnapshot().sword,true);
 h.fail(false);assert(x.poiInventoryDrop(0).ok);
 assert.deepEqual(h.save(),{version:1,weapon:null,potions:2,gold:4,claimedCaches:['glade'],sword:false,
  drops:[{type:'equipWoodSword',x:4,z:4,y:0}]});
 const reload=setup(h.save());
 assert(reload.x.poiInventoryPickup(4,4));assert.equal(reload.save().weapon,null);
 assert.equal(reload.x.poiInventorySnapshot().sword,true);assert.equal(reload.save().drops,undefined);
});
test('one herb per swipe, invalid/blocked/wet destinations and full pickup never consume items',()=>{
 const h=setup({version:1,weapon:null,potions:3}),{x}=h;
 assert.equal(x.poiInventoryDrop(2).ok,false);
 x.world=[{x:4,z:4,y:0,type:'river'}];assert(!x.poiInventoryDrop(1).ok);
 x.world=[];x.poiWalkCanStep=()=>false;assert(!x.poiInventoryDrop(1).ok);
 assert.equal(h.save().potions,3);
 x.poiWalkCanStep=()=>true;assert(x.poiInventoryDrop(1).ok);
 assert.equal(h.save().potions,2);
 assert.equal(h.save().drops[0].type,'healingHerb');
 const slots=Array.from({length:27},(_,i)=>i?{type:'healingHerb',count:9}:{type:'equipWoodSword',count:1});
 const full=setup({...h.save(),potions:9,slots});
 assert(!full.x.poiInventoryPickup(4,4));assert.equal(full.save().drops.length,1);
 assert(x.poiInventoryPickup(4,4));assert.equal(h.save().potions,3);
});
test('impossible ground location in a damaged save cannot strand the starting sword',()=>{
 const h=setup({version:1,weapon:null,potions:3,sword:false,drops:[{type:'equipWoodSword',x:50,z:100,y:0}]});
 assert.equal(h.x.poiInventorySnapshot().sword,true);
 assert.equal(h.x.poiInventorySnapshot().drops.length,0);
});
