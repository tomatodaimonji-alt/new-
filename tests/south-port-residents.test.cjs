const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||process.argv[2]||'world-editor.html','utf8');
const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)};
const p=(x,z,facing=0)=>({x,z,y:0,facing});
const port={name:'セルネア',bounds:{x1:73,x2:92,z1:109,z2:127,y:0},entry:p(91,123),
 market:{stall:p(84,116),work:p(84,117),public:p(84,115,2),prep:p(86,117,3),rest:p(86,120,3)},fisher:{berth:p(77,117,2),rest:p(81,121,3)}};
function setup(){
 const town={role:{id:'southmerchant'},x:101,z:112,y:0,path:[1]},stats={moves:[],talk:[],stance:0,blocked:null};
 const c=vm.createContext({port,facilitySite:{id:'base',southPort:port},poiWalkX:105,poiWalkZ:111,poiWalkLevel:0,
  poiTownNpcActors:[town],poiTownNpcVersion:0,POI_TOWN_RESIDENT_HP:100,POI_TOWN_RESIDENT_TICK:380,
  poiTownNpcLoadout:()=>({weapon:null,gear:{}}),poiTownNpcStance:()=>{stats.stance++;return true},
  poiTownDailySpawn:(a,_r,b)=>b.has(a.x+','+a.z+','+a.y)?{...a,x:a.x+1}:a,
  poiTownNpcPlayerBlocksStep:()=>false,
  poiTownNpcActorOccupied:(x,z)=>stats.blocked?.x===x&&stats.blocked?.z===z,
  poiTownNpcMove:(a,b,label,_now,budget)=>{stats.moves.push([a.role.id,label,b.x,b.z]);if(stats.stalled||!budget.plans)return false;Object.assign(a,b);return true},
  poiTownNpcAct:(a,label)=>{a.activity=label},poiTownDialogue:null,poiTownDialogueClose:()=>{stats.talk.push('close');c.poiTownDialogue=null}});
 vm.runInContext(cut('// BEGIN SOUTH PORT RESIDENTS','// END SOUTH PORT RESIDENTS'),c);
 return {c,town,stats};
}
const clock=minute=>({minute,absoluteMinute:minute});
const role=(c,id)=>c.poiTownNpcActors.find(a=>a.role.id===id);
test('local-only same floor residency and leave hysteresis preserve existing merchant identity and saved fields',()=>{
 const {c,town,stats}=setup(),time=clock(600);
 c.poiPortNpcSync(time,0);
 assert.deepEqual(c.poiTownNpcActors,[town]);assert.equal(stats.stance,0,'far area does no stance validation/path work');
 c.poiWalkX=97;c.poiWalkZ=117;c.poiWalkLevel=-1;c.poiPortNpcSync(time,380);
 assert.deepEqual(c.poiTownNpcActors,[town]);
 c.poiWalkLevel=0;c.poiPortNpcSync(time,760);
 assert.equal(c.poiTownNpcActors.length,3);assert.equal(role(c,'portfishseller').activity,'fish-stall');assert.equal(role(c,'portfisher').activity,'fishing');
 const actor=role(c,'portfishseller');c.poiWalkX=100;c.poiPortNpcSync(time,1000);
 assert.equal(role(c,'portfishseller'),actor,'small retreat does not reinstantiate a resident');
 c.poiTownDialogue={actor};
 c.poiWalkX=102;c.poiPortNpcSync(time,1500);
 assert.equal(role(c,'portfishseller'),undefined);assert.deepEqual(stats.talk,['close']);
 assert.equal(c.poiTownNpcActors[0],town);assert.deepEqual(town.path,[1]);
});
test('seller covers prep/rest and fishing berth round; movement is real routine, not coordinate rewrite after warm activation',()=>{
 const {c,stats}=setup();c.poiWalkX=90;c.poiWalkZ=115;c.poiPortNpcSync(clock(600),0);
 const seller=role(c,'portfishseller'),fisher=role(c,'portfisher');
 assert.deepEqual([seller.x,seller.z],[84,117]);assert.deepEqual([fisher.x,fisher.z],[77,117]);
 stats.stalled=true;c.poiPortNpcRoutine(seller,clock(735),380,{plans:2});assert.deepEqual([seller.x,seller.z],[84,117]);assert.equal(seller.activity,'port-walk');
 stats.stalled=false;c.poiPortNpcRoutine(seller,clock(735),760,{plans:2});assert.deepEqual([seller.x,seller.z],[86,117]);assert.equal(seller.activity,'fish-prep');
 c.poiPortNpcRoutine(fisher,clock(710),760,{plans:2});assert.deepEqual([fisher.x,fisher.z],[81,121]);assert.equal(fisher.activity,'net-mending');
 c.poiPortNpcRoutine(seller,clock(1350),1040,{plans:2});assert(seller.recessed);assert.deepEqual([seller.x,seller.z],[86,120]);
 assert(stats.moves.every(x=>x[2]>=73&&x[2]<=92&&x[3]>=109&&x[3]<=127));
});
test('cold activation cannot put a visible actor in the same cell as the player',()=>{
 const {c}=setup();c.poiWalkX=84;c.poiWalkZ=117;
 c.poiPortNpcSync(clock(600),0);
 const a=role(c,'portfishseller');assert(a);assert(!a.recessed);assert.notDeepEqual([a.x,a.z],[84,117]);
});
test('ordinary Marek speech remains first, optional clue only exists for authored port and correctly turns west',()=>{
 const {c,town}=setup();
 const hint=c.poiPortMarekTopic(town);
 assert.match(hint,/南.*西.*セルネア/);
 assert.equal(c.poiPortMarekTopic({role:{id:'toolkeeper'}}),null);
 c.facilitySite.southPort=null;assert.equal(c.poiPortMarekTopic(town),null);
 assert.match(h,/southmerchant:\['店の裏は荷ほどき場だ。/);
});
test('converse across the fish stall from its public side only, not through a missing prop or wall',()=>{
 const {c}=setup();c.poiWalkX=84;c.poiWalkZ=115;c.poiPortNpcSync(clock(600),0);
 const actor=role(c,'portfishseller'),g={cells:new Map([['84,116,0',['roadCutStoneFull','poiPortFishStall']]])};
 Object.assign(c,{poiTownNpcKey:(...a)=>a.join(','),isFloor:t=>t.startsWith('road'),poiMonsterStates:new Map()});
 assert(c.poiPortNpcCounter(actor,0,1,g));
 assert.equal(c.poiPortNpcCounter(actor,1,0,g),false);
 g.cells.get('84,116,0').push('stonewall');assert.equal(c.poiPortNpcCounter(actor,0,1,g),false);
 g.cells.set('84,116,0',['roadCutStoneFull']);assert.equal(c.poiPortNpcCounter(actor,0,1,g),false);
 assert.match(h,/function poiTownCounterTalkReachable[\s\S]{0,300}poiPortNpcCounter/);
});
test('exact final map has bounded legal paths for both villagers and a usable dialogue square',()=>{
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 assert(site.southPort);
 const world=site.map.world;site.id='base';
 const c={facilitySite:site,world,MAP_W:site.map.width,MAP_H:site.map.height,terrainHeights:new Map(site.map.terrainHeights.map(o=>[o.x+','+o.z,o.h])),
  facilityCreekIndex:null,poiMonsterStates:new Map()};
 vm.runInNewContext(cut('const terrainKey=','const terrainY=')+cut('function terrainPassable(','function waterfallFace(')+
  cut('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+cut('const ROAD_BASES=','const baseRoad=')+
  cut('const WALL_MATERIAL_IDS=','// Shared staggered timber')+h.match(/^function isFloor\(t\)\{.+\}$/m)[0]+'\n'+
  cut('function poiWalkPassableDoor(','let facilityCreekIndex=')+
  cut('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed(')+
  cut('// BEGIN SOUTH PORT RESIDENTS','// END SOUTH PORT RESIDENTS'),c);
 const locals=c.poiPortNpcRoles(site);assert.equal(locals.length,2);
 const through=new Set(site.southPort.dock.route.map(p=>p.x+','+p.z));
 for(const actor of locals){
  const anchors=[actor.home,actor.work,...(actor.prep?[actor.prep]:[])];
  for(let i=0;i<anchors.length;i++){
   const a=anchors[i],b=anchors[(i+1)%anchors.length];
   const path=c.poiTownFindPath(a,b,(_from,to)=>!c.poiPortNpcContains(site.southPort.bounds,to));
   assert(path&&path.length>0&&path.length<=12,actor.id+' local trip');
   assert(!through.has(a.x+','+a.z),actor.id+' stationary anchor may not block pier');
  }
 }
 const {public:p,work}=site.southPort.market;
 Object.assign(c,{poiWalkX:p.x,poiWalkZ:p.z,poiWalkLevel:p.y});
 assert(c.poiPortNpcCounter({...work,role:locals[0],activity:'fish-stall'},0,1,c.poiTownNpcGraph()));
 const approach=site.southPort.approach, south=approach.findIndex(p=>p.z>approach[0].z),west=approach.findIndex(p=>p.x<approach[0].x);
 assert(south>0&&west>south,'Marek tells the correct first movement/turn');
});
