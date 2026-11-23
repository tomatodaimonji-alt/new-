const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.DIALOGUE_HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
function fixture(){
 const actor={x:5,z:4,y:0,facing:0,activity:'work',role:{id:'guildkeeper',name:'受付係',role:'keeper'}};
 const e={hidden:true,style:{},textContent:''};let synced=0,faced=0;
 const c=vm.createContext({poiTownNpcActive:()=>true,poiTownNpcActors:[actor],poiWalkX:5,poiWalkZ:5,poiWalkLevel:0,poiWalkFacing:0,
  poiTownNpcGraph:()=>({}),poiTownNpcNextTile:(_from,x,z)=>({x,z,y:0}),poiMonsterStates:new Map(),poiTownNpcFace:(a,f)=>{a.facing=f;faced++},poiShopSync:()=>synced++,
  facilityDoorTiles:new Set(),facilityCellKey:(x,z,y)=>[x,z,y].join(','),facilityFloorOwner:()=>null,facilityHiddenRoof:()=>null,terrainY:()=>0,poiWorldToScreen:()=>({x:150,y:200}),$:id=>id==='poiTownSpeech'?e:null});
 const m=html.match(/\/\/ BEGIN TOWN DIALOGUE\n([\s\S]*?)\/\/ END TOWN DIALOGUE/);
 assert.ok(m,'conversation runtime is present');
 const section=(start,end)=>{
  const from=html.indexOf(start),to=html.indexOf(end,from+start.length);
  assert.ok(from>=0&&to>from,'missing dialogue dependency '+start);
  return html.slice(from,to);
 };
 const declaration=needle=>html.split('\n').find(line=>line.startsWith(needle));
 const deps=[
  section('const POI_TOWN_NPC_BASE_GEAR=', 'const POI_TOWN_INN='),
  section('const POI_ARMOR_DEFENSE=', 'function poiPlayerDefense('),
  section('const POI_PLAYER_WEAPON_PROFILES=', 'function poiPlayerWeaponCancel('),
  ...['const POI_PLAYER_MAX_HP=', 'const POI_HOTBAR_POTION_START=', 'const POI_CHEST_SIZE=',
   'const POI_KNIFE=', 'const POI_TOWN_RESIDENT_HP=','function poiPlayerAttackDamage('].map(declaration).filter(Boolean)
 ];
 vm.runInContext(deps.join('\n'),c);
 vm.runInContext(m[1],c);return {actor,e,c,run:(js)=>vm.runInContext(js,c),get faced(){return faced},get synced(){return synced}};
}
test('player-led conversation pauses the resident, uses announcements only and stays accessible',()=>{
 const f=fixture(),announcements=[];
 f.c.poiMessageSpeak=(...v)=>announcements.push(v);
 assert.equal(f.run('poiTownDialogueAction(100)'),true);assert.equal(f.actor.facing,2);
 f.run('poiTownDialogueDraw(200,[])');
 assert.equal(f.e.hidden,true);assert.equal(announcements.length,1);
 assert.equal(announcements[0][0],'受付係（ギルド受付）');assert.equal(announcements[0][1],f.run('poiTownDialogueSnapshot().text'));
 assert.equal(f.run('poiTownDialogueUpdate(4600)'),f.actor,'awake menu persists until Back or actor loss');
 f.run("poiNpcMenuChoose('back',4601)");assert.equal(f.run('poiTownDialogueUpdate(4602)'),null);
 const update=html.slice(html.indexOf('function poiMessagePush('),html.indexOf('function poiAnnounceDefeat('));
 assert.doesNotMatch(update,/aria-hidden/);
});
test('nearby successful NPC exchanges get two projected speaker turns, never entering announcements',()=>{
 const f=fixture(),announcements=[];f.c.poiMessageSpeak=(...v)=>announcements.push(v);
 f.c.guest={x:5,z:4,y:0,role:{id:'guestadventurer',name:'旅人'}};
 f.c.host={x:5,z:2,y:0,role:{id:'innkeeper',name:'宿屋の主人'}};
 assert.equal(f.run("poiTownAmbientSpeak('inn',guest,host,100)"),true);
 assert.equal(f.run("poiTownAmbientSpeak('inn',guest,host,101)"),false);
 f.run('poiTownDialogueDraw(200,[])');assert.equal(f.e.hidden,false);assert.match(f.e.textContent,/^旅人/);
 f.run('poiTownDialogueDraw(1250,[])');assert.equal(f.e.hidden,false);assert.match(f.e.textContent,/^宿屋の主人/);
 assert.equal(f.run('poiTownAmbientSnapshot().speaker'),'innkeeper');
 assert.equal(announcements.length,0);
 f.c.poiWalkLevel=1;f.run('poiTownDialogueDraw(1450,[])');assert.equal(f.e.hidden,true);
 assert.equal(f.run('poiTownAmbientSnapshot()'),null);
});
test('walls, floors, active enemy, and busy residents never yield a conversation',()=>{
 const f=fixture();f.actor.y=1;assert.equal(f.run('poiTownDialogueTarget(100)'),null);f.actor.y=0;
 f.c.poiTownNpcNextTile=()=>null;assert.equal(f.run('poiTownDialogueTarget(100)'),null);f.c.poiTownNpcNextTile=()=>({y:0});
 f.actor.target={};assert.equal(f.run('poiTownDialogueTarget(100)'),null);delete f.actor.target;
 f.actor.activity='sleep-home';assert.equal(f.run('poiTownDialogueTarget(100)'),f.actor);
 f.actor.activity='work';f.c.poiMonsterStates.set({y:0},{x:5,z:4,hp:30});assert.equal(f.run('poiTownDialogueTarget(100)'),null);
});
test('center selects a new topic; leaving cancels and unrelated attack remains available',()=>{
 const f=fixture();assert.equal(f.run('poiTownDialogueAction(100)'),true);
 const first=f.run('poiTownDialogueSnapshot().text');
 assert.equal(f.run('poiTownDialogueAction(200)'),true);
 assert.notEqual(f.run('poiTownDialogueSnapshot().text'),first);
 f.c.poiWalkFacing=1;assert.equal(f.run('poiTownDialogueUpdate(400)'),null);
 assert.equal(f.run('poiTownDialogueAction(500)'),false);
});
test('guild clerk at the mapped counter speaks across only the verified public desk',()=>{
 const f=fixture();Object.assign(f.actor,{x:56,z:27,y:0});f.actor.role={...f.actor.role,work:{x:56,z:27,y:0},public:{x:56,z:29,y:0,facing:0}};
 Object.assign(f.c,{poiWalkX:56,poiWalkZ:29,poiWalkFacing:0,poiTownNpcNextTile:()=>null});
 const cells=new Map([['56,28,0',['woodfloor','counterWood','poiLedgerPapers','poiPenHolder']]]);
 const desk={x:56,z:28,y:0,type:'counterWood',rot:0};f.c.world=[desk];
 f.c.poiTownNpcKey=(x,z,y)=>[x,z,y].join(',');f.c.poiTownNpcGraph=()=>({cells});f.c.poiTownNpcStance=()=>true;f.c.isFloor=t=>t==='woodfloor';
 assert.equal(f.run('poiTownDialogueAction(100)'),true);
 assert.equal(f.actor.facing,2);assert.equal(f.run('poiTownDialogueAction(101)'),true);
 cells.get('56,28,0').push('stonewall');assert.equal(f.run('poiTownDialogueTarget(200)'),null);
 cells.get('56,28,0').pop();desk.rot=1;assert.equal(f.run('poiTownDialogueTarget(201)'),null,'counter must face the players axis');
 desk.rot=0;f.c.world=[];assert.equal(f.run('poiTownDialogueTarget(202)'),null,'a cached counter must still exist live');
 f.c.world=[desk];cells.get('56,28,0').splice(1,1);assert.equal(f.run('poiTownDialogueTarget(203)'),null);
});
test('overlap keeps current speaker, queued attacks take priority',()=>{
 const f=fixture();const other={...f.actor,role:{id:'other',name:'二人目'}};
 f.c.poiTownNpcActors.push(other);
 assert.equal(f.run('poiTownDialogueAction(100)'),true);
 f.c.poiTownNpcActors.reverse();assert.equal(f.run('poiTownDialogueUpdate(101)'),f.actor);
 f.actor.hitAt=110;
 assert.equal(f.run('poiTownDialogueUpdate(104)'),null);
 assert.equal(f.run('poiTownDialogueTarget(104)'),other);
});
test('player conversation clears other overhead chatter and ambient expires without new messages',()=>{
 const f=fixture(),announcements=[];f.c.poiMessageSpeak=(...v)=>announcements.push(v);
 f.c.guest={x:5,z:6,y:0,role:{id:'guest',name:'客'}};
 f.c.host={x:5,z:7,y:0,role:{id:'clerk',name:'店員'}};
 assert.equal(f.run("poiTownAmbientSpeak('shop',guest,host,100)"),true);
 f.run('poiTownDialogueDraw(200,[])');assert.equal(f.e.hidden,false);
 assert.equal(f.run('poiTownDialogueAction(300)'),true);
 assert.equal(f.e.hidden,true);assert.equal(f.run('poiTownAmbientSnapshot()'),null);
 assert.equal(f.run("poiTownAmbientSpeak('shop',guest,host,400)"),false);
 f.run('poiTownDialogueClose()');
 assert.equal(f.run("poiTownAmbientSpeak('shop',guest,host,500)"),true);
 f.run('poiTownDialogueDraw(3200,[])');assert.equal(f.e.hidden,true);assert.equal(f.run('poiTownAmbientSnapshot()'),null);
 assert.equal(announcements.length,1);
});

test('ambient indoor text respects the speaker building, actual door thresholds and player floor',()=>{
 const f=fixture();
 f.c.guest={x:5,z:4,y:0,role:{id:'guest',name:'旅人'}};
 f.c.host={x:5,z:3,y:0,role:{id:'keeper',name:'宿屋の主人'}};
 f.c.facilityFloorOwner=(x,z,y,interiorOnly)=>y===0&&x===5&&(z===3||(!interiorOnly&&z===4))?0:null;
 f.c.facilityDoorTiles.add('5,4,0');
 assert.equal(f.run("poiTownAmbientSpeak('inn',guest,host,100)"),true);
 f.run('poiTownDialogueDraw(200,[])');assert.equal(f.e.hidden,true);assert.equal(f.e.textContent,'');
 f.c.facilityHiddenRoof=()=>1;
 f.run('poiTownDialogueDraw(300,[])');assert.equal(f.e.hidden,true);
 f.c.facilityHiddenRoof=()=>0;
 f.run('poiTownDialogueDraw(400,[])');assert.equal(f.e.hidden,false);assert.match(f.e.textContent,/^旅人/);
 f.run('poiTownDialogueDraw(1200,[])');assert.equal(f.e.hidden,false);assert.match(f.e.textContent,/^宿屋の主人/);
 f.c.facilityHiddenRoof=()=>null;
 f.run('poiTownDialogueDraw(1300,[])');assert.equal(f.e.hidden,true);
 f.c.poiWalkLevel=1;
 f.run('poiTownDialogueDraw(1400,[])');assert.equal(f.e.hidden,true);assert.equal(f.run('poiTownAmbientSnapshot()'),null);
});
test('root has four exact choices and NPC status is derived only from live stats and actual modeled equipment',()=>{
 const f=fixture();
 Object.assign(f.actor,{hp:74,coins:6,potions:2});
 Object.assign(f.c,{POI_TOWN_RESIDENT_HP:100,POI_TOWN_RESIDENT_MELEE:13});
 Object.assign(f.actor.role,{role:'keeper',type:'humanMerchant'});
 assert.equal(f.run('poiTownDialogueAction(100)'),true);
 assert.deepEqual(JSON.parse(f.run('JSON.stringify(poiTownDialogueSnapshot().actions)')),[
  {id:'talk',label:'話す'},{id:'status',label:'状態'},{id:'request',label:'依頼'},{id:'back',label:'戻る'}]);
 assert.equal(f.run("poiNpcMenuChoose('status',101)"),true);
 const s=JSON.parse(f.run('JSON.stringify(poiTownDialogueSnapshot())'));
 assert.equal(s.menu,'status');assert.deepEqual(s.actions,[{id:'back',label:'戻る'}]);
 const starter={head:'starterCap',torso:'starterTunic',legs:'starterTrousers',feet:'starterBoots'};
 assert.deepEqual(s.status,{name:f.actor.role.name+'（ギルド受付）',hp:74,maxHP:100,attack:6,defense:3.25,
  weapon:'equipBallpointPen',gear:{...starter,torso:'armorGuildUniform'},tools:[],
  equipment:['equipBallpointPen','starterCap','armorGuildUniform','starterTrousers','starterBoots'],coins:6,herbs:2});
 assert.equal(f.run("poiNpcMenuChoose('back',103)"),true);assert.equal(f.run('poiTownDialogueSnapshot().menu'),'root');
 f.actor.role={...f.actor.role,id:'innkeeper',role:'keeper',type:'humanMerchant'};
 assert.equal(f.run("poiNpcMenuChoose('status',104)"),true);
 const ordinary=JSON.parse(f.run('JSON.stringify(poiTownDialogueSnapshot().status)'));
 assert.deepEqual(ordinary.equipment,[null,'starterCap','armorMerchantCoat','starterTrousers','starterBoots']);
 assert.equal(ordinary.defense,2.5);assert.equal(ordinary.attack,null);
 assert.deepEqual(ordinary.gear,{...starter,torso:'armorMerchantCoat'});
 f.actor.role={...f.actor.role,id:'towncook',role:'visitor',type:'humanVillager'};
 const cook=JSON.parse(f.run('JSON.stringify(poiTownNpcStatus(poiTownNpcActors[0]))'));
 assert.deepEqual(cook.tools,['equipLadle']);assert.equal(cook.weapon,'equipFryingPan');
 assert.equal(cook.attack,12);assert.equal(cook.defense,3);
 assert.deepEqual([f.actor.hp,f.actor.coins,f.actor.potions],[74,6,2],'only reads actor');
});
test('bookable inn stays nested inside requests and viewing status does not book',()=>{
 const f=fixture();f.actor.role={...f.actor.role,id:'innkeeper'};
 Object.assign(f.c,{POI_TOWN_RESIDENT_HP:100,POI_TOWN_RESIDENT_MELEE:13});
 f.c.poiTownPlayerService=()=> 'book';let reservations=0;
 f.c.poiTownRequestPlayerLodging=()=>{reservations++;return {ok:true,bed:{id:'inn-south'}}};
 f.run('poiTownDialogueAction(100)');
 assert.equal(f.run("poiNpcMenuChoose('stay',101)"),false);
 f.run("poiNpcMenuChoose('status',102)");assert.equal(reservations,0);
 f.run("poiNpcMenuChoose('back',103)");f.run("poiNpcMenuChoose('request',104)");
 assert.equal(f.run('poiTownDialogueSnapshot().actions[0].id'),'stay');
 f.run("poiNpcMenuChoose('stay',105)");assert.equal(reservations,1);
 assert.match(f.run('poiTownDialogueSnapshot().text'),/南の客室/);
});
test('only the guild clerk offers a quest; list, back, and confirmed accept remain separate',()=>{
 const f=fixture(),calls=[];let accepted=false;
 f.actor.role.id='toolkeeper';f.c.poiQuestsForClerk=()=>[{id:'mine-survey',label:'廃坑の調査'}];
 f.c.poiQuestAccepted=()=>accepted;
 f.c.poiQuestAccept=(id,actor)=>{calls.push([id,actor]);accepted=true;return {ok:true}};
 f.run('poiTownDialogueAction(100)');
 assert.equal(f.run("poiTownDialogueSnapshot().actions.some(a=>a.id==='quest')"),false);
 f.run('poiTownDialogueClose()');f.actor.role.id='guildkeeper';f.run('poiTownDialogueAction(101)');
 assert.equal(f.run("poiNpcMenuChoose('quest',102)"),true);
 assert.equal(f.run('poiTownDialogueSnapshot().menu'),'quest');
 assert.equal(f.run("poiNpcMenuChoose('quest:mine-survey',103)"),true);
 assert.equal(f.run('poiTownDialogueSnapshot().menu'),'quest-detail');
 assert.equal(f.run("poiNpcMenuChoose('back',104)"),true);assert.equal(calls.length,0);
 f.run("poiNpcMenuChoose('quest:mine-survey',105)");f.run("poiNpcMenuChoose('quest-accept',106)");
 assert.deepEqual(calls,[['mine-survey',f.actor]]);
 assert.equal(f.run('poiTownDialogueSnapshot().menu'),'quest');
 assert.match(f.run('poiTownDialogueSnapshot().actions[0].label'),/受注済み/);
 f.run("poiNpcMenuChoose('quest:mine-survey',107)");
 assert.equal(f.run("poiTownDialogueSnapshot().actions.some(a=>a.id==='quest-accept')"),false);
 f.run("poiNpcMenuChoose('back',108)");f.run("poiNpcMenuChoose('back',109)");
 assert.equal(f.run('poiTownDialogueSnapshot().menu'),'root');assert.equal(calls.length,1);
});
test('actual residents have unique given names and those names label dialogue and status',()=>{
 const a=html.indexOf('const POI_TOWN_RESIDENT_ROLES='),b=html.indexOf('const POI_TOWN_INN=',a);
 const names=vm.runInNewContext(html.slice(a,b)+';POI_TOWN_RESIDENT_ROLES.map(({id,name})=>[id,name])');
 assert.equal(names.length,12);
 assert.deepEqual(Array.from(names.find(([id])=>id==='towncook')),['towncook','イネス']);
 assert.equal(new Set(names.map(([,name])=>name)).size,names.length);
 assert.deepEqual(Array.from(names[0]),['guildkeeper','リーネ']);
 assert(names.every(([,name])=>!/(役割|店主|受付係|主人|冒険者|配達人|旅人|行商人|厩舎番)/.test(name)));
 assert.match(html,/poiMessageSpeak\(poiTownNpcDisplayName\(d\.actor\.role\),d\.text,now\)/);
 assert.match(html,/\['name','名前',info\.name\]/);
 assert.doesNotMatch(html,/\['role','役割',info\.role\]/);
});
test('job titles follow given names and all dialogue surfaces use the same display name',()=>{
 const f=fixture(),announcements=[];f.c.poiMessageSpeak=(...args)=>announcements.push(args);
 f.actor.role.name='リーネ';
 f.c.guest={x:5,z:4,y:0,role:{id:'guestadventurer',name:'カイ'}};
 f.c.host={x:5,z:2,y:0,role:{id:'innkeeper',name:'ガルド'}};
 assert.equal(f.run("poiTownAmbientSpeak('inn',guest,host,100)"),true);
 f.run('poiTownDialogueDraw(1200,[])');assert.match(f.e.textContent,/^ガルド（宿屋の主人）\n/);
 assert.equal(f.run('poiTownNpcDisplayName(guest.role)'),'カイ（冒険者）');
 assert.equal(f.run("poiTownNpcDisplayName({id:'northtraveler',name:'セオ'})"),'セオ');
 assert.equal(f.run('poiTownDialogueAction(1500)'),true);
 assert.equal(announcements[0][0],'リーネ（ギルド受付）');
 assert.equal(f.run('poiTownDialogueSnapshot().name'),'リーネ（ギルド受付）');
 assert.equal(f.actor.role.name,'リーネ');
});
test('surveyed guild quest exposes report only, and completed quest has no payout action',()=>{
 const f=fixture();let stage='surveyed',calls=0;
 f.c.poiQuestsForClerk=()=>[{id:'mine-survey',label:'廃坑★★☆☆☆（調査）'}];
 f.c.poiQuestProgress=()=>stage;
 f.c.poiQuestReport=(id,actor)=>{assert.equal(id,'mine-survey');assert.equal(actor,f.actor);calls++;stage='reported';return {ok:true,gold:10}};
 f.run('poiTownDialogueAction(100)');f.run("poiNpcMenuChoose('quest',101)");
 assert.match(f.run('poiTownDialogueSnapshot().actions[0].label'),/報告可能/);
 f.run("poiNpcMenuChoose('quest:mine-survey',102)");
 assert.equal(f.run('poiTownDialogueSnapshot().actions[0].id'),'quest-report');assert.equal(calls,0);
 f.run("poiNpcMenuChoose('quest-report',103)");
 assert.equal(calls,1);assert.match(f.run('poiTownDialogueSnapshot().text'),/10G/);
 assert.match(f.run('poiTownDialogueSnapshot().actions[0].label'),/報告済み/);
 f.run("poiNpcMenuChoose('quest:mine-survey',104)");
 assert.equal(f.run('poiTownDialogueSnapshot().actions.length'),1);
 assert.equal(f.run("poiNpcMenuChoose('quest-report',105)"),false);assert.equal(calls,1);
});
