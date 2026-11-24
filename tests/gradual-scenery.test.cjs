const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const clip=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i);assert(i>=0&&j>i);return h.slice(i,j)};
const c=vm.createContext({POI_OVERLAND_CHUNK:8,poiOverlandDrawing:true,poiWalkViewX:59,poiWalkViewZ:138,terrainY:()=>0,
 facilitySite:{id:'base'},performance:{now:()=>1000},poiOverlandBoxVisible:()=>true});
vm.runInContext(clip('// The streamed perspective only draws nearby terrain.', 'function poiOverlandNeighborVP'),c);
const actor=(x,z,y=0)=>c.poiOverlandActorVisible([],x,z,y);
test('even a frustum-visible actor cannot float over uncovered ground; main stock atlas is unaffected',()=>{
 assert.equal(actor(60,139),false,'remove very close but unsupported snow-edge NPC projection');
 assert.equal(actor(60,100),false,'frustum alone is not a valid support witness');
 vm.runInContext("poiOverlandGroundDrawn.set('base:7,17',new Uint8Array([0,0,16,0,0,0,0,0]));poiOverlandGroundDrawn.set('snowpass:7,17',new Uint8Array(8).fill(255));",c);
 assert.equal(actor(60,138),true);
 assert.equal(c.poiOverlandActorVisible([],61,138,0,'snowpass'),true,'companion uses its actual old region during physical seam handoff');
 assert.equal(actor(60,137),false,'region-edge hole inside a submitted chunk is still not ground');
 assert.equal(actor(61,138),false,'an adjacent clipped tile or foreign chunk is not support');
 assert.equal(actor(60,138,1),true,'higher floor actors still have existing floor/visibility semantics');
 c.poiOverlandDrawing=false;
 assert.equal(actor(60,139),true);
});
test('production shader and range submit the newest distant props gradually without fading floor or leaking state',()=>{
 const shader=clip('const FRAG=', 'function sh('),draw=clip('function poiOverlandPresent(', 'function poiOverlandInspect(');
 assert.match(shader,/uStreamPropReveal/);
 assert.match(draw,/poiStreamPropDraw/);
 assert.match(h,/m\.propsFirst=m\.p\.length\/3/);
 assert.match(h,/if\(poiOverlandDrawing&&!poiOverlandActorVisible\(vp,a\.x,a\.z,a\.y,a\.site\?\.id\)\)/);
 const src=clip('// BEGIN STREAM PROP REVEAL','// END STREAM PROP REVEAL');
 const calls=[],a=vm.createContext({performance:{now:()=>1000},draw:(m,vp,first,count)=>calls.push(['draw',first??0,count??m.count]),gl:{uniform3f:(u,...v)=>calls.push(['uniform',...v])},loc:{streamPropReveal:1}});
 vm.runInContext(src,a);
 assert.deepEqual([0,100,275,550,700].map(t=>a.poiStreamPropOpacity(t,0)).map(n=>Math.round(n*1000)),[0,87,500,1000,1000]);
 a.poiStreamPropDraw({count:90,propsFirst:42,revealBorn:900},[1],60,138,1000);
 assert.deepEqual(calls.map(x=>x[0]),['draw','uniform','draw','uniform']);
 assert.deepEqual(calls[0],['draw',0,42]);assert.deepEqual(calls[2],['draw',42,48]);assert.deepEqual(calls[3],['uniform',0,0,0]);
 calls.length=0;a.poiStreamPropDraw({count:90,propsFirst:42,revealBorn:0},[1],60,138,1000);
 assert.deepEqual(calls,[['draw',0,90]],'no ongoing duplicate draw calls or upload after the reveal');
});
