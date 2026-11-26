const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa398:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  seed:()=>{
   const kit=poiHotbarRead(),slots=poiInventorySlots(kit).slice(),i=POI_HOTBAR_SIZE;
   slots[i]={type:'starterTunic',count:1,durability:31};slots[0]={type:'equipIronSword',count:1};
   if(!poiEconomyWrite(poiInventoryEdited({...kit,worn:POI_FRESH_ARMOR,weapon:'equipIronSword'},slots)))throw Error('seed');
   const moved=poiInventoryMove({zone:'bag',index:0},{zone:'hotbar',index:3});
   poiEconomyRefresh();
   return {moved,slot:poiInventorySlots(poiHotbarRead())[3]};
  },
  inspect:()=>{const k=poiHotbarRead();return {slot:poiInventorySlots(k)[3],armor:poiArmorWorn(k).torso,dur:k.wornDurability?.torso??null,weapon:k.weapon};},
  stow:()=>poiMoveArmorSlot({zone:'armor',part:'torso'},{zone:'hotbar',index:3}),
  mapLayer:()=>{
   const at=(x,z)=>{if(!workshopResumeRestorePosition({x,z,y:0,facing:3}))throw Error('map fixture')};
   const old=poiLocalSurvey('frontier:0:surface');poiLocalMark(old,19,29);poiLocalMark(old,32,29);
   at(33,29);const outside=poiLocalFrame,open=outside.tile(32,29),hidden=outside.tile(19,29);
   at(20,29);const inside=poiLocalFrame,room=inside.tile(19,29),bounds=poiLocalAtlasBounds(inside);
   at(33,29);const back=poiLocalFrame;
   return {before:outside.scope,open,hidden,under:inside.scope,room,bounds,back:back.tile(19,29)};
  }

 } ,
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.on('pageerror',e=>{errors.push(String(e.stack));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa398.ready(),null,{timeout:25000});
 const seed=await p.evaluate(()=>window.__editorTest.qa398.seed());
 a(seed.moved.ok);a.equal(seed.slot.durability,31);
 await p.reload({waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa398.ready(),null,{timeout:25000});
 const prior=await p.evaluate(()=>window.__editorTest.qa398.inspect());
 a.equal(prior.slot?.type,'starterTunic');a.equal(prior.armor,null);
 await p.locator('[data-hotbar-slot="3"]').tap();
 const after=await p.evaluate(()=>window.__editorTest.qa398.inspect());console.log({seed,prior,after});
 a.deepEqual(after,{slot:null,armor:'starterTunic',dur:31,weapon:'equipIronSword'});
 a((await p.evaluate(()=>window.__editorTest.qa398.stow())).ok);
 a.equal(await p.evaluate(()=>window.__editorTest.qa398.inspect().slot.durability),31);
 const map=await p.evaluate(()=>window.__editorTest.qa398.mapLayer());console.log(map);
 a.equal(map.before,'frontier:0:surface');a.equal(map.open,9);a(map.hidden<=3);
 a.equal(map.under,'frontier:0:west-ruins');a.equal(map.room,4);a.equal(map.back,map.hidden);a.equal(map.bounds.x2,33);
 console.log('PASS minimap and enlarged map use independent cave survey; surface shows only entrance');
 console.log('PASS armor shortcut survives reload and touchscreen tap equips without switching weapon');
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
