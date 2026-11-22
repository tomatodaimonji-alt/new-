const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('world-editor.html','utf8');
const mark={name:'旅人の井戸',x:119,z:44,y:0,type:'wayfarerWell',bounds:{x1:118,x2:121,z1:43,z2:46,y:0}};
function setup(){
 const c={facilitySite:{id:'base',northTrail:{wayfarer:{well:mark}}},world:[mark],
  poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,poiWalkFacing:3,poiWalkX:120,poiWalkZ:44,
  document:{querySelector:()=>c.modal},toast:s=>c.notices.push(s),notices:[],
  validPos:()=>true,poiWildZone:()=>false,POI_WILD_GATES:[],POI_SAFE_TOWN:[],POI_WILD_LANDMARKS:[],facilityFloorOwner:()=>null,
  poiDungeonPointIn:(b,x,z,y)=>b?.y===y&&b.x1<=x&&x<=b.x2&&b.z1<=z&&z<=b.z2};
 vm.createContext(c);
 const from=html.indexOf('function poiWayfarerWell('),until=html.indexOf('function poiWalkAction()',from);
 assert(from>=0&&until>from,'well reach and interaction missing');
 const wildA=html.indexOf('function poiWildExterior('),wildB=html.indexOf('function poiWildActive(',wildA);
 vm.runInContext(html.slice(from,until)+html.slice(wildA,wildB),c);
 return c;
}
test('the adjacent player facing the authored well can read its scenery hint without other gameplay operations',()=>{
 const c=setup();
 assert.equal(c.poiWayfarerWellReachable(),true);
 assert.equal(c.poiWayfarerWellRead(),true);
 assert.deepEqual(c.notices,['冷たい水の音がする。旅人が腰を下ろせるベンチがある。']);
 c.poiWalkFacing=1;assert.equal(c.poiWayfarerWellRead(),false);c.poiWalkFacing=3;
 c.modal=true;assert.equal(c.poiWayfarerWellRead(),false);c.modal=false;
 c.poiWalkLevel=-1;assert.equal(c.poiWayfarerWellRead(),false);c.poiWalkLevel=0;
 c.facilitySite.id='inn';assert.equal(c.poiWayfarerWellRead(),false);
 assert.equal(c.notices.length,1);
});
test('wild monsters neither spawn nor chase into the live rest boundary; the adjoining road stays unchanged',()=>{
 const c=setup();
 assert.equal(c.poiWildExterior(120,44),false);
 assert.equal(c.poiWildExterior(122,44),true);
 assert.equal(c.poiWildExterior(120,42),true);
 c.world=[];assert.equal(c.poiWildExterior(120,44),true);assert.equal(c.poiWayfarerWellRead(),false);
});
