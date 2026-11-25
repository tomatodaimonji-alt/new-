const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
const cut=(a,b)=>{const x=h.indexOf(a),y=h.indexOf(b,x+1);assert(x>=0&&y>x,a);return h.slice(x,y)};
function setup(saved=null){
 const o={raw:saved,fail:false,writes:0,step:1};
 const c={facilitySite:{id:'base'},localStorage:{getItem:()=>o.raw,setItem:(_,v)=>{if(o.fail)throw Error('quota');o.writes++;o.raw=v}},
  poiTownNpcHere:(a,p)=>a.x===p.x&&a.z===p.z&&a.y===p.y,poiTownNpcStepT:()=>o.step};
 vm.createContext(c);vm.runInContext(cut('// BEGIN TOWN NPC CANONICAL PURSE','// END TOWN NPC CANONICAL PURSE')+
 cut('// BEGIN TOWN SCOUT REPORT','// END TOWN SCOUT REPORT'),c);return {c,o};
}
const scout=()=>({role:{id:'northscout',home:{x:34,z:30,y:0},gate:{x:35,z:22,y:0},entry:{x:39,z:4,y:0},branch:{x:66,z:4,y:0},work:{x:67,z:2,y:0}}});
const clk=(m,d=1)=>({minute:m,absoluteMinute:d*1440+m,day:d+1});
function obs(c,a,leg,m,n=1){Object.assign(a,a.role[leg==='briefing'?'home':leg]);return c.poiTownScoutObserve(a,clk(m,n),leg,m*500)}
test('cold shortcut, skipped waypoint and unsettled final stride never certify a patrol',()=>{
 const {c,o}=setup(),a=scout();
 for(const [p,m] of [['work',700],['branch',905],['entry',932],['gate',947],['home',970]])obs(c,a,p,m);
 assert.equal(o.writes,0);assert.equal(c.poiTownScoutReport(clk(980)),null);
 obs(c,a,'briefing',450);obs(c,a,'gate',489);obs(c,a,'entry',509);obs(c,a,'work',570);
 for(const [p,m] of [['branch',905],['entry',932],['gate',947],['home',970]])obs(c,a,p,m);
 assert.equal(o.writes,0);
});
test('only round trip proves one durable dated passage with no monster/safety claim',()=>{
 const {c,o}=setup(),a=scout();
 Object.assign(a,a.role.home);c.poiTownScoutObserve(a,clk(450),'briefing',100);
 for(const [p,m] of [['gate',487],['entry',510],['branch',542],['work',550],['branch',904],['entry',938],['gate',956]])obs(c,a,p,m);
 o.step=.9;obs(c,a,'home',980);assert.equal(o.writes,0);
 o.step=1;o.fail=true;obs(c,a,'home',981);assert.equal(o.writes,0);
 o.fail=false;obs(c,a,'home',985);obs(c,a,'home',990);assert.equal(o.writes,1);
 const cold=setup(o.raw).c;
 assert.match(cold.poiTownScoutReport(clk(990)),/今日.*野営地.*往復/);
 assert.doesNotMatch(cold.poiTownScoutReport(clk(990)),/安全|敵はいない/);
 assert.match(cold.poiTownScoutReport(clk(520,2)),/昨日/);
 assert.equal(cold.poiTownScoutReport(clk(520,3)),null);
});
function runDuty(source,compareBaseline=false){
 const h=source;
 const cut=(a,b)=>{const x=h.indexOf(a),y=h.indexOf(b,x+1);assert(x>=0&&y>x,a);return h.slice(x,y)};
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 site.id='base';let raw=null;
 const c={facilitySite:site,world:site.map.world,MAP_W:site.map.width,MAP_H:site.map.height,
  terrainHeights:new Map(site.map.terrainHeights.map(o=>[o.x+','+o.z,o.h])),facilityCreekIndex:null,POI_TOWN_RESIDENT_TICK:380,
  localStorage:{getItem:()=>raw,setItem:(_,v)=>{raw=v;}}};
 vm.runInNewContext(cut('const terrainKey=','const terrainY=')+cut('function terrainPassable(','function waterfallFace(')+
 cut('const STAIR_DIRECTIONS=','function elevationStairGeometry(')+cut('const ROAD_BASES=','const baseRoad=')+
 cut('const WALL_MATERIAL_IDS=','// Shared staggered timber')+h.match(/^function isFloor\(t\)\{.+\}$/m)[0]+'\n'+
 cut('function poiWalkPassableDoor','let facilityCreekIndex=')+cut('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed(')+
 cut('function poiTownNpcPlayerBlocksStep','function poiTownNpcReleaseHunt')+cut('function poiTownNpcStepT','function poiTownNpcVisualPosition')+
 cut('// BEGIN TOWN WATCH DUTY','// END TOWN WATCH DUTY')+
 cut('// BEGIN TOWN NPC CANONICAL PURSE','// END TOWN NPC CANONICAL PURSE'),c);
 const role=c.poiTownDutyRoles().find(r=>r.id==='northscout');assert(role);
 const a={role,...role.home,recessed:false},visited=new Set(),trace=[];
 for(let i=0;i<1000;i++){
  const now=i*380,m=450+Math.floor(now/500);
  c.poiTownDutyRoutine(a,clk(m),now,{plans:2});visited.add(a.x+','+a.z);
  if(m<900)assert.equal(raw,null);
  trace.push([m,a.x,a.z,a.activity,a.scoutLeg,a.recessed]);
  if(m>=1040)break;
 }
 if(compareBaseline)return trace;
 assert(raw);for(const p of [role.gate,role.entry,role.branch,role.work])assert(visited.has(p.x+','+p.z));
 assert.deepEqual([a.x,a.z],[role.home.x,role.home.z]);
 assert.equal(JSON.parse(raw).northPatrolDay,1);
 return trace;
}
test('production uses the exact v330 movement trace and reports only after the complete return',()=>{
 const old=fs.readFileSync(process.env.SCOUT_V330_BASE||'/workspace/shared/workshop-next-npc-paid-shift/release.html','utf8');
 assert.deepEqual(runDuty(h),runDuty(old,true));
});
