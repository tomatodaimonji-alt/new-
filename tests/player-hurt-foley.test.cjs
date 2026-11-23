const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const slice=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return html.slice(i,j)};
const mob=slice('function poiMobHitPlayer(','function '),sound=slice('function poiSound(','function poiAudioSyncLifecycle(');
function combat(hp,armor=undefined,{scriptedDeath=true}={}){
 const events=[];
 const c=vm.createContext({poiPlayerHP:hp,poiPlayerDamageAfterArmor:raw=>armor??raw,poiHotbarHasKit:()=>true,
  poiPlayerDeathBegin:()=>{if(scriptedDeath)events.push('player-defeat');return scriptedDeath},
  poiWalkX:2,poiWalkZ:2,poiWalkViewX:2,poiWalkViewZ:2,poiWalkLevel:0,poiSpawnX:1,poiSpawnZ:1,facilitySite:null,
  poiSound:c=>events.push(c),terrainY:()=>0,poiDamageNumber(){},poiCombatHud(){},poiWalkReset(){},toast(){},
  poiDamageLabels:[],POI_PLAYER_MAX_HP:100});
 vm.runInContext(mob,c);return {c,events};
}
test('only an actual surviving player HP reduction plays one hurt; absorbed, duplicate-dead and lethal contacts never layer it',()=>{
 const o={type:'monsterSlime'};
 for(const [hp,armor,expected,cues,scriptedDeath] of [
  [100,undefined,82,['player-hurt'],true],[100,4,96,['player-hurt'],true],[100,0,100,[],true],
  [7,undefined,0,['player-defeat'],true],[7,undefined,100,['player-hurt'],false]
 ]){
  const {c,events}=combat(hp,armor,{scriptedDeath});c.poiMobHitPlayer(o,2400,18);
  assert.equal(c.poiPlayerHP,expected);assert.deepEqual(events,cues);
 }
 const dead=combat(0,0,{scriptedDeath:false});dead.c.poiMobHitPlayer(o,2500,18);assert.deepEqual(dead.events,[]);
 assert.match(html,/if\(typeof poiSound==='function'\)poiSound\('hurt'\);/,'other combatants keep their old cue');
});
test('recorded player cue enters existing synchronous SE bus and respects mute/foreground; NPC hurt retains synth',()=>{
 function play(kind,{master=62,se=75,allowed=true,recorded=true}={}){
  const trace=[];
  const c=vm.createContext({poiWalkActive:true,poiAudioEnabled:true,poiAudioAllowed:()=>allowed,poiAudioStart(){},
   poiAudioContext:{state:'running',currentTime:4.25},poiAudioLevels:{master,se},POI_WEAPON_SE:{},
   poiTryRecordedFoley:(...a)=>{trace.push(a);return recorded},poiAudioNoiseBurst:()=>trace.push('noise'),
   facilitySite:null,poiAudioThud:()=>trace.push('thud'),poiDefeatSound:()=>trace.push('defeat')});
  vm.runInContext(sound,c);c.poiSound(kind);return trace;
 }
 const actual=play('player-hurt');
 assert.equal(actual.length,1);assert.equal(actual[0][0],'playerHurt');assert.equal(actual[0][1],4.25);
 assert(actual[0][2]>=.64&&actual[0][2]<.76);
 for(const opts of [{master:0},{se:0},{allowed:false}])assert.deepEqual(play('player-hurt',opts),[]);
 assert.deepEqual(play('hurt'),['noise','thud']);
 assert.deepEqual(play('player-defeat'),['defeat']);
 assert.deepEqual(play('player-hurt',{recorded:false}).slice(1),['noise','thud']);
});
test('offline player hurt bundle is bounded, valid PCM with safe peak and no network',()=>{
 const row=html.match(/\n playerHurt:\n([\s\S]+?),\n/)?.[1];assert.ok(row,'recorded playerHurt exists');
 const pcm=Buffer.from([...row.matchAll(/'([A-Za-z0-9+/=]+)'/g)].map(x=>x[1]).join(''),'base64');
 assert(pcm.length>=6000&&pcm.length<=12100&&pcm.length%2===0);
 let peak=0,energy=0;for(let p=0;p<pcm.length;p+=2){const s=pcm.readInt16LE(p);peak=Math.max(peak,Math.abs(s));energy+=s*s}
 assert(peak>=11000&&peak<=27500);assert(Math.sqrt(energy/(pcm.length/2))>=950);
 assert.equal(pcm.readInt16LE(0),0);assert.equal(pcm.readInt16LE(pcm.length-2),0);
});
