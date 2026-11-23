const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const l=html.indexOf('function poiItemSound('),r=html.indexOf('// END ITEM FOLEY',l);
a(l>=0&&r>l);
const visit=(kind,material,levels={master:85,se:90})=>{
 const events=[],record=name=>(...args)=>events.push([name,...args]);
 const c=vm.createContext({poiAudioLevels:levels,poiAudioNoiseBurst:record('brush'),poiAudioTone:record('tone'),poiAudioThud:record('touch'),poiAudioEffects:'effects'});
 vm.runInContext(html.slice(l,r),c);c.poiItemSound(kind,material,5);return events;
};
test('all non-gold pickups have the very same short soft sound; coins have their own',()=>{
 const same=visit('item-pickup','healingHerb');
 a(same.length>1);
 for(const type of ['cannedFood','equipWoodSword','equipStoneMace','armorIronTorso','kitchenKnife','fireWand'])a.deepEqual(visit('item-pickup',type),same,type);
 for(const type of ['cannedFood','equipWoodSword','kitchenKnife'])a.deepEqual(visit('chest-pickup',type),visit('chest-pickup','healingHerb'),type);
 const coin=visit('item-pickup','coin');a.notDeepEqual(coin,same);
 a.equal(coin.some(v=>v[0]==='tone'&&v[1]===1480),true,'coin still rings');
 a.deepEqual(visit('item-pickup','equipWoodSword',{master:0,se:90}),[]);
 a.deepEqual(visit('item-pickup','coin',{master:85,se:0}),[]);
});
