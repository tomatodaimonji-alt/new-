const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const s=fs.readFileSync(process.argv[2]??'world-editor.html','utf8');
for(const match of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) if(match[1].trim())new vm.Script(match[1]);
const cut=(first,last)=>{const i=s.indexOf(first),j=s.indexOf(last,i);a.ok(i>=0&&j>i,first);return s.slice(i,j);};
const fn=name=>{const p=s.indexOf('function '+name+'(');a.ok(p>=0,name);return s.slice(p,s.indexOf('\n}',p)+2)};
const get=vm.runInNewContext(
 s.match(/const POI_SWORD_PROFILE=[^\n]+/)[0]+'\n'+
 cut('function poiAttackGrade(','function poiLearnedChance(')+
 cut('const POI_ORVAS_JUDGMENT_POWER=','let poiPlayerWeaponPending=')+
 s.match(/function poiPlayerWeaponProfile[^\n]+/)[0]+'\n'+fn('poiItemDetailWeaponStats')+
 '\n(t)=>({p:poiPlayerWeaponProfile(t),stars:poiItemDetailWeaponStats(t)})',
 {poiStatGrade:n=>Math.max(0,Math.min(10,n)),POI_PLAYER_ATTACK:20,POI_HOTBAR_SWORD_BONUS:8,POI_KNIFE_BONUS:3,POI_DAVID_SWEEP_FORWARD:4});
const types=['equipWoodBow','equipIronSword','equipWoodSword','equipIronSpear','equipWoodSpear','equipStick','equipWalkingCane','equipBallpointPen'];
const rows=types.map(t=>({t,...get(t)}));
for(const {t,p,stars} of rows)for(const {t:u,p:q,stars:other} of rows)
 if(stars.speed>other.speed)a.ok(p.ready<q.ready,`${t} ★${stars.speed} (${p.ready}) must repeat sooner than ${u} ★${other.speed} (${q.ready})`);
for(const {t,p} of rows)a.ok(p.hit>0&&p.hit<p.pose&&p.pose<=p.ready,t);
const iron=get('equipIronSpear').p,wood=get('equipWoodSpear').p,ironSword=get('equipIronSword').p,woodSword=get('equipWoodSword').p;
a.equal(wood.damage,24);a.ok(iron.damage>=24&&iron.damage<=26);
a.ok(iron.range>wood.range);a.equal(iron.shaftScale,.75);
a.equal(ironSword.sweep,true);a.ok(ironSword.damage<=26);a.ok(woodSword.damage<=20);
a.equal(get('equipIronSword').stars.speed,2);a.equal(get('equipWoodSword').stars.speed,3);
a.equal(get('equipWoodBow').stars.reach,6);a.equal(get('equipBallpointPen').stars.speed,7);
a.match(s,/frontiersugimoto:'equipIronSpear',frontiermiyamoto:'equipIronSpear'/);
console.log(rows.map(({t,p,stars})=>[t,stars.speed,stars.reach,p.damage,p.hit,p.ready]));
