const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||process.env.WORLD_HTML||'world-editor.html','utf8');
test('single soul shortcut tap selects and opens without summoning; only explicit commands act',()=>{
 const forTest=h.match(/\/\/ BEGIN COMPANION COMMAND UI([\s\S]*?)\/\/ END COMPANION COMMAND UI/);assert(forTest);
 const soul={type:'slimeSoul',count:1,durability:17},other={type:'orvasSoul',count:1,durability:87};
 const kit={slots:[{},soul,null,other],weapon:'equipIronSword',companionSoul:{}};
 const choices=[],node={hidden:true,querySelector(){return {focus(){}}}};
 const c={Map,document:{hidden:false,querySelector:()=>null},$:(id)=>id==='poiCompanionCommands'?node:null,
  performance:{now:()=>1000},poiCompanionAllowed:()=>true,poiHotbarRead:()=>kit,poiInventorySlots:k=>k.slots,
  poiCompanionType:type=>type==='slimeSoul'?{name:'スライムの魂',hp:36}:type==='orvasSoul'?{name:'オルヴァスの魂',hp:765}:null,
  poiCompanionCommand:(m,_now,type)=>{choices.push([m,type]);kit.companionSoul.active=m==='dismiss'?null:type;return {ok:true}},
  poiCompanionMode:()=> 'follow',poiHotbarRender(){}};
 const run=vm.runInNewContext(forTest[1]+";({press:poiCompanionShortcutTap,selected:poiCompanionSelectedShortcut,command:poiCompanionUiCommand,clear:poiCompanionClearShortcut})",c);
 assert(run.press(kit,1).ok);assert.equal(run.selected(kit),1);assert(!node.hidden);assert.deepEqual(choices,[]);
 run.command('back');assert(node.hidden);assert.equal(run.selected(kit),1);assert.equal(kit.companionSoul.active,undefined);
 assert(run.press(kit,1).ok);run.command('fight');assert(node.hidden);assert.equal(kit.companionSoul.active,'slimeSoul');
 assert(run.press(kit,3).ok);run.command('follow');assert(node.hidden);assert.equal(kit.companionSoul.active,'orvasSoul');assert.equal(run.selected(kit),3);
 assert(run.press(kit,3).ok);run.command('dismiss');assert(node.hidden);assert.equal(kit.companionSoul.active,null);
 assert.deepEqual(choices,[['fight','slimeSoul'],['follow','orvasSoul'],['dismiss','orvasSoul']]);
 assert.equal(soul.durability,17);assert.equal(other.durability,87);assert.equal(kit.weapon,'equipIronSword');
 assert.equal(run.selected(kit),3);kit.slots[3]=null;assert.equal(run.selected(kit),null);
});
