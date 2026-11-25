const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8'),extract=(s,e)=>{const i=h.indexOf(s),j=h.indexOf(e,i+1);a(i>=0&&j>i,s);return h.slice(i,j)};
const sample=new Map([['2,3','roadRoyalFull']]);
const c=vm.createContext({poiWalkLevel:0,facilitySite:{id:'frontier',templeTiles:sample},poiWalkViewX:51,poiWalkViewZ:30,
 frontierHeight:(x,z)=>x>=58&&x<=70?-.4:x/20+z/30,frontierGroundKind:(x,z)=>x===51?'stone':x===52?'woodfloorLight':x===53?'roadCobbleFull':'grass',
 WOOD_BRIDGE_DECK_TOP:.065,frontierRiver:()=>-1,frontierSmooth:(lo,hi,v)=>{let u=Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return u*u*(3-2*u)},ROAD_IDS:new Set(['roadCobbleFull','roadRoyalFull'])});
const moduleStart=h.includes('// BEGIN FRONTIER WALK SUPPORT')?extract('// BEGIN FRONTIER WALK SUPPORT','// END FRONTIER WALK SUPPORT'):'';
vm.runInContext(extract('function poiCreekPlayerHeight(now)','function poiCreekWalkHeight(')+extract('function frontierSampleHeight(x,z)','function frontierGroundKind(x,z)')+moduleStart,c);
const evaluate=s=>vm.runInContext(s,c);
const close=(x,y,desc)=>a(Math.abs(x-y)<1e-8,`${desc}: got ${x}, expected ${y}`);
for(const x of [51,52,53]){
 c.poiWalkViewX=x;
 close(evaluate('poiCreekPlayerHeight(0)'),evaluate('frontierSampleHeight(poiWalkViewX+.5,poiWalkViewZ+.5)')+.135,'avatar is based on visible stone, wood and road tops');
}
c.poiWalkViewX=54;
close(evaluate('poiCreekPlayerHeight(0)'),evaluate('frontierSampleHeight(54.5,30.5)')+.005,'grass does not float');
c.poiWalkViewX=64;close(evaluate('poiCreekPlayerHeight(0)'),.065,'wood plank rendered deck height');
close(evaluate('frontierSurfaceHeight(2.5,3.5)'),evaluate('frontierSampleHeight(2.5,3.5)')+.135,'temple override uses visible tile');
const diff=evaluate('Math.abs(frontierWalkSurface(54-.00001,30.5)-frontierWalkSurface(54+.00001,30.5))');
a(diff<.0001,'torso does not snap at transition from stone pavement to grass');
const boot=[53.94,0,30.5, 54.05,0,30.5, 54.08,.028,30.5, 54.03,.24,30.5,54.03,.50,30.5];
c.m={p:boot.slice()};evaluate('frontierFitSoles(m,[[0,12,15]],0,1)');
for(let i=0;i<9;i+=3)a(c.m.p[i+1]>=evaluate(`frontierSurfaceHeight(${boot[i]},${boot[i+2]})`),'foot spanning raised tile is not buried');
a(c.m.p[10]>boot[10]);a.equal(c.m.p[13],boot[13],'leg correction tapers out at hips');
console.log('Terrain, cobble, wood, temple and bridge supports; smooth seam and planted feet.');
