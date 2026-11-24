const assert=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('matching ambient/awake decks follow canonical arena and never substitute outside',()=>{
 const a=h.indexOf('// BEGIN DAVID COURTYARD SCORE'),b=h.indexOf('// END DAVID COURTYARD SCORE');assert(a>0&&b>a);
 const room={x:24,z:104,y:0},ctx={boss:room,facilitySite:{id:'base',davidTemple:{boss:room}},poiWalkLevel:0,poiWalkActive:true,poiWalkX:24,poiWalkZ:91,
  poiDavidIn:(_b,p)=>p.z>=94&&p.z<=118,poiDavidBattleActive:t=>{assert.equal(t,777);return ctx.battle},performance:{now:()=>777},battle:false};
 const m=vm.runInNewContext(h.slice(a,b)+';({scene:poiDavidScoreScene,reset:poiDavidScoreReset,ogg:POI_DAVID_SCORE_OGG})',ctx);
 const scene=t=>m.scene(t);
 assert.equal(scene(10),null);ctx.poiWalkZ=94;assert.equal(scene(11),'davidStill');
 ctx.battle=true;assert.equal(scene(11.2),'davidAwake');ctx.poiWalkZ=93;assert.equal(scene(11.3),'davidAwake');
 ctx.poiWalkZ=94;assert.equal(scene(11.6),'davidAwake');ctx.poiWalkZ=93;assert.equal(scene(11.7),'davidAwake');
 assert.equal(scene(12.3),null);ctx.poiWalkLevel=-1;ctx.poiWalkZ=99;assert.equal(scene(13),null);
 ctx.poiWalkLevel=0;assert.equal(scene(14),'davidAwake');ctx.facilitySite={id:'snowpass'};assert.equal(scene(14.05),null);
 for(const bytes of Object.values(m.ogg))assert.equal(Buffer.from(bytes,'base64').subarray(0,4).toString(),'OggS');
 assert.notEqual(m.ogg.davidStill,m.ogg.davidAwake);
 assert.match(h,/if\(scene==='outside'\)\{/);
});
