const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('only real surface-to-dungeon entry fades and plays its sound, including quick successive entries',()=>{
 const a=html.indexOf('// BEGIN DUNGEON ARRIVAL'),b=html.indexOf('// END DUNGEON ARRIVAL',a);
 assert(a>=0&&b>a,'expected an isolated entrance effect');
 const calls=[];let last;
 const p={id:'base',mine:{bounds:{x1:97,x2:125,z1:41,z2:67,y:-1}},otherworld:{bounds:{x1:95,x2:108,z1:72,z2:92,y:-1}}};
 const c=vm.createContext({facilitySite:p,poiWalkActive:true,pineAIActive:false,poiSound:k=>calls.push(k),
  $:()=>({animate(frames,opts){const run={frames,opts,cancelled:false,cancel(){this.cancelled=true}};last=run;return run}})});
 const r=s=>vm.runInContext(s,c);
 r(html.slice(a,b));
 assert.equal(r('poiDungeonEnterEffect(116,62,0,-1)'),true);
 const mine=last;
 assert.equal(mine.opts.duration,430);assert.equal(mine.frames.at(-1).opacity,0);
 assert.equal(r('poiDungeonEnterEffect(116,62,-1,0)'),false);
 assert.equal(r('poiDungeonEnterEffect(27,32,0,-1)'),false);
 assert.equal(r('poiDungeonEnterEffect(100,90,0,-1)'),true);
 assert(mine.cancelled);assert.deepEqual(calls,['dungeon-enter','dungeon-enter']);
 assert.equal(r('poiDungeonEntranceSerial'),2);
});
