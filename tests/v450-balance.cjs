const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const h=fs.readFileSync(process.argv[2],'utf8');
const take=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a.ok(i>=0&&j>i);return h.slice(i,j)};
const strip=h.match(/^const POI_MONSTER_STATS=.*;$/m)?.[0];
const c=vm.createContext({POI_AIM_EPS:1e-7,frontierSouthRuinsOwn:()=>true,poiAimWall:()=>()=>true,poiAimWallLimit:(_,d,r,pass)=>pass(d.x)?r:Math.min(r,.5)});
vm.runInContext(strip+'\n'+take('// BEGIN SOUTH SENTINEL COMBAT','// END SOUTH SENTINEL COMBAT')+
 take('function poiEnemyRangedCovers(','function poiEnemyRangedContact(')+
 ';globalThis.f={s:POI_SOUTH_SENTINELS,stats:POI_MONSTER_STATS,aim:poiSouthSentinelAim,covered:poiSouthSentinelCovered};',c);
const {s,stats,aim,covered}=c.f,regent={type:'monsterObsidianRegent',y:-1},hound={type:'monsterBasaltHound',y:-1};
const m={x:0,z:0,hp:stats.monsterObsidianRegent.hp,attackVisualSequence:0};
a.equal(aim(regent,m,0,5.5),null,'no long lane in phase one');
const near=aim(regent,m,0,1.8), pulse=aim(regent,{...m,attackVisualSequence:1},0,1.8);
a.equal(near.key,'cleave');a.equal(pulse.key,'pulse');
a.equal(covered(near,{x:0,z:1.8,y:-1}),true);a.equal(covered(near,{x:1.95,z:0,y:-1}),false);
a.equal(covered(pulse,{x:0,z:1.8,y:-1}),true);a.equal(covered(pulse,{x:0,z:3.75,y:-1}),false);
const line=aim(regent,{...m,hp:Math.ceil(m.hp*.4)},0,5.5);
a.equal(line?.key,'regent-rune','phase two should still threaten enemies outside melee range');
a.equal(covered(line,{x:0,z:5.5,y:-1}),true);a.equal(covered(line,{x:1.2,z:5.5,y:-1}),false);
c.poiAimWall=()=>dx=>dx<.1;a.equal(aim(regent,{...m,hp:200},5.5,0),null);
a.ok(near.windup>=850&&pulse.windup>=1100&&line.windup>=900,'readable warnings');
a.ok(near.damage+pulse.damage-12*2>=100,'baseline F player cannot take two unavoided heavy attacks even at 12 defense');
a.ok(s.monsterBasaltHound.patterns[0].cool<1200&&aim(hound,{...m,hp:140},0,2.05));
a.ok(stats.monsterObsidianRegent.hp>750&&stats.monsterObsidianRegent.hp<900);
const iron=h.match(/^ equipIronSword:\{\.\.\.POI_SWORD_PROFILE,range:2,damage:26,hit:245,ready:740,pose:560,speedStars:2\},$/m);a.ok(iron,'existing iron sword remains unchanged');
console.log('PASS stronger dungeon roster, readable lanes/fans/rings, second-phase range and unchanged iron sword');
