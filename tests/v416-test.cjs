const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const s=fs.readFileSync(process.argv[2],'utf8'),lines=s.split('\n');
const fn=name=>{const i=lines.findIndex(x=>x.startsWith('function '+name+'('));a.ok(i>=0,name);
 return lines.slice(i,lines[i].endsWith('}')?i+1:lines.findIndex((x,j)=>j>i&&x==='}')+1).join('\n')};
const c={POI_PLAYER_BASE_ATTACK:1,POI_PLAYER_BASE_DEFENSE:1,poiPlayerWeaponProfile:t=>t==='steel'?{damage:30}:null,
 poiArmorWorn:k=>k.worn,poiEquipmentDefense:t=>t==='boots'?1:0};
const stats=vm.runInNewContext([fn('poiPlayerWeaponPower'),fn('poiPlayerAttackDamage'),fn('poiPlayerDefense'),fn('poiPlayerDamageAfterArmor'),'[poiPlayerAttackDamage,poiPlayerDefense,poiPlayerDamageAfterArmor]'].join('\n'),c);
a.equal(stats[0](null),1);a.equal(stats[0]('steel'),31);a.equal(stats[1]({worn:{}}),1);a.equal(stats[2](9,{worn:{feet:'boots'}}),7);
const allowed=new Set(['0,0','1,0','2,0','2,1','2,2']);
const c2={POI_AIM_EPS:1e-6,poiWalkViewX:0,poiWalkViewZ:0,frontierBurrowCell:(x,z)=>allowed.has(x+','+z),frontierRuinsGateAt:(x,z)=>x===1&&z===0,frontierRuinsGateOpen:()=>c2.open};
const clear=vm.runInNewContext([fn('poiAimUnit'),fn('poiAimWallLimit'),fn('frontierRuinsBarLineClear'),'frontierRuinsBarLineClear'].join('\n'),c2);
c2.open=true;a.ok(clear({x:2.5,z:.5},[.5,1,.5]));a.ok(!clear({x:2.5,z:2.5},[.5,1,.5]));c2.open=false;a.ok(!clear({x:2.5,z:.5},[.5,1,.5]));
a.match(s,/id="poiMineUnlockProgress" hidden><progress max="2500"/);
a.match(s,/poiMineUnlockStart\(performance\.now\(\),FRONTIER_RUINS_CHEST_KEY\)/);
a.match(s,/if\(cut==='elder'&&look\.beard!==false\)/);
a.match(s,/if\(!bag.hidden\|\|source\.dataset\.hotbarSlot!==undefined\)\{const result=poiDropGoldStack/);
console.log('base stats and weapon power, cave wall/gate occlusion, old unlock UI at 2.5s and wallet drop routing');
