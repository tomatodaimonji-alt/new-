const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(a,b){const i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i,a+' seam is present');return h.slice(i,j)}
const helper=()=>cut('// BEGIN GAME DAMAGE FLASH','// END GAME DAMAGE FLASH');
test('player and real monster hit handlers start a pulse only when HP decreases',()=>{
 const c={poiPlayerHP:100,POI_MONSTER_STATS:{monsterSlime:{attack:12}},poiWalkViewX:0,poiWalkViewZ:0,poiWalkX:0,poiWalkZ:0,poiWalkLevel:0,
  poiSound(){},poiCombatHud(){},poiDamageNumber(){},terrainY:()=>0,facilitySite:null,pineGameActive:false,poiMonsterMeshDirty:false};
 vm.createContext(c);
 const read=vm.runInContext(helper()+cut('function poiMobHitPlayer(','function poiMineEarlyMayMove(')+
  cut('function poiPlayerDamageTarget(','function poiPlayerWeaponResolve(')+';(()=>poiPlayerHitFlashAt);',c);
 const o={type:'monsterSlime'},m={hp:100,x:10,z:11};
 c.poiMobHitPlayer(o,120);assert.equal(c.poiPlayerHP,88);assert.equal(read(),120);
 c.POI_MONSTER_STATS.monsterSlime.attack=0;c.poiMobHitPlayer(o,150);assert.equal(read(),120);
 c.poiPlayerDamageTarget([o,m],10,11,12,null,130);assert.equal(m.hp,88);assert.equal(m.hitFlashAt,130);
 c.poiPlayerDamageTarget([o,m],10,11,0,null,170);assert.equal(m.hitFlashAt,130);
});
test('pulse is faint, brief, and bounded in reduced-motion preference',()=>{
 const media={matches:false},c={matchMedia:()=>media};
 const amount=vm.runInNewContext(helper()+';poiHitFlashAmount;',c);
 assert.equal(amount(-Infinity,100),0);assert.equal(amount(100,99),0);
 assert(amount(100,100)>.08&&amount(100,100)<.35);
 assert(amount(100,175)<amount(100,100));assert.equal(amount(100,400),0);
 media.matches=true;
 assert(amount(100,100)>0&&amount(100,100)<=.16);assert.equal(amount(100,400),0);
});
test('only damaged monster vertex spans get a pulse and the next ordinary draw is clean',()=>{
 const calls=[],c={loc:{hitFlash:8},gl:{uniform1f(_l,value){calls.push(['u',value])}},
  draw(m,_vp,start=0,count=m.count){calls.push(['d',start,count])}};
 const draw=vm.runInNewContext(helper()+';poiDrawMonsterHitFlash;',c);
 const m={count:60,hitFlashSpans:[{first:12,end:30,source:{hitFlashAt:100}},{first:42,end:60,source:{hitFlashAt:40}}]};
 draw(m,{},230);
 assert.deepEqual(calls.map(row=>row[0]),['d','u','d','u','d']);
 assert.deepEqual(calls[0],['d',0,12]);assert.deepEqual(calls[2],['d',12,18]);assert.deepEqual(calls[3],['u',0]);
 assert.deepEqual(calls[4],['d',30,30]);
 calls.length=0;draw(m,{},500);assert.deepEqual(calls,[['d',0,60]]);
});
test('player normal mesh receives color, reverse-depth occlusion shares its original uncolored draw and restores all uniforms',()=>{
 const calls=[],c={poiWalkMesh:{count:42},pineAIActive:false,loc:{hitFlash:'hit',occlusionInfo:'occlusion'},
  gl:{GREATER:'GREATER',LESS:'LESS',depthMask:x=>calls.push(['mask',x]),depthFunc:x=>calls.push(['depth',x]),
   uniform4f:(_l,a,b,d,e)=>calls.push(['occ',e]),uniform1f:(_l,s)=>calls.push(['color',s])},
  draw:(_m,_vp,first,count)=>calls.push(['draw',first,count])};
 const f=vm.runInNewContext(helper()+cut('function poiDrawWalkAvatar(','function poiAvatarOcclusion(')+
  ';(now)=>{poiPlayerHitFlashAt=100;poiDrawWalkAvatar({},now)};',c);
 f(105);
 assert.deepEqual(calls.slice(0,7),[['mask',false],['depth','GREATER'],['occ',-2],['draw',undefined,undefined],
  ['occ',0],['depth','LESS'],['mask',true]]);
 assert(calls[7][0]==='color'&&calls[7][1]>.1);
 assert.deepEqual(calls.slice(8),[['draw',0,42],['color',0]]);
});
