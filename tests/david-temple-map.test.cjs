const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const site=build('base'),key=o=>[o.x,o.z,o.y].join(',');
test('the surface temple appends an open stocked arena to the old walkable road without changing any authored records',()=>{
 const d=site.davidTemple;a(d,'temple is absent');
 a(d.name==='白環の大神殿');a.deepEqual([d.boss.x,d.boss.z,d.boss.y],[24,104,0]);a.equal(d.boss.type,'monsterStoneDavid');
 a.deepEqual([site.map.width,site.map.height],[128,128]);const all=site.map.world,old=all.slice(0,d.authored.index),added=all.slice(d.authored.index);
 a.equal(old.length,8984);a.equal(crypto.createHash('sha256').update(JSON.stringify(old)).digest('hex'),process.env.OLD_PREFIX||'15535689893b8a631827467885930d45d786e0d3b559b74d6a2544267d03439a');
 const oldKeys=new Set(old.map(key));a(added.every(o=>!oldKeys.has(key(o))));a(added.length<=690);
 a.equal(added.filter(o=>o.type===d.boss.type).length,1);
 const grid=new Map();for(const o of all){const k=key(o);grid.set(k,[...(grid.get(k)||[]),o.type])}
 const isFloor=t=>/^(?:road|grass|earth|stone$|woodfloor)/.test(t);
 const walk=(x,z)=> (grid.get(key({x,z,y:0}))||[]).every(t=>isFloor(t)||t==='lantern'||t===d.boss.type);
 a.equal(key(d.approach[0]),'29,88,0');
 for(const [i,p] of d.approach.entries()){
  a(walk(p.x,p.z),key(p));a((grid.get(key(p))||[]).some(isFloor),key(p));
  if(i){const b=d.approach[i-1];a.equal(Math.abs(b.x-p.x)+Math.abs(b.z-p.z),1)}
 }
 for(let x=18;x<=30;x++)for(let z=98;z<=110;z++){
  a(walk(x,z),x+','+z);a(!(grid.get(key({x,z,y:2}))||[]).length,'overhead swing stays open');
 }
 for(let z=94;z<=103;z++)a(walk(24,z),'clear exact retreat');
 const b=site.buildings.find(x=>x.id==='davidTemple');
 a(b.footprint.length>=350);a(b.floorFootprints[0].length===b.footprint.length);
 a(added.some(o=>o.type==='roofTile'&&o.y===2));a(!added.some(o=>/portal|guildStair|ironGate|rewardChest/i.test(o.type)));
});
test('actual surface collision and local wildlife keepout respect the new arena and old road',()=>{
 const d=site.davidTemple;a.ok(d);site.id='base';
 const world=site.map.world;
 const c=vm.createContext({facilitySite:site,world,poiWalkLevel:0,poiWalkActive:true,poiMonsterAt:()=>null,
  poiIsMonster:t=>t==='monsterStoneDavid',pineSuperVehicleType:()=>false,isWallId:t=>t.includes('wall'),
  facilityCreekIndex:null,validPos:(x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<128&&z<128,
  isFloor:t=>/^(?:road|grass|earth|stone$|woodfloor)/.test(t)});
 vm.runInContext(cut('// BEGIN DAVID TEMPLE MAP','// END DAVID TEMPLE MAP')+
  cut('function poiWalkPassableDoor(','let facilityCreekIndex=')+cut('function poiWalkCanStep(','function poiFreeCenter(')+
  cut('function poiWildProtectedArea(','function poiWildNearResident('),c);
 for(const p of d.approach)a(c.poiWalkCanStep(p.x,p.z),'legal actual approach '+key(p));
 for(let x=d.threshold.minX;x<=d.threshold.maxX;x++)a(c.poiWalkCanStep(x,94),'full actual threshold');
 for(const [x,z] of [[21,94],[27,94],[24,115],[13,104],[34,104],[15,101]])a.equal(c.poiWalkCanStep(x,z),false);
 for(let z=95;z<=103;z++)a(c.poiWalkCanStep(24,z,24,z+1));
 a(c.poiWildProtectedArea(24,104));a(c.poiWildProtectedArea(24,91));
 a.equal(c.poiWildProtectedArea(29,88),false,'not adding a protected road band elsewhere');
 a.equal(c.poiDavidTempleContains(site,24,104,-1),false,'no lower-floor side effect');
});
test('open courtyard keeps native sky while roofed colonnades retain cutaway',()=>{
 const c=vm.createContext({facilitySite:site,poiWalkActive:true,poiWalkX:24,poiWalkZ:100,poiWalkLevel:0,
  facilityDoorTiles:new Set(),facilityCellKey:(...p)=>p.join(','),facilityFloorOwner:()=>13});
 c.facilitySite.id='base';
 vm.runInContext(cut('// BEGIN DAVID TEMPLE MAP','// END DAVID TEMPLE MAP')+cut('function facilityHiddenRoof(','function pineGuildRenewalSample('),c);
 a.equal(c.facilityHiddenRoof(),null,'not indoor in open center');
 c.poiWalkX=16;a.equal(c.facilityHiddenRoof(),13,'ordinary cutaway under covered colonnade');
 c.poiWalkX=60;a.equal(c.facilityHiddenRoof(),13,'no unrelated change');
});
test('only old occupied temple masonry checkpoints relocate one legal step, preferring exterior',()=>{
 const d=site.davidTemple,y=0,c=vm.createContext({facilitySite:site,world:site.map.world.slice(),poiWalkLevel:-1});
 c.poiWalkCanStep=(x,z)=>!c.world.some(o=>o.x===x&&o.z===z&&o.y===0&&(/stonewall|poiDavid/.test(o.type)));
 vm.runInContext(cut('// BEGIN DAVID TEMPLE MAP','// END DAVID TEMPLE MAP'),c);
 const p={x:13,z:104,y,facing:0},copy=o=>JSON.parse(JSON.stringify(o));
 a.deepEqual(copy(c.poiDavidTempleRecoverPosition(p)),{...p,x:12});
 const upright={x:15,z:101,y,facing:2},to=c.poiDavidTempleRecoverPosition(upright);
 a.equal(Math.abs(to.x-upright.x)+Math.abs(to.z-upright.z),1);a.equal(to.facing,2);
 for(const p of [{x:24,z:94,y,facing:1},{x:24,z:102,y,facing:1},{...upright,y:-1},{x:75,z:37,y}])a.equal(c.poiDavidTempleRecoverPosition(p),p);
 const i=c.world.findIndex(o=>o.x===upright.x&&o.z===upright.z&&o.y===0&&o.type==='poiDavidTempleColumn');
 c.world.splice(i,1);a.equal(c.poiDavidTempleRecoverPosition(upright),upright,'removed objects are not stale overrides');
 a.equal(c.poiWalkLevel,-1);a.match(h,/function workshopResumeRestorePosition\(p\)\{[^]*?p=poiDavidTempleRecoverPosition\(p\);/);
});
