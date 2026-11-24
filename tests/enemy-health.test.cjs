const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('nearby living enemy health follows the head, reuses a progress bar, and hides in AI or on death',()=>{
 const a=html.indexOf('const POI_ENEMY_HEAD_HEIGHT'),b=html.indexOf('function poiMonsterAt(',a);
 assert(a>=0&&b>a,'enemy health renderer is present');
 const obj={type:'monsterSlime',y:0},state={x:4,z:5,hp:35};
 const children=new Set(),layer={append:el=>children.add(el)};
 const projections=[];
 const scope={poiWalkActive:true,pineAIActive:false,facilitySite:{},poiWalkLevel:0,
  poiWalkX:3,poiWalkZ:5,poiMonsterStates:new Map([[obj,state]]),$:()=>layer,canvas:{clientWidth:300,clientHeight:500},
  document:{createElement:tag=>({tag,style:{},setAttribute(k,v){this[k]=v;},remove(){children.delete(this);}})},
  POI_MONSTER_STATS:{monsterSlime:{hp:35}},byId:()=>({name:'スライム'}),
  mesh:()=>({p:[]}),deco:m=>m.p.push(0,0,0,.30,.83,.22),poiMonsterRenderType:o=>o.type,
  poiMonsterPose:()=>({x:4.5,y:1,z:5.5}),poiWorldToScreen:(_vp,x,y,z)=>{projections.push([x,y,z]);return {x:x*20,y:160-y*10,z}}};
 vm.createContext(scope);vm.runInContext(html.slice(html.indexOf('function poiSacredInteriorHostileVisible('),html.indexOf('let poiSacredInteriorVbo'))+html.slice(a,b),scope);
 scope.poiRenderEnemyHealth(0,[]);
 const [bar]=children;
 assert.equal(bar.tag,'progress');assert.equal(bar.max,35);assert.equal(bar.value,35);
 assert.equal(bar['aria-label'],'スライムのHP');
 assert.match(bar.style.transform,/90px, 128px/);
 assert(Math.abs(projections[0][1]-1.89)<1e-9,'head follows pose and adds modest world clearance');
 state.hp=15;scope.poiRenderEnemyHealth(24,[]);
 assert.equal(children.size,1);assert(children.has(bar));assert.equal(bar.value,15);
 scope.pineAIActive=true;scope.poiRenderEnemyHealth(48,[]);assert.equal(children.size,0);
 scope.pineAIActive=false;obj.y=1;scope.poiRenderEnemyHealth(51,[]);assert.equal(children.size,0);
 obj.y=0;scope.poiRenderEnemyHealth(60,[]);assert.equal(children.size,1);
 state.hp=0;scope.poiRenderEnemyHealth(80,[]);assert.equal(children.size,0);
});

test('enemy progress keeps an independent warm fill and one layer of shared glass',()=>{
 const bar=html.match(/\.poiEnemyHealth\{([^}]+)\}/)?.[1];
 assert(bar);
 assert.match(bar,/width:clamp\(25px,6.8vw,34px\);height:5px/);
 assert.match(bar,/background:var\(--workshop-panel-surface\)/);
 assert.match(html,/\.poiEnemyHealth::-webkit-progress-bar\{background:transparent\}/);
 assert.match(html,/\.poiEnemyHealth::-webkit-progress-value\{[^}]*background:var\(--poi-enemy-fill\)/);
 assert.match(html,/\.poiEnemyHealth::-moz-progress-bar\{[^}]*background:var\(--poi-enemy-fill\)/);
});
