const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync('world-editor.html','utf8'),l=h.indexOf('const POI_WEAPON_SE='),r=h.indexOf('function poiDefeatSound(',l);
test('frying pan, ladle and pen give distinct quiet combat contact sounds',()=>{
 const events=[],out=t=>(...x)=>events.push([t,...x]); const c=vm.createContext({poiAudioNoiseBurst:out('noise'),poiAudioThud:out('thud'),poiAudioTone:out('tone'),poiAudioEffects:'effects'});
 vm.runInContext(h.slice(l,r)+';this.table=POI_WEAPON_SE',c);
 const samples=['equipFryingPan','equipLadle','equipBallpointPen'].map(k=>{
  a(c.table[k],k);events.length=0;c.poiWeaponSound('hit',c.table[k],3);return JSON.parse(JSON.stringify(events));
 });
 a.equal(samples[0].find(e=>e[0]==='tone')?.[1],382);
 a(samples[1].some(e=>e[0]==='tone'&&e[1]===708));
 a(samples[2].every(e=>e[0]!=='tone'));
 a.notDeepEqual(samples[0],samples[1]);a.notDeepEqual(samples[1],samples[2]);
});
