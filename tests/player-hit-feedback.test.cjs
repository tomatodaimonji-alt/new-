const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
function fixture(reduced=false){
 let animations=[],styles={},listeners={};
 const node={style:styles,animate:(keyframes,timing)=>{
  const output={keyframes,timing,cancelled:false,playState:'idle',pause(){this.playState='paused'},play(){this.playState='running'},cancel(){this.cancelled=true}};
  animations.push(output);return output;
 }};
 const c=vm.createContext({
  $:()=>node, document:{hidden:false,addEventListener:(k,f)=>listeners[k]=f},poiWalkActive:true,pineAIActive:false,
  poiPlayerHP:100,poiPlayerDamageAfterArmor:amount=>Math.max(0,amount-9),poiHotbarHasKit:()=>true,poiSound:()=>{},
  poiDamageNumber:()=>{},poiWalkViewX:3,poiWalkViewZ:5,poiWalkX:3,poiWalkZ:5,poiWalkLevel:0,facilitySite:null,terrainY:()=>0,
  poiCombatHud:()=>{},poiPlayerDeathBegin:()=>true,poiHitFlashReduced:{matches:reduced},poiPlayerHitFlashAt:-Infinity,
  poiMonsterHitFlashUntil:-Infinity,POI_HIT_FLASH_MS:180,
 });
 const i=h.indexOf('// BEGIN PLAYER DAMAGE EDGE'),j=h.indexOf('// END PLAYER DAMAGE EDGE',i);
 assert(i>=0&&j>i,'production player damage edge controller is present');
 const a=h.indexOf('function poiMobHitPlayer('),b=h.indexOf('function poiMineEarlyMayMove(',a);
 vm.runInContext(h.slice(i,j)+h.slice(a,b),c);
 return {c,animations,listeners,node,hit:(raw,now)=>c.poiMobHitPlayer({},now,raw)};
}
test('one behind-HUD static peripheral primitive, no intercepted inputs or central tint',()=>{
 const css=h.match(/#poiPlayerDamageEdge\{([^}]+)\}/)?.[1];
 assert(css&&css.includes('pointer-events:none')&&css.includes('transparent 62%')&&css.includes('opacity:0'));
 assert.match(h,/<div id="poiPlayerDamageEdge" aria-hidden="true"><\/div>/);
 assert(Number(css.match(/z-index:(\d+)/)[1])<9);
});
test('production post-armor hit path: zero block/heal stay clear, repeated real loss does not restart',()=>{
 const f=fixture();
 f.hit(9,100);assert.equal(f.c.poiPlayerHP,100);assert.equal(f.animations.length,0);
 f.hit(28,200);assert.equal(f.c.poiPlayerHP,81);assert.equal(f.animations.length,1);
 assert.equal(f.c.poiPlayerHitFlashAt,200);
 f.hit(20,320);assert.equal(f.c.poiPlayerHP,70);assert.equal(f.animations.length,1);
 f.c.poiPlayerHP+=13;assert.equal(f.animations.length,1);
 f.hit(25,700);assert.equal(f.animations.length,2);
 assert.equal(f.animations[1].keyframes.at(-1).opacity,0);
});
test('hidden and outside modes cannot replay, reduced mode is softer and shorter',()=>{
 const std=fixture(),low=fixture(true);
 std.hit(30,100);low.hit(30,100);
 assert(low.animations[0].timing.duration<std.animations[0].timing.duration);
 assert(low.animations[0].keyframes[0].opacity<std.animations[0].keyframes[0].opacity);
 low.animations[0].play();low.c.document.hidden=true;low.c.poiPlayerHitEdgeLifecycle(true);
 assert.equal(low.animations[0].playState,'paused');assert(!low.animations[0].cancelled);
 low.hit(20,1000);assert.equal(low.animations.length,1);
 low.c.document.hidden=false;low.c.poiPlayerHitEdgeLifecycle(false);
 assert.equal(low.animations[0].playState,'running');low.c.poiWalkActive=false;low.hit(20,1500);assert.equal(low.animations.length,1);
});
