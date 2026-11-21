const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const html=readFileSync(process.env.HTML||'world-editor.html','utf8');
const extract=(from,to)=>{const a=html.indexOf(from),b=html.indexOf(to,a+from.length);assert(a>=0&&b>a,from);return html.slice(a,b)};
test('facility uses the same default directional pad, center button, and game-region keyboard as ordinary play',()=>{
 assert.doesNotMatch(html,/#app\.facilitySession #poiWalkPad|#app\.facilitySession #poiWalkAction/);
 assert.match(html,/id="poiWalkAction"[^>]*>攻撃<br>決定/);
 assert.match(html,/facilitySite&&e\.target[\s\S]{0,80}\.closest(?:\?\.)?\('button,a\[href\],summary'\)/);
});
test('facility center attack can hit current-floor monsters without writing any save',()=>{
 let now=810,saveCalls=0,avatarCalls=0,damages=[];
 const other={hp:55,x:3,z:1},active={hp:55,x:3,z:1};
 const ctx=vm.createContext({poiWalkActive:true,facilitySite:{},poiWalkLevel:1,
  poiWalkFacing:0,poiWalkX:3,poiWalkZ:2,poiAttackReady:0,poiWalkActionStarted:0,
  performance:{now:()=>now},poiWalkAvatar:()=>avatarCalls++,poiSound(){},toast(){},terrainY:()=>0,
  poiMonsterStates:new Map([[{y:0},other],[{y:1},active]]),POI_PLAYER_ATTACK:20,
  poiDamageNumber:(...d)=>damages.push(d),poiMonsterMeshDirty:false,pineGameActive:false,
  pineGameSave(){saveCalls++}});
 const js=extract('function poiMonsterAt(', 'function poiMonsterCanMove(')+
  extract('function poiWalkAction(', 'function poiWalkReset(');
 vm.runInContext(js+'\npoiWalkAction();',ctx);
 assert.equal(avatarCalls,1);assert.equal(other.hp,55);assert.equal(active.hp,35);
 assert.equal(damages[0][2],3.2);assert.equal(saveCalls,0);
 vm.runInContext('poiWalkAction();',ctx);
 assert.equal(active.hp,35,'cooldown must be shared');
 now+=301;
 vm.runInContext('poiWalkAction();',ctx);
 assert.equal(active.hp,15);
 assert.equal(saveCalls,0);
});
