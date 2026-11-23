const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const page=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function controls(){
 const events={},fns={allowed:true,landscape:true,bagOpen:false,shop:false,chest:false,modal:false};
 const el={addEventListener(type,cb,capture=false){(events[type]??=[]).push({cb,capture})},getBoundingClientRect(){return {left:0,right:100,top:0,bottom:100}}};
 const ctx=vm.createContext({$:(id)=>id==='viewWrap'?{hasAttribute:()=>fns.landscape}:id==='poiBagPanel'?{get hidden(){return !fns.bagOpen}}:id==='palette'||id==='inspector'?{classList:{contains:()=>false}}:id==='poiSoundPanel'?{hidden:true}:el,performance:{now:()=>20},poiAnalogAllowed:()=>fns.allowed,poiWalkActive:true,poiPlayerDying:()=>false,pineAIActive:false,pineCheckMode:false,poiScreenNoteFrozen:()=>false,poiItemDetailIsOpen:()=>false,poiLandscapeMenu:{hidden:true},poiShopIsOpen:()=>fns.shop,poiChestIsOpen:()=>fns.chest,document:{querySelector:()=>fns.modal?{}:null},poiWalkAction:()=>{fns.count++}});
 const start=page.indexOf("const poiAnalogAction=$('poiWalkAction');"),end=page.indexOf('function poiAnalogGeometryChange(){',start);
 assert(start>0&&end>start);
 vm.runInContext('let poiAnalogContact=null;\n'+page.slice(start,end),ctx);
 el.addEventListener('click',ctx.poiWalkAction);
 fns.count=0;fns.contact=(held)=>vm.runInContext('poiAnalogContact='+ (held?'{moved:false}':'null'),ctx);
 fns.fire=(type,props={})=>{let stopped=false;const e={button:0,pointerType:'touch',pointerId:2,isPrimary:true,clientX:50,clientY:50,preventDefault(){},stopImmediatePropagation(){stopped=true},...props};for(const {cb} of [...events[type]??[]].sort((a,b)=>Number(b.capture)-Number(a.capture))){if(stopped)break;cb(e)}};
 const tap=opts=>{fns.fire('pointerdown',opts);fns.fire('pointerup',opts)};
 fns.tap=tap;return fns;
}
test('centered held thumb permits native secondary tap without synthesized click; a matching click is not duplicated',()=>{const a=controls();a.contact(true);const props={isPrimary:false};a.tap(props);assert.equal(a.count,1);a.fire('click',props);assert.equal(a.count,1)});
test('released thumb / first subsequent primary tap is not lost if WebView emits no compatibility click',()=>{const a=controls();a.contact(false);a.tap();assert.equal(a.count,1)});
test('left contact stopped by layout/app during active physical touch does not drop secondary tap without compatibility click',()=>{const a=controls();a.contact(false);a.tap({isPrimary:false});assert.equal(a.count,1)});
test('rapid right tap can activate primary click and preserve mouse/keyboard routes',()=>{const a=controls();a.tap();a.fire('click');assert.equal(a.count,1);a.fire('click',{pointerType:''});a.fire('click',{pointerType:'mouse'});assert.equal(a.count,3)});

test('legitimate active NPC menu and chest-close touches work while movement is disabled',()=>{const a=controls();a.allowed=false;a.shop=true;a.tap();assert.equal(a.count,1);a.shop=false;a.chest=true;a.bagOpen=true;a.tap();assert.equal(a.count,2)});
test('open modal and ordinary inventory prevent landscape physical and compatibility actions',()=>{const a=controls();a.modal=true;a.tap();a.fire('click');assert.equal(a.count,0);a.modal=false;a.bagOpen=true;a.tap();a.fire('click');assert.equal(a.count,0)});
test('portrait continues to use original compatibility click, and matching is touch-only',()=>{const a=controls();a.landscape=false;a.tap();assert.equal(a.count,0);a.fire('click');assert.equal(a.count,1);a.landscape=true;a.tap();a.fire('click',{pointerType:'mouse'});assert.equal(a.count,3);a.fire('click');assert.equal(a.count,3)});
test('movement out and back within the button is still a drag, not a tap',()=>{const a=controls();a.fire('pointerdown');a.fire('pointermove',{clientX:65});a.fire('pointerup');a.fire('click');assert.equal(a.count,0)});
test('pointer cancellation and out-of-bounds release do not invoke Action',()=>{const a=controls();a.fire('pointerdown');a.fire('pointercancel');a.fire('pointerup');assert.equal(a.count,0);a.fire('pointerdown');a.fire('pointerup',{clientX:102});assert.equal(a.count,0)});
test('old touch-derived MouseEvent deduplicates by coordinates without swallowing a real MouseEvent',()=>{const a=controls();a.tap();assert.equal(a.count,1);a.fire('click',{pointerType:undefined,pointerId:undefined,sourceCapabilities:{firesTouchEvents:false}});assert.equal(a.count,2);a.fire('click',{pointerType:undefined,pointerId:undefined,sourceCapabilities:{firesTouchEvents:true}});assert.equal(a.count,2)});
