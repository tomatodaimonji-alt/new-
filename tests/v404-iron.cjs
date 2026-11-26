const fs=require('node:fs'), vm=require('node:vm'), a=require('node:assert/strict'),{test}=require('node:test');
const s=fs.readFileSync(process.env.WORKSHOP_HTML||'candidate.html','utf8'),cut=(x,y)=>{const i=s.indexOf(x),j=s.indexOf(y,i+x.length);a(i>=0&&j>i,x);return s.slice(i,j)};
test('iron actually strikes and recovers at grade 2 while preserving range and power',()=>{
 const ctx={POI_PLAYER_ATTACK:16,POI_HOTBAR_SWORD_BONUS:12,POI_KNIFE_BONUS:12,poiStatGrade:x=>Math.min(10,Math.max(1,Math.round(x)))};
 vm.createContext(ctx);vm.runInContext(s.match(/^const POI_SWORD_PROFILE=.*$/m)[0]+cut('function poiAttackGrade(','function poiLearnedChance(')+cut('const POI_ORVAS_JUDGMENT_POWER=', 'let poiPlayerWeaponPending=').replace('return POI_DAVID_SWEEP_FORWARD','return 4'),ctx);
 const p=vm.runInContext('POI_PLAYER_WEAPON_PROFILES.equipIronSword',ctx);
 a.deepEqual([p.speedStars,p.range,p.damage,p.hit,p.ready,p.pose],[2,2,30,140,453,383]);
});
test('iron alone plays the new restrained swing and contact, old non-player and other weapon routes preserved',()=>{
 const calls=[],ctx={poiAudioNoiseBurst:(...x)=>calls.push(['air',...x]),poiAudioThud:(...x)=>calls.push(['body',...x]),poiAudioTone:()=>calls.push(['tone']),poiTryRecordedFoley:(...x)=>{calls.push(['old',...x]);return true;}};
 vm.createContext(ctx);vm.runInContext(cut('const POI_WEAPON_SE=', 'function poiDefeatSound('),ctx);
 const go=(kind,id,delay=0,player=true)=>{calls.length=0;vm.runInContext("poiWeaponSound("+JSON.stringify(kind)+",POI_WEAPON_SE["+JSON.stringify(id)+"],10,"+delay+","+player+")",ctx);return [...calls]};
 const swing=go('attack','equipIronSword'),hit=go('hit','equipIronSword');
 a.deepEqual(swing.map(x=>x[0]),['air','air','body']);a.equal(swing[0][1],10.05);
 a.deepEqual(hit.map(x=>x[0]),['body','air','air']);a.equal(hit[0][1],10);
 a.equal(go('hit','equipIronSword',.108)[0][1],10.108);
 a.equal(go('attack','equipNorthMinotaurAxe')[0][1],'playerSteelSwing');
 a.equal(go('hit','equipIronSword',.108,false)[0][1],'steelImpact');
 a.equal(go('hit','equipBoneSword')[0][1],'playerSteelCut');
});
