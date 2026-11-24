const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);if(i<0||j<=i)throw Error('missing '+a);return h.slice(i,j)};
function rig(){
 const f={x:25,z:107,y:0}, s={poiWalkActive:true,poiWalkLevel:0,pineAIActive:false,pineCheckMode:false,
  facilitySite:{id:'base',davidTemple:{boss:{y:0}}},poiEnemyCueReduced:{matches:false},document:{hidden:false,querySelector:()=>null},
  player:f,poiAimOrigin:()=>f,poiDavidIn:()=>true,poiDavidLine:()=>true,terrainY:()=>0,
  poiDavidRig:()=>({feet:[[-.56,0,.20],[-.56,0,.20]]}),poiDavidRoomOpenAt:()=>true};
 const c=vm.createContext(s);vm.runInContext(cut('function tri(m,a,b,c,col){','function rot2(x,z,r)')+
   cut('// BEGIN DAVID STOMP IMPACT','// END DAVID STOMP IMPACT'),c);
 return {c,run:s=>vm.runInContext(s,c)};
}
test('only an actual stomp can latch; dust starts at right heel, remains low and grows over terrain',()=>{
 const {run}=rig();
 const q="{kind:'stomp',sx:24,sz:104,dx:0,dz:1,y:0}";
 a.equal(run('poiDavidImpactStomp({...'+q+",kind:'beam'},400)"),false);
 a.equal(run(`poiDavidImpactStomp(${q},400)`),true);
 const event=JSON.parse(run('JSON.stringify(poiDavidImpact)'));
 a.ok(Math.abs(event.x-23.94)<1e-9&&Math.abs(event.z-104.70)<1e-9);
 const dust=age=>JSON.parse(run(`(()=>{const m={p:[],n:[],c:[]};poiDavidDustGeometry(m,poiDavidImpact,${age});return JSON.stringify(m.p)})()`));
 const extent=d=>Math.max(...d.filter((_,i)=>i%3===0).map(x=>Math.abs(x-event.x)));
 const early=dust(28),late=dust(300);
 a.ok(early.length>50&&late.length<=750);
 a.ok(extent(late)>extent(early)+1.1);
 a.ok(late.filter((_,i)=>i%3===1).every(y=>y>=0&&y<.49));
});
test('shake takes only a copy of visible projection, is tiny, decays and obeys menu/photo/floor/reduced motion',()=>{
 const {c,run}=rig();
 run("poiDavidImpactStomp({kind:'stomp',sx:24,sz:104,dx:0,dz:1,y:0},400);this.m=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);");
 const get=()=>JSON.parse(run('JSON.stringify(Array.from(poiDavidImpactVp({vp:m,halfH:9},420)))'));
 const changed=get();a.ok(Math.abs(changed[13])>.0001&&Math.abs(changed[13])<.011);
 a.equal(run('m[13]'),0);
 for(const [key,v] of [['poiScreenNotePhase','capture'],['poiWalkLevel',1],['pineAIActive',true],['pineCheckMode',true],['poiEnemyCueReduced',{matches:true}]]){
  const old=c[key];c[key]=v;a.equal(get()[13],0,key);c[key]=old;
 }
 c.document.querySelector=()=>({open:true});a.equal(get()[13],0);
 c.document.querySelector=()=>null;
 a.equal(run('poiDavidImpactVp({vp:m,halfH:9},1110)===m'),true);
});
test('contact is wired only after the live attack advances; the native draw uses one pooled buffer and restores blend state',()=>{
 const part=cut('function poiDavidCombatFrame(now){','function poiDavidPose(s,now){');
 a.equal(part.split('poiDavidImpactStomp(q,now)').length,2);
 a.match(part,/q\.executed\+\+;q\.lastContactAt=now;poiMonsterMeshDirty=true;\s+if\(q\.kind==='stomp'&&typeof poiDavidImpactStomp==='function'\)poiDavidImpactStomp\(q,now\)/);
 const {c,run}=rig(),calls=[];
 c.mesh=()=>({p:[],n:[],c:[]});c.upload=(m,reuse)=>{calls.push(['upload',m.p.length,reuse]);return {buf:'puff'}};
 c.draw=m=>calls.push(['draw',m.buf]);
 c.gl={BLEND:'blend',DYNAMIC_DRAW:'dynamic',CONSTANT_ALPHA:'ca',ONE_MINUS_CONSTANT_ALPHA:'1-ca',SRC_ALPHA:'sa',ONE_MINUS_SRC_ALPHA:'1-sa'};
 for(const f of ['enable','disable','blendColor','blendFunc','depthMask','deleteBuffer'])c.gl[f]=(...args)=>calls.push([f,...args]);
 run("poiDavidImpactStomp({kind:'stomp',sx:24,sz:104,dx:0,dz:1,y:0},400);");
 run('poiDrawDavidImpact(426,null);poiDrawDavidImpact(440,null);poiDrawDavidImpact(470,null);');
 a.deepEqual(calls.filter(c=>c[0]==='upload').map(c=>c[2]),[undefined,'puff'],'two geometry samples share the one actual GPU allocation');
 a.equal(calls.filter(c=>c[0]==='draw').length,3);
 a.deepEqual(calls.slice(-4),[['depthMask',true],['blendFunc','sa','1-sa'],['blendColor',0,0,0,0],['disable','blend']]);
 run('poiDrawDavidImpact(1106,null)');a.deepEqual(calls.at(-1),['deleteBuffer','puff']);
});
