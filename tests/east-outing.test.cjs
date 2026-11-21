const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
const site=JSON.parse(JSON.stringify(vm.runInNewContext(slice('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite("base")')));
const main=[[67,33],[67,38],[73,38],[73,42],[76,42],[76,44],[81,44],[81,39],[86,39],[86,38],[86,36]];
const shrine=[[78,44],[78,45]];
const shortcut=[[86,36],[86,28],[76,28],[76,26],[68,26],[68,30],[67,30],[67,33]];
function expand(points){
 let [x,z]=points[0];const cells=[[x,z]];
 for(const [xx,zz] of points.slice(1)){
  assert(x===xx||z===zz);
  while(x!==xx||z!==zz){x+=Math.sign(xx-x);z+=Math.sign(zz-z);cells.push([x,z]);}
 }
 return cells;
}
const palettes=new Set(['earth','moss','river','grassTrampled','grassPebbles','grassWild','grassForest','grassPatch','stone','roadCutStoneFull']);
const k=(x,z)=>x+','+z;
function testWalker(site){
 const water=[...site.creek.deep,...(site.canal?.water||[])];
 const spans=[...site.creek.crossings,...(site.canal?.bridgePairs||[]).flat()];
 const ctx=vm.createContext({facilitySite:{id:'base',...site},world:site.map.world,
  facilityCreekIndex:{water:new Set(water.map(({x,z})=>k(x,z))),
   parts:new Map(spans.map(({x,z,type})=>[k(x,z),site.map.world.find(o=>o.x===x&&o.z===z&&o.type===type)])),
   terrace:new Set(),shallows:new Map()},
  poiWalkLevel:0,poiWalkActive:true,validPos:(x,z)=>x>=0&&x<site.map.width&&z>=0&&z<site.map.height,
  isWallId:t=>t.startsWith('stonewall'),isFloor:t=>palettes.has(t),pineSuperVehicleType:()=>false,
  poiIsMonster:()=>false,poiMonsterAt:()=>null});
 vm.runInContext(slice('function poiWalkPassableDoor(','let facilityCreekIndex=')+
   slice('function poiWalkCanStep(','function poiWalkCamera('),ctx);
 return (...args)=>ctx.poiWalkCanStep(...args);
}
function featuresAt(x,z,y=0){return site.map.world.filter(o=>o.x===x&&o.z===z&&o.y===y)}
test('seamless east excursion reaches a weathered watchtower and a separate shrine, then takes a genuinely shorter path back',()=>{
 assert.deepEqual([site.map.width,site.map.height],[96,56]);
 const out=expand(main),side=expand(shrine),back=expand(shortcut),walk=testWalker(site);
 for(const [label,route] of [['main',out],['shrine',side],['shortcut',back]])
  for(let i=1;i<route.length;i++){
   const [x,z]=route[i];
   assert(walk(x,z,...route[i-1]),label+': '+route[i]);
   assert(featuresAt(x,z).some(o=>palettes.has(o.type)),label+' has an explicit trail underfoot: '+route[i]);
  }
 assert.deepEqual([out.length-1,back.length-1],[38,36],'north trail really is shorter over the same endpoints');
 assert(featuresAt(86,38).some(o=>o.type==='ruinDoorBroken'));
 assert(featuresAt(85,38,2).some(o=>o.type==='towerBattlement'));
 assert(featuresAt(78,46).some(o=>o.type==='ancientAltar'));
 assert(!walk(69,39,70,39),'deep creek stays out of the walking network');
});
test('outing leaves wash accessible on natural grade, with bounded static scenery and no added gameplay',()=>{
 assert.deepEqual(site.map.terrainHeights,[]);
 assert.deepEqual(site.creek.shallows,[]);assert.deepEqual(site.creek.terrace,[]);
 const walk=testWalker(site);
 for(const route of [expand([[70,38],[70,40],[69,40]]),expand([[70,38],[70,40],[71,40]])])
  for(let i=1;i<route.length;i++)assert(walk(...route[i],...route[i-1]));
 assert.deepEqual(site.spawn,{x:19,z:21});assert.equal(site.buildings.length,10);
 // v137 returns the old northeast guild parcel to the open landscape;
 // no exception for guild assets inside the outing area is needed now.
 const east=site.map.world.filter(o=>o.x>=72);
 assert(east.length<=325,east.length);
 assert(east.every(o=>!/(?:mob|monster|villager|loot|reward|treasure|quest)/i.test(o.type)));
 assert(east.filter(o=>/^tree/.test(o.type)).length<=21);
 assert(site.creek.deep.some(o=>o.x===95&&o.z>=51),'water continues to the southeast map edge, not an inland dead end');
});
test('every v136 eastern trail and creek record survives the town redesign exactly',()=>{
 const preserved=require('./canal-history-fixture.cjs').prior(require('./outside-history-fixture.cjs').prior(site.map.world)).filter(row=>{
  const [x,z]=JSON.parse(row);return x>=67&&z>=26;
 }).sort();
 assert.equal(preserved.length,398);
 const {createHash}=require('node:crypto');
 assert.equal(createHash('sha256').update(preserved.join('\n')).digest('hex'),
  '93d599c975027d62976924b027b3bb60e2bbebca91a7331fa4c527e03a145de5');
});
