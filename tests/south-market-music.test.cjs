const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync('world-editor.html','utf8'),slice=(x,y)=>h.slice(h.indexOf(x),h.indexOf(y,h.indexOf(x)+1));
test('new market music has a soft plucked melody and a distinct bounded eight-bar loop',()=>{
 const heard=[],c=vm.createContext({poiPianoKey:(hz,at,gain,bus,pluck)=>heard.push({hz,at,gain,bus,pluck}),poiAudioTone(){}});
 vm.runInContext(slice('const POI_DUNGEON_SCORES=','// BEGIN DUNGEON ARRIVAL')+';this.score=POI_DUNGEON_SCORES.market',c);
 a.equal(c.score?.bars.length,8);a.equal(c.score?.root.length,8);
 for(let t=0;t<31;t+=.2)c.poiAudioDungeonPhrase('market',t,'destination',true);
 a(heard.length>22);a(heard.some(n=>n.pluck));a(heard.some(n=>!n.pluck));
 a(heard.every(n=>n.gain<=.23&&n.at>=0&&n.bus==='destination'&&n.hz>50));
 const count=heard.length;for(let t=31;t<35;t+=.2)c.poiAudioDungeonPhrase('market',t,'destination',false);a.equal(heard.length,count);
});
test('only inside the named town chooses market audio, but stops clear the loop',()=>{
 a.match(slice('function poiAudioMusicZone(','function poiAudioTownRegionMusic('),/poiSouthTownContains\(facilitySite,poiWalkX,poiWalkZ,floor\)\?'market'/);
 a.match(slice('function poiAudioTownRegionMusic(','let poiMusicBars='),/\['mine','otherworld','chapel','market'\]/);
 a.match(h,/delete poiDungeonMusicClocks\.market/);
});
