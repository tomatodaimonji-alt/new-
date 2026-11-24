const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const stock=process.env.STOCK||'/workspace/shared/workshop-v315-square-field/release/world-editor.html';
function actual(file){
 const h=fs.readFileSync(file,'utf8'),i=h.indexOf('const FACILITY_SITES=Object.freeze('),j=h.indexOf('function workshopResumeDecode(',i);
 const a0=h.indexOf('function poiSacredForestKey('),b0=h.indexOf('function poiSacredForestMember(',a0);
 return JSON.parse(JSON.stringify(vm.runInNewContext(h.slice(i,j)+h.slice(a0,b0)+
  ';const s=buildFacilitySite("base");s.id="base";poiSnowPassSeam(s,s.map.world);s')));
}
const base=actual(stock),next=actual(process.env.HTML||'world-editor.html'),key=o=>o.x+','+o.z+','+o.y;
test('concealment consists only of real sparse finite trees, with old map and temple untouched',()=>{
 const forest=next.sacredForest;const q=forest.concealment?.trees;
 a(Array.isArray(q)&&q.length>=30&&q.length<=40);
 a.deepEqual([next.map.width,next.map.height],[base.map.width,base.map.height]);
 a.deepEqual(next.map.terrainHeights,base.map.terrainHeights);
 for(const p of ['entrance','interior','ring','boss','bounds','reserve'])a.deepEqual(next.davidTemple[p],base.davidTemple[p]);
 const tag=o=>key(o)+','+o.type,keys=new Set(base.map.world.map(tag));
 for(const o of q){a(!keys.has(tag(o)),tag(o));a(o.y===0&&o.x>=0&&o.x<=59&&o.z>=116&&o.z<182);keys.add(tag(o));}
 a.deepEqual(forest.trees,base.sacredForest.trees,'preserve original core tree authoring');
 const actualKeys=new Set(q.map(tag)),projected=next.map.world.filter(o=>!actualKeys.has(tag(o)));
 a.deepEqual(projected,base.map.world,'cannot move grade, objects, sea, or existing records to cheat visibility');
 for(const [x,z] of q.map(o=>[o.x,o.z])){
  a(x!==43&&x!==47&&z!==150&&z!==166,'old dry north/south and east/west lines remain unblocked');
  a(!(x>=20&&x<=28&&z>=122&&z<144),'porch and actual travel route quietly preserved');
  a(!(x>=23&&x<=25&&z<144),'true central player route remains three tiles wide');
  if(x>=48)a(z>=128&&z<139,'new northeast trees only on previously dry Base-owned sleeve');
 
 }
});
