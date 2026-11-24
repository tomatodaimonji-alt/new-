const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8'),name='オルヴァスの大神殿';
test('canonical temple metadata and editor names agree while internal IDs stay fixed',()=>{
 const actual=html.match(/const name='([^']+)',boss=\{\.\.\.P\(ring.x,ring.z\),type:'monsterStoneDavid'/);
 a.equal(actual?.[1],name);
 const first=html.indexOf("palette.push(\n {id:'monsterStoneDavid'"),last=html.indexOf('const catalog',first),parts=[];
 a(first>=0&&last>first);
 vm.runInNewContext(html.slice(first,last),{palette:parts});
 const map=Object.fromEntries(parts.map(p=>[p.id,p.name]));
 a.equal(map.monsterStoneDavid,'オルヴァス');
 const expected=['poiDavidGatePier','poiDavidTempleColumn','poiDavidWaystone','poiDavidWallRound','poiDavidSacredRoof','poiDavidTunnelRoof','poiDavidWallWingTall','poiDavidWallTunnel','poiDavidWallHeader','poiDavidCandleSconce','poiDavidDome','poiDavidWallWing'];
 a.equal(Object.keys(map).length,expected.length+1);
 expected.forEach(id=>a(map[id]?.startsWith(name+'・'),id));
 a(!/白環の大神殿|白環神殿|白環の石像|白環の道標/.test(html));
});
