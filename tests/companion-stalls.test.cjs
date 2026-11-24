const a=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(i,j)=>h.slice(h.indexOf(i),h.indexOf(j,h.indexOf(i)+1));
const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite("base")');site.id='base';
const k=(x,z)=>x+','+z,pond=new Set(site.northTrail.lowland.water.map(o=>k(o.x,o.z)));
const ctx=vm.createContext({facilitySite:site,world:site.map.world,poiWalkLevel:0,facilityCreekIndex:null,validPos:(x,z)=>x>=0&&z>=0&&x<184&&z<184,
 poiDungeonTravelKey:(s,x,z,y)=>y<0&&x>70?'chapel':null,poiDavidTempleEnclosedAt:(s,x,z)=>x===24&&z>=128,
 poiOtherworldPortalAt:(s,x,z,y)=>x===115&&z===16});
const a0=h.includes('const POI_COMPANION_NAV_STALL')?'const POI_COMPANION_NAV_STALL':'function poiCompanionNavScope(';
vm.runInContext(cut('function poiFindLocalDetour(',a0)+cut(a0,'function poiCompanionNavGroundClear('),ctx);
test('same-floor northern pond detour is available only as following, and routes on dry real cells',()=>{
 const made={x:115,z:15,y:0,freeFollows:true},to={x:115,z:9};
 const admit=ctx.poiCompanionNavScope(made,to);
 a.equal(typeof admit,'function','ordinary pond needs scoped route fallback instead of bridge-exclusive navigation');
 a.equal(ctx.poiCompanionNavScope({...made,freeFollows:false},to),null);
 a.equal(ctx.poiCompanionNavScope({...made,y:-1},to),null);
 a.equal(admit(115,16),false,'portal tile not usable by generic detour');
 const rows=new Map();for(const o of site.map.world)if(o.y===0&&o.x>=100&&o.x<=123&&o.z<18){
  const key=k(o.x,o.z),r=rows.get(key)||[];r.push(o.type);rows.set(key,r);
 }
 const legal=(x,z)=>admit(x,z)&&!pond.has(k(x,z))&&!(rows.get(k(x,z))||[]).some(t=>!/^(grass\w*|earth|stone|road\w+|tallGrass|flowerField|monster\w+)$/.test(t));
 const p=ctx.poiFindLocalDetour(made,to,legal,(x,z)=>Math.hypot(x-to.x,z-to.z)<=2.1);
 a(p?.length>=8&&p.some(o=>o.x===112&&o.z===12));
 let old=made;for(const v of p){a(legal(v.x,v.z));a.equal(Math.abs(v.x-old.x)+Math.abs(v.z-old.z),1);old=v}
});
