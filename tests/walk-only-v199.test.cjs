const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync('world-editor.html','utf8');
test('no dash or stamina state, gestures, UI or debug data are shipped; ordinary and shallow intervals fixed',()=>{
 assert.doesNotMatch(h,/POI_DASH|poiDash|poiStamina|poiPlayerStamina|data-dashing|dash:poiDashSnapshot/);
 assert.match(h,/const POI_WALK_MS=175/);
 assert.match(h,/const POI_CHAPEL_WET_MS=265/);
 assert.match(h,/walk:\{stepMs:poiWalkStepMs,walkMs:POI_WALK_MS\}/);
});
test('fresh taps have no movement mode; held repeat stops on release and does not cross a portal',()=>{
 const handlers={},button={dataset:{poiDir:'e'},addEventListener(name,fn){handlers[name]=fn},setPointerCapture(){}};
 const c={poiOtherworldTravelSerial:0,poiWalkActive:true,poiThirdPerson:false,pineAIActive:false,
  poiNpcMenuActive:()=>false,poiGameResetDialogOpen:()=>false,poiItemDetailIsOpen:()=>false,poiPlayerDying:()=>false,
  document:{querySelectorAll:()=>[button]},moves:0,portal:false,
  poiWalkStep(){c.moves++;if(c.portal)c.poiOtherworldTravelSerial++},
  setInterval(fn,ms){assert.equal(ms,35);c.repeat=fn;return 1},
  clearInterval(){c.repeat=null}
 };
 const a=h.indexOf('let poiWalkRepeat=null;'),b=h.indexOf("document.addEventListener('keydown'",a);
 vm.createContext(c);vm.runInContext(h.slice(a,b),c);
 const e={isPrimary:true,pointerId:1,preventDefault(){}};
 handlers.pointerdown(e);handlers.pointerup(e);handlers.pointerdown(e);
 assert.equal(c.moves,2);assert.ok(c.repeat);
 c.repeat();assert.equal(c.moves,3);handlers.pointercancel(e);assert.equal(c.repeat,null);
 c.portal=true;handlers.pointerdown(e);assert.equal(c.moves,4);assert.equal(c.repeat,null);
});
