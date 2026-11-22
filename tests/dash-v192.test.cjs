const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const h=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function dash(){
 const area=h.match(/\/\/ BEGIN PLAYER DASH\n([\s\S]*?)\/\/ END PLAYER DASH/);
 assert(area,'isolated dash runtime missing');
 const c=vm.createContext({POI_WALK_MS:175,poiWalkActive:true,pineAIActive:false,poiAudioAllowed:()=>true,$:()=>null});
 vm.runInContext(area[1],c);
 return c;
}
test('only short same-direction D-pad presses toggle; cancellation and holding do not prime',()=>{
 const c=dash(),on=()=>c.poiDashSnapshot().active;
 c.poiDashTapPress('s',1,0);c.poiDashTapRelease(1,60);
 c.poiDashTapPress('e',1,120);c.poiDashTapRelease(1,190);assert.equal(on(),false);
 c.poiDashTapPress('e',1,231);assert.equal(on(),true);c.poiDashTapRelease(1,270);
 c.poiDashTapPress('e',1,291);c.poiDashTapRelease(1,600);assert.equal(on(),true);
 c.poiDashTapPress('e',1,620);assert.equal(on(),true);c.poiDashTapRelease(1,670,true);
 c.poiDashTapPress('e',1,691);assert.equal(on(),true);c.poiDashTapRelease(1,750);
 c.poiDashTapPress('e',1,780);assert.equal(on(),false);
});
test('only committed steps spend; exhaustion uses the final boosted step, then walks and regenerates',()=>{
 const c=dash();
 c.poiDashTapPress('s',1,0);c.poiDashTapRelease(1,60);c.poiDashTapPress('s',1,100);
 assert.equal(c.poiDashSnapshot().stamina,100);
 for(let i=0;i<12;i++)assert.equal(c.poiDashCommitStep(),105);
 assert.equal(c.poiDashSnapshot().stamina,4);assert.equal(c.poiDashCommitStep(),105);
 assert.equal(c.poiDashSnapshot().active,false);assert.equal(c.poiDashSnapshot().stamina,0);
 assert.equal(c.poiDashCommitStep(),175);
 c.poiDashFrame(1000);c.poiDashFrame(1250);assert.equal(c.poiDashSnapshot().stamina,6);
 c.poiAudioAllowed=()=>false;c.poiDashFrame(2000);
 c.poiAudioAllowed=()=>true;c.poiDashFrame(3000);assert.equal(c.poiDashSnapshot().stamina,6);
});
test('movement spends only after collision and portal checks, and the HUD sits directly below HP',()=>{
 const step=h.slice(h.indexOf('function poiWalkStep('),h.indexOf('function poiWalkAction('));
 assert(step.indexOf('poiDashCommitStep(')>step.indexOf('poiOtherworldUseStep('));
 assert(step.indexOf('poiDashCommitStep(')>step.indexOf('if(!poiWalkCanStep('));
 assert.match(h,/id="poiPlayerHpValue"[^<]+<\/span><\/div>\s*<div class="poiStaminaMetric"><progress id="poiPlayerStamina"/);
});
