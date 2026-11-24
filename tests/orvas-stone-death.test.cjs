const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function pick(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+1);return i>=0&&j>i?h.slice(i,j):''}
function shatter(wall=false,type='monsterStoneDavid',actorEffect=null){
 const orig={x:20.5,z:20.5,y:0};
 const p={p:[-.3,0,0,.3,.5,0,0,.2,.1],n:Array(9).fill(0),c:Array(9).fill(.5)};
 const c={facilitySite:{id:'base'},facilityCreekIndex:null,validPos:(x,z)=>x>=0&&z>=0,
  terrainY:()=>0,poiWalkCanStep:(x,z)=>!wall||x<=20,rot2:(x,z)=>[x,z],
  poiAimWall:()=> (x,z)=>!wall||x<=20,poiDavidMatch:o=>o.type==='monsterStoneDavid'?{y:0}:null,
  poiDavidIn:(_b,p)=>(!wall||p.x<20.5)&&p.y===0,poiMonsterPose:()=>orig,poiOrvasShatterFoley:()=>c.foley++,
  poiMonsterFragmentTemplate:()=>Array.from({length:6},(_,i)=>({part:p,cx:0,cy:.4,cz:0,heading:i,spin:2})),
  POI_MONSTER_BREAK_LIMIT:5,poiMonsterBreaks:[],poiMonsterMeshDirty:false,
  mesh:()=>({p:[],n:[],c:[]}),tri:(m,a,b,d,col)=>{m.p.push(...a,...b,...d);m.n.push(...Array(9).fill(0));m.c.push(...col,...col,...col);},foley:0,result:null};
 const code=pick('const POI_AIM_EPS=', 'function poiAimChooseLock')+
  pick('// BEGIN ORVAS SHATTER GEOMETRY','// END ORVAS SHATTER GEOMETRY')+pick('function poiMonsterBreak(', 'function poiMonsterClearBreaks(');
 Object.assign(c,{type,actorEffect});vm.createContext(c);
 const e=vm.runInContext(code+";poiMonsterBreak({type,x:20,z:20,y:0},{x:20,z:20,facing:0,hp:0},100,()=>.37,actorEffect)",c);
 return {e,c};
}
test('only the actual authored Orvas breaks into many small low stones with broad natural spacing',()=>{
 const {e,c}=shatter();
 assert(e?.orvasStone);
 assert(e.parts.length>=11&&e.parts.length<=15);
 assert(e.parts.every(p=>p.lift<=.09&&p.bounce<=.04&&p.ground===0&&p.centerY<.43));
 assert(e.parts.filter(p=>Math.hypot(p.dx,p.dz)>1.35).length>=6);
 assert(new Set(e.parts.map(p=>Math.floor(e.x+p.dx)+','+Math.floor(e.z+p.dz))).size>=8);
 assert.equal(c.foley,1);
 const ordinary=shatter(false,'monsterSlime');assert.equal(ordinary.e.parts.length,6);assert.equal(ordinary.c.foley,0);
 const actor=shatter(false,'monsterStoneDavid',{actor:'companion'});assert.equal(actor.e.parts.length,6);assert.equal(actor.c.foley,0);
});
test('not pushed through the first real wall or into another area',()=>{
 const {e,c}=shatter(true);
 assert(e.parts.length>=6);
 assert(e.parts.every(p=>e.x+p.dx<20.94));
 assert.equal(c.foley,1);
});
test('dedicated embedded heavy impact and irregular small floor contacts are bounded and distinct',()=>{
 const crypto=require('node:crypto'),m=h.match(/\n orvasStoneShatter:\s*((?:'[A-Za-z0-9+/=]+'\s*(?:\+\s*)?)+)/);
 assert(m);const pcm=Buffer.from([...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]).join(''),'base64');
 assert.equal(pcm.length,30720);
 assert.equal(crypto.createHash('sha256').update(pcm).digest('hex'),'1baf1fc978221f41547d63133e5162623d0720ff587c997d2daccb9839c376a1');
 const rms=(x,y)=>Math.sqrt(Array.from({length:y-x},(_,i)=>(pcm.readInt16LE(2*(x+i))/32768)**2).reduce((a,b)=>a+b)/(y-x));
 assert(rms(100,4500)>.06);
 for(const i of [4900,7100,9550,12150])assert(rms(i,i+1400)>.002);
 assert.equal(rms(14500,15360),0);
});
