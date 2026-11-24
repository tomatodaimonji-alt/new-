const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function harness(){
 const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);if(i<0||j<=i)throw Error('missing real renderer '+a);return h.slice(i,j)};
 const w=vm.createContext({});
 vm.runInContext(cut('function tri(m,a,b,c,col){','function rot2(x,z,r)')+cut('// BEGIN STONE DAVID VISUAL','// END STONE DAVID VISUAL'),w);
 return vm.runInContext(`((kind,phase,progress=0,contact=0,elapsed)=>{
  const p={kind,phase,progress,contact,elapsed},m={p:[],n:[],c:[]};
  const rig=poiDavidGeometry(m,0,0,0,p);
  return JSON.stringify({m,rig});
 })`,w);
}
const contact=(f,k,n=1)=>JSON.parse(f(k,'impact',0,n));
const d=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('authored giant dormant mesh is stable and uses no red color till awakened',()=>{
 const f=harness(),a0=JSON.parse(f(null,'dormant')),a1=f(null,'dormant',1);
 a.equal(JSON.stringify(a0),a1);
 a.ok(a0.m.p.length<4500,`coords=${a0.m.p.length}`);
 a.ok(a0.m.p.every(Number.isFinite)&&a0.m.n.every(Number.isFinite));
 const height=Math.max(...a0.m.p.filter((_,i)=>i%3===1));
 a.ok(height>4.8&&height<5.3);
 assertNoRed(a0.m.c);
 a.ok(JSON.parse(f(null,'wake',1)).m.c.some((v,i,c)=>i%3===0&&v>.90&&c[i+1]<.30));
});
function assertNoRed(c){a.ok(!c.some((v,i)=>i%3===0&&v>.90&&c[i+1]<.30))}
test('both swords stay absolutely rigid across windups/contact, and sweep tip reaches registered hit extent',()=>{
 const f=harness(),frames=['sweep','double','stomp','beam'].flatMap(k=>['windup','impact','recover'].flatMap(ph=>[0,.5,1].map(t=>JSON.parse(f(k,ph,t,ph==='impact'?1:0)).rig)));
 for(const r of frames)for(let i=0;i<2;i++)a.ok(Math.abs(d(r.hands[i],r.swordTips[i])-3.1)<1e-8);
 const {rig}=contact(f,'sweep');a.ok(rig.swordTips.some(([x,_y,z])=>Math.abs(Math.hypot(x,z)-4.2)<.12));
 const raised=JSON.parse(f('double','windup',1)).rig;
 a.ok(raised.swordTips.every(p=>p[1]>5.8));
 const one=contact(f,'double',1).rig,two=contact(f,'double',2).rig;
 a.ok(one.swordTips[0][1]<.4&&one.swordTips[1][1]>5);
 a.ok(two.swordTips.every(([x,y,z])=>Math.abs(x)<1.5&&y<.4&&z>.55&&z<=3.55));
});
test('right foot visibly raises for stomp and touches ground at contact; red beam eyes hold the advertised exact origin',()=>{
 const f=harness(),r=JSON.parse(f('stomp','windup',1)).rig;
 a.ok(r.feet[0][1]>.93);a.equal(r.feet[1][1],0);
 a.deepEqual(contact(f,'stomp').rig.feet.map(p=>p[1]),[0,0]);
 a.deepEqual(contact(f,'beam').rig.eyes.map(p=>p.slice(1)),[[4.75,.29],[4.75,.29]]);
});

test('clocked double blade descends into actual rendered one-tip contact before the second landed strike',()=>{
 const f=harness(),frame=(elapsed)=>JSON.parse(f('double','windup',0,0,elapsed));
 const up=frame(500),middle=frame(625),landed=frame(720),other=frame(1040);
 a.ok(up.rig.swordTips[0][1]>middle.rig.swordTips[0][1]&&middle.rig.swordTips[0][1]>landed.rig.swordTips[0][1]);
 a.deepEqual(landed.rig.swordTips[1],up.rig.swordTips[1]);
 for(const {m,rig} of [up,middle,landed,other])for(const tip of rig.swordTips){
  a.ok(m.p.some((_,i)=>i%3===0&&d(m.p.slice(i,i+3),tip)<1e-10),'tip is a real mesh vertex, not only animation metadata');
 }
 a.ok(other.rig.swordTips.every(p=>p[1]<.35));
});
