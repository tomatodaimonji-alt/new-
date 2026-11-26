const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const fn=n=>{const m=html.match(new RegExp('^function '+n+'\\([^]*?^}','m'));a.ok(m,n);return m[0]};
const c=vm.createContext({frontierTreeHabitat:()=>.3,frontierRiver:()=>5,frontierTerrainAccentPatch:()=>false,frontierDirtCoverage:()=>.42,
 frontierGroundContact:()=>0,frontierBurrowCell:()=>false,frontierHomeCell:()=>false,frontierTempleGround:()=>false,frontierNorthWet:()=>false,
 frontierSlopeShade:()=>0,frontierHeight:()=>0,frontierSouthOwn:(x,z)=>x>=128&&x<=192&&z>=64});
vm.runInContext(['surfaceNoise','frontierSmooth','frontierTrackVerge','frontierMeadowNoise','frontierMeadowPaint','frontierProtectedGround','frontierEarthTintLegacy','frontierEarthTint'].map(fn).join('\n'),c);
const meadow=c.frontierMeadowPaint;
const dry=meadow(120,35,0,0,0,0),wood=meadow(120,35,1,0,0,0),turf=meadow(120,35,0,0,0,1);
const soil=meadow(120,35,0,1,0,0),lip=meadow(120,35,0,.5,0,0);
a.ok(dry[1]>dry[0]&&dry[0]>dry[2]&&dry[1]>.44);
a.ok(dry[1]>wood[1]&&turf[1]<dry[1]);
a.ok(soil[0]>soil[1]&&soil[1]>soil[2]);
a.ok(lip[1]>soil[1]&&lip[1]<dry[1]+.035);
for(const x of [0,7.99,8,8.01,71,144,254,-1])for(const z of [-58,-.001,0,.001,8,41,63]){
 const u=meadow(x,z,.27,.35,.04,.4),v=meadow(x+.001,z,.27,.35,.04,.4);
 a.ok(u.every((t,i)=>Number.isFinite(t)&&t>=0&&t<=1&&Math.abs(t-v[i])<.002));
}
for(const x of [128,160,192])a.deepEqual(c.frontierEarthTint(x,64,null),c.frontierEarthTintLegacy(x,64,null));
c.frontierRiver=()=>.1;
a.deepEqual(c.frontierEarthTint(99,28,null),c.frontierEarthTintLegacy(99,28,null),'shoreline palette retained');
a.match(html,/const meadow=frontierMeadowPaint\(x,z,.12,0,0,0\)/);
a.match(html,/frontierMeadowArt\(grade,ranges\)/);
console.log('PASS layered greens, continuous soil blend, southern seam and shoreline preservation');
