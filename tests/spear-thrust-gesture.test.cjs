const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2]||process.env.HTML||'world-editor.html','utf8');
const cut=(u,v)=>{const i=h.indexOf(u),j=h.indexOf(v,i+u.length);a(i>=0&&j>i,u);return h.slice(i,j)};
const api=vm.runInNewContext(cut('function characterArmRotation(','function roundStack(')+
 cut('// BEGIN WORLD PLAYER SPEAR','// END WORLD PLAYER SPEAR')+
 ';({pose:poiWorldSpearPose,line:poiWorldSpearLine,arm:characterArmRotation})');
const profile={range:3,hit:240,pose:410};
function sample(ms){
 const p=api.pose(profile,ms);
 const [hx,hy,hz]=api.arm(p.strike,p.sweep)(0,.55-.965,.028);
 const c=Math.cos(p.twist),s=Math.sin(p.twist);
 const g={x:(.272+hx)*c-hz*s,y:(.965+hy)*.90,z:hz*c+(.272+hx)*s};
 return {p,g,...api.line(p,g)};
}
test('clear cocking motion pulls the live hand and tip back before the big straight jab',()=>{
 const ready=sample(148),cocked=sample(166),first=sample(190),second=sample(216),strike=sample(240);
 a(cocked.g.z<-.32);
 a(strike.g.z>.41&&strike.g.z-cocked.g.z>.75);
 a(Math.abs(ready.tip[2]-cocked.tip[2])<.03,'readable held draw');
 a(strike.tip[2]-cocked.tip[2]>1.25,'large pull and thrust');
 a(cocked.tip[2]<first.tip[2]&&first.tip[2]<second.tip[2]&&second.tip[2]<strike.tip[2]);
 a(Math.max(cocked.tip[1],first.tip[1],second.tip[1],strike.tip[1])-Math.min(cocked.tip[1],first.tip[1],second.tip[1],strike.tip[1])<.12);
});
test('whole shoulder rotates and the tip thrusts straight, pauses at precise hit, and recoils on the same line',()=>{
 const wind=sample(166),contact=sample(240),hold=sample(274),back=sample(327);
 a(wind.p.twist<-.20&&contact.p.twist>.20);
 a(Math.abs(contact.tip[2]-3)<1e-8&&Math.abs(hold.tip[2]-3)<1e-8);
 a(back.tip[2]<2&&Math.abs(back.tip[1]-contact.tip[1])<.15);
 for(const t of [0,95,148,166,190,216,240,274,327,390]){
  const {tip,rear}=sample(t);
  a(Math.abs(Math.hypot(...tip.map((v,i)=>v-rear[i]))-3.24)<1e-7,'not a growing or shrinking pole');
 }
 a.match(h,/equipWoodSpear:\{range:3,damage:24,tipLength:\.75,shaftScale:\.75,hit:240,ready:540,pose:410/);
});
