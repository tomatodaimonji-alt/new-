const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
const temple=h.slice(h.indexOf('function extendTownWorldDavidTemple('),h.indexOf('function poiDavidTempleEnclosedAt('));
const s=h.match(/\/\/ BEGIN FRONTIER LANDSCAPE\n([\s\S]+?)\/\/ END FRONTIER LANDSCAPE/)[1];
const qa=vm.runInNewContext(temple+s+';({site:frontierSite(),kind:frontierGroundKind})');
for(const b of qa.site.buildings.slice(0,3)){
 const dz=b.turn===2?-1:1,x=b.door.x,z=b.door.z;
 for(let r=z+dz;r!==30;r+=dz){
  a(r>=27&&r<=33,'front faces the main street');
  a.equal(qa.kind(x,r),'roadCobbleFull','continuous frontage '+[x,r]);
  a(!qa.site.map.world.some(o=>o.x===x&&o.z===r&&o.y===0&&/barrel|wall|tree|rock/.test(o.type)));
 }
}
a.equal(qa.site.buildings[2].turn,2);
a(!qa.site.map.world.some(o=>o.type==='barrel'&&!(o.x===39&&o.z===24)),'no barrels in the open street');
console.log('Three clear front doors directly on the street; no barrel outside');
