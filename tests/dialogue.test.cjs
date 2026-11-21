const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.DIALOGUE_HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
function fixture(){
 const actor={x:5,z:4,y:0,facing:0,activity:'work',role:{id:'guildkeeper',name:'受付係',role:'keeper'}};
 const e={hidden:true,style:{},textContent:''};let synced=0,faced=0;
 const c=vm.createContext({poiTownNpcActive:()=>true,poiTownNpcActors:[actor],poiWalkX:5,poiWalkZ:5,poiWalkLevel:0,poiWalkFacing:0,
  poiTownNpcGraph:()=>({}),poiTownNpcNextTile:(_from,x,z)=>({x,z,y:0}),poiMonsterStates:new Map(),poiTownNpcFace:(a,f)=>{a.facing=f;faced++},poiShopSync:()=>synced++,
  terrainY:()=>0,poiWorldToScreen:()=>({x:150,y:200}),$:()=>e});
 const m=html.match(/\/\/ BEGIN TOWN DIALOGUE\n([\s\S]*?)\/\/ END TOWN DIALOGUE/);
 assert.ok(m,'conversation runtime is present');
 vm.runInContext(m[1],c);return {actor,e,c,run:(js)=>vm.runInContext(js,c),get faced(){return faced},get synced(){return synced}};
}
test('adjacent faced actor turns, pauses, gets a projected named bubble and expires',()=>{
 const f=fixture();assert.equal(f.run('poiTownDialogueAction(100)'),true);assert.equal(f.actor.facing,2);assert.equal(f.faced,1);
 f.run('poiTownDialogueDraw(200,[])');assert.equal(f.e.hidden,false);assert.match(f.e.textContent,/受付係/);
 assert.equal(f.run('poiTownDialogueUpdate(4599)'),f.actor);assert.equal(f.run('poiTownDialogueUpdate(4600)'),null);
 assert.equal(f.e.hidden,true);
});
test('walls, floors, active enemy, and busy residents never yield a conversation',()=>{
 const f=fixture();f.actor.y=1;assert.equal(f.run('poiTownDialogueTarget(100)'),null);f.actor.y=0;
 f.c.poiTownNpcNextTile=()=>null;assert.equal(f.run('poiTownDialogueTarget(100)'),null);f.c.poiTownNpcNextTile=()=>({y:0});
 f.actor.target={};assert.equal(f.run('poiTownDialogueTarget(100)'),null);delete f.actor.target;
 f.actor.activity='sleep-home';assert.equal(f.run('poiTownDialogueTarget(100)'),null);
 f.actor.activity='work';f.c.poiMonsterStates.set({y:0},{x:5,z:4,hp:30});assert.equal(f.run('poiTownDialogueTarget(100)'),null);
});
test('retap or leaving cancels; unrelated attack fallback remains available',()=>{
 const f=fixture();assert.equal(f.run('poiTownDialogueAction(100)'),true);
 assert.equal(f.run('poiTownDialogueAction(200)'),true);
 assert.equal(f.run('poiTownDialogueSnapshot()'),null);
 f.run('poiTownDialogueAction(300)');f.c.poiWalkFacing=1;assert.equal(f.run('poiTownDialogueUpdate(400)'),null);
 assert.equal(f.run('poiTownDialogueAction(500)'),false);
});
test('guild clerk at the mapped counter speaks across only the verified public desk',()=>{
 const f=fixture();Object.assign(f.actor,{x:56,z:27,y:0});f.actor.role={...f.actor.role,work:{x:56,z:27,y:0},public:{x:56,z:29,y:0,facing:0}};
 Object.assign(f.c,{poiWalkX:56,poiWalkZ:29,poiWalkFacing:0,poiTownNpcNextTile:()=>null});
 const cells=new Map([['56,28,0',['woodfloor','counterWood','poiLedgerPapers','poiPenHolder']]]);
 f.c.poiTownNpcKey=(x,z,y)=>[x,z,y].join(',');f.c.poiTownNpcGraph=()=>({cells});f.c.poiTownNpcStance=()=>true;f.c.isFloor=t=>t==='woodfloor';
 assert.equal(f.run('poiTownDialogueAction(100)'),true);
 assert.equal(f.actor.facing,2);assert.equal(f.run('poiTownDialogueAction(101)'),true);
 cells.get('56,28,0').push('stonewall');assert.equal(f.run('poiTownDialogueTarget(200)'),null);
 cells.get('56,28,0').pop();cells.get('56,28,0').splice(1,1);assert.equal(f.run('poiTownDialogueTarget(201)'),null);
});
test('overlap keeps current speaker, queued attacks take priority',()=>{
 const f=fixture();const other={...f.actor,role:{id:'other',name:'二人目'}};
 f.c.poiTownNpcActors.push(other);
 assert.equal(f.run('poiTownDialogueAction(100)'),true);
 f.c.poiTownNpcActors.reverse();assert.equal(f.run('poiTownDialogueUpdate(101)'),f.actor);
 f.actor.hitAt=110;
 assert.equal(f.run('poiTownDialogueUpdate(104)'),null);
 assert.equal(f.run('poiTownDialogueTarget(104)'),other);
});
