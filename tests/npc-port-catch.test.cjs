const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
const p=(x,z)=>({x,z,y:0}),clock=(n,d=0)=>({minute:n,absoluteMinute:d*1440+n});
function sim(seed=null){
 const v={raw:seed,fail:false,settled:true,writes:0,goal:null};
 const n={role:{id:'portfisher',work:p(77,117),portBounds:{}},...p(77,117),activity:'fishing'};
 const c={role:{id:'portfishseller',work:p(84,117),portBounds:{}},...p(84,117),activity:'fish-stall'};
 const site={id:'base',southPort:{fisher:{berth:p(77,117)},market:{work:p(84,117),stall:p(84,116)}}};
 const cx={facilitySite:site,poiTownNpcActors:[n,c],localStorage:{getItem:()=>v.raw,setItem:(_,r)=>{if(v.fail)throw Error('quota');v.writes++;v.raw=r}},
  poiTownNpcHere:(o,q)=>o.x===q.x&&o.z===q.z&&o.y===q.y,poiTownNpcStepT:()=>v.settled?1:.9,
  poiTownNpcGraph:()=>({cells:new Map([['75,117,0',['sea']],['78,119,0',['poiPortNet']],['84,116,0',['poiPortFishStall']]])}),
  poiTownNpcKey:(...q)=>q.join(','),poiTownNpcStance:()=>true,poiTownNpcAct:(o,k)=>o.activity=k,
  poiTownNpcMove:(o,q)=>{v.goal=q;return cx.poiTownNpcHere(o,q)}};
 vm.createContext(cx);vm.runInContext(cut('// BEGIN TOWN NPC CANONICAL PURSE','// END TOWN NPC CANONICAL PURSE')+
 cut('// BEGIN PORT CATCH','// END PORT CATCH'),cx);
 return {v,n,c,cx,fish:()=>cx.poiTownNpcPurseRead().fish,
 frame:(minute,now=minute*500,d=0)=>cx.poiPortFishObserve(n,clock(minute,d),now)};
}
test('only sustained actual settled fishing credits one catch and failure/cold/clock gap cannot duplicate',()=>{
 const s=sim(),{n,v}=s;
 for(let m=500;m<524;m++)s.frame(m);
 a.equal(s.fish().held,0);
 v.fail=true;s.frame(524);a.equal(s.fish().held,0);a.equal(v.writes,0);
 v.fail=false;s.frame(525);a.deepEqual([s.fish().held,s.fish().stall,s.fish().total,s.fish().day],[2,0,2,0]);
 for(let m=526;m<555;m++)s.frame(m);
 a.equal(v.writes,1);
 const cold=sim(v.raw);cold.frame(580);cold.frame(650);a.equal(cold.v.writes,0);a.equal(cold.fish().held,2);
 const off=sim();off.frame(501);off.frame(550);a.equal(off.fish().held,0);
 off.n.activity='net-mending';for(let m=551;m<590;m++)off.frame(m);
 a.equal(off.fish().held,0);
});
test('only settled staffed consignment conserves fish, one retained portion, no gold or player stock',()=>{
 const s=sim();for(let m=500;m<=524;m++)s.frame(m);
 const {cx,v,n,c}=s,post=m=>cx.poiPortFishConsign(n,clock(m),m*500,{plans:2});
 const initial=cx.poiTownNpcPurseRead();
 c.activity='fish-prep';a.equal(post(528),false);c.activity='fish-stall';
 a.equal(post(529),true);a.deepEqual([v.goal.x,v.goal.z],[83,117]);a.equal(s.fish().stall,0);
 Object.assign(n,p(83,117));v.settled=false;post(540);a.equal(s.fish().stall,0);
 v.settled=true;v.fail=true;post(541);a.equal(s.fish().stall,0);
 v.fail=false;post(542);a.deepEqual([s.fish().held,s.fish().stall,s.fish().total],[1,1,2]);
 a.equal(post(543),false);a.equal(cx.poiTownNpcPurseRead().issued,initial.issued);
 const cold=sim(v.raw);a.equal(cold.cx.poiPortFishConsign(cold.n,clock(544),0,{plans:2}),false);
});
test('actual port role, movement and clocks produce, walk and consign conserved stock through the real berth lane',()=>{
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 site.id='base';const world=site.map.world;let raw=null;
 const c={facilitySite:site,world,MAP_W:site.map.width,MAP_H:site.map.height,POI_TOWN_RESIDENT_TICK:380,
  terrainHeights:new Map(site.map.terrainHeights.map(o=>[o.x+','+o.z,o.h])),facilityCreekIndex:null,
  localStorage:{getItem:()=>raw,setItem:(_,s)=>{raw=s}}};
 vm.runInNewContext(cut('const terrainKey=','const terrainY=')+cut('function terrainPassable(','function waterfallFace(')+
 cut('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+cut('const ROAD_BASES=','const baseRoad=')+
 cut('const WALL_MATERIAL_IDS=','// Shared staggered timber')+h.match(/^function isFloor\(t\)\{.+\}$/m)[0]+'\n'+
 cut('function poiWalkPassableDoor','let facilityCreekIndex=')+cut('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed(')+
 cut('function poiTownNpcPlayerBlocksStep','function poiTownNpcReleaseHunt')+cut('function poiTownNpcStepT','function poiTownNpcVisualPosition')+
 cut('// BEGIN SOUTH PORT RESIDENTS','function poiPortNpcCounter')+
 cut('// BEGIN TOWN NPC CANONICAL PURSE','// END TOWN NPC CANONICAL PURSE')+'\nthis.actors=poiTownNpcActors;',c);
 const roles=c.poiPortNpcRoles(site),nr=roles.find(r=>r.id==='portfisher'),cr=roles.find(r=>r.id==='portfishseller');
 const n={role:nr,...nr.home},seller={role:cr,...cr.work,activity:'fish-stall'};
 c.actors.push(n,seller);
 c.poiTownNpcActorOccupied=(x,z,y,self)=>c.actors.some(o=>o!==self&&o.x===x&&o.z===z&&o.y===y);
 const seen=new Set();let caughtAt=null,settledAt=null;
 for(let i=0;i<100;i++){
  const now=i*380,m=500+Math.floor(now/500);
  c.poiPortNpcRoutine(n,clock(m),now,{plans:2});seen.add(n.x+','+n.z);
  const f=c.poiTownNpcPurseRead().fish;
  if(f.held===2&&caughtAt===null){caughtAt=m;a.deepEqual([n.x,n.z],[77,117]);}
  if(f.stall){settledAt=m;break}
 }
 a(caughtAt>=524&&settledAt>caughtAt);
 a(seen.has('77,117')&&seen.has('83,117'));
 a.deepEqual([n.x,n.z,seller.x,seller.z],[83,117,84,117]);
 const f=c.poiTownNpcPurseRead().fish;a.deepEqual([f.held,f.stall,f.total],[1,1,2]);
});
test('Claire can mention delivered stock, not a pending catch, and neither a date nor a sale is claimed',()=>{
 const s=sim();a.equal(s.cx.poiPortFishTalk(s.c),null);
 for(let m=500;m<=524;m++)s.frame(m);a.equal(s.cx.poiPortFishTalk(s.c),null);
 Object.assign(s.n,p(83,117));s.cx.poiPortFishConsign(s.n,clock(530),8000,{plans:2});
 a.match(s.cx.poiPortFishTalk(s.c),/ネリが届けてくれた魚/);
 a.doesNotMatch(s.cx.poiPortFishTalk(s.c),/今朝|今日|新鮮/);
 a.equal(sim(s.v.raw).cx.poiPortFishTalk(s.n),null);
 a.match(h,/const topics=report\?\[report,\.\.\.usualTopics\]:fish\?\[fish,\.\.\.usualTopics\]:usualTopics/);
});
