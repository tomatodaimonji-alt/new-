const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function harness(){
 const a=html.indexOf('const POI_MONSTER_BREAK_MS='),b=html.indexOf('function poiWalkFrame(',a);
 assert.ok(a>=0&&b>a,'death burst helper missing');
 const draws=[],renders=[],calls=[];
 const ctx=vm.createContext({renders,world:[],facilitySite:{id:'base'},poiWalkLevel:0,poiWalkActive:true,
  poiMonsterStates:new Map(),poiMonsterMesh:null,poiMonsterMeshLast:-10000,poiMonsterMeshDirty:true,
  gl:{deleteBuffer(){}},mesh:()=>({p:[],n:[],c:[]}),terrainY:()=>0,rot2:(x,z)=>[x,z],
  deco(m,id){
   calls.push(id);
   for(let i=0;i<12;i++){
    const c=Math.cos(i*Math.PI/6),s=Math.sin(i*Math.PI/6);
    m.p.push(c*.5,.25,s*.5,c*.4,.45,s*.4,c*.45,.38,s*.45);
    m.n.push(c,0,s,c,0,s,c,0,s);
    m.c.push(.4,.7,.9,.4,.7,.9,.4,.7,.9);
   }
  },
  upload:m=>{renders.push(m);return {...m,buf:{}}},draw:m=>draws.push(m)});
 vm.runInContext(html.slice(a,b),ctx);
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
 run('poiMonsterRender(900,null)');assert.equal(renders.at(-1).p.length,0);
});
test('short effects are capped, floor-specific, and cleared without game-world mutation',()=>{
 const {ctx,run,renders,calls}=harness();
 run("for(let i=0;i<8;i++)poiMonsterBreak({type:'monsterSlime',y:-1,x:i,z:1},{x:i,z:1,moveStarted:-10000},0);poiMonsterRender(0,null)");
 assert.equal(renders.at(-1).p.length,0,'another floor must not show it');
 ctx.poiWalkLevel=-1;
 run('poiMonsterRender(100,null)');assert.equal(renders.at(-1).p.length,108*3);
 assert.deepEqual(calls,['monsterSlime']);
 run('poiMonsterClearBreaks();poiMonsterRender(101,null)');assert.equal(renders.at(-1).p.length,0);
 assert.deepEqual(ctx.world,[]);
});
