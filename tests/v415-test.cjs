const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const s=fs.readFileSync(process.argv[2],'utf8'),i=s.indexOf('function poiSpearArt(');
a.ok(i>=0,'held, ground and thumbnail spear share the same silhouette builder');
const run=vm.runInNewContext(s.slice(i,s.indexOf('\n}',i)+2)+'\npoiSpearArt',{
 tri:(m,...p)=>m.faces.push(p.slice(0,3)),quad:(m,...p)=>m.faces.push(p.slice(0,4)),
 naturalBranch:(m,...p)=>m.rods.push(p)
});
const build=(id,length)=>{
 const m={faces:[],rods:[]};run(m,id,length,(d,w=0,f=0)=>[w,d,f]);
 return {m,extent:Math.max(...m.faces.flat().map(p=>Math.abs(p[0])))};
};
const wood=build('equipWoodSpear',2.67),iron=build('equipIronSpear',2.67);
a.ok(iron.extent>wood.extent*1.75);a.ok(iron.m.faces.length>wood.m.faces.length);
for(const q of [wood,iron]){
 a.ok(q.m.faces.some(f=>f.some(p=>p.every(x=>x===0))), 'visual point is still on hit tip');
 a.ok(q.m.rods.some(p=>p[1]===-2.67),'physical shaft length unchanged');
}
a.equal((s.match(/poiSpearArt\(/g)||[]).length,3);
console.log('shared world/preview spear shapes: narrow wooden point vs broad iron leaf blade');
