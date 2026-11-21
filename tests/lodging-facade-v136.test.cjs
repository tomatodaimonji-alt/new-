const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
function scene(id){
 const ctx=vm.createContext({terrainY:()=>0,mesh:()=>({p:[],n:[],c:[]})});
 vm.runInContext(cut('const FACILITY_SITES=','function workshopResumeDecode(')+
  cut('function rot2(','\n')+cut('function tri(','function diamond(')+
  cut('function facilityLodgingFacade(','function houseFacadeDetails(')+
  `const site=buildFacilitySite('${id}'),facilitySite={...site,id:'${id}'};
   function get(objects=site.map.world){const m={p:[],n:[],c:[]};return {m,replaced:facilityLodgingFacade(m,objects)};}`,ctx);
 return s=>vm.runInContext(s,ctx);
}
test('covered entry and raised window framing stay on the same authored lodging in both routes',()=>{
 for(const id of ['base','lodging']){
  const run=scene(id);
  assert.equal(run("get().replaced.size"),14);
  assert.equal(run(`(()=>{const {entrance:{x,z}}=site.buildings.find(b=>b.id==='lodging'),{m}=get();let cover=false;
   for(let i=0;i<m.p.length;i+=9){
    const a=m.p.slice(i,i+9),y=[a[1],a[4],a[7]];
    if(Math.min(a[0],a[3],a[6])<x+.12&&Math.max(a[0],a[3],a[6])>x+.88&&
      Math.max(a[2],a[5],a[8])>z+1.22&&Math.max(...y)>.06) {
     if(Math.min(...y)<1.43)return false;
     cover=true;
    }
   }return cover})()`),true,'entry stays clear beneath canopy');
  assert(run('get().m.p.length/9')<3000,'modest static mesh footprint');
 }
});
test('ordinary routes and basement remain untouched; deleting the main door removes its projection',()=>{
 assert.equal(scene('stable')('get().m.p.length'),0);
 const run=scene('lodging');
 assert.equal(run('get(site.map.world.filter(o=>o.y<0)).m.p.length'),0);
 assert.equal(run(`(()=>{const {entrance:{x,z}}=site.buildings[0];
  const without=site.map.world.filter(o=>o.x!==x||o.z!==z||o.type!=='plasterwallDoor');
  const {m,replaced}=get(without);
  return replaced.size===13&&!m.p.some((v,i)=>i%3===2&&v>z+1.3);
 })()`),true);
});
