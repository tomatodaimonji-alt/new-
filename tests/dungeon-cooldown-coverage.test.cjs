const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync('world-editor.html','utf8');
function pick(l,r){const i=h.indexOf(l),j=h.indexOf(r,i+1);a(i>=0&&j>i);return h.slice(i,j)}
test('all actual dungeon monsters, including the later armed guards, have distinct seven-day cooldown entries',()=>{
 const site=vm.runInNewContext(pick('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
 const c=vm.createContext({facilitySite:{id:'base'},poiTownClockRead(){},poiTownClockSnapshot:()=>({absoluteMinute:8000})});
 vm.runInContext(pick('// BEGIN DUNGEON POPULATION','// END DUNGEON POPULATION'),c);
 const found=new Set();
 for(const o of site.map.world.filter(o=>o.y===-1&&o.type.startsWith('monster'))){
  const realm=['mine','chapel','otherworld'].find(k=>{const b=site[k].bounds;return o.x>=b.x1&&o.x<=b.x2&&o.z>=b.z1&&o.z<=b.z2});
  a(realm,'authored hostile B1 encounter is registered in a dungeon');
  const id=c.poiDungeonSpawnId(o);a(id?.startsWith(realm+'.'),o.type+' '+o.x+','+o.z);a(!found.has(id));found.add(id);
  const p=c.poiDungeonPopulationDecode({version:1,dead:{[id]:1000}},8000);
  a(c.poiDungeonActorAbsent(o,p));a(!c.poiDungeonActorAbsent({...o,y:0},p));
 }
 a(found.size>=13);
});
