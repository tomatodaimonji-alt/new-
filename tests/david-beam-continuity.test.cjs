const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=html.indexOf(x),j=html.indexOf(y,i+1);a(i>=0&&j>i,x);return html.slice(i,j)};
function game(){
 const o={type:'monsterStoneDavid',x:24,z:104,y:0},b={...o,room:{minX:13,maxX:35,minZ:93,maxZ:115}},s={hp:1050,x:24,z:104,facing:2},live=new Set(),draws=[],sounds=[],finishes=[],hits=[];
 let counter=0,alpha=0,current=0;
 const c={facilitySite:{id:'base',davidTemple:{boss:b}},poiWalkActive:true,poiWalkLevel:0,poiWalkDoorOpen:null,document:{hidden:false,addEventListener(){}},
  poiEnemyThreatEnabled:()=>true,poiEnemyCueReduced:null,poiAimOrigin:()=>c.p,poiMonsterStates:new Map([[o,s]]),poiMonsterMeshDirty:false,p:{x:24,z:97,y:0},world:[],
  Math:Object.assign(Object.create(Math),{random:()=>c.roll}),roll:.42,poiAimWall:()=>((x,z)=>!c.wall(x,z)),wall:()=>false,POI_AIM_EPS:1e-7,
  poiMonsterCanMove:()=>true,terrainY:()=>0,poiEnemyCuePoint:(x,z,y)=>[x+.5,y+.15,z+.5],
  poiMobHitPlayer:(_o,at,n)=>{hits.push([at,n]);return false},poiDavidAttackFoley:(q,_p,_b,i,phase)=>sounds.push([q.start,phase,current]),poiDavidFinishBeamFoley:q=>finishes.push([q.start,current]),
  poiDavidStopAttackFoley:()=>finishes.push(['stop',current]),mesh:()=>({p:[],n:[],c:[]}),tri(m,p,q,r,col){for(const v of [p,q,r])m.p.push(...v)},
  quad(m,p,q,r,s,col){for(const v of [p,q,r,r,s,p])m.p.push(...v)},
  upload(m,handle){const buf=handle??++counter;live.add(buf);return {buf,count:m.p.length/3,coords:m.p,coreCount:m.coreCount}},
  draw(g,_vp,offset,amount){draws.push({buf:g.buf,n:g.count,p:g.coords,beam:Number.isFinite(g.coreCount),offset,amount,alpha})},
  gl:{DYNAMIC_DRAW:1,CONSTANT_ALPHA:2,ONE_MINUS_CONSTANT_ALPHA:3,SRC_ALPHA:4,ONE_MINUS_SRC_ALPHA:5,BLEND:6,
   blendColor(_r,_g,_b,a){alpha=a},blendFunc(){},enable(){},depthMask(){},disable(){},deleteBuffer(id){live.delete(id)}}
 };
 const api=vm.runInNewContext(cut('// BEGIN DAVID TEMPLE COMBAT','// END DAVID TEMPLE COMBAT')+
  cut('function poiAimWallLimit(','function poiAimChooseLock(')+cut('// BEGIN DAVID TEMPLE CUES','// END DAVID TEMPLE CUES')+
  ';({realStep:poiDavidMobFrame,step:(o,s,t)=>{const ok=poiDavidMobFrame(o,s,t);if(ok){const b=poiDavidMatch(o);for(const u of [POI_DAVID_AWAKENING.first,POI_DAVID_AWAKENING.second,POI_DAVID_AWAKENING.ready])poiDavidAwakeningTick(o,s,b,t+u);if(!s.david?.wakeDone)throw Error("post-awakening fixture unavailable");s.david.next=t+620;}return ok},tick:poiDavidCombatFrame,begin:poiDavidBegin,pose:poiDavidPose,draw:poiDrawDavidCue})',c);
 const frame=time=>{current=time;api.tick(time);draws.length=0;api.draw(time,[]);return draws.slice()};
 const begin=()=>{c.p.z=98;a(api.step(o,s,1000));c.p.z=97;a(api.begin(o,s,1700,'beam'));return s.david.attack.hits[0]};
 return {api,c,s,b,live,frame,begin,sounds,finishes,hits};
}
const beam=f=>f.find(x=>x.beam);
const length=d=>Math.max(...d.p.filter((_,i)=>i%3===2).map(z=>104.5-z));
test('actual beam draw grows out of the eyes and maintains one buffer and posture through warning and rotating finish',()=>{
 const g=game(),hit=g.begin(),q=g.s.david.attack;
 g.frame(hit-500); const before=g.frame(hit-150),early=g.frame(hit-80),mid=g.frame(hit-40);
 a(!beam(before),'there is only a warning before the muzzle reveal');
 a(beam(early)&&beam(mid),'a visible ray grows during the original windup');
 a(length(beam(early))<length(beam(mid)),'successive rays extend from the eye');
 const muzzle=beam(early).p.filter((v,i,coords)=>i%3===0&&Math.abs(coords[i+2]-104.21)<.002&&Math.abs(coords[i+1]-4.75)<.03);
 a(muzzle.some(x=>Math.abs(x-24.349)<.025)&&muzzle.some(x=>Math.abs(x-24.651)<.025),'both real eye positions seed the beam, not the forehead center');
 a(beam(early).n<=375&&beam(mid).n<=375);

 a.equal(g.hits.length,0);
 const contact=g.frame(hit),hold=g.frame(hit+180),last=g.frame(hit+410),sweepStart=g.frame(hit+450),sweep=g.frame(hit+750);
 a([contact,hold,last,sweepStart,sweep].every(f=>beam(f)),'the ray must remain visible every phase');
 a.equal(new Set([early,mid,contact,hold,last,sweepStart,sweep].map(f=>beam(f).buf)).size,1,'one actual GL handle across charge, hold and sweep');
 a(hold.some(f=>!f.beam)&&last.some(f=>!f.beam),'the separate fan warning is drawn together with the exact held beam');
 a(Math.abs(length(beam(contact))-length(beam(hold)))<.12);
 a(beam(sweep).p.some((x,i)=>i%3===0&&x>25.5),'rightward sweep grows laterally');
 a.deepEqual(g.hits,[[hit,47],[hit+450,36]],'hold never stacks damage; moving sweep retains one contact');
 const ending=g.frame(hit+1130),after=g.frame(hit+1148);a(beam(ending)&&!beam(after),'ray ends once sweep reaches its last frame');
 a.deepEqual(g.finishes,[[q.start,hit+1130]]);
 a.equal(g.sounds.filter(v=>v[1]==='beamOnset').length,1);
});
test('no-branch closes normally and exterior interrupts the beam with no ghosts',()=>{
 for(const exit of [false,true]){
  const g=game(),hit=g.begin();g.c.roll=.99;g.frame(hit-500);g.frame(hit-55);a(beam(g.frame(hit)));
  if(exit){g.c.p.z=92; a(!beam(g.frame(hit+100)));a.equal(g.live.size,0);a.equal(g.finishes[0][0],'stop');}
  else {a(beam(g.frame(hit+115)));a(!beam(g.frame(hit+185)));a.equal(g.finishes.length,1);}
  a.equal(g.hits.length,1);
 }
});
