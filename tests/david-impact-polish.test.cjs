const fs=require('node:fs'),a=require('node:assert/strict'),test=require('node:test'),vm=require('node:vm');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
function pcm(id){
 const match=h.match(new RegExp('\\n '+id+':\\n([^]*?)(?:,\\n|\\n};)'));
 a.ok(match,id+' has its own embedded authentic-contact master');
 return Buffer.from([...match[1].matchAll(/["']([A-Za-z0-9+/=]+)["']/g)].map(m=>m[1]).join(''),'base64');
}
test('different synchronized samples have long decaying bodies, sensible peak and silent tails',()=>{
 const normal=pcm('davidHeavyStomp'),leap=pcm('davidLeapStomp');
 a(normal.length>=48000&&leap.length>normal.length+9000&&leap.length<=76000);
 for(const sample of [normal,leap]){
  let peak=0,power=0;for(let i=0;i<sample.length;i+=2)peak=Math.max(peak,Math.abs(sample.readInt16LE(i)));
  a(peak>18000&&peak<29100);
  for(let i=38400;i<43200;i+=2)power+=(sample.readInt16LE(i)/32768)**2;
  a(power>.016,'low rumble remains after the prior 0.71s sample ended');
  a.equal(sample.readInt16LE(sample.length-2),0);
 }
 a.match(h,/q\.kind==='stomp'&&q\.davidLeapImpact\?'leapStomp'/);
 a.match(h,/poiDavidAttackFoley\(\{\.\.\.q,kind:'stomp',davidLeapImpact:true\},p,b,0,'impact'\)/);
});
test('actual ground impact creates both cracks, each at proper planted point and duration, without reduced-motion shake',()=>{
 const o={id:'base',davidTemple:{boss:{}}},ctx=vm.createContext({Math,Float32Array,facilitySite:o,poiWalkActive:true,poiWalkLevel:0,
 document:{hidden:false,querySelector:()=>null},poiDavidIn:()=>true,poiDavidLine:()=>true,poiAimOrigin:()=>({x:2,z:2,y:0}),
 poiEnemyCueReduced:{matches:false}});
 vm.runInContext(cut('// BEGIN DAVID STOMP IMPACT','// END DAVID GROUND FISSURE')+
 '\nthis.make=poiDavidImpactStomp;this.view=poiDavidImpactVp;this.inspect=()=>({crack:poiDavidFissure,impact:poiDavidImpact})',ctx);
 const q={kind:'stomp',sx:2,sz:2,dx:0,dz:1,y:0},now=1000;
 a(ctx.make(q,now));const normal=ctx.inspect().crack;a.equal(normal.radius,6);a(normal.x<2.2);
 a(ctx.make({...q,davidLeapImpact:true},now));const leap=ctx.inspect().crack;a.equal(leap.radius,8);a(leap.x>2.20&&leap.x<2.65);
 a(leap.quakeMs>normal.quakeMs&&normal.quakeMs>550&&leap.fissureMs>normal.fissureMs);
 const frame={halfH:7,vp:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])};
 a.notEqual(ctx.view(frame,now+435),frame.vp);
 ctx.poiEnemyCueReduced.matches=true;a.equal(ctx.view(frame,now+435),frame.vp);
 a.equal(ctx.view(frame,now+leap.quakeMs+1),frame.vp);
});
