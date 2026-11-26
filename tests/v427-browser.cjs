const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa427:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&facilitySite.residents.some(n=>n.id==='frontierregna'),
  inspect:()=>{
   const role=facilitySite.residents.find(n=>n.id==='frontierregna');
   poiNpcInventorySync(poiTownNpcActors.find(n=>n.role===role)??{role,hp:550});
  },
  close:()=>poiNpcInventorySync(),
  party:()=>{
   if(!poiEconomyWrite({...poiHotbarRead(),humanParty:[{id:'human:frontierregna',hp:550,mode:'follow'}]}))throw Error('party setup');
  },
  saved:()=>JSON.parse(localStorage.getItem(POI_HOTBAR_KEY)).skillSlots,
  chief:()=>[poiTownNpcMaxHp('frontierchief'),
   poiHumanPartyDecode([{id:'human:frontierchief',hp:90}],false,true)[0]?.hp,
   frontierLifeDecode({frontierchief:{hp:90}},[],false,true).frontierchief?.hp],
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[];
 p.on('pageerror',e=>{errors.push(String(e));console.error(e.stack)});
 const url='http://127.0.0.1:'+server.address().port+'/?test=1';
 const start=async()=>{await p.goto(url,{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa427?.ready(),null,{timeout:30000});};
 const via=m=>p.evaluate(m=>window.__editorTest.qa427[m](),m);
 const open=()=>p.locator('#poiNpcSkillListOpen').tap();
 const pick=()=>p.locator('#poiSkillListRows button').filter({hasText:'氷牙陣'}).tap();
 const slot=i=>p.getByRole('button',{name:new RegExp('^スキル'+i+'にセット')});
 await start();
 a.deepEqual(await via('chief'),[70,60,60]);
 await via('inspect');
 a.match(await p.locator('#poiNpcStatus').innerText(),/魔法剣士/);
 const status=await p.locator('#poiNpcStatus').boundingBox(),button=await p.locator('#poiNpcSkillListOpen').boundingBox();
 a.ok(button.y>=status.y+status.height-1);a.ok(button.height>=22);
 await open();await pick();a.equal(await slot(1).isDisabled(),true);
 await p.getByRole('button',{name:'閉じる',exact:true}).tap();
 await via('party');await open();await pick();await slot(3).tap();
 let saved=await via('saved');a.deepEqual(saved,[null,null,{owner:'frontierregna',id:'ice-fang'}]);
 await pick();await p.getByRole('button',{name:'やめる',exact:true}).tap();
 await p.getByRole('button',{name:'閉じる',exact:true}).tap();await via('close');
 a.match(await p.locator('[data-skill-slot="2"]').innerText(),/3.*氷牙陣/);
 await start();a.deepEqual(await via('saved'),saved);
 await via('inspect');await open();await pick();await slot(1).tap();
 a.deepEqual(await via('saved'),[{owner:'frontierregna',id:'ice-fang'},null,null]);
 await pick();await p.getByRole('button',{name:'スキル1から外す',exact:true}).tap();
 a.deepEqual(await via('saved'),[null,null,null]);a.deepEqual(errors,[]);
 console.log('PASS mobile NPC status layout, skill dialog touch, ownership, move, remove, reload and Roan HP migration');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
