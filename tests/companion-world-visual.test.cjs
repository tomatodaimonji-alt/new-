const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const block=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
const helpers=block('function poiCompanionPosition(','function poiCompanionPlayerPoint(');
test('allied and ordinary slime submit the same sculpted geometry and actual wild pose engine',()=>{
 const c=vm.createContext({rot2:(x,z,r)=>[[x,z],[-z,x],[-x,-z],[z,-x]][r],
  terrainY:()=>0,poiCompanionPose:()=>({hop:0}),poiMonsterPose:(o,s,now)=>({o,s,x:2,y:0,z:4})});
 vm.runInContext(helpers+block('// BEGIN COMPANION WORLD VISUAL','// END COMPANION WORLD VISUAL'),c);
 const p={p:[.35,.22,.49],n:[0,1,0],c:[.26,.73,.88]},mesh=()=>({p:[],n:[],c:[]});
 const m=mesh(),q={x:3,y:2,z:4};c.poiAppendWildSlimeVisual(m,p,q,0);
 a.deepEqual(m.c,p.c);a.deepEqual(m.p,[3.35,2.22,4.49]);
 const ally={x:20,z:24,px:20.31,pz:24.26,y:0,fx:19,fz:24,stepAt:100,stepMs:380,attackMotion:{start:100,dx:1,dz:0,pending:true,hit:220}};
 const pose=c.poiCompanionWorldPose(ally,120),wild=pose.s;
 a.equal(pose.o.type,'monsterSlime');a.deepEqual([wild.x,wild.z,wild.fromX,wild.fromZ,wild.moveStarted,wild.guardMoveMs],[20.31,24.26,20.31,24.26,100,380]);
 a.equal(wild.playerAttack,ally.attackMotion);
 a.match(h,/if\(art==='monsterSlime'\)\{[^]*?poiAppendWildSlimeVisual/);
 a.match(h,/\.poiEnemyHealth\.poiCompanionHealth\{[^}]*#4f8f62,#9ec685/);
});
test('world gauge follows the sampled identical head pose and current durable life, not a separate health pool',()=>{
 const team={site:{id:'base'},x:12,z:9,y:0,fx:11,fz:9,stepAt:100,stepMs:200,id:'slimeSoul',hurtAt:0};
 let kit={companionSoul:{active:'slimeSoul'},slots:[{type:'slimeSoul',durability:36}]};
 const elements=[],layer={append:e=>elements.push(e)},trace=[],ep={x:12.3,y:.6,z:9.5};
 const ctx=vm.createContext({poiOverlandDrawing:false,poiCompanionActor:team,poiCompanionSame:()=>true,poiCompanionPlace:()=>team,poiCompanionAllowed:()=>true,
  poiWalkX:12,poiWalkZ:9,poiCompanionMesh:null,poiCompanionMeshKey:'',poiCompanionTemplate:null,
  terrainY:()=>0,poiCompanionPose:()=>({hop:0}),poiMonsterPose:()=>({...ep}),mesh:()=>({p:[],n:[],c:[]}),deco:m=>{m.p.push(0,0,0);m.n.push(0,1,0);m.c.push(.26,.73,.88)},
  rot2:(x,z)=>[x,z],upload:(m,buf)=>({buf:buf??{},count:m.p.length/3}),gl:{DYNAMIC_DRAW:1},draw(){},
  poiHotbarRead:()=>kit,poiInventorySlots:k=>k.slots,poiCompanionType:()=>({name:'スライム',hp:36}),
  document:{createElement:type=>({type,style:{},setAttribute(k,v){this[k]=v}})},canvas:{clientWidth:500,clientHeight:300},
  poiEnemyHealthAnchor:(_vp,pose)=>{trace.push(pose);return {x:100.8,y:90}},poiEnemyHealthEnvelope:()=>({}),POI_ENEMY_BAR_GAP:13});
 vm.runInContext(helpers+block('// BEGIN COMPANION WORLD VISUAL','// END COMPANION WORLD VISUAL'),ctx);
 ctx.poiDrawCompanion(150,[]);ctx.poiDrawCompanionHealth(150,[],layer);
 a.equal(elements.length,1);const bar=elements[0];a.equal(bar.max,36);a.equal(bar.value,36);a.equal(bar.type,'progress');
 a.equal(bar['aria-label'],'仲間のスライムのHP');a.equal(bar.style.transform,'translate3d(101px, 77px, 0) translate(-50%, -100%)');
 a.deepEqual([trace[0].x,trace[0].y,trace[0].z],[ep.x,ep.y,ep.z]);
 kit={...kit,slots:[{type:'slimeSoul',durability:29}]};ctx.poiDrawCompanionHealth(170,[],layer);a.equal(bar.value,29);
 ctx.poiCompanionActor=null;ctx.poiDrawCompanion(190,[]);ctx.poiDrawCompanionHealth(190,[],layer);a.equal(bar.hidden,true);
 a.equal(elements.length,1,'no DOM churn or duplicate after losing the actual ally');
});
