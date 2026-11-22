const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('world-editor.html','utf8');
const mark={x:100,z:6,y:0,type:'ruinStonePost'};
function setup(){
 const c={facilitySite:{id:'base',northTrail:{watchPost:{waymark:mark}}},world:[mark],
  poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,poiWalkFacing:2,poiWalkX:100,poiWalkZ:5,
  document:{querySelector:()=>c.modal},toast:s=>c.notices.push(s),notices:[]};
 vm.createContext(c);
 const from=html.indexOf('function poiNorthTrailForkSignReachable(');
 assert.notEqual(from,-1,'north-trail fork sign interaction is missing');
 const until=html.indexOf('function poiWalkAction()',from);
 vm.runInContext(html.slice(from,until),c);
 return c;
}
test('readable fork stone responds from either adjacent facing, without combat input or state writes',()=>{
 const c=setup();
 assert.equal(c.poiNorthTrailReadForkSign(),true);
 assert.deepEqual(c.notices,['東へ：水辺の道。南へ：森の見張り場。']);
 c.poiWalkX=101;c.poiWalkZ=6;c.poiWalkFacing=3;
 assert.equal(c.poiNorthTrailReadForkSign(),true);
 assert.equal(c.notices.length,2);
});
test('sign is unavailable when facing away, behind a dialog, removed from the world, or on another floor/site',()=>{
 const c=setup();
 c.poiWalkFacing=1;assert.equal(c.poiNorthTrailReadForkSign(),false);c.poiWalkFacing=2;
 c.poiWalkLevel=-1;assert.equal(c.poiNorthTrailReadForkSign(),false);c.poiWalkLevel=0;
 c.facilitySite.id='inn';assert.equal(c.poiNorthTrailReadForkSign(),false);c.facilitySite.id='base';
 c.modal=true;assert.equal(c.poiNorthTrailReadForkSign(),false);c.modal=false;
 c.world=[];assert.equal(c.poiNorthTrailReadForkSign(),false);
 assert.deepEqual(c.notices,[]);
});
