const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const build=vm.runInNewContext(h.slice(h.indexOf('const FACILITY_SITES=Object.freeze('),h.indexOf('function workshopResumeDecode('))+';buildFacilitySite');
const plain=s=>JSON.parse(JSON.stringify(s)),sha=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
test('only the overlapping artisan façade plant moves to an otherwise empty edge tile, not the door lane',()=>{
 const s=plain(build('base')),w=s.map.world,at=(x,z)=>w.filter(o=>o.x===x&&o.z===z&&o.y===0);
 assert.deepEqual(at(66,52),[{x:66,z:52,y:0,type:'poiPottedPlant',rot:0}]);
 assert.deepEqual(at(71,52).map(o=>o.type),['roadCobbleFull','benchWood']);
 assert.deepEqual(at(69,52).map(o=>o.type),['roadCobbleFull']);
 assert.deepEqual(at(72,52).map(o=>o.type),['roadCobbleFull','sack']);
 assert(at(75,52).some(o=>o.type==='poiPottedPlant'));
 w[3695]={...w[3695],x:71};
 assert.equal(sha(w),'a21874e6baf44e8feb6bb00a2a0604a0ad6c1e4ab414f8a7cda4c1f1750d342f','complete v207 ordering and all other records');
 assert.equal(sha(plain(build('artisan')).map.world),'6071fbb77539014cebbe104d49ba8fab02b29b634d2442bd37371063d5f200e1','standalone artisan remains untouched');
});
