const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {test}=require('node:test');
const vm=require('node:vm');
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const code=html.split('// BEGIN DUNGEON ARRIVAL')[1].split('// END DUNGEON ARRIVAL')[0];
function harness(reduced=false){
 const motion=[],tones=[],cancelled=[];
 const context=vm.createContext({
  poiWalkActive:true,pineAIActive:false,
  facilitySite:{id:'base',
   mine:{bounds:{x1:86,x2:125,z1:50,z2:63,y:-1}},
   chapel:{bounds:{x1:60,x2:82,z1:73,z2:90,y:-1}},
   otherworld:{bounds:{x1:95,x2:108,z1:72,z2:92,y:-1}}},
  matchMedia:()=>({matches:reduced}),poiSound:s=>tones.push(s),
  $:id=>{assert.equal(id,'poiDungeonFade');return {animate(frames,opts){
   motion.push({frames,opts});return {cancel(){cancelled.push(opts.duration)}};
  }}}
 });
 vm.runInContext(code,context);
 return {...context,context,motion,tones,cancelled,serial:()=>vm.runInContext('poiDungeonEntranceSerial',context)};
}
const paths=[[116,62],[78,88],[100,90]];
test('exits from the three themed underground routes give one short nonblocking fade',()=>{
 for(const [x,z] of paths){
  const h=harness();
  assert.equal(h.poiDungeonExitEffect(x,z,-1,0),true);
  assert.equal(h.motion.length,1);
  assert.equal(h.motion[0].opts.duration,300);
  assert.equal(h.motion[0].frames.at(-1).opacity,0);
  assert(h.motion[0].frames[0].opacity>=.7);
  assert.deepEqual(h.tones,[],'exit does not reuse the dungeon entry audio');
  assert.equal(h.serial(),0,'exit cannot change entry serial');
 }
 assert.match(html,/#poiDungeonFade\{[^}]*pointer-events:none/);
});
test('ordinary cellar, surface, lower floor changes, inactive walk and AI mode do not trigger an exit fade',()=>{
 const h=harness();
 for(const args of [[28,32,-1,0],[116,62,0,0],[116,62,0,-1],[116,62,-1,-2],[116,62,-1,1]]){
  assert.equal(h.poiDungeonExitEffect(...args),false);
 }
 h.context.pineAIActive=true;
 assert.equal(h.poiDungeonExitEffect(116,62,-1,0),false);
 h.context.pineAIActive=false;h.context.poiWalkActive=false;
 assert.equal(h.poiDungeonExitEffect(116,62,-1,0),false);
 assert.equal(h.motion.length,0);
});
test('reduced motion and rapid transition preserve established entry timing and count',()=>{
 const h=harness(true);
 assert.equal(h.poiDungeonEnterEffect(116,62,0,-1),true);
 assert.equal(h.poiDungeonExitEffect(116,62,-1,0),true);
 assert.deepEqual(h.motion.map(m=>m.opts.duration),[190,150]);
 assert.deepEqual(h.cancelled,[190]);
 assert(h.motion[1].frames[0].opacity<=.45);
 assert.deepEqual(h.tones,['dungeon-enter']);
 assert.equal(h.serial(),1);
});
test('exit animation is wired only to the shared canonical stair and successful portal transactions',()=>{
 const portal=html.slice(html.indexOf('function poiOtherworldUseStep('),html.indexOf('function poiOtherworldEnemyMayFight('));
 const step=html.slice(html.indexOf('function poiWalkEnterCell('),html.indexOf('function poiNorthTrailForkSignReachable('));
 assert.match(portal,/if\(!safe\)[^\n]+[\s\S]+poiDungeonExitEffect\(route\.from\.x,route\.from\.z,prior,to\.y\)/);
 assert.match(step,/poiWalkLevel=next[\s\S]+poiDungeonExitEffect\(poiWalkX,poiWalkZ,prior,next\)/);
 assert.equal((html.match(/poiDungeonExitEffect\(/g)||[]).length,3);
});
