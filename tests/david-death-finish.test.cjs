const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const h=fs.readFileSync(process.env.PRODUCT||'world-editor.html','utf8');
function slice(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)}
const rules=slice('function poiDavidBeamEmission(', 'function poiDavidBeamAdvance(')+slice('function poiDavidCease(', 'function poiDavidArrive(')+slice('function poiDavidDeathFrame(', 'function poiDavidMobFrame(')+slice('function poiDavidPose(', 'function poiDavidIncoming(');
function setup(kind='double',killer=true,sw=null){
 const q={kind,start:0,hits:kind==='double'?[720,1040]:[720],cursor:1,executed:1,landed:1,lastContactAt:720,until:1730,sweep:sw};
 const d={awake:true,wakeDone:true,dx:1,dz:0,attack:q,trail:[{x:4,z:4}]};
 const o={type:'monsterStoneDavid'},s={david:d,x:3,z:4,hp:100,moveStarted:0},b={x:4,z:4};
 const ctx=vm.createContext({q,d,s,o,b,killer:killer?o:{type:'monsterSlime'},poiDavidActive:{o,s},poiDavidMatch:()=>b,poiMonsterStates:new Map([[o,s]]),poiMonsterMeshDirty:false,
  POI_DEATH_PAUSE:1200,POI_DAVID_PATTERNS:{beam:{rest:760}},POI_DAVID_BEAM_SHORT:180,POI_DAVID_BEAM_SWEEP:680,POI_DAVID_BEAM_ARC:1,
  poiDavidBeamRay:()=>({x:1,z:0}),poiDavidLeapPose:()=>null,poiDavidLeapAbort:()=>{},
  poiDavidReturnFrame:()=>{ctx.returned=(ctx.returned||0)+1},poiDavidArrive:()=>{},poiDavidBeamAudioEnd:(q)=>{if(!q.beamClosed){q.beamClosed=true;ctx.ended=(ctx.ended||0)+1}},
  poiPlayerDying:()=>true});
 vm.runInContext(rules,ctx);return {ctx,q,s,d,at:js=>vm.runInContext(js,ctx)};
}
test('first fatal double contact retains real second blade pose and causes no more resolved contacts',()=>{
 const {q,d,at,ctx}=setup();
 at('poiDavidDeathFrame(720,killer);poiDavidCease(o,s,b,720)');
 assert.equal(at('poiDavidPose(s,740).phase'),'impact');
 assert(!d.returning);
 at('poiDavidDeathFrame(900)');assert.equal(at('poiDavidPose(s,900).phase'),'windup');
 at('poiDavidDeathFrame(1040)');assert.equal(at('poiDavidPose(s,1040).phase'),'impact');
 assert.equal(q.cursor,2);assert.equal(q.executed,1);assert.equal(q.landed,1);
 at('poiDavidDeathFrame(1350)');assert.equal(at('poiDavidPose(s,1350).phase'),'recover');assert(!ctx.returned);
 at('poiDavidDeathFrame(1730)');assert.equal(d.attack,null);assert(d.returning);assert.equal(ctx.returned,1);
});
test('only David as actual lethal source may remain visually active',()=>{
 const {d,at}=setup('stomp',false);at('poiDavidDeathFrame(720,killer)');
 assert.equal(d.attack,null);assert(d.returning);
});
test('beam already sweeping finishes visually, tell for not-yet-started sweep is discarded',()=>{
 const {q,at,ctx}=setup('beam',true,{side:1,tell:500,start:650,end:1330,angle:.1,done:false});
 at('poiDavidDeathFrame(720,killer);poiDavidDeathFrame(1100)');
 assert(q.sweep.angle>.5&&at('poiDavidBeamEmission(q,1100).turning'));
 at('poiDavidDeathFrame(1330);poiDavidDeathFrame(1340)');assert.equal(ctx.ended,1);
 assert.equal(at('poiDavidPose(s,1340).phase'),'recover');assert.equal(q.executed,1);
 const p=setup('beam',true,{tell:720,start:null});
 p.at('poiDavidDeathFrame(720,killer)');assert.equal(p.q.sweep,null);
 assert.equal(p.at('poiDavidBeamEmission(q,800).turning'),false);
});
