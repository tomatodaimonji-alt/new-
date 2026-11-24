const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function make(surface,mask=3){
 const draws=[],host={},ctx={facilitySite:host,poiWalkActive:true,poiWalkLevel:0,terrainY:()=>0,poiAimWall:()=>()=>true,
   poiDavidBeamRay:(_q,t)=>({x:Math.cos(t),z:Math.sin(t)}),poiDavidBeamReach:()=>14,
   mesh:()=>({p:[],n:[],c:[]}),quad:(m,...p)=>{for(const v of [p[0],p[1],p[2],p[0],p[2],p[3]])m.p.push(...v)},
   poiOrvasTraceGround:()=>surface,
   poiOrvasFloorMark:(m,g,x,z)=>{if(!g(x,z))return false;m.p.push(x,0,z);return true},
   poiOrvasScorchPaint:()=>[0,0,0],
   poiOrvasBossOpticalEnds:(q,d)=>[-1,1].filter(side=>q.beamMask&(side<0?1:2)).map(side=>{
    const x=d.z*.151*side,z=-d.x*.151*side,len=13.8;
    return {x,z,length:len,h:0,eyeSide:side,face:null,floor:!!surface(x+d.x*len,z+d.z*len)};
   }),
 };
 const x=h.indexOf('const ORVAS_TRACE_MAX_TILES'),y=h.indexOf('function poiOrvasTraceGround(');
 const i=h.indexOf('function poiOrvasSweepGroundSample('),j=h.indexOf('function poiOrvasTraceBladeFleck(',i);
 a(i>=0&&j>i,'sweep ribbon implementation');
 const c=vm.createContext(ctx);vm.runInContext(h.slice(x,y)+h.slice(i,j),c);
 const q={kind:'beam',executed:1,y:0,sx:0,sz:0,beamMask:mask};
 return {draws,q,c,run:(angle,t)=>c.poiOrvasBeamTrace(q,{},t,angle)};
}
test('real first and final angular spans are joined with small supported ribbons while straight and unstarted tell remain dots',()=>{
 const f=make((x,z)=>[x+.5,0,z+.5]);a(f.run(0,0));a.equal(f.q.orvasBeamGround.parts.length,2);
 f.q.sweep={start:null};a(!f.run(.9,10));a.equal(f.q.orvasBeamGround.parts.length,2);
 f.q.sweep.start=10;a(f.run(.59,30));f.q.sweep.done=true;a(f.run(1.08,80));
 const e=f.q.orvasBeamGround;a(e.sweepMesh.p.length>1000);a(e.sweepMesh.p.length<17000);
 const p=e.sweepMesh.p,zs=p.filter((_,i)=>i%3===2);a(Math.min(...zs)<.65);a(Math.max(...zs)>12.5);
 a.equal(e.parts.filter(p=>p===e.sweepMesh).length,1);
});
test('passing over missing ground leaves an actual gap; negative/masked eye stays local and one active strip',()=>{
 const f=make((x,z)=>z< -3&&z> -5?null:[x+.5,0,z+.5],2);a(f.run(0,0));
 f.q.sweep={start:0,done:true};a(f.run(-1.08,50));const p=f.q.orvasBeamGround.sweepMesh.p,zs=p.filter((_,i)=>i%3===2);
 a(!zs.some(z=>z< -2.5&&z> -4.5));a(zs.some(z=>z< -6));a(zs.some(z=>z> -2));a(Math.max(...zs)<.8);
});
test('adjacent faces on one plane join, wall gap and wall-to-floor transition never bridge',()=>{
 const f=make(()=>null),m={p:[]};
 f.c.poiWallCameraSlab=(s,o,ray)=>o[2]+ray[2]*.055>=s.left&&o[2]+ray[2]*.055<=s.right?.055:Infinity;
 const wall=(z,left,right,x=2)=>({kind:'wall',p:[x,3,z],face:{normal:[1,0,0],row:{x:0,y:0,z:0,s:{left,right}}}});
 a(f.c.poiOrvasSweepRibbon(m,()=>null,wall(0,-1,.11),wall(.26,.10,1)));
 const count=m.p.length;
 const p=m.p,ny=(p[4]-p[1])*(p[8]-p[2])-(p[5]-p[2])*(p[7]-p[1]);a(ny>0,"wall faces outward towards the beam");
 a(!f.c.poiOrvasSweepRibbon(m,()=>null,wall(0,-1,.08),wall(.26,.16,1)));
 a(!f.c.poiOrvasSweepRibbon(m,()=>null,wall(0,-1,.11),wall(.26,.1,1,2.1)));
 a(!f.c.poiOrvasSweepRibbon(m,()=>null,wall(0,-1,.11),{kind:'floor',p:[2,3,.1]}));
 a.equal(m.p.length,count);
});
