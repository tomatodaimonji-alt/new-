const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const section=(a,b)=>{const x=html.indexOf(a),y=html.indexOf(b,x+1);assert(x>=0&&y>x,'missing anchor '+a);return html.slice(x,y)};
test('Potted foliage is an additive normal-floor catalog asset',()=>{
 assert.match(html,/{id:'poiPottedPlant',name:'観葉植物'/);
 assert.match(html,/"number":"330","id":"poiPottedPlant"/);
 assert.match(html,/items:\['poiPottedPlant'\]/);
 assert.doesNotMatch(section('const PINE_TABLETOP_KINDS=','const PINE_TABLETOP_HEIGHTS='),/poiPottedPlant/);
 assert.match(html,/case 'poiPottedPlant':poiPottedPlantGeometry\(m,x,y,z\);break/);
});
test('Native plant mesh has ground contact and a tall, varied green silhouette within one tile',()=>{
 const m=vm.runInNewContext(section('function tri(m,','function naturalCrown(')+
 section('function poiPottedPlantGeometry(','function decoBase(')+`
 const m={p:[],n:[],c:[]};poiPottedPlantGeometry(m,0,0,0);m
 `);
 assert(m.p.length>500&&m.p.length<8000);
 assert.equal(m.p.length,m.n.length);assert.equal(m.p.length,m.c.length);
 const ys=m.p.filter((_,i)=>i%3===1),xz=m.p.filter((_,i)=>i%3!==1);
 assert.equal(Math.min(...ys),0);assert(Math.max(...ys)>1.01&&Math.max(...ys)<1.31);
 assert(xz.every(n=>Math.abs(n)<.50));
 const vertexCount=ys.filter((y,i)=>y>.58&&m.c[i*3+1]>m.c[i*3]&&m.c[i*3+1]>m.c[i*3+2]).length;
 assert(vertexCount>35);
});
