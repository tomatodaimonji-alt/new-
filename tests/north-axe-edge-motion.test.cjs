const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(s,e)=>{const i=h.indexOf(s),j=h.indexOf(e,i+s.length);a.ok(i>=0&&j>i,s);return h.slice(i,j)};
const triangles=[];
const push=(m,...xyz)=>triangles.push(xyz);
const c=vm.createContext({tri:push,quad:push});
const api=vm.runInContext(cut('function poiNorthMinotaurAxeGeometry(', '\nfunction ')+cut('// BEGIN WORLD MELEE REACH','// END WORLD MELEE REACH')+
';({geom:poiNorthMinotaurAxeGeometry,plan:poiWorldMeleePlan,rig:poiRigidHeldRotation})',c);
api.geom(null,0,0,0);
const blade=triangles.filter(t=>t.at(-1)[0]===.735).flatMap(t=>t.slice(0,-1));
const edge=blade.reduce((p,q)=>q[0]>p[0]?q:p);
const grip=[0,.64,0],apex=[.4661,2.82886,0],hand={x:.21,y:.85,z:.40},profile={range:2.55,hit:300,pose:670,frontArc:true};
const plan=ms=>api.plan('equipNorthMinotaurAxe',profile,ms);
const equal=(x,y)=>a.ok(Math.hypot(...x.map((v,i)=>v-y[i]))<1e-6);
const point=(plan,pivot=hand)=>{
 const orient=api.rig({mix:1,...plan},pivot,apex,grip,[1,1,1],(...v)=>v);
 return (...p)=>orient(...p.map((v,i)=>v-grip[i])).map((v,i)=>v+[pivot.x,pivot.y,pivot.z][i]);
};
test('the actual sharpened steel face leads the moving head rather than following the heel',()=>{
 a.ok(edge[0]>.62,'selector found actual sharp blade crest');
 for(const ms of [235,275,300,355,415]){
  const p=plan(ms),q=plan(ms-1),n=plan(ms+1),transform=point(p);
  const front=transform(...edge),heel=transform(-.14,edge[1],edge[2]);
  const dot=(front[0]-heel[0])*(n.side-q.side)+(front[2]-heel[2])*(n.forward-q.forward);
  a.ok(dot>0,`cutting edge must lead sweep at ${ms}ms (dot ${dot})`);
  equal(transform(...grip),[hand.x,hand.y,hand.z]);
  const vec=[p.side-hand.x,p.height-hand.y,p.forward-hand.z];
  const f=Math.hypot(...apex.map((v,i)=>v-grip[i]))/Math.hypot(...vec);
  equal(transform(...apex),vec.map((v,i)=>[hand.x,hand.y,hand.z][i]+f*v));
 }
});
test('same shared rig with a different weapon retains its existing orientation',()=>{
 const p={side:0,height:1.1,forward:2.55};
 const warp=point(p),left=warp(-.2,1,0),right=warp(.2,1,0);
 a.ok(right[0]>left[0]);
});
