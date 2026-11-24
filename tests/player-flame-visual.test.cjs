const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),slice=(x,y)=>h.slice(h.indexOf(x),h.indexOf(y,h.indexOf(x)+1));
function setup(){
 const meshes=()=>({p:[],n:[],c:[]});
 const moves=[],buffers=[],ctx={mesh:meshes,tri(m,...v){m.p.push(...v[0],...v[1],...v[2]);m.c.push(v[3]);},
  gl:{BLEND:'blend',CONSTANT_ALPHA:'const',ONE:'one',SRC_ALPHA:'src',ONE_MINUS_SRC_ALPHA:'inv',enable:x=>moves.push(['on',x]),
   disable:x=>moves.push(['off',x]),blendColor:(...p)=>moves.push(['color',...p]),blendFunc:(...p)=>moves.push(['fn',...p]),
   depthMask:x=>moves.push(['depthMask',x]),deleteBuffer:x=>moves.push(['delete',x])},
  upload:(_mesh,prior)=>{buffers.push(prior);return {buf:1,count:1}},draw:()=>{throw Error('fake GL loss')}};
 const api=vm.runInNewContext(slice('function poiPlayerFireGeometry','function poiAppendWeaponProjectile')+
   ';({fire:poiPlayerFireGeometry,glow:typeof poiDrawPlayerFireGlow===\"function\"?poiDrawPlayerFireGlow:null})',ctx);
 const fire=(now,impact,dir=[1,0])=>{const m=meshes();api.fire(m,{x:0,y:0,z:0,dx:dir[0],dz:dir[1]},now,impact);return m};
 return {fire,moves,buffers,api};
}
function dims(p){
 const ax=i=>p.filter((_,j)=>j%3===i);
 return [0,1,2].map(i=>Math.max(...ax(i))-Math.min(...ax(i)));
}
test('player flame is visibly longer and broader with an above-daylight warm core',()=>{
 const {fire}=setup();const m=fire(140),d=dims(m.p);
 a(d[0]>1.45&&d[1]>.55&&d[2]>.50,JSON.stringify(d));
 a(m.c.some(c=>c[0]>1.3&&c[1]>1.05&&c[2]>.28),'bright ivory-gold inner core');
 a(m.c.some(c=>c[0]>c[1]*2&&c[2]<.12),'warm orange edge remains distinct');
 a(m.p.length/9<65,'bound cost per visible frame');
});
test('flicker changes shape and brightness, angular flight remains normalized',()=>{
 const {fire}=setup(),early=fire(32),late=fire(83),diagonal=fire(32,undefined,[.6,.8]);
 a.notDeepEqual(early.p,late.p);a.notDeepEqual(early.c,late.c);
 const p=early.p,q=diagonal.p;
 for(let i=0;i<p.length;i+=3){
  a(Math.abs(q[i]-.6*p[i]+.8*p[i+2])<1e-8);
  a(Math.abs(q[i+2]-.8*p[i]-.6*p[i+2])<1e-8);
 }
});
test('impact adds a luminous warm spread, then fully disappears on the original envelope',()=>{
 const {fire}=setup(),flight=fire(120),impact=fire(142,120),end=fire(280,120);
 a(impact.p.length>flight.p.length,'extra embers only on impact');
 a(dims(impact.p)[2]>dims(flight.p)[2]);
 a(impact.fireGlow?.p.length>0);
 a.equal(end.p.length,0);
});
test('small additive halo restores blend/depth state even if its draw fails',()=>{
 const {fire,moves,buffers,api}=setup(),glow=fire(100).fireGlow;
 a(glow?.p.length>0&&glow.p.length/9<=16&&glow.alpha>0&&glow.alpha<.30);
 a.throws(()=>api.glow(glow,[]),/fake GL loss/);
 a(moves.some(x=>x[0]==='depthMask'&&x[1]===false));
 a(moves.some(x=>x[0]==='depthMask'&&x[1]===true));
 a.deepEqual(moves.at(-1),['off','blend']);
 a.throws(()=>api.glow(glow,[]),/fake GL loss/);
 a.deepEqual(buffers,[null,1],'halo GL allocation is reused');
 a(!moves.some(x=>x[0]==='delete'));
});
