const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.QA_HTML||'world-editor.html','utf8');
const slice=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert.ok(i>=0&&j>i,'features present');return h.slice(i,j)};
function talk(id,port){
 const actor={role:{id}}, d={actor,sleeping:false,rows:[{id:'talk'}],topicIndex:0};
 const c={poiTownDialogue:d,facilitySite:{id:'base',southPort:port},poiTownDialogueTarget:()=>actor,
  poiNpcMenuRender:()=>{},poiShopSync:()=>{}};
 vm.createContext(c);
 vm.runInContext(slice('const POI_NPC_EXTRA_SPEECH=','const POI_NPC_MENU_LABELS=')+
  (h.includes('const poiNpcTalkCursor=')?slice('const poiNpcTalkCursor=','function poiNpcMenuActive('):'')+
  (h.includes('function poiPortMarekTopic(')?slice('function poiPortMarekTopic(','// END SOUTH PORT RESIDENTS'):'')+
  slice('function poiNpcMenuChoose(','// A flexible greeting'),c);
 return ()=>{
  // A new visit reopens the root menu; only the NPC's topic cursor survives.
  d.page='root';d.rows=[{id:'talk'}];
  assert.equal(c.poiNpcMenuChoose('talk',100),true);assert.equal(d.topic,d.text);
  if(h.includes('const poiNpcTalkCursor='))assert.equal(d.page,'speech','ordinary menu closes after the single selected line');
  return d.text;
 };
}
test('first explicit innkeeper Talk points from east gate through ruins and distinguishes slow wet and dry west',()=>{
 const next=talk('innkeeper',{name:'潮待ちの港',entrance:{x:91,z:123,y:0}});
 const first=next();
 assert.match(first,/東門.*川下.*崩れた石壁.*階段/);
 assert.match(first,/西.*濡れず.*まっすぐ.*浅瀬.*足/);
 assert(!next().includes('潮待ちの港'),'only Marek gives the optional clue');
 assert(!next().includes('潮待ちの港'));
 assert.equal(next(),first,'same original innkeeper topic cycle');
});
test('only Marek receives one extra route topic, with his first two unaffected',()=>{
 const topics=talk('southmerchant',{name:'潮待ちの港',entrance:{x:91,z:123,y:0}}),
       original=talk('southmerchant',null);
 const first=original();assert.match(first,/店の裏は荷ほどき場/);assert.equal(topics(),first);
 const second=original();assert.match(second,/向かいの宿/);assert.equal(topics(),second);
 if(h.includes('function poiPortMarekTopic('))
  assert.match(topics(),/南.*西.*潮待ちの港/);
 assert.equal(topics(),first);assert.equal(original(),first);
});
test('waymark reads only exact live Surface stone from adjacent facing, never through a modal',()=>{
 const sign={x:119,z:84,y:0,type:'ruinStonePost'};
 const c={facilitySite:{id:'base',chapel:{approach:{waymark:sign}}},world:[sign],poiWalkLevel:0,poiWalkX:119,poiWalkZ:85,poiWalkFacing:0,
  poiWalkActive:true,pineAIActive:false,text:[],toast:t=>c.text.push(t),document:{querySelector:()=>c.modal}};
 vm.createContext(c);vm.runInContext(slice('function poiChapelWaymarkReachable(','function poiWayfarerWell('),c);
 assert.equal(c.poiChapelReadWaymark(),true);
 assert.match(c.text[0],/礼拝堂.*階段.*西.*乾いた.*浅瀬.*遅/);
 c.poiWalkFacing=1;assert.equal(c.poiChapelReadWaymark(),false);
 c.poiWalkFacing=0;c.poiWalkLevel=-1;assert.equal(c.poiChapelReadWaymark(),false);
 c.poiWalkLevel=0;c.modal=true;assert.equal(c.poiChapelReadWaymark(),false);
 c.modal=false;c.world=[];assert.equal(c.poiChapelReadWaymark(),false);
 c.world=[sign];c.facilitySite.id='mine';assert.equal(c.poiChapelReadWaymark(),false);
 assert.equal(c.text.length,1);
 assert.match(h,/poiChapelWaymarkReachable\(\)\)\?'trail-sign'/);
 assert.match(h,/\|\|\(typeof poiChapelReadWaymark==='function'&&poiChapelReadWaymark\(\)\)/);
});
