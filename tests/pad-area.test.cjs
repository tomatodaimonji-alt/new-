const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function load(){
 const start=h.indexOf('// BEGIN EXPANDED ANALOG START AREA'),end=h.indexOf('// END EXPANDED ANALOG START AREA');
 assert(start>=0&&end>start,'left-canvas gesture routing exists');
 return Function(h.slice(start,end)+';return poiAnalogCanvasStartAt;')();
}
const stage={left:10,top:0,width:1120,right:1130,bottom:500};
test('left touch expands to the marked 39% above shortcuts; right and cutout remain excluded',()=>{
 const fn=load();
 assert(fn(423,408,stage,54,[]));
 assert(!fn(452,408,stage,54,[]));
 assert(!fn(53,408,stage,54,[]));
 assert(!fn(423,500,stage,54,[]));
});
test('transformed display rect still excludes left joystick starts',()=>{
 const fn=load(),animatedArea={left:200,right:405,top:100,bottom:146};
 assert(!fn(400,118,stage,54,[animatedArea]));
 assert(fn(400,147,stage,54,[animatedArea]));
});
