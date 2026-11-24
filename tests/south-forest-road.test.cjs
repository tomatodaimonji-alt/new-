const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite'),site=build('base');
const key=o=>[o.x,o.z,o.y].join(',');
test('forest is a dry continuously walkable append without trading city or snow at this gate',()=>{
 const f=site.southForest;a.ok(f,'authored forest route missing');
 a.equal(f.name,'潮風の森');a.equal(site.map.width,128);a.equal(site.map.height,128);
 a.equal(key(f.route[0]),key(site.southPort.market.public));a.equal(key(f.route.at(-1)),key(f.rest));
 a.ok(f.route.length>=42&&f.route.length<=58);
 for(const [i,p] of f.route.entries()){
  if(i){const q=f.route[i-1];a.equal(Math.abs(q.x-p.x)+Math.abs(q.z-p.z),1)}
  const tiles=site.map.world.filter(o=>key(o)===key(p));a(tiles.length===1&&/^(road|earth|grass)/.test(tiles[0].type),key(p));
 }
 const prev=site.map.world.slice(0,f.authored.index),newTiles=site.map.world.slice(f.authored.index),oldSlots=new Set(prev.map(key));
 a.equal(prev.length,8832);a(newTiles.length<=190&&newTiles.every(o=>!oldSlots.has(key(o))&&o.y===0));
 a(f.props.filter(o=>/^tree/.test(o.type)).length>=15);a(f.props.some(o=>o.type==='benchWood'));a(f.props.some(o=>o.type==='lantern'));
 a(!newTiles.some(o=>/snow|portal|monster/i.test(o.type)));
 const digest=crypto.createHash('sha256').update(JSON.stringify(prev)).digest('hex');
 a.equal(digest,process.env.PREFIX_SHA||'ea2d84b74e1014e92d3dd9bf218944f6f1dde29374f1dfc83f9edf43c4344813');
});
test('the forest named passage remains outdoors and only its immediate tree and rest assets register for a local VBO',()=>{
 const f=site.southForest;a.ok(f,'authored forest route missing');site.id='base';
 const c=vm.createContext({facilitySite:site,poiWalkActive:true,poiWalkX:54,poiWalkZ:119,poiWalkLevel:0,
  poiSouthTownContains:()=>false});
 vm.runInContext(cut('// BEGIN SOUTH FOREST LOCAL','// END SOUTH FOREST LOCAL')+
  cut('const POI_SAFE_TOWN=','// BEGIN LOCATION PANEL MOTION')+cut('function poiAudioSurfaceMusicZone(','function poiOrchestraScene('),c);
 const found=c.poiRegionAt(site,54,119,false,0);
 a.equal(found.name,'潮風の森');a.equal(c.poiAudioSurfaceMusicZone(found),'outside');
 a.equal(c.poiSouthForestContains(site,84,115,0),false,'fish market still itself');a.equal(c.poiSouthForestContains(site,54,119,-1),false);
 a(f.props.every(c.poiSouthForestMember));a(!c.poiSouthForestMember(site.southPort.props[0]));
 a(!c.poiSouthForestMember(site.map.world.find(o=>o.type==='earth'&&o.z<70)));
});
test('old saves on newly solid forest props resume on the nearest unoccupied dry forest surface only',()=>{
 const f=site.southForest;a.ok(f);site.id='base';
 const world=site.map.world.slice(),blocked=new Set();
 const c=vm.createContext({facilitySite:site,world,poiWalkLevel:-1,
  poiWalkCanStep:(x,z)=>!blocked.has(x+','+z)&&!world.some(o=>o.x===x&&o.z===z&&o.y===0&&/^(tree|rockMossy|fallenLog|ruinStonePost)/.test(o.type))});
 vm.runInContext(cut('// BEGIN SOUTH FOREST LOCAL','// END SOUTH FOREST LOCAL'),c);
 const recover=p=>c.poiSouthForestRecoverPosition(p);
 for(const prop of f.props.filter(o=>/^(tree|rockMossy|fallenLog|ruinStonePost)/.test(o.type))){
  const p={x:prop.x,z:prop.z,y:0,facing:3},q=recover(p),d=Math.abs(q.x-p.x)+Math.abs(q.z-p.z);
  a.ok(d>=1&&d<=2,JSON.stringify(p));a.equal(q.facing,3);a.equal(q.y,0);
  const nearest=world.filter(o=>o.y===0&&/^(road|earth|grass)/.test(o.type)&&c.poiWalkCanStep(o.x,o.z))
   .reduce((n,o)=>Math.min(n,Math.abs(o.x-p.x)+Math.abs(o.z-p.z)),Infinity);
  a.equal(d,nearest);
 }
 const p={...f.props.find(o=>o.type==='treeCedar'),facing:2};
 const q=recover(p);blocked.add(q.x+','+q.z);a.notDeepEqual(recover(p),q,'occupied candidate bypassed');blocked.clear();
 for(const unchanged of [f.rest,f.route[0],{...p,y:-1},f.props.find(o=>o.type==='benchWood'),{x:0,z:0,y:0}])a.equal(recover(unchanged),unchanged);
 world.splice(world.findIndex(o=>o.x===p.x&&o.z===p.z&&o.y===0&&o.type===p.type),1);
 a.equal(recover(p),p,'removed authored obstacle cannot move a legal checkpoint');
 a.equal(c.poiWalkLevel,-1);
 a.match(h,/function workshopResumeRestorePosition\(p\)\{[^]*?p=poiSouthForestRecoverPosition\(p\);/);
});
