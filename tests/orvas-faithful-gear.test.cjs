const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.PRODUCT||'world-editor.html','utf8');
const cut=(u,v)=>{const i=h.indexOf(u),j=h.indexOf(v,i+u.length);a(i>=0&&j>i,u);return h.slice(i,j)};
function engine(){
 const m=()=>({p:[],n:[],c:[]}),c={mesh:m};
 c.tri=(m,p,q,r,c)=>{m.p.push(...p,...q,...r);m.c.push(...c,...c,...c);m.n.push(0,1,0,0,1,0,0,1,0)};
 c.quad=(m,p,q,r,s,k)=>{c.tri(m,p,q,r,k);c.tri(m,p,r,s,k)};
 const js=cut('function characterArmRotation(', 'function roundStack(')+cut('const POI_DAVID_EYE_Y=', 'const POI_DAVID_GAIT_STRIDE=')+
  cut('function poiDavidMakePrism(', 'function poiDavidGeometry(')+cut('// BEGIN ORVAS TROPHY ART','// END ORVAS TROPHY ART')+
  `globalThis.api={face:poiDavidFaceMesh,head:poiOrvasHeadGeometry,sword:poiOrvasGreatswordGeometry,swordShared:poiDavidSwordMesh,
     prism:poiDavidMakePrism,twin:poiOrvasTwinBladeBasis};`;
 vm.runInNewContext(js,c);return {c,m,...c.api};
}
const near=(a0,b,e=1e-9)=>a(Math.abs(a0-b)<e,`${a0} vs ${b}`);
test('trophy contains identical full-scale face triangles pigments and eye centers, with additional jagged neck faces',()=>{
 const x=engine(),s=x.m(),p=x.m(),t=(m)=>(...q)=>x.c.tri(m,...q),q=(m)=>(...q)=>x.c.quad(m,...q);
 x.face(t(s),q(s),null,{wakeGlow:0,glow:false});x.head(p,0,0,0);
 a(p.p.length>s.p.length);a.deepEqual(p.c.slice(0,s.c.length),s.c);
 for(let i=0;i<s.p.length;i++)near(p.p[i],s.p[i]-(i%3===1?4.028:0));
 a(p.p.slice(s.p.length).filter((_,i)=>i%3===1).some(v=>v<.010));
});
test('both rigid swords reuse exact boss blade at original scale; each real leading bevel points along descent and tip reaches floor',()=>{
 const x=engine(),s=x.m(),p=x.m();
 const t=(...q)=>x.c.tri(s,...q),q=(...q)=>x.c.quad(s,...q);
 x.swordShared(t,q,x.prism(t,q),[0,.38,0],[0,3.48,0],[0,1,0],[1,0,0]);x.sword(p,0,0,0);
 a.deepEqual(p.p,s.p);a.deepEqual(p.c,s.c);
 const arms={right:{wrist:[.272,.80,.31]},left:{wrist:[-.272,.85,.30]}};
 for(let i=0;i<2;i++){
  const early=x.twin(arms,{orvasTwin:[1.47,1.47]},i),b=x.twin(arms,{orvasTwin:[1.48,1.48]},i);
  near(Math.hypot(...b.tip.map((v,k)=>v-b.grip[k])),3.1);near(b.tip[1],.028);
  near(b.axis.reduce((s,v,k)=>s+v*b.blade[k],0),0);
  const sweep=b.tip.map((v,k)=>v-early.tip[k]),cos=sweep.reduce((s,v,k)=>s+v*b.blade[k],0)/Math.hypot(...sweep);
  a(cos>.98&&b.blade[1]<-.8);
 }
});
