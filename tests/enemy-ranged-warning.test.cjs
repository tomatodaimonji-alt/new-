const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a.ok(i>=0&&j>i,x);return h.slice(i,j)};
const attack=(type,x=4,z=2)=>({obj:{type},x,z,sx:0,sz:0,y:-1,angular:x!==0&&z!==0,
 dx:x/Math.hypot(x,z),dz:z/Math.hypot(x,z),pending:true,start:0,hit:700});
function setup(){
 const c={mesh:()=>({p:[]}),terrainY:()=>0,tri:(m,...v)=>m.p.push(...v.slice(0,3).flat()),quad(){},
  poiEnemyCombatEdge:(x,z)=> x<c.wall,poiPlayerRayClear:(x,z)=>x<c.wall,wall:999};
 vm.createContext(c);
 vm.runInContext(cut('// BEGIN ANGULAR COMBAT MATH','// END ANGULAR COMBAT MATH')+
  cut('// BEGIN ENEMY ANGLES','// END ENEMY ANGLES')+
  cut('const poiEnemyCueReduced=','let poiEnemyCueCache='),c);
 return c;
}
function stats(m,k){
 let first=Infinity,end=0,width=0;
 for(let i=0;i<m.p.length;i+=3){
  const x=m.p[i]-.5,z=m.p[i+2]-.5;
  const u=x*k.dx+z*k.dz,v=Math.abs(x*k.dz-z*k.dx);
  first=Math.min(first,u);end=Math.max(end,u);width=Math.max(width,v);
 }
 return {first,end,width};
}
test('a diagonal archer cue is one joined lane within committed endpoints, never rounded tile islands',()=>{
 const e=setup(),k=attack('monsterSkelArcher'),path=e.poiEnemyAttackTrace(0,0,k.x,k.z,()=>true);
 k.tiles=path.tiles;
 a.equal(typeof e.poiEnemyCueRangedGeometry,'function');
 const m=e.poiEnemyCueRangedGeometry(k,{});
 const dims=stats(m,k);
 a(m.p.length>=50);
 a(dims.first>=-1e-6&&dims.end>4.4&&dims.end<=Math.hypot(4,2)+1e-6);
 a(dims.width>=.15&&dims.width<=.24,'not the full width of any cell');
 for(let i=0;i<m.p.length;i+=9)a.deepEqual(m.p.slice(i,i+3),[.5,-1.4+.052,.5],'draws one contiguous fan, no isolated tile fill');
});
test('line clips at a live wall and at mage flight shortening, while no visible length is fabricated for zero reach',()=>{
 const e=setup(),k=attack('monsterSkelMage',3,2);k.tiles=e.poiEnemyAttackTrace(0,0,k.x,k.z,()=>true).tiles;
 e.wall=2;
 const m1=e.poiEnemyCueRangedGeometry(k,{}),short=stats(m1,k);
 a(m1.p.length>0);a(short.end<2.25);a(m1.p.every((v,i)=>i%3!==0||v<=2.000001));
 e.wall=999;
 k.mageTiles=[k.tiles[0]];const seen=stats(e.poiEnemyCueRangedGeometry(k,{}),k);
 a(seen.end>0&&seen.end<1.1);
 k.mageTiles=[];a.equal(e.poiEnemyCueRangedGeometry(k,{}).p.length,0);
 const card=attack('monsterSkelMage',3,0);card.tiles=[{x:1,z:0},{x:2,z:0},{x:3,z:0}];card.mageReach=2;
 a(Math.abs(stats(e.poiEnemyCueRangedGeometry(card,{}),card).end-2)<1e-6);
});
test('standard melee/unarmed and specialized boss rendering keep their routes',()=>{
 const e=setup();
 for(const t of ['monsterSlime','monsterSkelSpearman','monsterSkelLongStaff','monsterNorthMinotaur'])
  a.equal(e.poiEnemyCueRanged(attack(t)),false);
 a.equal(e.poiEnemyCueRanged(attack('monsterSkelArcher')),true);
 a.match(h,/poiEnemyCueTilesGeometry\(a,tiles\)/);
 a.match(h,/poiNorthAxeCueGeometry\(a\)/);
});
test('committed diagonal contact uses the same warning instead of damaging any point in an old staggered cell',()=>{
 const e=setup(),k=attack('monsterSkelArcher',3,1);
 k.tiles=e.poiEnemyAttackTrace(0,0,k.x,k.z,()=>true).tiles;
 a(k.tiles.some(t=>t.x===2&&t.z===1),'old reducer damaged this entire staggered cell');
 const area=e.poiEnemyRangedArea(k,{});
 a.equal(e.poiEnemyRangedCovers(k,{}, {x:2,z:1,y:-1},area),false);
 a.equal(e.poiEnemyRangedCovers(k,{}, {x:2.12,z:.705,y:-1},area),true);
 a.equal(e.poiEnemyRangedCovers(k,{}, {x:3,z:1,y:-1},area),true);
 a.equal(e.poiEnemyRangedCovers(k,{}, {x:3.01,z:1.004,y:-1},area),false);
 a.equal(e.poiEnemyRangedCovers(k,{}, {x:2.12,z:.705,y:0},area),false);
 a.match(h,/covered=poiEnemyRangedContact\(a,s,typeof poiAimOrigin/);
});
test('authored archer stationary aim reaches exactly eight beyond its old roaming leash but neither safe territory nor blocked walls',()=>{
 const e={facilitySite:{id:'base'},poiWalkLevel:0,poiArmedBound:()=>false,poiWildExterior:(x,z)=>x>=e.safe, safe:-1,
  poiWalkCanStep:(x,z)=>!e.block || x!==e.block,
  poiEnemyCombatEdge:(x,z)=>!e.block||x!==e.block};
 vm.createContext(e);
 vm.runInContext(cut('const POI_ARMED_FOES=','const POI_ARMED_WAND_FIND=')+
  cut('function poiEnemyAttackTrace(','function poiEnemyDiagonalType(')+cut('function poiArmedAim(','function poiArmedLootOptions('),e);
 const o={type:'monsterSkelArcher',y:0,x:0,z:0};
 a.equal(e.poiArmedAim(o,o,8,0).tiles.length,8);
 a.equal(e.poiArmedAim(o,o,9,0),null);
 a.equal(e.poiArmedAim(o,o,8,1),null);
 e.block=7;a.equal(e.poiArmedAim(o,o,8,0),null);
 e.block=null;e.safe=9;a.equal(e.poiArmedAim(o,o,8,0),null);
 a.match(h,/dist<=8&&\(dist>6\.5\|\|!poiArmedBound/);
 a.match(h,/monsterSkelMage:\{type:'equipPlainStaff'[^\n]*reach:4,windup:820/);
});
test('real enemy resolver hits in geometric lane exactly once and no longer damages old-cell corners',()=>{
 const e=setup(),marks=[];
 const source=cut('function poiEnemyResolvePlayer(','// END SLIME ATTACK');
 Object.assign(e,{poiEnemyThreatEnabled:()=>true,poiEnemyAttackSourceValid:()=>true,poiEnemyPending:new Set(),
  poiEnemyContactTolerance:()=>200,poiMonsterMeshDirty:false,poiWalkLevel:-1,
  poiAimOrigin:()=>e.p,poiMobHitPlayer:(_o,t)=>{marks.push(t);return false}});
 vm.runInContext(source,e);
 for(const [now,p,actual] of [[700,{x:2,z:1,y:-1},false],[900,{x:2.12,z:.705,y:-1},true]]){
  const k=attack('monsterSkelArcher',3,1);k.hit=now;
  k.tiles=e.poiEnemyAttackTrace(0,0,k.x,k.z,()=>true).tiles;
  e.p=p;e.poiWalkX=Math.round(p.x);e.poiWalkZ=Math.round(p.z);
  e.poiEnemyPending.add({playerAttack:k});
  e.poiEnemyResolvePlayer(now);e.poiEnemyResolvePlayer(now+1);
  a.equal(marks.includes(now),actual);
 }
 a.deepEqual(marks,[900]);
});

test('moving obstacle cannot enlarge contact beyond the last rendered red lane before next paint',()=>{
 const e=setup(),k=attack('monsterSkelArcher',4,2);
 k.tiles=e.poiEnemyAttackTrace(0,0,k.x,k.z,()=>true).tiles;
 const player={x:4,z:2,y:-1};
 e.wall=2;
 const prior=e.poiEnemyRangedArea(k,{});
 e.poiEnemyCueCache=new Map([[k,{area:prior}]]);
 e.wall=999;
 a.equal(e.poiEnemyRangedCovers(k,{},player),true);
 a.equal(e.poiEnemyRangedContact(k,{},player),false);
 e.poiEnemyCueCache.get(k).area=e.poiEnemyRangedArea(k,{});
 a.equal(e.poiEnemyRangedContact(k,{},player),true);
 e.wall=2;
 a.equal(e.poiEnemyRangedContact(k,{},player),false,'newly closed wall still blocks even before repaint');
});
