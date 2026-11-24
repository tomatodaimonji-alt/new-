const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto');
function load(file){
 const h=fs.readFileSync(file,'utf8'),i=h.indexOf('const FACILITY_SITES=Object.freeze('),j=h.indexOf('function workshopResumeDecode(',i);
 a(i>=0&&j>i);
 return JSON.parse(JSON.stringify(vm.runInNewContext(h.slice(i,j)+";buildFacilitySite('base')")));
}
test('only six exact freestanding temple lanterns are missing, original wall wax and every unrelated record remain',()=>{
 const after=load(process.env.HTML||'world-editor.html');
 const {davidTemple:t,map}=after;
 const scope=map.world.slice(t.authored.index,t.authored.index+t.authored.count);
 a.equal(scope.filter(o=>o.type==='lantern').length,0);
 a.equal(scope.filter(o=>o.type==='poiDavidCandleSconce').length,t.depth===1?13:10);
 for(const [x,z] of [[53,39],[60,39]])a(map.world.some(o=>o.type==='lantern'&&o.x===x&&o.z===z&&o.y===0));
 // Exact byte-for-byte per-record proof when validating a known base locally.
 if(!process.env.BEFORE_HTML)return;
 const before=load(process.env.BEFORE_HTML);
 const d=before.davidTemple,old=before.map.world;
 const owned=old.slice(d.authored.index,d.authored.index+d.authored.count),standalone=owned.filter(o=>o.type==='lantern');
 a.equal(standalone.length,6);a(standalone.every(o=>o.y===0));
 const expected=d.depth===1?[[14,151],[34,151],[13,162],[35,162],[20,169],[28,169]]:[[10,104],[38,104],[13,113],[35,113],[22,118],[26,118]];
 a.deepEqual(standalone.map(o=>[o.x,o.z]),expected);
 a.equal(owned.filter(o=>o.type==='poiDavidCandleSconce').length,d.depth===1?13:10);
 const exact=new Set(standalone);
 const remaining=old.filter(o=>!exact.has(o));
 a.equal(remaining.length,old.length-6);
 a.equal(after.davidTemple.authored.index,d.authored.index);
 a.equal(after.davidTemple.authored.count,d.authored.count-6);
 if(before.sacredForest)a.equal(after.sacredForest.authored.index,before.sacredForest.authored.index-6);
 const hash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
 a.equal(hash(after.map.world),hash(remaining));
 a.deepEqual(after.buildings,before.buildings);a.deepEqual(after.davidTemple.boss,before.davidTemple.boss);
});
