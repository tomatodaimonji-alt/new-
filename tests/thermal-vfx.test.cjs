const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const part=(x,y)=>{const s=src.indexOf(x),e=src.indexOf(y,s+1);a(s>=0&&e>s,x);return src.slice(s,e)};
function inject(){
 const ctx=vm.createContext({mesh:()=>({p:[],n:[],c:[]}),tri:(m,x,y,z,c)=>{m.p.push(...x,...y,...z);m.c.push(c)},
  quad:(m,...t)=>{const [x,y,z,w,c]=t;ctx.tri(m,x,y,z,c);ctx.tri(m,x,z,w,c)},
  terrainY:()=>0,poiDavidBeamRay:(q,a)=>({x:Math.sin(a),z:Math.cos(a)}),poiDavidBeamReach:()=>ctx.limit,limit:6.25});
 vm.runInContext(part('function poiPlayerFireGeometry','function poiAppendWeaponProjectile')+
  part('// BEGIN DAVID THERMAL BEAM','// END DAVID THERMAL BEAM')+part('function poiDavidSweepBeamMesh','// BEGIN DAVID STOMP IMPACT'),ctx);
 return ctx;
}
test('David heat beam has moving sculpted core and sheath; all frames stop at the same clipped reach',()=>{
 const c=inject(),r={x:0,z:1},q={sx:24,sz:104,dx:0,dz:1,y:0,sweep:{angle:.43}};
 const beam=(t,cut=6.25)=>c.poiDavidThermalBeam(q,r,cut,t,false);
 const v=beam(100),w=beam(142);
 a(v.coreCount>30&&v.p.length/3>v.coreCount&&v.p.length/3<=2160);
 a.notDeepEqual(v.p,w.p,'live tube geometry continues to ripple');
 for(const f of [v,w]){
  const near=[],left=[],right=[];
  for(let i=0;i<f.p.length;i+=3){
   const d=f.p[i+2]-104.5,x=f.p[i]-24.5;
   if(d>.8&&d<5.9)(x<0?left:right).push(x);
   near.push(x);
  }
  a(left.length>24&&right.length>24&&near.every(x=>Math.abs(x)>.036),'two physically separate tubes and their sheaths');
 }
 a(v.c.some(c=>c[0]>.95&&c[1]<.31&&c[2]<.12),'warm halo remains distinct from the bright core');
 a(v.c.some(c=>c[0]>.95&&c[1]>.70&&c[2]>.40));
 const visit=(m,ray,max)=>{
  for(let i=0;i<m.p.length;i+=3){
   const x=m.p[i]-24.5,z=m.p[i+2]-104.5,d=x*ray.x+z*ray.z;
   a(d<=max+1e-8&&d>=.25,'clipped accurately: '+d+' >'+max);
  }
 };
 visit(v,r,6.25);visit(beam(100,1.5),r,1.5);a.equal(beam(100,.30).p.length,0);
 visit(c.poiDavidSweepBeamMesh(q,{},125),c.poiDavidBeamRay(q,.43),6.25);
 a.deepEqual(c.poiDavidThermalBeam(q,r,6.25,100,true).p,c.poiDavidThermalBeam(q,r,6.25,235,true).p);
});
test('wand has animated bounded ribbons and sparks; original 160ms visual envelope preserved',()=>{
 const c=inject(),p={x:12,y:.77,z:3,dx:1,dz:0},make=(t,impact)=>{const m=c.mesh();c.poiPlayerFireGeometry(m,p,t,impact);return m};
 const a0=make(100),a1=make(134),b=make(110,100);
 a(a0.p.length>210&&a0.p.length/9<65);a.notDeepEqual(a0.p,a1.p);a.notDeepEqual(a0.c,a1.c);
 a(b.p.length>a0.p.length);a(a0.fireGlow?.p.length>0&&a0.fireGlow.alpha<.3);a.equal(make(260,100).p.length,0);
});
