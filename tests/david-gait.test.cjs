const assert=require('node:assert/strict'), test=require('node:test'), fs=require('node:fs'), vm=require('node:vm');
const source=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const cut=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)+a.length));
function sandbox(){
 const ctx=vm.createContext({Math,POI_DAVID_BLADE:2.7,POI_DAVID_EYE_Y:4.72,POI_DAVID_EYE_FRONT:.34,
  poiDavidPose:s=>({phase:s.david?.returning?'return':'ready',kind:null,dx:0,dz:1}),terrainY:()=>0,facilitySite:null});
 vm.runInContext(cut('function poiDavidHeadPoint(','function poiDavidGeometry(')+cut('function poiMonsterPose(','function poiMonsterBreakPhase('),ctx);
 return ctx;
}
test('stride is continuous across logical cell boundaries, while render movement and attack stay authored',()=>{
 const c=sandbox(),o={type:'monsterStoneDavid'},s={x:0,z:1,fromX:0,fromZ:0,moveStarted:0,guardMoveMs:235,david:{gaitDistance:0}};
 const first=c.poiMonsterPose(o,s,117.5),end=c.poiMonsterPose(o,s,235);
 assert.equal(first.z,1);
 assert.equal(first.david.walkDistance,.5,'render gait tracks actual traversed distance');
 const next=c.poiMonsterPose(o,{...s,z:2,fromZ:1,moveStarted:250,david:{gaitDistance:1}},250);
 assert.equal(end.david.walkDistance,next.david.walkDistance);
 assert.deepEqual(c.poiDavidRig(end.david).feet,c.poiDavidRig(next.david).feet);
 const stomp={kind:'stomp',phase:'windup',elapsed:800,hitTimes:[930]};
 assert.deepEqual(c.poiDavidRig(stomp),c.poiDavidRig({...stomp,walkDistance:1.4,walkAmount:1}));
});
test('stride plants over more than a full cell; the other leg has lifted and recovered in that span',()=>{
 const c=sandbox(),p={phase:'ready',kind:null,walkAmount:1};
 const pose=d=>c.poiDavidRig({...p,walkDistance:d});
 const a=pose(.35),b=pose(1.55);
 assert.ok(a.feet[1][1]===0&&b.feet[1][1]===0);
 assert.ok(Math.abs((a.feet[1][2]-b.feet[1][2])-1.2)<1e-8,'a single planted foot offsets more than one world cell');
 assert.ok(pose(.9).feet[0][1]>.4,'the swinging shin has clearance');
 assert.ok(Math.abs(pose(.3).hands[0][2]-pose(2.08).hands[0][2])>.3,'heavy opposite arm swing reads across two footfalls');
});
test('front slit is open on the right while stone drape reaches the covered shin',()=>{
 const c=sandbox();
 assert.equal(typeof c.poiDavidSkirt,'function','dedicated drape emits world mesh instead of a short closed hip cone');
 const tris=[],quads=[];
 c.poiDavidSkirt(c.poiDavidRig({phase:'ready',walkDistance:.95,walkAmount:1}),(...v)=>tris.push(v.slice(0,3)),(...v)=>quads.push(v.slice(0,4)),[.45,.4,.3]);
 const ps=[...tris,...quads],all=ps.flat();
 assert.ok(all.some(([x,y])=>x<-.4&&y<.78),'covered leg hem reaches shin');
 assert.ok(ps.length>=36&&ps.length<=80,'bounded pleated stone silhouette');
 for(const face of ps){
  const [x,y,z]=face.reduce((a,p)=>a.map((n,i)=>n+p[i]/face.length),[0,0,0]);
  assert.ok(!(y<1.3&&x>.52&&x<.84&&z>.49),'no face fills the lower front-right slit');
 }
});
test('only the right blade sweeps; the left holds one constant guard and the overhead double remains separate',()=>{
 const c=sandbox(),load=c.poiDavidRig({kind:'sweep',phase:'windup',progress:.62}),impact=c.poiDavidRig({kind:'sweep',phase:'impact'});
 assert.deepEqual(load.hands[0],impact.hands[0]);assert.deepEqual(load.swordTips[0],impact.swordTips[0]);
 assert.ok(Math.abs(load.hands[1][2]-impact.hands[1][2])>.75,'active right sword moves across the contact');
 const high=c.poiDavidRig({kind:'double',phase:'windup',progress:1});
 assert.ok(high.hands.every(h=>h[1]>4.4));
});
test('moving skirt clears the high knee under the covered front lapel during a stomp',()=>{
 const c=sandbox();
 const r=c.poiDavidRig({kind:'stomp',phase:'windup',elapsed:805,hitTimes:[930]});
 const [x,y,z]=r.knees[0],faces=[];
 c.poiDavidSkirt(r,()=>{},(a,b,c,d)=>faces.push([a,b,c],[a,c,d]),[.45,.4,.3]);
 const intersections=faces.flatMap(([a,b,c])=>{
  const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  if(Math.abs(d)<1e-7)return [];
  const s=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d;
  const t=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d;
  return Math.min(s,t,1-s-t)>=0?[s*a[2]+t*b[2]+(1-s-t)*c[2]]:[];
 });
 assert.ok(Math.max(...intersections)>z+.23,JSON.stringify({knee:r.knees[0],intersections}));
});
