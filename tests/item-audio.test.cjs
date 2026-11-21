const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
test('success cues are distinct, vary by material and honor the existing effects levels',()=>{
 const item=html.match(/\/\/ BEGIN ITEM FOLEY\n([\s\S]*?)\/\/ END ITEM FOLEY/);
 assert.ok(item,'item foley module exists');
 const calls=[],c={poiAudioLevels:{master:85,se:90},poiAudioEffects:{},Math,
  poiAudioNoiseBurst:(...v)=>calls.push(['noise',...v]),poiAudioThud:(...v)=>calls.push(['thud',...v]),
  poiAudioTone:(...v)=>calls.push(['tone',...v])};
 vm.createContext(c);vm.runInContext(item[1],c);
 const play=(kind,material)=>{calls.length=0;c.poiItemSound(kind,material,1);return calls.map(a=>a.slice())};
 const loot=play('enemy-loot','coin'),wood=play('inventory-drop','equipWoodSword'),herb=play('inventory-drop','healingHerb');
 const coin=play('item-pickup','coin'),pickup=play('item-pickup','healingHerb');
 for(const a of [loot,wood,herb,coin,pickup])assert.ok(a.length>=2);
 assert.ok(loot[0][1]>1.14);assert.notDeepEqual(wood,herb);assert.notDeepEqual(coin,pickup);
 for(const key of ['master','se']){const before=c.poiAudioLevels[key];c.poiAudioLevels[key]=0;assert.deepEqual(play('item-pickup','coin'),[]);c.poiAudioLevels[key]=before}
});
test('each cue is downstream of its successful spawn, write, and claim only',()=>{
 const slice=(a,b)=>html.slice(html.indexOf('function '+a),html.indexOf('function '+b));
 assert.match(slice('poiEconomyDrop','poiEconomyCollect'),/poiEconomyDrops\.set[\s\S]*poiSound\('enemy-loot','coin'\)/);
 assert.match(slice('poiEconomyCollect','poiEconomySnapshot'),/if\(!poiEconomyWrite[\s\S]*poiEconomyDrops\.delete[\s\S]*poiSound\('item-pickup','coin'\)/);
 assert.match(slice('poiInventoryDrop','poiInventoryPickup'),/if\(!poiEconomyWrite[\s\S]*poiSound\('inventory-drop',type\)/);
 assert.match(slice('poiInventoryPickup','poiInventoryReleaseMesh'),/if\(!poiEconomyWrite[\s\S]*poiSound\('item-pickup',item\.type\)/);
 assert.match(slice('poiSound','poiEconomyAllowed'),/!poiWalkActive\|\|!poiAudioEnabled\|\|!poiAudioAllowed\(\)[\s\S]*poiItemSound/);
});
