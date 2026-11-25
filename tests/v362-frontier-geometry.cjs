const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.argv[2], 'utf8');
const block=html.match(/\/\/ BEGIN FRONTIER LANDSCAPE\n([\s\S]+?)\/\/ END FRONTIER LANDSCAPE/);
assert.ok(block,'frontier landscape exists');
const ctx=vm.createContext({});
vm.runInContext(block[1]+`
const terrain=frontierSite();
const geometry={p:[],n:[],c:[]};
frontierGround(geometry);
globalThis.qa={terrain,geometry,bridgeShore:frontierGroundKind(63,30), water:frontierGroundKind(63,24)};
`,ctx);
const {terrain,geometry,bridgeShore,water}=ctx.qa;
assert.equal(terrain.map.width,128);
assert.equal(terrain.map.height,64);
assert.equal(bridgeShore,'river');
assert.equal(water,'river');
const tiles=new Map(terrain.map.world.filter(o=>o.y===0&&o.type.startsWith('bridge')).map(o=>[o.x+','+o.z,o]));
for(let x=58;x<=69;x++) assert.ok(tiles.has(x+',30'), x+' on deck');
const painted=new Map();
for(let v=0;v<geometry.p.length;v+=18){
 const x=geometry.p[v],z=geometry.p[v+2],x2=geometry.p[v+6],z2=geometry.p[v+8];
 for(let j=z;j<z2;j++) for(let i=x;i<x2;i++){
   assert.ok(!painted.has(i+','+j),'ground overlap '+[i,j]);painted.set(i+','+j,true);
 }
}
for(let z=-64;z<128;z++)for(let x=-64;x<192;x++) assert.ok(painted.has(x+','+z),'ground hole '+[x,z]);
assert.equal(painted.size,256*192);
assert.ok(geometry.p.length/3<56000);
assert.equal(geometry.p.length,geometry.c.length);assert.equal(geometry.p.length,geometry.n.length);
console.log('Complete 8,192-tile playfield and continuous backdrop; '+geometry.p.length/3+' ground vertices.');
