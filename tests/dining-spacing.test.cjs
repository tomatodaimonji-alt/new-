const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const source=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];
assert(source);
const build=vm.runInNewContext(source+'\n;buildFacilitySite');
const dirs=[[0,1],[-1,0],[0,-1],[1,0]],key=(x,z)=>x+','+z;
const floor=o=>/^(woodfloor(?:Dark|Light)?|brickfloor|stone)$/.test(o.type);
function plan(id){
 const site=build(id),b=site.buildings[id==='base'?1:0],delta=id==='base'?3:0;
 const toWorld=(x,z)=>delta?[b.x1+z,b.z2-x]:[b.x1+x,b.z1+z];
 const at=(x,z,y=0)=>{const [a,c]=toWorld(x,z);
  return Array.from(site.map.world.filter(o=>o.x===a&&o.z===c&&o.y===y),o=>({...o,rot:(o.rot+4-delta)%4}));
 };
 const accessible=(x,z)=>{const cells=at(x,z);return cells.some(o=>floor(o)||o.type==='guildStairDown')&&cells.every(o=>floor(o)||o.type.endsWith('Door')||o.type==='guildStairDown');};
 const visited=new Set([key(5,9)]),q=[[5,9]];
 for(let i=0;i<q.length;i++)for(const [dx,dz] of dirs){
  const x=q[i][0]+dx,z=q[i][1]+dz,k=key(x,z);
  if(x>=0&&x<=13&&z>=0&&z<=9&&!visited.has(k)&&accessible(x,z)){visited.add(k);q.push([x,z]);}
 }
 return {b,at,visited};
}
test('two staggered tables each have two facing seats, not six crowded diners or overflowing place settings',()=>{
 for(const id of ['kitchen','base']){
  const {b,at}=plan(id);
  assert.equal(b.footprint.length,140);
  for(const p of [[5,6],[10,7]])assert.ok(at(...p).some(o=>o.type==='roundTableWood'));
  let chairs=0,tables=0;
  for(let x=1;x<13;x++)for(let z=5;z<=8;z++)for(const o of at(x,z)){
   if(o.type==='chairWood'){
    chairs++;
    const [dx,dz]=dirs[o.rot];
    assert.ok(at(x+dx,z+dz).some(t=>t.type==='roundTableWood'),id+' seat faces a table');
   }
   if(/^roundTable/.test(o.type))tables++;
  }
  assert.equal(chairs,4);
  assert.equal(tables,2);
 }
});
test('occupied dining seats and staff stool leave connecting aisles, usable checkout, both staff doors and WC',()=>{
 for(const id of ['kitchen','base']){
  const {at,visited}=plan(id);
  for(const x of [4,6,12])for(let z=5;z<=8;z++)assert.ok(visited.has(key(x,z)),id+' lane '+[x,z]);
  for(let x=6;x<=12;x++)assert.ok(visited.has(key(x,6)),id+' side-to-side crosswalk '+x);
  for(const p of [[2,7],[4,4],[11,4],[10,1],[6,8],[8,7],[9,8],[10,8]])assert.ok(visited.has(key(...p)),id+' route '+p);
  for(const [x,z] of [[5,5],[5,7],[9,7],[11,7],[8,8]])assert.ok(!visited.has(key(x,z)),id+' seats do not count as aisle');
  assert.ok(at(7,7).some(o=>o.type==='counterWood')&&at(7,8).some(o=>o.type==='poiLedgerPapers'));
  assert.ok(at(11,1).some(o=>o.type==='guildStairDown')&&at(11,1,-1).some(o=>o.type==='guildStairUp'));
 }
});
