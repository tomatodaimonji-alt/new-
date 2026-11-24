const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const c=vm.createContext({POI_DAVID_EYE_Y:4.75,POI_DAVID_EYE_FRONT:.29,POI_DAVID_AWAKENING:{first:920,second:1840,ready:2440,eyes:320},
 poiDavidLeapBodyY:y=>y,tri:(m,a,b,d)=>m.tris.push([a,b,d]),quad:()=>{}});
vm.runInContext(s.slice(s.indexOf('const POI_DAVID_BLADE='),s.indexOf('// END STONE DAVID VISUAL')),c);
const walking=(d=0,amount=1,phase='ready')=>({phase,kind:null,walkDistance:d,walkAmount:amount});
const sample=p=>{
 const m={tris:[]},r=c.poiDavidGeometry(m,0,0,0,p);
 const blades=Array.from(r.swordTips,(tip,i)=>{
  const ring=m.tris.filter(t=>t[2].every((v,j)=>Math.abs(v-tip[j])<1e-8));
  assert.equal(ring.length,4,'four genuine bevel facets must meet the original tip');
  const vert=ring.map(t=>t[0]);
  return {tip:[...tip],hand:[...r.hands[i]],edge:vert[2].map((v,j)=>v-vert[0][j]),face:vert[1].map((v,j)=>v-vert[3][j])};
 });
 return {blades,mesh:m.tris};
};
test('walking and returning bevel edges are above/below, not the broad faces; unchanged shaft and gait',()=>{
 for(const phase of ['ready','return']) for(let n=0;n<=16;n++) {
  const {blades}=sample(walking(n*.24,1,phase));
  for(const [i,b] of blades.entries()){
   assert.ok(b.edge[1]>.245,JSON.stringify(b));
   assert.ok(Math.abs(b.face[1])<1e-8,JSON.stringify(b));
   const dir=b.tip.map((v,j)=>(v-b.hand[j])/3.1);
   const len=Math.hypot(.13,.59,.8),expected=[(i?1:-1)*.13/len,-.59/len,.8/len];
   dir.forEach((v,j)=>assert.ok(Math.abs(v-expected[j])<1e-8,'original point direction and length'));
  }
 }
});
test('roll eases during first windup but not contact, later attack, dormant or blade extraction',()=>{
 const walkingMesh=sample(walking(.82));
 for(const kind of ['sweep','double','stomp','beam','leap']){
  const start={kind,phase:'windup',progress:0,contact:0,elapsed:0};
  const q=sample({...walking(.82),...start});
  for(let i=0;i<2;i++){
   const {edge,tip,hand}=q.blades[i],vanilla=sample(start).blades[i];
   assert.ok(edge[1]>.19);
   assert.deepEqual(tip,vanilla.tip);
   assert.deepEqual(hand,vanilla.hand);
  }
  for(const phase of ['windup','impact','recover']){
   const u={kind,phase,progress:.47,contact:1,elapsed:390};
   assert.deepEqual(sample({...walking(),...u}).mesh,sample(u).mesh);
  }
 }
 assert.ok(walkingMesh.blades[0].edge[1]>.245);
 for(const phase of ['dormant','wake']){
  const q={phase,kind:null,wakeAge:840};
  assert.deepEqual(sample({...walking(),...q}).mesh,sample(q).mesh);
 }
});
test('idle armed boss and ally carry actual cutting edges in walking orientation with lowest resting tip still clear of ground',()=>{
 for(const phase of ['ready','idle','return']) for(const amount of [0,.001,.4,1]){
  const {blades}=sample(walking(0,amount,phase));
  for(const [i,b] of blades.entries()){
   assert.ok(b.edge[1]>.245,JSON.stringify({phase,amount,i,...b}));
   assert.ok(Math.abs(b.face[1])<1e-8);
   assert.ok(b.tip[1]>.48);
   if(amount===0)assert.deepEqual(b.hand,[(i?1:-1)*1.22,2.37,.26]);
   const len=Math.hypot(.13,.59,.8),expected=[(i?1:-1)*.13/len,-.59/len,.8/len];
   b.tip.forEach((v,j)=>assert.ok(Math.abs((v-b.hand[j])/3.1-expected[j])<1e-8));
  }
 }
});
