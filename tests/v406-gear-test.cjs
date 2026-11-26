const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
a(h.includes('const POI_SHARED_CLOTH_ART='));
const cut=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)+1));
const funcs=cut('const FRONTIER_HUMANS=', 'function characterHuman(');
const ctx={poiHumanGearType:c=>c?.type??c,humanRingProfile:(m,x,y,z,rows,c)=>m.colors.push(c.join(',')),cube:(m,...arg)=>m.colors.push(arg.at(-1).join(',')),quad:(m,...arg)=>m.colors.push(arg.at(-1).join(',')),poiRoleClothingGeometry:()=>false,poiStarterGearGeometry:()=>{}};
vm.runInNewContext(funcs+'\nthis.gear=POI_SHARED_CLOTH_ART;this.looks=FRONTIER_HUMANS;this.wear=frontierHumanShape;',ctx);
const want=[[.48,.53,.43],[.65,.65,.49],[.37,.28,.19],[.31,.36,.39],[.43,.46,.44],[.31,.218,.146]].map(v=>v.join(','));
const equipped={torso:'starterTunic',legs:'starterTrousers',feet:'armorLeatherShoes'};
const counts=[];
for(const look of Object.values(ctx.looks)){
 const m={p:[],colors:[]};ctx.wear(m,look,equipped);
 const count=want.map(c=>m.colors.filter(v=>v===c).length);
 a(count.every(n=>n>0));counts.push(count.join(','));
}
a.equal(new Set(counts).size,1);
a(!cut('function poiDrawPlayerBlockArms(', 'function poiPlayerPlannedFist(').includes('look.shirt'));
console.log('PASS identical equipped tunic, trousers, shoes and marking palette across five human profiles');
