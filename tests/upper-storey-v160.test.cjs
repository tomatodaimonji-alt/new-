const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
function setup(){
 const m=html.match(/\/\/ BEGIN ANGLED STOREY SURFACES\n([\s\S]*?)\/\/ END ANGLED STOREY SURFACES/);assert.ok(m,'storey occlusion helpers');
 const scope=vm.createContext({});
 vm.runInContext(m[1],scope);return scope;
}
const rec=(owner,x,z,y,kind,start,min=[x,y*1.4,z],max=[x+1,y*1.4+.16,z+1])=>({
 owner,x,z,y,kind,type:kind,start,end:start+6,min,max
});
test('only a blocking upper deck or partition can ghost, with nearby attached items across the same upper cell',()=>{
 const {poiAngledStoreySelect:pick}=setup();
 const records=[
  rec('lodging',41,23,1,'slab',0),
  rec('lodging',41,23,1,'prop',12),
  rec('lodging',41,23,1,'wall',18,[41,1.5,23],[42,2.78,23.98]),
  rec('lodging',42,23,1,'slab',25),
  rec('lodging',41,28,1,'slab',42),
  rec('lodging',41,23,0,'wall',48),
  rec('lodging',41,21,1,'slab',54),
  rec('other',46,23,1,'wall',60)
 ];
 const out=pick(records,[[41.5,.62,22.5],[41.5,.95,22.5]],[0,Math.tan(.86),1],0);
 assert.deepEqual(Array.from(out,a=>a.start),[0,12,18,25]);
 assert.equal(pick(records,[[41.5,.62,22.5]],[0,Math.tan(.86),-1],1).length,0,'never fade current storey');
 assert.equal(pick(records,[[44.5,1.05,22.5]],[0,Math.tan(.86),1],0).length,0,'unobstructed ray stays solid');
});
