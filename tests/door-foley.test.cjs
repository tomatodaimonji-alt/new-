const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const between=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i);return html.slice(i,j)};
const rate=24000,rms=(a,from,to)=>{
 const v=a.slice(Math.round(rate*from),Math.round(rate*to));
 return Math.sqrt(v.reduce((sum,x)=>sum+x*x,0)/v.length);
};
test('door opening keeps voiced hinge friction, closing gives a short body strike followed by a latch',()=>{
 const c=vm.createContext({});vm.runInContext(between('function poiSurfaceFoleyPcm(','const poiSurfaceFoleyCache='),c);
 for(const material of ['wood','stone','iron']){
  const open=c.poiSurfaceFoleyPcm('door-open-'+material,rate),close=c.poiSurfaceFoleyPcm('door-close-'+material,rate);
  assert(open.length/rate>=.26&&open.length/rate<=.34);
  assert(close.length/rate>=.13&&close.length/rate<=.20);
  for(const a of [open,close]){
   assert(a.every(Number.isFinite));
   const peak=Math.max(...a.map(Math.abs));
   assert(peak>.12&&peak<.83,'useful level without clipping');
   assert(Math.abs(a.at(-1))<.001,'no ending click');
  }
  assert(rms(open,.055,.15)>.034,'creak remains audible over multiple friction pulses');
  assert(rms(open,.085,.14)>rms(open,.205,.245)*2.3,'hinge clears space before the following latch');
  assert(rms(close,.034,.065)>rms(close,.10,.14)*2,'short landing transient dominates the tail');
  assert(rms(close,.056,.080)>.018,'second latch/contact is audible after impact');
  assert.notDeepEqual(open,c.poiSurfaceFoleyPcm('door-open-'+material,rate,1));
 }
 assert.notDeepEqual(c.poiSurfaceFoleyPcm('door-close-wood',rate),c.poiSurfaceFoleyPcm('door-close-iron',rate));
});
test('door playback uses the existing cached effects and mute gates',()=>{
 assert.match(html,/if\(kind==='door-open'\|\|kind==='door-close'\)\{\s*if\(poiAudioLevels\.master<=0\|\|poiAudioLevels\.se<=0\)return;[\s\S]{0,230}poiPlayImpactBuffer\(poiSurfaceFoley\(/);
});
function walkFixture(world,configure={}){
 const result=[];
 let t=800;
 const ctx=vm.createContext({
  world,poiWalkX:0,poiWalkZ:0,poiWalkLevel:0,poiWalkActive:true,poiWalkNextReady:0,poiWalkStarted:0,
  poiWalkFromX:0,poiWalkFromZ:0,poiWalkFacing:1,POI_WALK_MS:175,performance:{now:()=>t+=200},
  facilitySite:{},pineGameActive:false,poiChestIsOpen:()=>false,poiShopIsOpen:()=>false,
  poiWalkCanStep:()=>true,poiWalkPassableDoor:t=>t==='door'||/(Door|DoorOpen|Entrance)$/.test(t)||t.startsWith('ruinDoor'),
  facilityHasDiningStoneLeaf:o=>o.type==='stonewallDoor'&&o.x===5,
  facilityStableLoadingBayPart:o=>o.type!=='woodwallDoor'?0:o.x===1?1:o.x===2?2:0,
  poiSound:(k,m)=>result.push([k,m]),poiWalkRoof(){},poiWalkAvatar(){},poiWalkStatus(){},poiMiniUpdate(){},poiShopSync(){},workshopResumeWrite(){},
  ...configure
 });
 vm.runInContext(between('function poiDungeonThemeAt(','function poiDungeonEnterEffect(')+
  between('function poiWalkStep(','function poiWalkAction('),ctx);
 return {result,ctx,step:(dx=1,dz=0)=>ctx.poiWalkStep(dx,dz)};
}
test('safe entry then exit count once, re-entry repeats, blocked move and open frames do not sound',()=>{
 const f=walkFixture([{x:1,z:0,y:0,type:'plasterwallDoor'},{x:3,z:0,y:0,type:'ruinDoorBroken'},
  {x:4,z:0,y:0,type:'woodwallDoorOpen'},{x:5,z:0,y:0,type:'stonewallDoor'},{x:7,z:0,y:0,type:'ironwallDoor'}]);
 f.step();
 f.ctx.poiWalkCanStep=()=>false;f.step();
 assert.deepEqual(f.result,[['door-open','wood']],'no close or second creak while blocked in doorway');
 f.ctx.poiWalkCanStep=()=>true;
 for(let i=0;i<7;i++)f.step();
 assert.deepEqual(f.result.filter(x=>x[0].startsWith('door')),[
  ['door-open','wood'],['door-close','wood'],['door-open','stone'],['door-close','stone'],['door-open','iron'],['door-close','iron']
 ]);
 f.step(-1);f.step(-1);
 assert.deepEqual(f.result.filter(x=>x[0].startsWith('door')).slice(-2),[['door-open','iron'],['door-close','iron']]);
});
test('adjacent paired stable leaves count as one threshold, and portals clear rather than latch',()=>{
 const bay=walkFixture([{x:1,z:0,y:0,type:'woodwallDoor'},{x:2,z:0,y:0,type:'woodwallDoor'}]);
 bay.step();bay.step();bay.step();
 assert.deepEqual(bay.result.filter(x=>x[0].startsWith('door')),[['door-open','wood'],['door-close','wood']]);
 const gate=walkFixture([{x:1,z:0,y:0,type:'stonewallDoor'},{x:2,z:0,y:0,type:'otherworldPortal'}],{
  poiOtherworldUseStep:x=>x===2
 });
 gate.step();gate.step();gate.ctx.poiOtherworldUseStep=()=>false;gate.step();
 assert.deepEqual(gate.result.filter(x=>x[0].startsWith('door')),[['door-open','wood']]);
});
