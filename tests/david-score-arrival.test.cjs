const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function harness(){
 const b={x:24,z:104,y:0},temple={boss:b,threshold:{minX:22,maxX:26,z:94,y:0}},c={facilitySite:{id:'base',davidTemple:temple},poiWalkActive:true,
  poiDavidIn:(_b,p)=>p.x>=15&&p.x<=33&&p.z>=94&&p.z<=120,poiDavidBattleActive:()=>c.battle,performance:{now:()=>999},battle:false};
 const i=h.indexOf('let poiDavidScoreVisit=null;'),j=h.indexOf('function poiDavidScoreClip(',i);a(i>=0&&j>i);
 const run=vm.runInNewContext(h.slice(i,j)+';poiDavidScoreScene',c),at=(t,x,z,y=0)=>{Object.assign(c,{poiWalkX:x,poiWalkZ:z,poiWalkLevel:y});return run(t)};
 return {c,temple,at};
}
test('the southward approach starts calm music at the forecourt, not old outer gate; not adjacent hills or other floors',()=>{
 const {at,c}=harness();
 a.equal(at(10,24,87),null);
 a.equal(at(11,21,88),null);
 a.equal(at(12,27,88),null);
 a.equal(at(13,24,88,-1),null);
 a.equal(at(14,24,88),'davidStill');
 a.equal(at(15,24,93),'davidStill');
 a.equal(at(16,24,94),'davidStill');
 c.battle=true;a.equal(at(17,24,99),'davidAwake');
 a.equal(at(18,24,92),'davidStill','awake guard cannot classify exterior approach as combat');
 a.equal(at(18.4,24,87),'davidStill');a.equal(at(18.5,24,87),null);
});
test('future explicitly authored approach can extend before a taller or longer entry without changing arena gates',()=>{
 const {at,temple}=harness();
 temple.musicArrival={minX:23,maxX:25,minZ:81,maxZ:95,y:0};
 a.equal(at(10,24,80),null);a.equal(at(11,22,83),null);
 a.equal(at(12,24,81),'davidStill');a.equal(at(13,24,95),'davidStill');
 a.equal(at(14,24,124),null);
});
