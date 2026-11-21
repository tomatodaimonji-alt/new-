const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function extract(a,b){const x=html.indexOf(a),y=html.indexOf(b,x+1);assert(x>=0&&y>x,'missing '+a);return html.slice(x,y)}
test('Distinct dining sign is editable and AI-coded without changing historical inn signs',()=>{
 assert.match(html,/{id:'poiDiningSign',name:'食堂の吊り看板'/);
 assert.match(html,/"number":"331","id":"poiDiningSign"/);
 assert.match(html,/id:'decorations'[^\n]*'poiDiningSign'/);
 assert.match(html,/{id:'poiInnSign',name:'宿屋の吊り看板'/);
 assert.match(html,/case 'poiDiningSign':poiDiningSignGeometry\(m,x,y,z\);break/);
 const m=vm.runInNewContext(extract('function tri(m,','function naturalCrown(')+
 extract('function poiDiningSignGeometry(','function poiPottedPlantGeometry(')+`
 const m={p:[],n:[],c:[]};poiDiningSignGeometry(m,0,0,0);m
 `);
 assert(m.p.length>350&&m.p.length<7400);
 const xs=m.p.filter((_,i)=>i%3===0),ys=m.p.filter((_,i)=>i%3===1),zs=m.p.filter((_,i)=>i%3===2);
 assert(Math.min(...zs)<.53&&Math.max(...zs)>1.08);
 assert(Math.max(...ys)<1.46&&Math.min(...ys)>.65);
 assert(xs.some(x=>x>.08)&&xs.some(x=>x<-.08),'artwork on both faces');
});
test('Cellar surround is native render-only with clear upper approach',()=>{
 assert.match(html,/if\(facilitySite&&o.type==='guildStairDown'&&o.y===0&&facilityStairOpenings.has\(facilityCellKey\(o.x,o.z,o.y\)\)\)/);
 assert.match(html,/world.filter\(o=>o.type==='guildStairDown'&&\s+stairs.has/);
 const m=vm.runInNewContext(extract('function tri(m,','function naturalCrown(')+
 extract('function poiCellarEntryGeometry(','function poiPottedPlantGeometry(')+`
 const m={p:[],n:[],c:[]};poiCellarEntryGeometry(m,0,0,0);m
 `);
 assert(m.p.length>300&&m.p.length<6200);
 for(let i=0;i<m.p.length;i+=3)assert(
   !(Math.abs(m.p[i])<.34&&m.p[i+2]<-.35&&m.p[i+1]>.045),
   'must keep the upper approach at -Z open');
 assert(m.p.some((y,i)=>i%3===1&&y>.46),'visible parapet');
});
test('Only opted-in authored WC stone leaves use cool mineral colors; generic stone door untouched',()=>{
 assert.match(html,/else if\(facilityHasDiningStoneLeaf\(o\)\)/);
 const scope=vm.runInNewContext(extract('function facilityHasDiningStoneLeaf(','function poiDiningSignGeometry(')+`
 let facilitySite={id:'kitchen',buildings:[{x1:3,z1:3}]};
 const o={type:'stonewallDoor',x:6,z:10,y:0,rot:1};
 const tests=[facilityHasDiningStoneLeaf(o),facilityHasDiningStoneLeaf({...o,z:9})];
 facilitySite={id:'base',buildings:[{}, {x1:2,z1:11}]};
 tests.push(facilityHasDiningStoneLeaf({...o,x:9,z:19,rot:0}));
 facilitySite=null;tests.push(facilityHasDiningStoneLeaf(o));tests
 `);
 assert.deepEqual([...scope],[true,false,true,false]);
 const meshes=vm.runInNewContext(extract('function tri(m,','function naturalCrown(')+
 extract('const MATCHED_OPENING_MATERIALS=','const MATCHED_COUNTER_IDS=')+`
 const a={p:[],n:[],c:[]},b={p:[],n:[],c:[]};
 matchedOpening(a,'stonewallDoor',0,0,0,false);matchedOpening(b,'stonewallDoor',0,0,0,true);
 [a,b]`);
 assert.notEqual(JSON.stringify(meshes[0]),JSON.stringify(meshes[1]));
 // Stone frame positions and materials stay unchanged (first three cubes).
 assert.deepEqual([...meshes[0].p.slice(0,270)],[...meshes[1].p.slice(0,270)]);
 const yes=meshes[1].c; assert(yes.some((v,i)=>i%3===0&&v<yes[i+1]&&yes[i+1]<yes[i+2]));
});
