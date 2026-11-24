const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)+a.length));
const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite("base")');
const near=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z),k=(x,z)=>x+','+z;
const route=h.includes('function poiFindLocalDetour(')?vm.runInNewContext(cut('function poiFindLocalDetour(','function poiCompanionNavScope(')+';poiFindLocalDetour'):()=>null;
test('an actual mine wall corner can be detoured via its authored doorway, away first',()=>{
 const rows=new Map();
 for(const o of site.map.world)if(o.y===-1){const p=k(o.x,o.z),r=rows.get(p)||[];r.push(o.type);rows.set(p,r)}
 const from={x:107,z:60},to={x:107,z:55};
 const legal=(x,z)=>{const r=rows.get(k(x,z))||[];return r.some(t=>/^(stone|moss)$/.test(t))&&!r.some(t=>!/^(?:stone|moss|monster\w+)$/.test(t));};
 const p=route(from,to,legal,(x,z)=>near({x,z},to)===1);
 a(p?.length&&near(p[0],to)>near(from,to),'first real step must temporarily increase distance');
 a(p.some(t=>t.x===109&&t.z===58),'use physical north doorway and never ghost through its side');
 let old=from;for(const t of p){a.equal(near(old,t),1);a(legal(t.x,t.z));old=t;}
});
test('only the actual connected stone bridge may span river and bounded search gives up if broken',()=>{
 const bridge=site.creek.crossings,water=new Set(site.creek.deep.map(p=>k(p.x,p.z)));
 a.deepEqual(Array.from(bridge,o=>[o.x,o.z]),[[90,60],[91,60]]);
 const start={x:93,z:64},hero={x:89,z:64};
 const legal=(allow,x,z,fx,fz)=>{
  if(x<85||x>96||z<57||z>68)return false;
  const deck=[k(x,z),k(fx,fz)].some(t=>bridge.some(p=>k(p.x,p.z)===t));
  if(deck&&z!==fz)return false;
  return !water.has(k(x,z))||allow&&deck&&bridge.some(p=>k(p.x,p.z)===k(x,z));
 };
 const path=route(start,hero,(...p)=>legal(true,...p),(x,z)=>near({x,z},hero)<=1);
 a(path?.length&&path.some(p=>p.x===90&&p.z===60)&&path.some(p=>p.x===91&&p.z===60));
 let probes=0;
 a.equal(route(start,hero,(...p)=>{probes++;return legal(false,...p)},(x,z)=>near({x,z},hero)<=1),null);
 a(probes<=288,'missing bridge must never provoke an unbounded query');
});
