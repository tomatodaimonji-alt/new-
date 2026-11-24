const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(s,e)=>{const i=h.indexOf(s),j=h.indexOf(e,i+1);a(i>=0&&j>i,s);return h.slice(i,j)};
function setup(){
 const ner={role:{id:'portfisher',portBounds:{}}},cla={role:{id:'portfishseller',portBounds:{}}},mar={role:{id:'southmerchant'}};
 const end={x:73,z:118,y:0},c=vm.createContext({end,ner,cla,mar,poiTownDialogue:null,poiWalkActive:true,pineAIActive:false,poiWalkX:77,poiWalkZ:118,poiWalkLevel:0,
  world:[{...end,type:'woodfloorDark'}],facilitySite:{id:'base',southPort:{dock:{end}},southRoad:{town:{}}},POI_ECONOMY_GOLD_MAX:999999,
  poiHotbarRead:()=>c.kit,poiEconomyWrite:k=>{if(c.fail)return false;c.kit=copy(k);return true},poiWalletSync(){},poiNpcMenuService:()=>null,
  poiTownDialogueTarget:()=>c.live,poiTownDialogueClose:()=>{c.poiTownDialogue=null},poiShopSync(){},poiNpcMenuBack(){},poiMessagePush(){}});
 vm.runInContext(cut('// BEGIN PORT QUESTS','// END PORT QUESTS')+cut('const POI_NPC_MENU_LABELS=','// Topics belong')+
  cut('function poiNpcMenuRows(','function poiTownNpcStatus(')+cut('function poiNpcMenuChoose(','// A flexible greeting'),c);
 c.kit={gold:11,southShipment:{readyDay:1},npcTrade:{kept:1}};
 const menu=(actor,live=actor)=>{c.live=live;c.poiTownDialogue={actor,page:'request'};c.poiTownDialogue.rows=c.poiNpcMenuRows(c.poiTownDialogue)};
 c.poiNpcMenuRender=()=>{const d=c.poiTownDialogue;d.rows=c.poiNpcMenuRows(d)};
 const row=id=>c.poiTownDialogue.rows.some(r=>r.id===id),choose=id=>c.poiNpcMenuChoose(id,1000);
 return {c,ner,cla,mar,menu,row,choose};
}
const copy=x=>JSON.parse(JSON.stringify(x)),lid='pier-lantern',mid='market-message';
test('fisher live request proof is actual same-floor dock tip visit and report pays once',()=>{
 const {c,ner,menu,row,choose}=setup();
 c.poiWalkX=73;a.equal(c.poiPortQuestVisit(),false,'preaccept visit never sets proof');c.poiWalkX=77;
 menu(ner);a(row('port-quest:'+lid));choose('port-quest:'+lid);a(row('port-accept:'+lid));choose('port-accept:'+lid);
 a.equal(c.kit.portQuests[lid],'accepted');a.equal(c.kit.gold,11);
 c.poiWalkX=73;c.poiWalkLevel=-1;a.equal(c.poiPortQuestVisit(),false);
 c.poiWalkLevel=0;c.fail=true;a.equal(c.poiPortQuestVisit(),false);c.fail=false;
 a(c.poiPortQuestVisit());a.equal(c.kit.portQuests[lid],'ready');
 c.poiWalkX=77;menu(ner);choose('port-quest:'+lid);c.fail=true;choose('port-report:'+lid);a.equal(c.kit.gold,11);
 c.fail=false;c.kit.gold=999999;choose('port-report:'+lid);a.equal(c.kit.portQuests[lid],'ready');
 c.kit.gold=11;choose('port-report:'+lid);a.equal(c.kit.portQuests[lid],'done');a.equal(c.kit.gold,17);
 a.equal(choose('port-report:'+lid),false);a.equal(c.kit.gold,17);
});
test('fishseller delivery is independent; only live Marek can hear explicit message, ordinary requests remain',()=>{
 const {c,cla,mar,ner,menu,row,choose}=setup();
 menu(mar);a(!row('port-deliver:'+mid));menu(cla);choose('port-quest:'+mid);choose('port-accept:'+mid);
 menu(ner);a(!row('port-deliver:'+mid));menu(mar,ner);choose('port-deliver:'+mid);a.equal(c.kit.portQuests[mid],'accepted');
 menu(mar);a(row('sell')&&row('buy')&&row('recruit')&&row('port-deliver:'+mid));
 choose('port-deliver:'+mid);a.equal(c.kit.portQuests[mid],'ready');a.equal(c.kit.gold,11);
 menu(cla);choose('port-quest:'+mid);choose('port-report:'+mid);
 a.deepEqual(c.kit,{gold:19,southShipment:{readyDay:1},npcTrade:{kept:1},portQuests:{'market-message':'done'}});
});
test('ledger decoding keeps only authored phases and strips malformed or unrelated record fields',()=>{
 const {c}=setup();
 a.equal(c.poiPortQuestDecode(null),null);
 a.deepEqual(copy(c.poiPortQuestDecode({'pier-lantern':'ready','market-message':'x','unknown-role':'done'})),{'pier-lantern':'ready'});
});
test('actual hotbar read/write survives reload, concurrent reverse acceptance, and ignores malformed records',()=>{
 function live(raw){
  let mem=raw===null?null:JSON.stringify(raw);
  const c=vm.createContext({MAX_MAP:128,facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,
   poiWalkLevel:0,poiWalkX:73,poiWalkZ:118,poiWalkFacing:0,world:[],poiWalkCanStep:()=>true,validPos:()=>true,
   poiHotbarRender(){},poiWalkAvatar(){},poiShopIsOpen:()=>false,toast(){},isFloor:()=>true,localStorage:{getItem:()=>mem,setItem(_k,v){mem=v}}});
  vm.runInContext(cut('const POI_HOTBAR_KEY=','function poiHotbarSwordIcon('),c);
  return {c,raw:()=>JSON.parse(mem),run:s=>vm.runInContext(s,c)};
 }
 let h=live({version:1,weapon:null,potions:2,gold:10,portQuests:{junk:'done','pier-lantern':'bad'},northMinotaurAxeAwarded:true,
  toolshopSupply:{version:1,stock:7,delivered:4,cargo:5}});
 a.equal(h.run('poiHotbarRead().portQuests'),undefined);a(h.raw().portQuests,'decode is read-only');
 a.equal(h.run("poiPortQuestPut(poiHotbarRead(),'pier-lantern','accepted')"),'ok');
 h=live(h.raw());a.equal(h.run("poiHotbarRead().portQuests['pier-lantern']"),'accepted');
 a.equal(h.run("poiPortQuestPut(poiHotbarRead(),'market-message','accepted')"),'ok');
 h=live(h.raw());a.deepEqual(copy(h.run('poiHotbarRead().portQuests')),{'pier-lantern':'accepted','market-message':'accepted'});
 a.equal(h.run("poiPortQuestPut(poiHotbarRead(),'pier-lantern','ready')"),'ok');
 a.equal(h.run("poiPortQuestPut(poiHotbarRead(),'pier-lantern','done',6)"),'ok');
 h=live(h.raw());
 a.equal(h.raw().gold,16);a.equal(h.raw().potions,2);
 a.deepEqual(h.raw().toolshopSupply,{version:1,stock:7,delivered:4,cargo:5});
 a.equal(h.raw().northMinotaurAxeAwarded,true);a.deepEqual(h.raw().portQuests,{'pier-lantern':'done','market-message':'accepted'});
});
