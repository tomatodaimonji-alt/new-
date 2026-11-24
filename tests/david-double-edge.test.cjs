const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)};
const calc=vm.runInNewContext(cut('function tri(m,a,b,c,col){','function rot2(x,z,r)')+
 cut('// BEGIN STONE DAVID VISUAL','// END STONE DAVID VISUAL')+`
 (pose)=>{const m={p:[],n:[],c:[]};const rig=poiDavidGeometry(m,0,0,0,pose);return JSON.stringify({m,rig})}`);
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const norm=a=>{const n=Math.hypot(...a);assert(n>0);return a.map(x=>x/n)};
const round=x=>Math.abs(x)<1e-9?0:x;
function vertices(g,i){
 const origin=g.rig.hands[i],tip=g.rig.swordTips[i],axis=norm(sub(tip,origin)),edges=[],flats=[];
 for(let j=0;j<g.m.p.length;j+=3){
  const point=sub(g.m.p.slice(j,j+3),origin);
  if(Math.abs(dot(point,axis)-2.68)>1e-6)continue;
  const radius=Math.sqrt(Math.max(0,dot(point,point)-2.68**2));
  if(Math.abs(radius-.16)<1e-7)edges.push(norm(sub(point,axis.map(x=>x*2.68))).map(round));
  if(Math.abs(radius-.068)<1e-7)flats.push(norm(sub(point,axis.map(x=>x*2.68))).map(round));
 }
 assert(edges.length>=2&&flats.length>=2,'must locate actual taper rim vertices of each wielded sword');
 return {edges,flats,axis};
}
test('the wide cutting bevel, not the sword flat, meets both ordered real descending contacts',()=>{
 const times=[720,1040],draw=t=>JSON.parse(calc({kind:'double',phase:'windup',elapsed:t,hitTimes:times}));
 const held=draw(500);
 for(let i=0;i<2;i++){
  const t=times[i],pre=draw(t-33),strike=draw(t),now=strike.rig.swordTips[i];
  const {edges,flats,axis}=vertices(strike,i),velocity=sub(now,pre.rig.swordTips[i]);
  const motion=norm(sub(velocity,axis.map(x=>x*dot(velocity,axis))));
  assert(velocity[1]<0,'physical descending motion is not changed');
  assert(edges.some(e=>dot(e,motion)>.96),'sharp bevel leads actual descending trajectory');
  assert(flats.every(e=>Math.abs(dot(e,motion))<.2),'flat is not chasing trajectory');
  for(const f of [held,pre,strike]){
   for(let slot=0;slot<2;slot++)assert(Math.abs(Math.hypot(...sub(f.rig.swordTips[slot],f.rig.hands[slot]))-3.1)<1e-9);
  }
 }
 assert.deepEqual(draw(720).rig.swordTips[1],held.rig.swordTips[1],'other sword is still up for second impact');
});
