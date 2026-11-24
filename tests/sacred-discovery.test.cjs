const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(p,q){const i=h.indexOf(p),j=h.indexOf(q,i+p.length);a(i>=0&&j>i,p);return h.slice(i,j)}
function rig(){
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite("base")');
 site.id='base';let kit={weapon:'equipWoodSword',gold:23},written=[],allow=true;
 const c=vm.createContext({poiHotbarRead:()=>kit,poiEconomyWrite(next){if(!allow)return false;kit=next;written.push(next);return true},
  poiSacredForestOf:s=>s?.id==='base'?s.sacredForest:null});
 vm.runInContext(cut('// BEGIN SACRED TEMPLE DISCOVERY','// END SACRED TEMPLE DISCOVERY'),c);
 return {c,site,written,load:k=>kit=k,allow:v=>allow=v};
}
test('withheld topology contains only the precise pre-discovery temple records, not west trail or town',()=>{
 const {c,site}=rig(),d=site.davidTemple;
 const filters=c.poiSacredMiniRecords(site,true);
 const key=c.poiSacredMiniRecordKey;
 const portal=site.map.world.find(o=>o.x===24&&o.z===94&&o.y===0);
 a(filters.has(key(portal)));
 const oldApproach=site.map.world.find(o=>o.x===24&&o.z===91&&o.y===0&&/^road/.test(o.type));
 a(oldApproach&&!filters.has(key(oldApproach)),'the original outside lane remains readable');
 for(const x of [site.sacredForest.authored.index,12,site.davidTemple.authored.index-1])a(!filters.has(key(site.map.world[x])));
 a.equal(c.poiSacredMiniRecords(site,false),null);
 a.equal(c.poiSacredMiniRecords({...site,id:'artisan'},true),null);
 a.equal(d.entrance.z,94);
});
test('surface + genuine gate or old physically interior save only; one durable bit preserves inventory and cold seen',()=>{
 const {c,site,written,load,allow}=rig(),gate=site.davidTemple.entrance;
 a.equal(c.poiSacredMiniConcealed(site,gate.x,gate.z,-1),false);
 for(const p of [[29,88,0],[24,93,0],[gate.x-5,gate.z,0]])
  a.equal(c.poiSacredMiniConcealed(site,...p),true);
 a.equal(written.length,0);
 a.equal(c.poiSacredMiniConcealed(site,24,94,0),false);
 a.equal(written.length,1);a.deepEqual({gold:written[0].gold,weapon:written[0].weapon,seen:written[0].sacredTempleSeen},
  {gold:23,weapon:'equipWoodSword',seen:true});
 a.equal(c.poiSacredMiniConcealed(site,29,88,0),false);
 a.equal(c.poiSacredMiniConcealed(site,24,94,0),false);a.equal(written.length,1);
 const cold=rig();cold.load(JSON.parse(JSON.stringify(written[0])));
 a.equal(cold.c.poiSacredMiniConcealed(cold.site,12,49,0),false);a.equal(cold.written.length,0);
 const old=rig();a.equal(old.c.poiSacredMiniConcealed(old.site,24,100,0),false);a.equal(old.written.length,1);
 const failed=rig();failed.allow(false);a.equal(failed.c.poiSacredMiniConcealed(failed.site,24,94,0),false);a.equal(failed.written.length,0);
});
