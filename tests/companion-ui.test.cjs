const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('soul shortcut select/summon and next press open do not debit HP; only explicit dismiss returns it',()=>{
 const forTest=h.match(/\/\/ BEGIN COMPANION COMMAND UI([\s\S]*?)\/\/ END COMPANION COMMAND UI/);assert(forTest);
 const soul={type:'slimeSoul',count:1,durability:17},kit={slots:[{},soul],companionSoul:{}};
 const choices=[],dialog={open:false,showModal(){this.open=true},close(){this.open=false},querySelector(){return {focus(){}}}};
 const c={Map,document:{hidden:false,querySelector:()=>null},$:(id)=>id==='poiCompanionCommands'?dialog:null,
  poiWalkActive:true,poiCompanionAllowed:()=>true,poiHotbarHasKit:()=>true,poiHotbarRead:()=>kit,poiInventorySlots:k=>k.slots,
  POI_HOTBAR_SIZE:9,poiCompanionType:type=>type==='slimeSoul'?{enemy:'monsterSlime',name:'スライムの魂',hp:36}:null,
  poiCompanionUse:(k,i)=>{assert.equal(i,1);choices.push('summon');k.companionSoul.active=soul.type;return {ok:true}},
  poiCompanionCommand:m=>{choices.push(m);if(m==='dismiss')kit.companionSoul.active=null;return {ok:true}},
  poiHotbarRender(){},poiStopRepeat(){},toast(){}};
 const run=vm.runInNewContext(forTest[1]+";({press:poiCompanionShortcutTap,selected:poiCompanionSelectedShortcut,command:poiCompanionUiCommand,clear:poiCompanionClearShortcut})",c);
 assert(run.press(kit,1).ok);assert.equal(run.selected(kit),1);assert(!dialog.open);assert.deepEqual(choices,['summon']);
 assert(run.press(kit,1).ok);assert(dialog.open);assert.equal(soul.durability,17);assert.deepEqual(choices,['summon']);
 run.command('back');assert(!dialog.open);assert(kit.companionSoul.active);
 assert(run.press(kit,1).ok);run.command('fight');assert(!dialog.open);assert.equal(soul.durability,17);
 assert(run.press(kit,1).ok);run.command('flee');assert(kit.companionSoul.active);
 run.clear();assert.equal(run.selected(kit),null);
 assert(run.press(kit,1).ok);assert(!dialog.open,'weapon focus change makes next tap select, not open');
 assert(run.press(kit,1).ok);run.command('dismiss');assert(!dialog.open);assert.equal(kit.companionSoul.active,null);
 assert.deepEqual(choices,['summon','fight','flee','dismiss']);
 assert.equal(soul.durability,17);
});
