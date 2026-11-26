const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),h=fs.readFileSync(process.argv[2],'utf8');
const m=h.match(/\/\/ BEGIN FRONTIER WALK LAYERS\n([\s\S]*?)\/\/ END FRONTIER WALK LAYERS/);
a(m,'ground must not use the underground footprint for collision');
const C={facilitySite:{id:'frontier'},FRONTIER_BURROW:{east:32,roof:25,north:27,south:32},
 frontierPlayCave:false,frontierCollisionCave:null,frontierBurrowCell:(x,z)=>(x>=10&&x<32&&z>=27&&z<32)||(x>=18&&x<26&&z>=36&&z<=41)};
vm.runInNewContext(m[1]+'\nthis.a={frontierBurrowWalkEdge,frontierLayerAfter,frontierOpenTrench};',C);
const x=C.a;
a(x.frontierBurrowWalkEdge(18,38,17,38,false));a(x.frontierBurrowWalkEdge(17,38,18,38,false));
a(!x.frontierBurrowWalkEdge(17,38,18,38,true));a(x.frontierBurrowWalkEdge(19,38,18,38,true));
a(!x.frontierBurrowWalkEdge(27,27,27,26,false));
a(x.frontierBurrowWalkEdge(31,29,32,29,false));a(x.frontierLayerAfter(false,31,29,32,29));
a(x.frontierBurrowWalkEdge(32,29,31,29,true));a(!x.frontierLayerAfter(true,32,29,31,29));
a(!x.frontierLayerAfter(false,18,38,17,38));
for(const q of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(q[1]);
console.log('PASS surface walks freely over buried walls, only mouth switches layers, cave walls stay solid');
