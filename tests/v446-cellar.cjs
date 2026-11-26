const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
for(const m of h.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const code=h.match(/^function frontierSouthWarmCellar\([^]*?^}/m)?.[0];a.ok(code);
let builds=0;
const c={facilitySite:{id:'frontier'},poiWalkActive:true,poiWalkLevel:0,poiWalkViewX:106,poiWalkViewZ:30,
 facilityScenes:new Map(),window:{pineStartup:{loading:true}},makeScene:()=>({id:++builds})};
vm.createContext(c);vm.runInContext('let frontierSouthBakeFloor=null;\n'+code,c);
c.frontierSouthWarmCellar();a.equal(builds,1,'warm the dungeon behind the existing startup cover rather than on approach');
a.ok(c.facilityScenes.has('cellar:-1'));
c.window.pineStartup.loading=false;c.poiWalkViewX=160;c.poiWalkViewZ=76;c.frontierSouthWarmCellar();a.equal(builds,1);
c.facilityScenes.clear();c.poiWalkViewX=106;c.poiWalkViewZ=30;c.frontierSouthWarmCellar();a.equal(builds,1,'do not rebuild far away during live play');
c.poiWalkViewX=160;c.poiWalkViewZ=76;c.frontierSouthWarmCellar();a.equal(builds,2,'keep on-demand fallback after scene invalidation');
console.log('Cellar warmed behind startup cover; approach uses cached mesh; invalidation fallback works');
