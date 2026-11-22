const {kitchenChestAddedV162}=require('./kitchen-chest-history.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createHash}=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
const a=html.indexOf('const FACILITY_SITES=Object.freeze('),b=html.indexOf('function workshopResumeDecode(',a);
assert(a>=0&&b>a);
const build=vm.runInNewContext(html.slice(a,b)+';buildFacilitySite');
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const oldCell=({x,z})=>x>=10&&x<118&&z>=10&&z<78;
const fromOld=require('./town-frame-v144-projection.cjs').originalFrame;
test('v144 preserves all original Game World cell records, simulation metadata and ordered draw stacks',()=>{
 const site=build('base');
 assert.deepEqual([site.map.width,site.map.height,site.map.size,site.townOffset],[128,96,128,22]);
 const {map:{world},creek}=site;
 const historical=world.filter(o=>!kitchenChestAddedV162(o,site.townOffset));
 const original=historical.filter(oldCell),extra=world.filter(o=>!oldCell(o));
 assert.equal(original.length,5345);
 
 assert(world.every(o=>o.x>=0&&o.z>=0&&o.x<128&&o.z<96),'all objects within the actual released bounds');
 assert.equal(new Set(world.map(o=>JSON.stringify([o.x,o.z,o.y,o.type,o.rot]))).size,world.length);
 assert(extra.length>0,'the outer area adds authored records, not only larger dimensions');
 const originalDeep=creek.deep.filter(oldCell),extraDeep=creek.deep.filter(o=>!oldCell(o));
 assert(extraDeep.length>0&&extraDeep.every(({x})=>x>=118),'old creek outlet only extends east');
 assert.deepEqual(Array.from(creek.deep),[...originalDeep,...extraDeep],'creek extension is appended after all original cells');
 const {map:{world:oldWorld,...oldMap},...oldMeta}=fromOld({...site,map:{...site.map,world:historical}});
 assert.equal(digest(oldWorld),'2cfc3ac52b36c7fcd5a88421db977d67666510333c020600124e7ed009298032');
 assert.equal(digest({map:oldMap,...oldMeta}),'bc4b3d2e59cbb4d7938bed7a57bdceb68cdc3732fec6543378bbc9b4ea226220');
});
