const {test}=require('node:test');
const {strict:assert}=require('node:assert');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const html=readFileSync(process.env.WORKSHOP_HTML||require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const extract=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function build({x=0,z=0,direction={dx:Math.SQRT1_2,dz:Math.SQRT1_2,power:1},strokeBlocked=false,doors=[],wetAt=null,portal=false}={}){
 const audio=[],world=doors.map(([x,z])=>({x,z,y:0,type:'plasterwallDoor'}));
 const c={moved:true,last:null,failures:new Map(),dx:12,dy:12};
 const vm={x,z,world,c,dir:direction,audio,wetAt,Math,POI_WALK_MS:200,poiWalkActive:true,poiWalkLevel:0,poiWalkFacing:1,
  poiWalkFromX:x,poiWalkFromZ:z,poiWalkX:x,poiWalkZ:z,poiWalkNextReady:0,poiFreePose:null,poiAnalogContact:c,
  poiThirdPerson:false,yaw:0,poiOtherworldTravelSerial:0,facilitySite:null,pineGameActive:false,
  poiAnalogAllowed:()=>true,poiAnalogSample:()=>vm.dir,
  poiWalkCanStep:(tx,tz)=>!strokeBlocked||tx<=0,
  poiOtherworldUseStep:portal?()=>{vm.poiOtherworldTravelSerial++;vm.poiWalkX=50;return true}:undefined,
  poiAnalogStop:()=>{vm.poiAnalogContact=null},poiChapelWater:(x,z)=>x===wetAt,
  poiChapelStepMs:x=>x===wetAt?265:200,poiDungeonThemeAt:()=>null,poiWalkIndoor:()=>false,
  poiWalkPassableDoor:()=>true,facilityHasDiningStoneLeaf:()=>false,
  poiWalkRoof:()=>{},poiWalkAvatar:()=>{},poiWalkStatus:()=>{},workshopResumeWrite:()=>{},
  poiSound:(...args)=>audio.push({args,t:vm.now})};
 runInNewContext([
  extract('const POI_FREE_RADIUS=','// END FREE MOVEMENT SOLVER'),
  extract('let poiWalkDoorOpen=','function poiNorthTrailForkSignReachable('),
  extract('function poiAnalogFrame(','poiAnalogPad.addEventListener(\'pointerdown\''),
 ].join('\n')+'\nthis.frame=poiAnalogFrame;this.enter=poiWalkEnterCell;',vm);
 return {vm,audio,at:t=>{vm.now=t;vm.frame(t)},walk:(a,b,dt=10)=>{for(let t=a;t<=b;t+=dt){vm.now=t;vm.frame(t)}}};
}
test('diagonal does not play two steps at simultaneous cardinal boundaries; stride follows physical distance',()=>{
 const {vm,audio,walk}=build();walk(0,740);
 assert(vm.poiWalkX===3&&vm.poiWalkZ===3,'actual solver crosses six canonical boundaries');
 assert.equal(audio.length,4);
 assert.deepEqual(audio.map(e=>e.t),[100,300,500,700]);
});
test('walk slides at achieved speed, blocked thumb remains quiet, and a hitch cannot queue a burst',()=>{
 const slide=build({strokeBlocked:true});
 slide.walk(0,400);slide.at(1000);slide.walk(1010,1700);
 assert.deepEqual(slide.audio.map(({t})=>t),[110,400,1240,1520]);
 const blocked=build({strokeBlocked:true,direction:{dx:1,dz:0,power:1}});
 blocked.walk(0,3000);
 assert.equal(blocked.audio.length,0);
});
test('reduced power slows cadence without phase reset; wet and dry use existing sounds',()=>{
 const h=build({direction:{dx:1,dz:0,power:.5},wetAt:1});h.walk(0,300);
 h.vm.dir.power=1;h.walk(310,720);
 assert.deepEqual(h.audio.map(e=>e.args),[['chapel-water-step'],['step','outdoor'],['step','outdoor']]);
 assert.deepEqual(h.audio.map(e=>e.t),[200,520,720]);
});
test('door foley keeps one open and close; direct movement and a portal retain previous semantics',()=>{
 const h=build({direction:{dx:1,dz:0,power:1},doors:[[1,0]]});h.walk(0,620);
 assert.deepEqual(h.audio.map(e=>e.args),[['door-open','wood'],['door-close','wood'],['step','outdoor']]);
 const p=build({direction:{dx:1,dz:0,power:1},portal:true});p.walk(0,600);
 assert.equal(p.vm.poiAnalogContact,null);assert.deepEqual(p.audio,[]);
 const d=build();d.vm.enter(1,0,0);assert.deepEqual(d.audio.map(e=>e.args),[['step','outdoor']]);
});
test('neutral freezes a partial stride; lifting and starting again resets the stride',()=>{
 const h=build({direction:{dx:1,dz:0,power:1}});h.walk(0,70);
 const straight=h.vm.dir;h.vm.dir=null;h.walk(80,400);assert.equal(h.audio.length,0);
 h.vm.dir=straight;h.walk(410,440);assert.deepEqual(h.audio.map(e=>e.t),[440]);
 h.walk(450,570);h.vm.poiAnalogContact={moved:true,last:null,failures:new Map(),dx:12,dy:12};h.walk(580,680);
 assert.deepEqual(h.audio.map(e=>e.t),[440,680]);
});
