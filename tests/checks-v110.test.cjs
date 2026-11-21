const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('bottom Check button enters normally and clears only marks when closing; undo is snapshot backed',()=>{
 const start=h.indexOf('function pineSetCheckMode('),end=h.indexOf('function pineDrawChecks(',start);
 const wire=h.match(/\$\('pineCheckMode'\)\.addEventListener\('click',[^\n]+\);/)?.[0];
 assert(start>=0&&end>start&&wire);
 const world=[{x:1,z:1,y:0,type:'table'},{x:3,z:3,y:1,type:'wall'}];
 const marks=[{x:1,z:1,y:0,color:'#ef6'},{x:3,z:3,y:1,color:'#eff'}];
 let saved,commits=0,click;
 const c=vm.createContext({world,pineCheckMarks:marks.slice(),pineCheckMode:false,pineGameActive:false,
  pineCheckNodes:new Map(),$:(id)=>({replaceChildren(){},classList:{remove(){}},addEventListener:(event,fn)=>{click=fn}}),
  pineCheckRefresh(){},snapshot(){saved=[...c.pineCheckMarks]},commit(){commits++}});
 vm.runInContext(h.slice(start,end)+'\n'+wire,c);
 click();assert.equal(c.pineCheckMode,true);assert.equal(c.pineCheckMarks.length,2);assert.equal(commits,0);
 click();assert.equal(c.pineCheckMode,false);assert.equal(c.pineCheckMarks.length,0);assert.equal(commits,1);
 assert.deepEqual(saved,marks);assert.equal(world.length,2);assert.equal(world[0].type,'table');
 click();click();assert.equal(commits,1,'an empty close must not add a spurious undo step');
});
