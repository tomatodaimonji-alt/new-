const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const stock=process.env.STOCK||'/workspace/shared/workshop-v315-square-field/release/world-editor.html';
function actual(file){
 const h=fs.readFileSync(file,'utf8'),i=h.indexOf('const FACILITY_SITES=Object.freeze('),j=h.indexOf('function workshopResumeDecode(',i);
 return JSON.parse(JSON.stringify(vm.runInNewContext(h.slice(i,j)+';buildFacilitySite("base")')));
}
const base=actual(stock),next=actual(process.env.HTML||'world-editor.html'),key=o=>o.x+','+o.z+','+o.y;
test('concealment consists only of real sparse finite trees, with old map and temple untouched',()=>{
 const forest=next.sacredForest;const q=forest.concealment?.trees;
 a(Array.isArray(q)&&q.length>=22&&q.length<=30);
 a.deepEqual([next.map.width,next.map.height],[base.map.width,base.map.height]);
 a.deepEqual(next.map.terrainHeights,base.map.terrainHeights);
 for(const p of ['entrance','interior','ring','boss','bounds','reserve'])a.deepEqual(next.davidTemple[p],base.davidTemple[p]);
 const keys=new Set(base.map.world.map(key));
 for(const o of q){a(!keys.has(key(o)),key(o));a(o.y===0&&o.x>=0&&o.x<48&&o.z>=120&&o.z<182);keys.add(key(o));}
 const actualKeys=new Set(q.map(key)),projected=next.map.world.filter(o=>!actualKeys.has(key(o)));
 a.deepEqual(projected,base.map.world,'cannot move grade, objects, sea, or existing records to cheat visibility');
 for(const [x,z] of q.map(o=>[o.x,o.z])){
  a(x!==43&&x!==47&&z!==150&&z!==166,'old dry north/south and east/west lines remain unblocked');
  a(!(x>=20&&x<=28&&z<144),'porch and actual travel route quietly preserved');
 }
});
