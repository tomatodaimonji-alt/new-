const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync('world-editor.html','utf8');
const section=(start,end)=>h.slice(h.indexOf(start),h.indexOf(end,h.indexOf(start)+1));
test('ordinary item, armed drops and mine finds all announce exactly the item name',()=>{
 a.match(section('function poiInventoryPickup(','function poiInventoryReleaseMesh('),/poiMessagePush\(notice,'item'\)/);
 a.match(section('function poiArmedPickup(','\/\/ END ARMED FOES'),/poiInventoryItemName\(item.type\)\+'を拾った'/);
 a.match(section('function poiMineFindPickup(','\/\/ END MINE VAULT'),/poiInventoryItemName\(find.type\)\+'を拾った'/);
});
test('side-supply pickup copy does not mention the place, or add duplicate hints',()=>{
 const fn=section('function poiNorthTrailPickup(','\/\/ END NORTH TRAIL CAMP');
 for(const [name,type] of [['camp','healingHerb'],['watch','cannedFood'],['marsh','healingHerb'],['otherworld','cannedFood'],['chapel','cannedFood']]){
  const p={id:({camp:'north-trail-camp',watch:'north-watchpost-find',marsh:'north-marsh-herb',otherworld:'otherworld-east-supply',chapel:'chapel-west-supply'})[name],type,x:1,z:1,count:1},shown=[];
  const get=k=>()=>name===k?p:null;
  const c=vm.createContext({poiInventoryAllowed:()=>true,poiHotbarRead:()=>({}),poiNorthTrailSupply:get('camp'),poiNorthTrailWatchSupply:get('watch'),poiNorthTrailMarshSupply:get('marsh'),poiOtherworldEastSupply:get('otherworld'),poiChapelWestSupply:get('chapel'),poiNorthTrailSupplyGround:()=>true,
    poiInventoryAccept:()=>({slots:[],accepted:1}),poiInventoryEdited:k=>k,poiEconomyWrite:()=>true,poiEconomyRefresh(){},poiSound(){},toast:v=>shown.push(v)});
  vm.runInContext(fn,c);a.equal(c.poiNorthTrailPickup(1,1),true);
  a.deepEqual(shown,[type==='cannedFood'?'缶詰を拾った':'薬草を拾った']);
 }
});
