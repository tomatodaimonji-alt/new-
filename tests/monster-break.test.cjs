const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function harness(){
 const a=html.indexOf('const POI_MONSTER_BREAK_MS='),b=html.indexOf('function poiWalkFrame(',a);
 assert.ok(a>=0&&b>a,'death burst helper missing');
 const draws=[],renders=[],calls=[];
 const ctx=vm.createContext({renders,world:[],facilitySite:{id:'base'},poiWalkLevel:0,poiWalkActive:true,
  poiMonsterStates:new Map(),poiMonsterMesh:null,poiMonsterMeshLast:-10000,poiMonsterMeshDirty:true,
  gl:{deleteBuffer(){}},mesh:()=>({p:[],n:[],c:[]}),terrainY:(x,z)=>z===22?.4:0,validPos:(x,z)=>x>=0&&z>=0&&x<96&&z<56,poiWalkCanStep:(x,z)=>x!==12,facilityCreekIndex:{water:new Set(['10,20'])},rot2:(x,z)=>[x,z],
  deco(m,id){
   calls.push(id);
   for(let i=0;i<12;i++){
    const c=Math.cos(i*Math.PI/6),s=Math.sin(i*Math.PI/6);
    m.p.push(c*.5,.06,s*.5,c*.4,i<2?.45:.24,s*.4,c*.45,.19,s*.45);
    m.n.push(c,0,s,c,0,s,c,0,s);
    m.c.push(.4,.7,.9,.4,.7,.9,.4,.7,.9);
   }
  },
  upload:m=>{renders.push(m);return {...m,buf:{}}},draw:m=>draws.push(m)});
  const attack=html.match(/\/\/ BEGIN SLIME ATTACK\n([\s\S]*?)\/\/ END SLIME ATTACK/);
 assert.ok(attack,'slime attack pose is present');
 vm.runInContext(attack[1]+html.slice(a,b),ctx);
 return {ctx,renders,draws,calls,run:s=>vm.runInContext(s,ctx)};
}
test('a dying slime reuses its colored model triangles, scatters, and vanishes from the render batch',()=>{
 const {run,renders,calls}=harness();
 run("poiMonsterBreak({type:'monsterSlime',x:11,z:20,y:0},{x:11,z:20,moveStarted:-10000,hp:0},100);poiMonsterRender(100,null)");
 assert.deepEqual(calls,['monsterSlime']);
 const p=renders.at(-1);assert.equal(p.p.length,108);assert.equal(p.c[0],.4);assert.equal(p.c[1],.7);assert.equal(p.c[2],.9);
 run('poiMonsterRender(125,null)');assert.equal(renders.length,1,'same existing render cadence guard');
 run('poiMonsterRender(350,null)');
 const q=renders.at(-1);assert.equal(q.p.length,p.p.length);
 assert.notDeepEqual(q.p,p.p);
 assert(Math.max(...q.p.filter((_,i)=>i%3===1))>Math.max(...p.p.filter((_,i)=>i%3===1))+.1);
 run('poiMonsterRender(900,null)');const settled=renders.at(-1);
 assert.equal(settled.p.length,p.p.length);
 const count=renders.length;
 run('poiMonsterRender(4200,null);poiMonsterRender(5100,null)');
 assert.equal(renders.length,count,'static debris must reuse the same batch');
 assert.equal(run('poiMonsterBreakSnapshot(5100)[0].phase'),'settled');
 run('poiMonsterRender(5500,null)');assert.equal(run('poiMonsterBreakSnapshot(5500)[0].phase'),'fade');
 run('poiMonsterRender(5755,null)');assert.equal(renders.at(-1).p.length,0);
});
test('short effects are capped, floor-specific, and cleared without game-world mutation',()=>{
 const {ctx,run,renders,calls}=harness();
 run("for(let i=0;i<8;i++)poiMonsterBreak({type:'monsterSlime',y:-1,x:i,z:1},{x:i,z:1,moveStarted:-10000},0);poiMonsterRender(0,null)");
 assert.equal(renders.at(-1).p.length,0,'another floor must not show it');
 ctx.poiWalkLevel=-1;
 run('poiMonsterRender(100,null)');assert.equal(renders.at(-1).p.length,108*5);
 assert.deepEqual(calls,['monsterSlime']);
 run('poiMonsterClearBreaks();poiMonsterRender(101,null)');assert.equal(renders.at(-1).p.length,0);
 assert.deepEqual(ctx.world,[]);
});

test('all creature shapes persist and use settled locations near the center or within roughly a tile, never blocked terrain',()=>{
 const {run,calls}=harness();
 run(`['monsterSlime','monsterGoblin','monsterSkeleton','monsterDragon','monsterSlime'].forEach((type,i)=>{
  poiMonsterBreak({type,x:11,z:20,y:0},{x:11,z:20,moveStarted:-10000},0,()=>i/5);
 });poiMonsterRender(900,null)`);
 assert.deepEqual(calls,['monsterSlime','monsterGoblin','monsterSkeleton','monsterDragon']);
 const snapshot=JSON.parse(run('JSON.stringify(poiMonsterBreakSnapshot(900))'));
 for(const effect of snapshot){
  assert(effect.parts.some(p=>Math.hypot(p.x-effect.x,p.z-effect.z)<.5),'center breakup');
  assert(effect.parts.some(p=>Math.hypot(p.x-effect.x,p.z-effect.z)>.65),'outer breakup');
  for(const {x,z} of effect.parts){
   assert(Math.hypot(x-effect.x,z-effect.z)<=1.25);
   assert.notEqual(Math.floor(x),12,'wall');assert.notEqual(Math.floor(x)+','+Math.floor(z),'10,20','deep creek');
  }
 }
 assert.notDeepEqual(snapshot[0].parts,snapshot[4].parts,'same monster type lands a little differently each time');
});

test('only enemy debris expires at exactly half its previous lifetime; human effects and burst timing are unchanged',()=>{
 const {run}=harness();
 assert.equal(run('poiMonsterBreakTTL({})'),5655);
 assert.equal(run('poiMonsterBreakTTL({actor:"player"})'),2400);
 assert.equal(run('poiMonsterBreakTTL({actor:"resident"})'),2400);
 assert.equal(run('poiMonsterBreakFadeAt({actor:"player"})'),1850);
 assert.equal(run('poiMonsterBreakPhase(759,{})'),'flight');
 assert.equal(run('poiMonsterBreakPhase(760,{})'),'settled');
 assert.equal(run('poiMonsterBreakFadeAt({})'),5105);
});
