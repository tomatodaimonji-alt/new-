const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function renderer(){
 const a=html.indexOf('// BEGIN PAPER DOLL DEPTH RASTER'),b=html.indexOf('// END PAPER DOLL DEPTH RASTER');
 assert(a>=0&&b>a,'portrait-specific depth raster');
 return vm.runInNewContext(html.slice(a,b)+';poiPaperDollPixels');
}
const pt=(u,v,z)=>[u+.46*z,.21*(u+1.46*z)-v,z];
function square(p,z,c,flip=false){
 const vertices=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>pt(u,v,z(u)));
 for(const i of flip?[0,1,3,1,2,3]:[0,1,2,0,2,3]){
  p.p.push(...vertices[i]);p.n.push(0,1,0);p.c.push(...c);
 }
}
const mesh=()=>({p:[],n:[],c:[]});
const pixel=(data,x,y,w=40)=>Array.from(data.slice((y*w+x)*4,(y*w+x)*4+4));
test('touching triangles with the same material share opaque interior samples without light diagonal cracks',()=>{
 const f=renderer(),a=mesh(),b=mesh(),blue=[.2,.3,.7];
 square(a,()=>0,blue);square(b,()=>0,blue,true);
 const out=f(a,40,40),alt=f(b,40,40);
 assert.deepEqual(out,alt,'changing the half-triangle diagonal changes no sample');
 for(let y=8;y<32;y++)for(let x=8;x<32;x++)assert.equal(pixel(out,x,y)[3],255,[x,y]);
 assert.deepEqual(pixel(out,0,0),[0,0,0,0],'canvas stays transparent outside the silhouette');
});
test('crossing garment planes are sorted per pixel, independent of model emission order',()=>{
 const f=renderer(),a=mesh(),b=mesh(),red=[.9,.1,.1],green=[.1,.9,.1];
 square(a,u=>u,red);square(a,u=>-u,green);
 square(b,u=>-u,green);square(b,u=>u,red);
 const out=f(a,40,40);assert.deepEqual(out,f(b,40,40));
 const left=pixel(out,9,20),right=pixel(out,30,20);
 assert(left[1]>left[0]&&right[0]>right[1]);
 assert.equal(left[3],255);assert.equal(right[3],255);
 assert.equal(f(mesh(),40,40),null);
 assert.equal(f(a,4096,4096),null,'portrait CPU allocation is bounded');
});
test('portrait cache retains same view and actual wearable mesh without changing generic thumbnail or world drawing',()=>{
 const a=html.indexOf('function poiPlayerPaperDollRender('),b=html.indexOf('function poiBagUiRender(',a);
 assert.match(html.slice(a,b),/key!==poiPaperDollKey&&poiDrawPaperDoll\(view,poiBuildPlayerMesh\(weapon,null,gear\)\)/);
 assert.doesNotMatch(html.slice(a,b),/drawWallThumbnail/);
 const raster=html.slice(html.indexOf('// BEGIN PAPER DOLL DEPTH RASTER'),html.indexOf('// END PAPER DOLL DEPTH RASTER'));
 assert.match(raster,/getContext\('2d'\)/);assert.doesNotMatch(raster,/webgl|requestAnimationFrame/i);
});
