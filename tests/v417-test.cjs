const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const s=fs.readFileSync(process.argv[2],'utf8'),lines=s.split('\n');
const fn=name=>{const i=lines.findIndex(x=>x.startsWith('function '+name+'('));a.ok(i>=0,name);
 return lines.slice(i,lines[i].endsWith('}')?i+1:lines.findIndex((x,j)=>j>i&&x==='}')+1).join('\n')};
const doc={querySelector:q=>q.includes('#poiBagPanel')?{id:'poiBagPanel'}:null,getElementById:()=>({hidden:false})};
const c={document:doc,$:()=>({hidden:false})};
const blocks=vm.runInNewContext(fn('poiCompanionMenusBlock')+'\npoiCompanionMenusBlock',c);
a.equal(blocks(true),false);a.equal(blocks(false),true);
doc.querySelector=q=>q.includes('#poiLandscapeMenu')?{id:'poiLandscapeMenu'}:null;
a.equal(blocks(true),true);
const height=vm.runInNewContext(fn('poiGroundLootSupport')+'\npoiGroundLootSupport',{
 facilitySite:{id:'frontier'},frontierSurfaceHeight:(x,z,_,cave)=>cave?-4:.4,terrainY:()=>-.8,poiLootFloorTop:()=>0,frontierGroundRecordLayer:o=>!!o.frontierCave
});
a.equal(height({x:124,z:30,y:0}),.4);a.equal(height({x:5,z:29,y:0,frontierCave:true}),-4);
a.match(s,/冒険者ランク<\/b><span>未登録/);
a.match(s,/\['job','職業',info.job\],\['rank','冒険者ランク',info.rank\]/);
console.log('inventory blocks player but permits human allies; bridge / cave loot supports; rank row placement');
