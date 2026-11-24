const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto');
const stock=fs.readFileSync(process.env.STOCK||'stock.html','utf8'),candidate=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(s,x,y)=>{const i=s.indexOf(x),j=s.indexOf(y,i+x.length);a(i>=0&&j>i,x);return s.slice(i,j)};
const site=vm.runInNewContext(cut(stock,'const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");site.id='base';
const signature=w=>{
 const hash=createHash('sha256');
 for(const [level,row] of w.levels)hash.update(String(level)).update(row.cats).update(row.walls);
 return hash.digest('hex');
};
function rig(h,warm=false){
 const qi=[],c={poiLocalTopology:null,poiMiniBuilds:0,poiSacredMiniFilters:new WeakMap,poiSacredLocalSeen:new WeakMap,BRIDGE_IDS:new Set,ROAD_IDS:new Set,
  world:site.map.world,poiLocalBit:(x,z)=>z*128+x,POI_LOCAL_W:128,POI_LOCAL_H:182,
  isWallId:t=>/wall/i.test(t),isFloor:t=>/^(earth|road|grass|floor|poiSnow)/.test(t),poiWalkPassableDoor:t=>/Door/.test(t),
  poiHotbarRead:()=>({sacredTempleSeen:c.seen}),facilitySite:{id:'snowpass'},poiWalkX:12,poiWalkZ:4,poiWalkActive:true,
  requestIdleCallback:f=>qi.push(f),performance:{now:()=>0},document:{hidden:false}};
 c.poiSnowPassBase={site,world:c.world};
 vm.runInNewContext(cut(h,'function poiNorthTrailSupplyGround(','function poiNorthTrailLowlandWater(')+
  cut(h,'function poiSacredMiniRecordKey(','function poiSacredMiniEntrance(')+cut(h,'function poiLocalCategory(','function poiLocalBlocked(')+
  (warm?cut(h,'let poiSnowMapIdle=null;','function poiSnowPassDrawMeasured('):''),c);
 return {c,qi};
}
test('exact immutable active-world and side-cache topologies, both discovery states',()=>{
 const a0=rig(stock),b=rig(candidate,true);
 for(const concealed of [true,false]){
  const old=a0.c.poiLocalTopologyFor(site,concealed),direct=b.c.poiLocalTopologyFor(site,concealed);
  const gen=b.c.poiLocalTopologyRows(site,concealed,site.map.world);let v,yields=0;while(!(v=gen.next()).done)yields++;
  a.equal(signature(old),signature(direct));a.equal(signature(old),signature(v.value));
  a(yields>100);a.equal(v.value.world,site.map.world);a.equal(v.value.site,site);
 }
});
test('snow-only idle work is bounded, never mutates active survey map, and cancels when leaving',()=>{
 const {c,qi}=rig(candidate,true);c.poiSnowMapWarmTick();a.equal(qi.length,1);
 qi.shift()({timeRemaining:()=>4});
 a.equal(c.poiSnowPassBase.localTopology,undefined);a.equal(qi.length,1);
 c.poiWalkZ=11;qi.shift()({timeRemaining:()=>4});
 a.equal(qi.length,0);a.equal(c.poiSnowPassBase.localTopology,undefined);
 c.poiWalkZ=7;c.poiSnowMapWarmTick();let turns=0;
 while(qi.length){qi.shift()({timeRemaining:()=>4});a(++turns<40)}
 a(turns>=15);a.equal(c.poiLocalTopology,null);a.equal(c.poiSnowPassBase.localTopology.concealed,true);
});
