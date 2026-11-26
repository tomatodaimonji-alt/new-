const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'candidate.html','utf8');
function fixture(){
 const i=h.indexOf('// BEGIN FRONTIER PARTY QUIET IDLE'),j=h.indexOf('// END FRONTIER PARTY QUIET IDLE');
 a(i>=0&&j>i,'idle is a real actor-controller block');
 const site={id:'frontier'},x={id:'h1',x:2,z:0,y:0,site},y={id:'h2',x:2,z:1,y:0,site};
 const p={x:0,z:0,y:0},c={facilitySite:site,poiWalkLevel:0,poiWalkStarted:-1e9,poiFreePose:null,poiPartyActors:()=>[x,y],
 frontierLifeSpeech:new Map(),POI_HUMAN_PARTY_IDS:{h1:'frontierchief',h2:'frontiersera'},poiCompanionAttackClear:()=>true,
 poiCompanionPosition:a=>({x:a.px??a.x,z:a.pz??a.z}),poiHumanSidestepClear:()=>!c.wall,poiFreeCell:Math.round};
 vm.createContext(c);vm.runInContext(h.slice(i,j),c);
 const tick=(actor,t,goal=null,hp=100)=>c.frontierQuietParty(actor,{hp},p,c.poiCompanionPosition(actor),t,goal);
 return {x,y,p,c,tick};
}
test('occasional nearby allies exchange distinct short lines without overriding heal',()=>{
 const {x,y,tick,c}=fixture();tick(x,0);tick(y,0);
 tick(x,7599);a.equal(c.frontierLifeSpeech.size,0);tick(x,7600);
 const first=c.frontierLifeSpeech.get('frontierchief');a(first?.text.includes('足'));
 tick(y,9950);const answer=c.frontierLifeSpeech.get('frontiersera');a(answer?.text&&answer.text!==first.text);
 c.frontierLifeSpeech.set('frontierchief',{kind:'heal',actor:x,until:12000,text:'薬草'});
 tick(x,11100,{x:4,z:0});a.equal(c.frontierLifeSpeech.get('frontierchief').text,'薬草');
});
test('only a deliberate collision-safe micro step; no movement on block, combat or player input',()=>{
 const {x,tick,c}=fixture();tick(x,0);tick(x,7600);
 a(tick(x,25400));const start={x:x.x,z:x.z};tick(x,26095);
 a(Math.hypot(x.px-start.x,x.pz-start.z)<=.085001);
 c.wall=true;const point=[x.px,x.pz];a(!tick(x,26110));a.deepEqual([x.px,x.pz],point);
 c.poiFreePose={walking:true};a(!tick(x,26200));a.equal(x.frontierQuiet,null);
 c.poiFreePose=null;x.attackMotion={pending:true};a(!tick(x,28000));a.equal(x.frontierQuiet,null);
 a.match(h,/if\(typeof frontierQuietParty==='function'&&frontierQuietParty\(a,member,player,origin,now,goal\)\)return;/);
});
