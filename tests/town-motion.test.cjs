const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function setup(){
 const a=h.indexOf('function poiTownNpcMotion('),b=h.indexOf('const poiTownNpcModelCache=',a);
 assert(a>=0&&b>a,'missing pure resident motion sampler');
 const x={poiTownNpcVersion:0,poiWalkX:0,poiWalkZ:0,poiWalkLevel:0};vm.createContext(x);
 vm.runInContext(h.slice(a,b),x);return x;
}
test('idle, work, walk, sleep and rest have distinct near-field pose sampling and distant actors are static',()=>{
 const x=setup(),a={role:{id:'toolkeeper'},index:2,x:1,z:0,y:0};
 for(const [activity,kind] of [['idle','idle'],['work','write'],['sleep-home','sleep'],['rest-inn','rest']]){
  a.activity=activity;
  const p=x.poiTownNpcMotion(a,200,true),q=x.poiTownNpcMotion(a,433,true);
  assert.equal(p.kind,kind);assert.notEqual(p.amount,q.amount);assert.equal(x.poiTownNpcMotion(a,433,false).amount,0);
 }
 for(const [id,kind] of [['stablekeeper','tend'],['workshopkeeper','craft'],['diningkeeper','serve']]){
  a.role.id=id;a.activity='work';assert.equal(x.poiTownNpcMotion(a,200,true).kind,kind);
 }
 a.activity='errand';a.moveAt=100;a.fromY=0;assert.equal(x.poiTownNpcMotion(a,200,true).kind,'walk');
});
test('transactions are temporary and do not mask existing sword contact or hurt',()=>{
 const x=setup(),a={role:{id:'innkeeper'},x:0,z:0,y:0,activity:'work'};
 x.poiTownNpcGesture(a,'check-in-host',0);
 assert.equal(x.poiTownNpcMotion(a,300,true).kind,'check-in-host');
 assert.equal(x.poiTownNpcMotion(a,1450,true).kind,'write');
 a.swingAt=300;assert.equal(x.poiTownNpcMotion(a,420,true).kind,'swing');
 a.swingAt=-1000;a.hurtAt=450;assert.equal(x.poiTownNpcMotion(a,480,true).kind,'hurt');
});
