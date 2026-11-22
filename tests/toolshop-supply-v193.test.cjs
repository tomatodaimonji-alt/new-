const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const slice=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)));
function fixture(saved={version:1,weapon:null,potions:0,gold:100}){
 let raw=JSON.stringify(saved),writes=0,fail=false,day=1;
 const c=vm.createContext({facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,$:()=>null,world:[],
  poiTownClockSnapshot:()=>({day}),poiTownNpcHere:(a,p)=>!!p&&a.x===p.x&&a.z===p.z&&a.y===p.y,
  poiTownNpcActive:()=>true,poiTownNpcActors:[],POI_TOWN_RESIDENT_ROLES:[{id:'stablekeeper',public:{x:34,z:61,y:0,facing:1}}],poiTownNpcAct:(a,t)=>{a.activity=t},
  poiTownNpcMove:(a,p)=>{a.goal=p;return a.x===p.x&&a.z===p.z&&a.y===p.y},
  localStorage:{getItem:()=>raw,setItem(_k,v){if(fail)throw Error('storage');raw=v;writes++}},toast(){},document:{querySelectorAll:()=>[]}});
 const all=slice('const POI_HOTBAR_KEY=','function poiResetCombat(')+slice('// BEGIN TOOLSHOP SUPPLY ROUTINE','// END TOOLSHOP SUPPLY ROUTINE');
 vm.runInContext(all+';const POI_TOWN_CLOSE=1080,POI_TOWN_OPEN=450,POI_TOWN_RESIDENT_TICK=380;',c);
 return {c,raw:()=>JSON.parse(raw),writes:()=>writes,fail:v=>fail=v,setDay:v=>day=v};
}
const shop={x:71,z:35,y:0,facing:3},yard={x:34,z:61,y:0,facing:1},work={x:35,z:61,y:0};
test('stock is finite and actual buy atomically records one herb, 6G, one shelf decrement',()=>{
 const f=fixture(),{c}=f;
 assert(c.poiToolshopStock()>=1);
 const start=c.poiToolshopStock();
 assert.equal(f.writes(),0);
 f.fail(true);assert.equal(c.poiEconomyBuyPotion().reason,'storage');assert.equal(c.poiToolshopStock(),start);
 f.fail(false);for(let i=0;i<start;i++)assert.equal(c.poiEconomyBuyPotion().ok,true);
 assert.equal(c.poiEconomyBuyPotion().reason,'stock');assert.equal(c.poiToolshopStock(),0);
 assert.equal(f.raw().gold,100-6*start);
 assert.equal(fixture(f.raw()).c.poiToolshopStock(),0);
});
test('morning cart requires actual Noah and then physical return; reload cannot credit twice',()=>{
 const f=fixture(),{c}=f,clock={day:1,minute:570};
 const tobin={role:{id:'toolkeeper',work:shop},...shop,activity:'work'};
 const noah={role:{id:'stablekeeper',work,public:yard},...work,activity:'work'};c.poiTownNpcActors.push(tobin,noah);
 const go=()=>c.poiToolshopSupplyRoutine(tobin,clock,100,{plans:2});
 const initial=c.poiToolshopStock();assert.equal(go(),true);assert.deepEqual(tobin.goal,yard);
 Object.assign(tobin,yard);noah.activity='going-work';assert.equal(go(),true);assert.equal(f.writes(),0);
 noah.activity='work';assert.equal(go(),true);assert.equal(f.raw().toolshopSupply.cargo,1);assert.equal(c.poiToolshopStock(),initial);
 const reload=fixture(f.raw());assert.equal(reload.c.poiToolshopStock(),initial);
 Object.assign(tobin,shop);assert.equal(go(),true);assert(c.poiToolshopStock()>initial);
 assert.equal(f.raw().toolshopSupply.delivered,1);assert.equal(f.raw().toolshopSupply.cargo,0);
 assert.equal(go(),false);assert.equal(f.writes(),2);
 clock.day=4;clock.minute=1100;assert.equal(go(),false);assert.equal(f.writes(),2,'late time skips do not auto-stock');
});
test('cargo resumes from the receiving yard, still requires the route through return, and cannot roll back the day',()=>{
 const f=fixture({version:1,weapon:null,potions:0,toolshopSupply:{version:1,stock:8,delivered:1,cargo:2}});
 const {c}=f,clock={day:2,minute:600};
 assert.deepEqual(c.poiToolshopSupplyResume(clock),yard);
 assert.equal(c.poiToolshopSupplyResume({day:1,minute:600}),null);
 assert.equal(c.poiToolshopSupplyResume({day:2,minute:1100}),null);
 const a={role:{id:'toolkeeper',work:shop},...yard,activity:'supply-return',supplyCarrying:true};
 const b={role:{id:'stablekeeper',work,public:yard},...work,activity:'work'};c.poiTownNpcActors.push(a,b);
 assert(c.poiToolshopSupplyRoutine(a,clock,420,{plans:2}));assert.equal(f.writes(),0);
 Object.assign(a,shop,{moveAt:420});assert(c.poiToolshopSupplyRoutine(a,clock,500,{plans:2}));assert.equal(f.writes(),0);
 assert(c.poiToolshopSupplyRoutine(a,clock,800,{plans:2}));
 assert.deepEqual(f.raw().toolshopSupply,{version:1,stock:9,delivered:2,cargo:0});
 assert.equal(c.poiToolshopSupplyRoutine(a,{day:1,minute:570},900,{plans:2}),false);
 assert.equal(f.writes(),1);
});
test('actual 128×96 town graph has a cardinal door-and-road route between the staffed desk and loading yard',()=>{
 const actual=vm.runInNewContext(slice('const FACILITY_SITES=','function workshopResumeDecode(')+';buildFacilitySite("base")');
 const world=actual.map.world,ctx=vm.createContext({world,MAP_W:128,MAP_H:96,facilitySite:{...actual,id:'base'},terrainPassable:()=>true,
  facilityCreekIndex:null,isWallId:t=>/wall/i.test(t),ROAD_IDS:new Set(world.map(o=>o.type).filter(t=>t.startsWith('road')))});
 vm.runInContext(slice('function isFloor(','// Tabletop decor')+slice('function poiWalkPassableDoor(','let facilityCreekIndex=')+
  slice('const POI_TOWN_RESIDENT_ROLES=','function poiTownNpcVisiting('),ctx);
 const path=ctx.poiTownFindPath(shop,yard);assert(path&&path.length>55&&path.length<117);
 let p=shop;
 for(const step of path){assert.equal(Math.abs(step.x-p.x)+Math.abs(step.z-p.z),1);assert.equal(step.y,0);p=step;}
 assert.deepEqual([p.x,p.z,p.y],[34,61,0]);
 const doors=path.filter(q=>world.some(o=>o.y===q.y&&o.x===q.x&&o.z===q.z&&ctx.poiWalkPassableDoor(o.type)));
 assert(doors.length>0,'walks through a real entrance');
 const road=path.filter(q=>world.some(o=>o.y===q.y&&o.x===q.x&&o.z===q.z&&o.type.startsWith('road')));
 assert(road.length>10,'walks along authored streets');
 assert(ctx.poiTownFindPath(yard,shop)?.length);
});
