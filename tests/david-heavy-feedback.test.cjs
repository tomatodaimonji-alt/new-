const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const leapRadius=Number(h.match(/POI_DAVID_LEAP_RADIUS=([0-9.]+)/)?.[1]);
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
function setup(){
 const b={y:0},s={david:{gaitDistance:0},x:1,z:0,fromX:0,fromZ:0,moveStarted:0,guardMoveMs:240},heard=[];
 const c={POI_DAVID_LEAP_RADIUS:leapRadius,facilitySite:{id:'base',davidTemple:{boss:b}},poiWalkActive:true,document:{hidden:false,querySelector:()=>null},
  poiAudioEnabled:true,poiAudioAllowed:()=>true,poiAudioLevels:{master:1,se:1},poiWalkLevel:0,poiEnemyCueReduced:{matches:false},
  poiEnemyThreatEnabled:()=>c.active,active:true,poiDavidHidden:()=>c.document.hidden,
  poiDavidIn:()=>true,poiDavidLine:()=>c.clear,clear:true,poiAimOrigin:()=>c.listener,listener:{x:3,z:0,y:0},
  poiAudioStart(){},poiAudioContext:{state:'running',currentTime:2},poiDavidTrackAttackFoley(){},poiTryRecordedFoley:(name,t,gain)=>heard.push({name,t,gain})};
 const u=vm.runInNewContext(cut('const POI_DAVID_GAIT_STRIDE=','function poiDavidRig(')+cut('// BEGIN DAVID STOMP IMPACT','function poiDavidDustGeometry')+
  ';({foot:typeof poiDavidFootFeedback==="function"?poiDavidFootFeedback:null,contact:typeof poiDavidHeavyContact==="function"?poiDavidHeavyContact:null,stomp:poiDavidImpactStomp,view:poiDavidImpactVp})',c);
 return {b,s,c,u,heard};
}
test('a real gait boundary, not tile starts nor redraws, sounds once; blocked or hidden time does not replay',()=>{
 const {b,s,c,u,heard}=setup();
 for(const t of [10,100,230])u.foot({},s,b,t);
 a.equal(heard.length,0);
 Object.assign(s,{x:2,fromX:1,moveStarted:250});s.david.gaitDistance=1;
 for(const t of [250,350,460,460,470,540,600])u.foot({},s,b,t);
 a.equal(heard.length,1);a.equal(heard[0].name,'davidFootPlant');
 a(heard[0].gain>0&&heard[0].gain<.39);
 Object.assign(s,{x:3,fromX:2,moveStarted:550});s.david.gaitDistance=2;
 u.foot({},s,b,700);a.equal(heard.length,1);
 c.document.hidden=true;
 Object.assign(s,{x:4,fromX:3,moveStarted:800});s.david.gaitDistance=3;
 u.foot({},s,b,1040);c.document.hidden=false;u.foot({},s,b,1041);
 a.equal(heard.length,1);
});
test('minor contacts leave camera state intact, reduce-motion disables shake, leap landing is stronger than ordinary stomp',()=>{
 const {b,c,u}=setup(),q={kind:'stomp',sx:2,sz:0,y:0,dx:1,dz:0}, vp=new Float32Array(16);
 vp[15]=1; const f={halfH:8,vp};
 a(u.contact('sweep',q,1000,b));
 const fine=u.view(f,1016);a.notEqual(fine,vp);a.equal(vp[13],0);
 c.poiEnemyCueReduced.matches=true;a.equal(u.view(f,1016),vp);
 c.poiEnemyCueReduced.matches=false;
 a(u.stomp(q,1200));const ordinary=Math.abs(u.view(f,1216)[13]);
 a(u.stomp({...q,davidLeapImpact:true},1400));const heavy=Math.abs(u.view(f,1416)[13]);
 a(heavy>ordinary&&ordinary>Math.abs(fine[13]));
 c.document.hidden=true;a.equal(u.view(f,1416),vp);
 c.document.hidden=false; c.listener={x:45,z:0,y:0};
 a.equal(u.contact('beam',q,1600,b),false);a.equal(u.view(f,1616),vp);
});
test('the new offline foot plant recording is bundled exactly at the verified master',()=>{
 const list=vm.runInNewContext(cut('const POI_RECORDED_FOLEY={','const poiRecordedFoleyCache')+';POI_RECORDED_FOLEY');
 const raw=Buffer.from(list.davidFootPlant??'','base64');a.equal(raw.length,14880);
 a.equal(crypto.createHash('sha256').update(raw).digest('hex'),'69c7e73802b4f46704384aca18d26ee3497f2ff5453226c05d743f530ac29424');
});
