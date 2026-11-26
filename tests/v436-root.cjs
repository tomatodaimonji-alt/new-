const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
for(const m of src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const fn=name=>{const re=new RegExp('^function '+name+'\\([^]*?^}', 'm');const x=src.match(re);a.ok(x,name);return x[0]};
const tests=[
 ['underground bake never claims surface ground cache',()=>{
  const view={active:true,y:-1};const c={facilitySite:{id:'frontier'},poiWalkActive:true,facilityViewLevel:()=>view.y};
  const key=vm.runInNewContext(fn('facilityGradeKey')+';facilityGradeKey',c);
  a.equal(key([]),null);
  view.y=0;a.equal(key([]),'frontier-ground');
 }],
 ['death in the south cellar returns outside its gate',()=>{
  const c={poiDavidTempleEnclosedAt:()=>false,frontierSouthRuinsOwn:(x,z)=>x===160&&z===119,frontierPlayCave:false,frontierBurrowRoofAt:()=>false};
  vm.createContext(c);vm.runInContext(fn('poiDefeatArea')+';'+fn('poiDefeatCheckpoint'),c);
  const site={id:'frontier',spawn:{x:115,z:30},southRuinsEntry:{x:160,z:72,y:0}};
  const area=c.poiDefeatArea(site,160,119,-1);a.equal(area,'southRuins');
  const p=c.poiDefeatCheckpoint({site,area,facing:1});
  a.deepEqual([p.x,p.z,p.y],[160,72,0]);
 }],
 ['only the live boss chamber cues the recorded battle theme',()=>{
  const c={facilitySite:{id:'frontier'},poiWalkActive:true,poiWalkX:160,poiWalkZ:118,poiWalkLevel:-1,
    frontierSouthRuinsOwn:()=>true,frontierSouthBossDefeated:()=>false,poiSouthSettlementContains:()=>false,poiAudioSnowActive:()=>false,
    poiOrchestraBattleUntil:Infinity};
  vm.createContext(c);vm.runInContext(fn('poiOrchestraScene'),c);
  a.equal(c.poiOrchestraScene(0),'southRuinsBoss');
  c.poiWalkZ=115;a.equal(c.poiOrchestraScene(0),'southRuins');
  c.poiWalkZ=120;c.frontierSouthBossDefeated=()=>true;a.equal(c.poiOrchestraScene(0),'southRuins');
 }]
];
let n=0;
for(const [name,test] of tests)try{test();console.log('PASS '+name)}catch(e){console.log('FAIL '+name+': '+e.message);n++}
process.exitCode=n?1:0;
