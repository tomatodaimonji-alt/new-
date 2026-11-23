const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(a,b){
 const x=html.indexOf(a),y=html.indexOf(b,x+1);assert(x>=0&&y>x,a);return html.slice(x,y);
}
function setup(){
 const origin={x:10,z:10},canvas={clientWidth:600,clientHeight:600},targets=new Map(),samples=[],avatars=[];
 const style={}; const marker={hidden:true,style,dataset:{},setAttribute(){}};const layer={append(){}};
 const bag={hidden:true},menu={hidden:true},note={hidden:true};
 const c={poiWalkActive:true,pineAIActive:false,poiMonsterStates:targets,poiWalkX:10,poiWalkZ:10,poiWalkLevel:0,
  poiWalkViewX:10,poiWalkViewZ:10,poiWalkFromX:10,poiWalkFromZ:10,poiWalkStarted:0,poiWalkStepMs:160,poiWalkFacing:1,
  poiFreePose:{x:10,z:10,level:0,angle:-Math.PI/2,walking:false,distance:0}, poiWalkActionStarted:-10000,
  POI_WALK_MS:160,facilitySite:null,terrainY:()=>0,poiWalkActionWeapon:null,poiWalkAttackPosePending:false,poiWalkMesh:null,
  document:{hidden:false,createElement:()=>marker,querySelector:()=>null},canvas,poiTownDialogue:null,poiPlayerDying:()=>false,
  $(id){return id==='poiBagPanel'?bag:id==='poiLandscapeMenu'?menu:id==='poiScreenNoteLayer'?note:null},
  held:'equipWoodSword',wand:false,poiEquippedWeapon:()=>c.held,poiArmedWandIndex:()=>c.wand?0:null,
  poiPlayerWeaponProfile:type=>type==='equipWoodSword'?{range:1.3,sweep:true,pose:296}:type==='fireWand'?{range:8}:null,
  poiMonsterPose:(_o,s)=>({x:s.x+.5,z:s.z+.5,y:0}),
  poiPlayerRayClear:(x,z)=>!c.wall?.(x,z),POI_ENEMY_HEAD_HEIGHT:{monsterSlime:.83},
  poiWorldToScreen:(_vp,x,y,z)=>{samples.push({x,y,z});return{x:x*15,y:y*15+z*15}},
  EQUIPMENT_IDS:[],poiRoleToolGripStyle:()=>null,poiWalkPunchPose:()=>null,poiWalkSwordPose:()=>null,
  poiCreekPlayerHeight:()=>0,gl:{deleteBuffer(){}},upload:()=>({buf:{}}),poiBuildPlayerMesh:(...args)=>{avatars.push(args);return {}}
 };
 vm.createContext(c);
 vm.runInContext(cut('// BEGIN ANGULAR COMBAT MATH','// BEGIN PLAYER WEAPON PROFILES')+
  cut('function poiWalkAvatar(','const POI_MONSTER_BREAK_MS='),c);
 const enemy=(dx,dz,y=0)=>{
  const state={x:origin.x+dx,z:origin.z+dz,hp:40};const obj={type:'monsterSlime',x:state.x,z:state.z,y};targets.set(obj,state);return state;
 };
 const draw=(when=1000)=>{samples.length=0;c.poiAimRenderMarker(when,null,layer);return marker.hidden?null:samples.at(-1);};
 return {c,enemy,draw,marker,bag,menu,avatars};
}
test('reticle acquires at eight without changing sword reach or attacking on its own',()=>{
 const h=setup(),a=h.enemy(7.9,0),back=h.enemy(8.01,0);
 const point=h.draw();assert.equal(point?.x,18.4);
 assert.equal(a.hp,40);assert.equal(back.hp,40);
 const shot=h.c.poiAimNewShot({type:'equipWoodSword',profile:{range:1.3}},1000);
 assert.equal(h.c.poiAimTrace(shot,1.3,1000).monster,null);
});
test('retargets to a visible closer enemy while the previous foe is behind a wall',()=>{
 const h=setup();h.c.wand=true;
 const a=h.enemy(4,0);assert.equal(h.draw()?.x,14.5);
 const b=h.enemy(1,0);h.c.wand=false;h.c.wall=x=>x===13;
 assert.equal(h.draw(1200)?.x,11.5);
 h.c.wall=null;assert.equal(h.draw(1400)?.x,11.5);
 b.x=18.02;assert.equal(h.draw(1600)?.x,14.5);
 assert.equal(a.hp,40);
});
test('reticle is projected on torso, not above enemy name and health',()=>{
 const h=setup();h.enemy(.7,0);const point=h.draw();
 assert(point&&point.y>.16&&point.y<.83,'must lie between feet and slime head');
});
test('combat-facing tracks the lock independent of sideways/backwards movement heading',()=>{
 const h=setup(),{c}=h;c.wand=true;
 const a=h.enemy(0,3),point=h.draw();assert.equal(point?.z,13.5);
 c.poiFreePose.angle=Math.PI/2;c.poiFreePose.walking=true;c.poiFreePose.distance=.4;
 c.poiWalkAvatar(1200);
 const avatar=h.avatars.at(-1);assert(Math.abs(avatar[8])<1e-6,'target is south while walking west');
 assert.equal(c.poiFreePose.angle,Math.PI/2);assert.equal(c.poiWalkFacing,1);
 assert.equal(a.hp,40);
});
test('menu hides the marker; reopening shows the current nearest foe',()=>{
 const h=setup();h.c.wand=true;h.enemy(4,0);assert.equal(h.draw()?.x,14.5);
 h.menu.hidden=false;h.enemy(1,0);assert.equal(h.draw(1200),null);
 h.menu.hidden=true;assert.equal(h.draw(1400)?.x,11.5);
});
test('a dead target, a different floor and exit from play release prior engagement',()=>{
 const h=setup();h.c.wand=true;const a=h.enemy(4,0);assert.equal(h.draw()?.x,14.5);
 const b=h.enemy(5,0);a.hp=0;assert.equal(h.draw(1200)?.x,15.5);
 h.c.poiWalkLevel=1;assert(h.draw(1400)?.x<12,'no enemy on this floor; only the wand free-aim cursor remains');
 h.c.poiWalkLevel=0;assert.equal(h.draw(1600)?.x,15.5);
 h.c.poiWalkActive=false;assert.equal(h.draw(1800),null);
 h.enemy(1,0);h.c.poiWalkActive=true;assert.equal(h.draw(2000)?.x,11.5);
 assert.equal(b.hp,40);
});
test('initial target must be same-floor and unobstructed',()=>{
 const h=setup();h.c.wand=true;h.enemy(4,0);h.enemy(1,0,1);
 h.c.wall=x=>x===13;assert(h.draw()?.x<12,'a wall-hidden foe is not used as the wand aim point');
 h.c.wall=null;assert.equal(h.draw(1200)?.x,14.5);
});
test('moving enemies are compared on the 80 ms scan, and firing refreshes immediately',()=>{
 const h=setup(),{c}=h;c.wand=true;
 const a=h.enemy(3,0),b=h.enemy(0,4);assert.equal(h.draw(1000)?.x,13.5);
 b.z=12.85;
 assert.equal(h.draw(1030)?.x,13.5,'no extra candidate scan per movement frame');
 assert.equal(h.draw(1080)?.z,13.35,'closer foe replaces even with a gap under the old .35 tolerance');
 a.x=12.5;
 const shot=c.poiAimNewShot({type:'fireWand',profile:{range:8}},1081);
 assert.equal(shot.dx,1);assert.equal(shot.dz,0);
 assert.equal(h.draw(1082)?.x,13);
});
test('an exactly tied prior is stable; obstruction retains identity only without an eligible target',()=>{
 const h=setup(),{c}=h;h.enemy(4,0);assert.equal(h.draw(1000)?.x,14.5);
 const b=h.enemy(0,4);assert.equal(h.draw(1080)?.x,14.5);
 c.wall=(x,z)=>x===13||z===13;assert.equal(h.draw(1160),null);
 assert.equal(c.poiCombatLockUpdate(c.poiAimOrigin(1170),1170)?.x,14,'existing hidden target remains when no replacement is visible');
 c.wall=x=>x===13;assert.equal(h.draw(1240)?.z,14.5);
 b.hp=0;c.wall=null;assert.equal(h.draw(1241)?.x,14.5,'death releases the active lock immediately');
});
