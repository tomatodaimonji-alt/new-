const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const get=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);return i>=0&&j>i?h.slice(i,j):''};
function setup(){
 const c={foley:[],poiDavidHeavyContact:(kind,loc)=>c.foley.push([kind,loc.sx,loc.sz]),POI_DAVID_GAIT_STRIDE:1.78,
  poiWalkLevel:0,facilitySite:{id:'base'},world:[],poiEnemyThreatEnabled:()=>true,poiDavidHidden:()=>false,
  poiDavidMatch:o=>o.correct?c.b:null,poiDavidIn:(_b,p)=>p.x<=20.8,poiAimOrigin:()=>({x:20,z:20,y:0}),
  b:{y:0},obj:{correct:true,x:20,z:20,y:0},gl:{deleteBuffer(){}},poiMonsterActorPoint:()=>({x:20,z:20,t:0}),
  poiMonsterPose:()=>({x:20.5,z:20.5,heading:0,david:{walkDistance:2}}),poiDavidRig:()=>({feet:[[-.55,0,.27],[.48,0,-.19]]}),
  poiOrvasTraceGround:()=> (x,z)=>x<=20.8?[x+.5,.142,z+.5]:null,
  mesh:()=>({p:[],n:[],c:[]}),poiOrvasHairline:(m,g,x,z,nx,nz,width)=>{const a=g(x,z),b=g(nx,nz);if(a&&b)m.p.push(...a,...b,width)},
  step:{david:{wakeDone:true,gaitDistance:0},actorFree:{},moveStarted:90,guardMoveMs:310,x:20,z:20}};
 vm.createContext(c);vm.runInContext(get('// BEGIN ORVAS WALK FISSURES','// END ORVAS WALK FISSURES')+
  get('function poiDavidFootFeedback(', 'function poiDavidHeavyContact('),c);
 const f=(t,d)=>{c.step.david.gaitDistance=d;c.t=t;vm.runInContext('poiDavidFootFeedback(obj,step,b,t)',c)};
 const marks=()=>vm.runInContext('typeof poiOrvasFootMarks!=="undefined"?poiOrvasFootMarks:[]',c);
 return {f,marks,c};
}
test('one tiny mark follows each alternating real gait plant and does not change prior audible foot cue',()=>{
 const q=setup();
 q.f(100,0);q.f(145,1.0);assert.equal(q.marks().length,0);
 q.f(180,1.8);assert.equal(q.marks().length,1);assert.equal(q.marks()[0].x,19.45);
 q.f(205,1.85);assert.equal(q.marks().length,1);
 q.f(280,3.6);assert.equal(q.marks().length,2);assert.equal(q.marks()[1].x,20.48);
 assert.equal(q.c.foley.length,2);
});
test('awakening, stationary pose, attack, and retreat cannot emit; queue never grows above three',()=>{
 const q=setup();q.f(100,0);q.c.step.david.wakeDone=false;q.f(145,1.8);assert.equal(q.marks().length,0);
 q.c.step.david.wakeDone=true;q.c.step.david.returning=true;q.f(180,3.6);assert.equal(q.marks().length,0);
 q.c.step.david.returning=false;q.c.step.david.attack={};q.f(205,5.5);assert.equal(q.marks().length,0);
 q.c.step.david.attack=null;for(let i=4;i<13;i++)q.f(210+i*10,i*1.78+.02);
 assert.equal(q.marks().length,3);
 assert(q.marks().every(m=>m.m.p.length>0));
});
test('GPU buffers retire on expiry or exact map swap, never drawing across scenes',()=>{
 const q=setup(),deleted=[];q.c.poiWalkActive=true;q.c.gl.deleteBuffer=b=>deleted.push(b);
 q.f(100,0);q.f(180,1.8);q.marks()[0].gpu={buf:'expired'};
 vm.runInContext('poiDrawOrvasWalkFissures(860,null)',q.c);
 assert.equal(q.marks().length,0);assert.deepEqual(deleted,['expired']);
 q.f(280,3.6);q.marks()[0].gpu={buf:'moved'};q.c.world=[];
 vm.runInContext('poiDrawOrvasWalkFissures(285,null)',q.c);
 assert.equal(q.marks().length,0);assert.deepEqual(deleted,['expired','moved']);
});
