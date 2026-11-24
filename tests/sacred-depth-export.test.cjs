const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=s.indexOf(x),j=s.indexOf(y,i+x.length);a(i>=0&&j>i,x);return s.slice(i,j)};
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const deep=build('base'),legacy=build('artisan').map;
const c=vm.createContext({MIN_MAP:12,MAX_MAP:128,MAX_LEVEL:9,POI_SACRED_DEPTH_H:182,POI_SACRED_DEPTH_W:48,TERRAIN_MAX:12,PINE_CHECK_COLORS:[]});
vm.runInContext(cut('const palette=[','const catalog=new Map(')+cut('function validModel(','function loadData(')+cut('function facilityExportMap(','function facilityDownload('),c);
test('actual stock deep JSON exports and parses losslessly with a permissible deep edit',()=>{
 const source=JSON.parse(JSON.stringify(deep.map));source.world.push({x:2,z:181,y:0,type:'benchWood',rot:1});
 const e=c.facilityExportMap(source),f=JSON.parse(JSON.stringify(e)),v=c.pineValidateWorldData(f);
 a.deepEqual([v.newW,v.newH,e.workshopFacility.stockDepth],[128,182,1]);
 a.equal(f.world.length,source.world.length);
 a.deepEqual(f.world.map(o=>({...o,y:o.y-e.workshopFacility.floorOffset})),source.world);
 a.equal(f.world.at(-1).type,'benchWood');
 const l=c.facilityExportMap(legacy);
 a.equal(l.workshopFacility.stockDepth,undefined);
 a.equal(c.pineValidateWorldData(l).newH,legacy.height);
});
test('plain custom maps retain old limits, and the documented format never admits impossible deep positions',()=>{
 const e=c.facilityExportMap(deep.map),validate=o=>c.pineValidateWorldData(o);
 for(const bad of [
  {...e,workshopFacility:undefined}, {...e,width:127}, {...e,height:181}, {...e,height:183},
  {...e,workshopFacility:{...e.workshopFacility,stockDepth:2}},
  {...e,workshopFacility:{...e.workshopFacility,version:2}},
  {...e,workshopFacility:{...e.workshopFacility,groundY:2}},
  ...[[48,128],[-1,128],[22,-1],[22,182]].map(([x,z])=>({...e,world:e.world.concat({x,z,y:0,type:'benchWood',rot:0})})),
  {...e,terrainHeights:[{x:51,z:157,h:1}]}
 ])a.throws(()=>validate(bad));
});
