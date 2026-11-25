const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.argv[2], 'utf8');
const block=html.match(/\/\/ BEGIN FRONTIER LANDSCAPE\n([\s\S]+?)\/\/ END FRONTIER LANDSCAPE/);
assert.ok(block,'frontier landscape exists');
const ctx=vm.createContext({});
vm.runInContext(block[1]+`
const terrain=frontierSite();
const geometry={p:[],n:[],c:[]};
frontierGround(geometry);
globalThis.qa={terrain,geometry,track:frontierTrack,height:typeof frontierSampleHeight==='function'?frontierSampleHeight:null,bridgeShore:frontierGroundKind(63,30), water:frontierGroundKind(63,24)};
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
for(let z=0;z<64;z++)for(let x=0;x<128;x++) assert.ok(painted.has(x+','+z),'ground hole '+[x,z]);
assert.equal(painted.size,128*64);
assert.ok(geometry.p.length/3<56000);
assert.equal(geometry.p.length,geometry.c.length);assert.equal(geometry.p.length,geometry.n.length);
assert.equal(typeof ctx.qa.height,'function');
const get=ctx.qa.height;
assert(get(28.5,16.5)>1.4,'northwest hill is not flat');
assert(get(93.5,45.5)>1.4,'southeast hill is not flat');
assert(Math.abs(get(46.5,25.5))<.001,'cottage floor remains level');
assert(Math.abs(get(58.5,30.5))<.001,'bridge approach remains level');
assert(get(64.5,29.5)<-.5,'riverbed below water');
const trees=terrain.map.world.filter(o=>/^tree(?:Birch|Pine|Cedar)$/.test(o.type));
assert(trees.length>=135&&trees.length<=225, 'intentional tree budget: '+trees.length);
assert(trees.filter(o=>Math.hypot(o.x-51,o.z-30)<14).length>=8,'visible trees from spawn');
for(const t of trees){
 assert(Math.abs(t.z+.5-ctx.qa.track(t.x+.5))>3||t.x<21||t.x>109,'main path clear');
 assert(!tiles.has(t.x+','+t.z),'bridge clear');
}
console.log('Landscape height samples, clear deck and '+trees.length+' trees');
console.log('Complete 8,192-tile playfield and no exterior terrain; '+geometry.p.length/3+' ground vertices.');
