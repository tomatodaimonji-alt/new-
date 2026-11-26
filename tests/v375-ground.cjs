const a=require('node:assert/strict'),fs=require('node:fs'),h=fs.readFileSync(process.argv[2],'utf8');
const fn=(start,end)=>{const i=h.indexOf(start);a(i>=0,start);return h.slice(i,h.indexOf(end,i))};
const base=fn("const FRONTIER_BRIDGE=","function frontierHeight");
const blend=fn("function frontierDirtCoverage(","function frontierGroundKind(");
const colors=new Function("const FRONTIER_W=192,FRONTIER_H=64,FRONTIER_VILLAGE={x:44.5,z:30.5,r:12,opening:1.72}; const surfaceNoise=(x,z)=>.5+.49*Math.sin(x*73.135+z*17.391);"+base+fn("function frontierVillageTrack","const FRONTIER_TEMPLE")+blend+"return {frontierEarthTint,frontierDirtCoverage,frontierVillageTrack,frontierGroundContact:typeof frontierGroundContact==='function'?frontierGroundContact:null,frontierTrackVerge:typeof frontierTrackVerge==='function'?frontierTrackVerge:null,frontierGroundCuts:typeof frontierGroundCuts==='function'?frontierGroundCuts:null};")();
const {frontierEarthTint:t,frontierDirtCoverage:d,frontierVillageTrack:track,frontierGroundContact:shade,frontierTrackVerge:verge,frontierGroundCuts:cuts}=colors;
const trees=new Set([48*512+11]);
a.equal(typeof shade,'function','ground should provide local tree and fence shading');
a(shade(48.5,11.5,trees)>.22&&shade(50.5,11.5,trees)===0,'tree contact must stay local');
a(shade(44.5,18.5,trees)>.20&&shade(32.5,30.5,trees)<.02,'fence feet darken but gate stays open');
for(const x of [28,52,75,96,118]){
 const z=track(x);
 a(d(x,z)>.95);a(verge(x,z)<.03);a([1.3,1.5,1.7,1.9].some(delta=>verge(x,z+delta)>.15));a(d(x,z+3)<.15);
 const road=t(x,z),grass=t(x,z+3);a(road[0]>road[1]&&grass[1]>grass[0],'earth and grass recognizable');
}
const tiles=[[42,30],[42,29],[20,10],[86,28]];a(cuts(...tiles[0]));a(!cuts(...tiles[2]));
console.log('PASS earth color, localized shaded roots, open gates, patchy verge, bounded subdivision');
