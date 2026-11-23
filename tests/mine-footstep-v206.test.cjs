const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function fn(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)}
test('mine stone footstep has a rounded impact, quiet tail and two stable variations',()=>{
 const s=vm.createContext({});
 vm.runInContext(fn('function poiSurfaceFoleyPcm','const poiSurfaceFoleyCache='),s);
 const rate=24000,a=s.poiSurfaceFoleyPcm('mine-step',rate,0), b=s.poiSurfaceFoleyPcm('mine-step',rate,1);
 const rms=(p,q)=>Math.sqrt(a.slice(p*rate,q*rate).reduce((v,x)=>v+x*x,0)/Math.round((q-p)*rate));
 assert.equal(a.length,Math.round(rate*.148));
 assert.ok(a.every(Number.isFinite)&&Math.max(...a.map(Math.abs))<.6);
 assert.ok(rms(0,.035)>.04);
 assert.ok(rms(.075,.125)>.001&&rms(.075,.125)<rms(0,.035)*.23);
 assert.ok(Math.abs(a.at(-1))<.002);
 assert.notDeepEqual(a,b);
});
test('only the actual mine gets stone footstep, rendered through cached and volume-gated effects',()=>{
 assert.match(h,/poiDungeonThemeAt\(facilitySite,poiWalkX,poiWalkZ,poiWalkLevel\)==='mine'\?'mine-step'/);
 assert.match(h,/weapon==='mine-step'\|\|weapon==='indoor'[\s\S]{0,170}poiPlayImpactBuffer\(poiSurfaceFoley\(weapon\),now/);
 assert.match(h,/if\(wet\)poiSound\('chapel-water-step'\)/);
});
