const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const s=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=s.indexOf(x),j=s.indexOf(y,i+1);a(i>=0&&j>i,x);return s.slice(i,j)};
test('successful slime FX captures actual debris and reverses from exact settled phase before chasing live pose',()=>{
 const c=vm.createContext({POI_MONSTER_FLIGHT_MS:760});
 vm.runInContext(cut('// BEGIN COMPANION SOUL FX','// END COMPANION SOUL FX'),c);
 const e={x:23.62,y:.20,z:12.49,floor:0,start:100,parts:[{}],type:'monsterSlime'};
 const f={start:100,arrives:2520};
 const sample=(now,p=[30,1,12])=>c.poiCompanionFxFrame(e,f,now,p);
 for(const [t,phase,q] of [[100,'fracture',0],[860,'gather',1],[1360,'silhouette',0],[1640,'flight',undefined],[2520,'absorbed',undefined]]){
  const v=sample(t);a.equal(v.stage,phase);if(q!==undefined)a.equal(v.debris,q);
 }
 a(sample(950).debris>sample(1220).debris);
 a.equal(sample(1640).position[0],e.x);
 const a1=sample(2410).position,b1=sample(2410,[28,1,16]).position;
 a(a1[0]>b1[0]+1&&b1[2]>a1[2]+2);
 a.deepEqual(Array.from(sample(2520,[29,1.10,13]).position),[29,1.1,13]);
});
test('reservation owns precisely one emitted break and reentrant rendering shares one buffer; no draw across worlds',()=>{
 const f={start:100,arrives:2520},origin={x:2.52,y:0,z:3.57,floor:0,start:100,parts:[{actual:true}],type:'monsterSlime'};
 const base={id:'base'},draws=[],uploads=[],glTrace=[],vertices=[];
 const c=vm.createContext({POI_MONSTER_FLIGHT_MS:760,poiCompanionSoulFlight:()=>f,facilitySite:base,world:[],poiWalkLevel:0,poiWalkActive:true,
  poiMonsterMeshDirty:false,poiWalkViewX:6,poiWalkViewZ:4,poiCreekPlayerHeight:()=>0,poiAudioAllowed:()=>true,
  mesh:()=>({p:[],n:[],c:[]}),tri:(m,...t)=>m.p.push(...t[0],...t[1],...t[2]),
  poiMonsterAppendDebris(m,e,t){draws.push({e,t});m.p.push(0,0,0);m.c.push(.4,.6,.7);},
  upload(m,old){uploads.push(old);vertices.push(m.p.length/3);return {buf:old??{},count:m.p.length/3}},
  draw(){},gl:{DYNAMIC_DRAW:1,BLEND:2,CONSTANT_ALPHA:3,ONE_MINUS_CONSTANT_ALPHA:4,SRC_ALPHA:5,ONE_MINUS_SRC_ALPHA:6,
   enable(){},disable(){},blendColor(){},blendFunc(){},depthMask:x=>glTrace.push(x)}
 });
 vm.runInContext(cut('// BEGIN COMPANION SOUL FX','// END COMPANION SOUL FX'),c);
 a.equal(c.poiCompanionFxAttach(origin,{...f}),false,'must match exact committed object');
 a.equal(c.poiCompanionFxAttach({...origin,type:'monsterGoblin'},f),false);
 a(!origin.soulFx);a.equal(c.poiCompanionFxAttach(origin,f),true);a(origin.soulFx&&c.poiMonsterMeshDirty);
 a.equal(c.poiCompanionFxAttach(origin,f),false,'one attachment');
 for(const t of [500,860,1100,1400,2200])c.poiCompanionFxDraw(t,{});
 a(draws.every(d=>d.e===origin));a.equal(draws[1].t,1);a(draws[2].t<1);
 a.equal(uploads.length,5);a.equal(new Set(uploads.slice(1)).size,1);
 a(vertices.every(n=>n<=120));a.deepEqual(glTrace,[false,true]);
 a.equal(c.poiCompanionFxSnapshot().stage,'flight');const before=c.poiCompanionFxSnapshot().position;
 c.poiWalkViewZ=7;c.poiCompanionFxDraw(2370,{});
 a(c.poiCompanionFxSnapshot().position[2]>before[2]+1);
 c.world=[];c.poiCompanionFxDraw(2380,{});a.equal(c.poiCompanionFxSnapshot(),null);
 a.match(s,/if\(effect\.soulFx\|\|/);
});
