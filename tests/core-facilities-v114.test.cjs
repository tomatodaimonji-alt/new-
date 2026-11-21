const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const source=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];
assert(source);
const build=vm.runInNewContext(source+'\n;buildFacilitySite');
const floor=o=>/^(?:earth|stone|brickfloor|woodfloor(?:Dark|Light)?)$/.test(o.type);
const dirs=[[0,1],[0,-1],[1,0],[-1,0]],key=(x,z)=>x+','+z;
function plan(id,dx,dz){
 const site=build(id);assert(site,id+' exists');
 const b=site.buildings[0];
 assert.equal(b.x2-b.x1+1,dx);assert.equal(b.z2-b.z1+1,dz);
 const at=(x,z,y=0)=>site.map.world.filter(o=>o.x===b.x1+x&&o.z===b.z1+z&&o.y===y);
 const start=[id==='stable'?6:4,dz-1],q=[start],visited=new Set([key(...start)]);
 assert.ok(at(...start).some(o=>o.type.endsWith('Door')&&o.rot===0));
 for(let i=0;i<q.length;i++)for(const [dx,dz] of dirs){
  const x=q[i][0]+dx,z=q[i][1]+dz,k=key(x,z),cell=at(x,z);
  if(visited.has(k)||!cell.some(floor)||cell.some(o=>!floor(o)&&!o.type.endsWith('Door')))continue;
  visited.add(k);q.push([x,z]);
 }
 for(let x=0;x<dx-1;x++)for(let z=0;z<dz-1;z++){
  const [a,b,c,d]=[[x,z],[x+1,z],[x,z+1],[x+1,z+1]].map(p=>at(...p).some(o=>/wall(?:Door|Window)?$/.test(o.type)));
  assert.ok(!((a&&d&&!b&&!c)||(b&&c&&!a&&!d)),id+' cardinal walls at '+[x,z]);
 }
 const has=(x,z,t,y=0)=>at(x,z,y).some(o=>o.type===t);
 const reach=(...p)=>assert.ok(visited.has(key(...p)),id+' can reach '+p);
 return {has,at,reach};
}
test('artisan home has separate WC, working kitchen, seating and reachable trade bench',()=>{
 const {has,reach}=plan('artisan',8,8);
 assert.ok(has(2,5,'counterWood')&&has(2,5,'poiLedgerPapers')&&has(1,5,'stoolRound'));
 assert.ok(has(4,1,'kitchenStove')&&has(6,3,'bed')&&has(1,1,'guildLatrine'));
 for(const p of [[4,2],[4,6],[3,5],[1,6],[1,2],[1,3],[2,2],[2,3]])reach(...p);
});
test('stable has two aligned exterior doors, two reachable stalls and open loading apron',()=>{
 const {has,at,reach}=plan('stable',12,9);
 assert.ok(has(7,8,'woodwallDoor'));
 for(const p of [[5,2],[6,7],[2,3],[9,3],[8,7],[1,6]])reach(...p);
 assert.ok(has(3,11,'handcartLoaded')&&has(10,10,'wellWood'));
 for(let z=9;z<=13;z++)for(let x=5;x<=7;x++)
  assert.ok(at(x,z).every(o=>floor(o)||o.type.startsWith('road')),'cart apron is clear at '+[x,z]);
});
test('toolshop has independent private WC and stockroom, plus a working customer and clerk approach',()=>{
 const {has,reach}=plan('toolshop',9,9);
 assert.ok(has(5,6,'counterLuxury')&&has(5,6,'poiLedgerPapers')&&has(6,6,'stoolRound'));
 assert.ok(has(6,4,'woodwallDoor')&&has(3,6,'woodwallDoor')&&has(1,5,'guildLatrine'));
 assert.ok(has(2,1,'displayShelf')&&has(7,5,'displayShelf'));
 for(const p of [[4,6],[6,5],[5,7],[6,3],[4,2],[1,6],[1,7],[2,6],[2,7]])reach(...p);
});
