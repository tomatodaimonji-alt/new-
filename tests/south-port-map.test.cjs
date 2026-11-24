const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const a=h.indexOf('const FACILITY_SITES=Object.freeze('),b=h.indexOf('function workshopResumeDecode(',a);
const build=vm.runInNewContext(h.slice(a,b)+';buildFacilitySite'),site=build('base'),p=site.southPort;
const plain=v=>JSON.parse(JSON.stringify(v)),key=o=>[o.x,o.z,o.y].join(',');
const cells=o=>site.map.world.filter(v=>key(v)===key(o));
const expectedPrefix='49466e43ba72fa3d8ce839bbbd5083a37d086e3542c4a103426b883aff3027c2';
const floors=vm.runInNewContext(h.match(/^const ROAD_(?:BASES|DIAGONALS|IDS)=.+$/gm).join("\n")+"\n"+h.match(/^function isFloor\(t\)\{.+\}$/m)[0]+";isFloor");
test('actual southern inn connects on foot to a quiet coast and safe walkable pier, with no new objects on old authored cells',()=>{
 assert(p,'south coast present');
 assert.equal(p.name,'潮待ちの港');assert.equal(site.map.width,128);assert.equal(site.map.height,128);
 assert.equal(key(p.approach[0]),'105,111,0');assert.equal(key(p.entrance),'91,123,0');
 assert.equal(key(p.dock.end),'73,118,0');assert.equal(key(p.dock.waterAhead),'72,118,0');
 const all=[...p.approach,...p.dock.route.slice(1)];
 for(let i=0;i<all.length;i++){
  const v=all[i];assert.equal(v.y,0);
  if(i){const old=all[i-1];assert.equal(Math.abs(old.x-v.x)+Math.abs(old.z-v.z),1,key(v));}
  const at=cells(v);assert(at.length&&at.every(o=>/^(road|woodfloor|grass|earth|stone)/.test(o.type)),key(v));
 }
 const prefix=site.map.world.slice(0,p.authored.index),prior=new Set(prefix.map(key)),added=site.map.world.slice(p.authored.index);
 assert(added.every(o=>!prior.has(key(o))), 'no placements overlap any prior authored records');
 assert(added.length<=420&&added.every(o=>o.x>=0&&o.x<128&&o.z>=0&&o.z<128&&o.y===0&&!o.type.startsWith('monster')));
 const tiles=new Set();for(const o of site.map.world){if(o.y!==0||!floors(o.type))continue;assert(!tiles.has(key(o)),"unique ground "+key(o));tiles.add(key(o));}
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(prefix)).digest('hex'),expectedPrefix);
});
test('market counter leaves separate player, seller and passage cells; water connects to map edge without colliding with skiffs and walk cells',()=>{
 assert(p,'south coast present');
 assert.equal(key(p.market.stall),'84,116,0');
 for(const side of [p.market.public,p.market.work,p.market.prep,p.market.rest,p.fisher.berth,p.fisher.rest]){
  assert.equal(cells(side).length,1,key(side));assert.match(cells(side)[0].type,/^(road|stone|woodfloor|earth)/);
 }
 assert(cells(p.market.stall).some(o=>o.type==='poiPortFishStall'));
 assert(cells(p.dock.waterAhead).some(o=>o.type==='sea'));
 const tides=new Set(p.water.map(key));assert(tides.size>=125);
 assert(p.water.some(o=>o.z===127),'sea connects to the south world edge');
 assert(p.water.every(o=>cells(o).some(x=>x.type==='sea')));
 assert(!p.dock.route.some(o=>tides.has(key(o))));
 assert(!p.dock.route.some(o=>[p.fisher.berth,p.fisher.rest].some(stand=>key(o)===key(stand))),'fisher stations cannot block the through-dock');
 assert(site.map.world.filter(o=>o.type==='poiPortSkiff').every(o=>tides.has(key(o))));
 assert(p.future.every(o=>!p.water.some(v=>key(v)===key(o))&&!site.map.world.slice(p.authored.index).some(v=>key(v)===key(o))));
});
