const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const from=h.indexOf('function workshopResumeRestorePosition('),to=h.indexOf(' const prior=poiWalkLevel;',from);
test('exact two closed mine threshold resumes use the closest south tile without shifting other saves',()=>{
 const closed=[115,120].map(x=>({x,z:57,y:-1,fallback:{x,z:58,y:-1}}));
 const c=vm.createContext({facilitySite:{id:'base',mine:{approach:{closed}}},poiWalkActive:true,
   validPos:()=>true,poiMineVaultResumeBlocked:()=>false,poiOtherworldResumeBlocked:()=>false,poiChapelResumeBlocked:()=>false});
 vm.runInContext(h.slice(from,to)+'return p;}',c);
 for(const p of [...closed.map(({fallback,...p})=>({...p,facing:2})),{x:120,z:57,y:0,facing:1},{x:116,z:58,y:-1,facing:3}]){
  const end=c.workshopResumeRestorePosition(p);
  a.deepEqual(JSON.parse(JSON.stringify(end)),{...p,z:p.y===-1&&p.z===57?58:p.z});
 }
 c.facilitySite.id='other';const prior={x:115,z:57,y:-1,facing:3};
 a.equal(c.workshopResumeRestorePosition(prior),prior);
});
