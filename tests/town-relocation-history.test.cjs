const {kitchenChestAddedV162}=require('./kitchen-chest-history.cjs');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const {createHash}=require('node:crypto');
const canalHistory=require('./canal-history-fixture.cjs');
const outsideHistory=require('./outside-history-fixture.cjs');
const gateHistory=require('./town-frame-history.cjs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const src=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];
assert(src,'authored Game World source');
const build=vm.runInNewContext(src+';buildFacilitySiteLegacyFrame');
const site=build('base');
// v208 moves exactly the pot whose old position intersected the artisan
// stall. This test uses the pre-offset builder, so (66,52) is (44,30).
const artisanPot=site.map.world.filter(o=>o.x===44&&o.z===30&&o.y===0&&o.type==='poiPottedPlant'&&o.rot===0);
assert.equal(artisanPot.length,1,'exact v208 artisan pot in the legacy frame');
artisanPot[0].x=49;
const historicalWorld=site.map.world.filter(o=>!kitchenChestAddedV162(o));
// Canonical hashes pinned from the exact shipped v136 map. The exterior
// additions/removals below enumerate individual authored changes by type,
// level, rotation and z-row, not a wildcard for a larger "changed area."
const pin=
{
  "geom": {
    "lodging": "77b62cf471d5e9f4f7d266b829cd58f4e2b06efe7e83fbda01fcd96b1986359c",
    "kitchen": "b2b15f218a342b2e133f1bfa399ffef6bc0427f44f6fea5f15e49511300ba050",
    "workshop": "8d9aa0fc2d1eac79e0571a5b967d0e4445b02a5813b1edeef18bd5085c0c1b03",
    "artisan": "3c502e839b409141d64b7daa8e3109e4c7bb210c557f722716d3026129f64ea6",
    "stable": "b1d645c97ae289fa470b922c10f4a91104189166b53c11667dddd8d25ad67561",
    "cottage": "df2eea1b458a9e64df8ba61f1cf1d1347e1c56e201e3ed762cb84bdb9e692d84",
    "rowhouse": "dacd8661ff690b1da30f44682d1ee4ba05501280f1f7211b0f3a114a4a66c217",
    "gardener": "10f6d6ca9be3bc5567465d31f1e1955db355fe2abbd55ebd6b6faa7182c8591b",
    "toolshop": "090d12bee7f9ed9f9e77ece364c1a0320c5634f58101c10e1f231d7d042b2db8",
    "townGuild": "8ce6f8efc7d99f87f3634ef7802d38a7293fb1934a4bf18c1dd5a7f8c8ffc436"
  },
  "standalone": {
    "lodging": "498744e14380c95daba753377c27f52bdf2fe890799c5cea7bff20cedc1eea85",
    "kitchen": "f9444c4f372fa2c7bfcf1d58f0180d82b11c6ac7369210baf77ab49e5de9a412",
    "workshop": "89cf5f3ddccc02b2224a7083c65c6c32eebd3cc8eaaee4b36465dd7a675caf63",
    "artisan": "256bb1cfe9a0c45804c65aaf4aa36eed48c9fa0d6cc3198c71df7de32b57b743",
    "stable": "0fcd7b4c385ced78fb604baebdd1c364147693fa25470083bc80e687f11be781",
    "homes": "26328afe9d5cfec959c179fbefb1f198251dad6cfbea7845bfbc89ed938e554e",
    "toolshop": "a6665a8516a68ce57fc56dd4ef09d42539cbe51aeb5afb44606be7a21537fdde"
  },
  "creek": "9adaa00edf4f48d962f307d6dec3018093ad1d6fe80eafd8e463e66ea3f764ec",
  "terrain": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "counts": {
    "same": 1148,
    "add": 147,
    "remove": 140
  },
  "outside": "30d255a5fcef6e2e81469e2fb315c095ac98080f133fc86cee2e431ad433991b",
  "deltaAdded": {
    "benchWood 0 0": "18:29,40",
    "benchWood 0 1": "20:27",
    "benchWood 0 3": "20:40",
    "bushFlower 0 0": "5:57",
    "handcartLoaded 0 2": "15:53",
    "lantern 0 0": "17:31,38",
    "poiStreetLamp 0 0": "21:29,39",
    "poiStreetLamp 0 1": "14:54",
    "roadCobbleFull 0 0": "11:54 12:54 13:54 14:54 15:54 16:52-54 19:42-44 20:42-44 21:26,42-44 22:26,30-31,37-38 23:26",
    "roadCutStoneFull 0 0": "17:24-38,46-48 18:24-38 19:26-41 20:26-41 21:27-41 22:32-36 44:61-63 45:61-63 46:18-20,61-63 47:18-20 48:18-20",
    "roadGravelFull 0 1": "13:53 14:53 15:53",
    "shopChestSign 0 1": "9:54",
    "treeBirch 0 0": "8:65 32:64",
    "treeOak 0 0": "22:64",
    "treePine 0 0": "3:54 6:0"
  },
  "deltaRemoved": {
    "benchWood 0 0": "19:74,85",
    "bushFern 0 0": "5:37",
    "bushFlower 0 0": "7:57 9:42",
    "earth 0 0": "45:61-63 46:18-20 47:18-20 48:18-20",
    "flowerField 0 0": "5:31",
    "grassPatch 0 0": "8:40 15:39",
    "grassTrampled 0 0": "9:40 10:40 11:40 12:40 13:40-41 14:40 15:40 44:61-63 46:61-63",
    "grassWild 0 0": "5:37 7:33 9:42 10:39 20:38 23:26",
    "handcartLoaded 0 2": "20:25",
    "lantern 0 0": "18:76,83",
    "poiStreetLamp 0 1": "19:26",
    "roadCobbleFull 0 0": "17:24-26,46-48 18:24-26 19:26",
    "roadCutStoneFull 0 0": "16:39-42,52-54 17:55-71 18:55-80 19:78-80 20:78-80 21:78-80 22:78-80 23:78-80 24:78-80",
    "roadGravelFull 0 0": "19:39-41 20:39-41 21:39-41",
    "roadGravelFull 0 1": "20:26",
    "shopChestSign 0 1": "14:26",
    "tallGrass 0 0": "3:34",
    "treeBirch 0 0": "7:64 32:62",
    "treeOak 0 0": "7:33 22:62",
    "treePine 0 0": "4:55 6:1"
  }
}
;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key=(x,z)=>x+','+z;
const record=o=>JSON.stringify([o.x,o.z,o.y,o.type,o.rot]);
function geometry(b,relative,translation=[0,0]){
 const [dx,dz]=relative?[b.x1,b.z1]:translation;
 const anchor=o=>[o.x-dx,o.z-dz];
 const footprint=Array.from(b.footprint,anchor);
 const owned=new Set(Array.from(b.footprint,p=>key(p.x,p.z)));
 const floors=Object.entries(b.floorFootprints).map(([y,p])=>[y,Array.from(p,anchor)]);
 // Sort by cell while retaining same-cell drawing/selection order.
 const items=Array.from(historicalWorld.filter(o=>owned.has(key(o.x,o.z))),o=>[o.x-dx,o.z-dz,o.y,o.type,o.rot])
  .sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
 return digest([b.id,b.name,b.turn,b.x1-dx,b.x2-dx,b.z1-dz,b.z2-dz,anchor(b.entrance),footprint,floors,items]);
}
function rampart(o){
 const {x,z,y,type}=o;
 return y===0&&/^poiFort(?:Boundary|Wall|Corner|Gate)$/.test(type)&&(
  (z===0&&x>=1&&x<=46)||(x===46&&z>=1&&z<=4)||(z===4&&x>=46&&x<=66)||
  (x===66&&z>=4&&z<=20)||(z===20&&x>=62&&x<=66)||
  (x===62&&z>=20&&z<=47)||(z===47&&x>=1&&x<=62)||(x===1&&z>=0&&z<=47));
}
function unpack(encoded){
 const records=new Set();
 for(const [label,rows] of Object.entries(encoded)){
  const [type,y,rot]=label.split(' ');
  for(const row of rows.split(' ')){
   const [z,spans]=row.split(':');
   for(const interval of spans.split(',')){
    const [a,b=a]=interval.split('-').map(Number);
    for(let x=a;x<=b;x++)records.add(record({x,z:+z,y:+y,type,rot:+rot}));
   }
  }
 }
 return records;
}
// v140 reworks only the ground interior; guild-ground-v140 protects the stock
// shell, footprint, stairs and every upper record against the original sample.
const guildGroundV140Geom='4b9cb3184f8fbdb3a12c3eb8f7e8a011e1a57101d9ff8a12b64ac2e9c6e2f7d0';
test('local geometry stays pinned after authorized translations and ground-floor Guild redesign',()=>{
 const moved={townGuild:[27,42,2,16],workshop:[55,64,6,16],cottage:[46,52,35,41],rowhouse:[52,58,23,29]};
 // Old house pins used absolute coordinates; undo only these exact translations.
 const canalTranslations={cottage:[12,1],rowhouse:[8,-13]};
 assert.deepEqual([site.map.width,site.map.height,site.buildings.length],[96,56,10]);
 assert.deepEqual({...site.spawn},{x:19,z:21});
 for(const [id,expected] of Object.entries(pin.geom)){
  const b=site.buildings.find(v=>v.id===id);
  assert.ok(b,id+' is still present');
  if(moved[id])assert.deepEqual([b.x1,b.x2,b.z1,b.z2],moved[id],id+' exact relocation');
  assert.equal(geometry(b,id==='townGuild'||id==='workshop',canalTranslations[id]),id==='townGuild'?guildGroundV140Geom:expected,id+' original stairs, doors, footprint, roof and ordered cell stacks');
 }
 for(const [id,expected] of Object.entries(pin.standalone))assert.equal(digest(build(id)),expected,id+' standalone POI unchanged');
 assert.equal(digest(site.creek),pin.creek,'complete creek metadata unchanged');
 assert.equal(digest(site.map.terrainHeights),pin.terrain,'terrain height unchanged');
});
test('every v136 exterior record remains except the enumerated civic paving and scenic changes',()=>{
 const ownership=new Set(site.buildings.flatMap(b=>Array.from(b.footprint,p=>key(p.x,p.z))));
 const records=outsideHistory.prior(gateHistory.prior(site.map.world).filter(r=>{const [x,z,y,type,rot]=JSON.parse(r);return !ownership.has(key(x,z))&&!rampart({x,z,y,type,rot})}));
 const live=new Set(records);
 assert.equal(canalHistory.added.size,canalHistory.legacy.counts.add);
 assert.equal(canalHistory.removed.size,canalHistory.legacy.counts.remove);
 for(const r of canalHistory.added)assert.ok(live.has(r),'missing canal addition '+r);
 for(const r of canalHistory.removed)assert.ok(!live.has(r),'obsolete v137 exterior record '+r);
 const beforeCanal=canalHistory.prior(records);
 const present=new Set(beforeCanal);
 const added=unpack(pin.deltaAdded),removed=unpack(pin.deltaRemoved);
 assert.equal(added.size,pin.counts.add);assert.equal(removed.size,pin.counts.remove);
 for(const r of added)assert.ok(present.has(r),'missing authorized addition '+r);
 for(const r of removed)assert.ok(!present.has(r),'obsolete relocation record still present '+r);
 const protectedRecords=beforeCanal.filter(r=>!added.has(r)).sort();
 assert.equal(protectedRecords.length,pin.counts.same);
 assert.equal(digest(protectedRecords),pin.outside,'all other exterior records preserved');
});

test('open grassland alters only enumerated non-structural exterior planting and styles',()=>{
 const {pinned,added,removed}=outsideHistory;
 const records=gateHistory.prior(historicalWorld),present=new Set(records);
 assert.equal(present.size,records.length,'unique authored records');
 const outside=(x,z)=>z>47||x<1||x>66||(z>20&&x>62)||(z<4&&x>46);
 const cells=new Set(site.creek.deep.map(o=>key(o.x,o.z)));
 const buildingCells=new Set(site.buildings.flatMap(b=>b.footprint.map(o=>key(o.x,o.z))));
 for(const [entries,expected,allowed] of [
  [added,true,/^(?:grassMeadow|flowerField|bushFlower|tallGrass)$/],
  [removed,false,/^(?:grassForest|tree\w+)$/]
 ])for(const r of entries){
  const [x,z,y,type,rot]=JSON.parse(r);
  assert.equal(present.has(r),expected,'intentional grassland delta '+r);
  assert(y===0&&rot===0&&outside(x,z)&&!cells.has(key(x,z))&&!buildingCells.has(key(x,z))&&allowed.test(type),r);
 }
 const preserved=Array.from(present).filter(r=>!added.has(r)).sort();
 assert.equal(preserved.length,pinned.count);
 assert.equal(digest(preserved),pinned.hash,'all other exact v140 world records preserved');
});

