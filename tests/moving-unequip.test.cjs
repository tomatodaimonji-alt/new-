const test=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const from=h.indexOf('function poiWireMovingWeaponShortcuts('),to=h.indexOf('function poiBagWire(',from);a(from>=0&&to>from);
function wired(){
 let hot=[null,'equipIronSword',null,'gold'],wallet=2,focus,calls=[],handlers={};
 const button=i=>({dataset:{hotbarSlot:String(i)},setPointerCapture(){}});
 const use=vm.runInNewContext(h.slice(from,to)+'\npoiWireMovingWeaponShortcuts',{
  POI_HOTBAR_SIZE:9,POI_FIRE_WAND:'fireWand',poiHotbarWeaponForType:t=>t?.startsWith('equip'),poiHotbarRead:()=>hot,
  poiInventorySlot:(k,i)=>k[i]??null,poiGoldHotbarSlot:()=>wallet,poiInventoryAllowed:()=>true,poiAnalogContact:{id:1},
  poiBagKeySource:null,poiAnalogAllowed:()=>true,$:()=>({hasAttribute:()=>true}),performance:{now:()=>10},
  document:{elementFromPoint:()=>focus,addEventListener(){}},window:{addEventListener(){}},poiStorageTapGate:{cancel(){}},
  poiHotbarUse:i=>calls.push(i)
 });
 use({addEventListener:(key,fn)=>{handlers[key]=fn}},{hidden:true},x=>x);
 const evt=(type,i,opt={})=>handlers[type]({target:focus,pointerId:i,pointerType:'touch',isPrimary:false,button:0,clientX:10,clientY:10,preventDefault(){},...opt});
 const press=(i,id=2,change)=>{focus=button(i);evt('pointerdown',id);change?.();evt('pointerup',id)};
 return {calls,press,evt,set:(i,t)=>{hot[i]=t}};
}
test('bare-hands secondary tap uses only an unchanged truly empty non-wallet slot',()=>{
 const f=wired();
 f.press(0);a.deepEqual(f.calls,[0],'an actual secondary empty-slot release must choose bare hands');
 f.press(2);f.press(3);a.deepEqual(f.calls,[0],'wallet and gold are not bare hands');
 f.press(0,3,()=>f.set(0,'equipIronSword'));a.deepEqual(f.calls,[0],'item changing mid-tap does not act');
 f.press(1,4);a.deepEqual(f.calls,[0,1],'ordinary moving weapon selection survives');
});
