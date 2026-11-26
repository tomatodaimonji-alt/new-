const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const s=fs.readFileSync(process.argv[2],'utf8');
const start=s.indexOf('function poiWalletSync('),stop=s.indexOf('\n}',start);
const calls={};
let k={gold:24,goldStacks:[],goldHotbarSlot:4};
const value={textContent:''},attrs=new Map(),wallet={title:'',hasAttribute:()=>true,getAttribute:n=>attrs.get(n),toggleAttribute:(n,v)=>attrs.set(n,v),setAttribute:(n,v)=>attrs.set(n,v)};
const context={poiHotbarRead:()=>k,poiGoldHotbarSlot:k=>k?.goldHotbarSlot??null,
 poiWalletGold:(k,g=k.gold)=>g-k.goldStacks.reduce((n,p)=>n+p.amount,0),
 $:n=>({poiBagWallet:wallet,poiGoldValue:value}[n]||null)};
const sync=vm.runInNewContext(s.slice(start,stop+2)+'\npoiWalletSync',context);
sync(24);a.equal(value.textContent,'','moving the wallet to a shortcut empties the bag slot');a.equal(attrs.get('data-wallet-empty'),true);
k={gold:24,goldStacks:[{slot:2,amount:6}]};sync(24);a.equal(value.textContent,'18');a.equal(attrs.get('data-wallet-empty'),false);
a.doesNotMatch(s,/id="poiBagGoldTotal"/);
console.log('wallet visible exactly in its assigned position and no top-right balance label');
{
 const lines=s.split('\n'),fn=name=>{
  const start=lines.findIndex(v=>v.startsWith('function '+name+'('));a.ok(start>=0,name);
  return lines.slice(start,lines.findIndex((v,i)=>i>start&&v==='}')+1).join('\n');
 };
 const buyer={role:{id:'frontiermiyamoto'},x:102,z:25,y:0},shop={role:{id:'frontiershopkeeper'},x:102,z:23,y:0};
 let stock={frontiermiyamoto:{gold:12,healingHerb:0},frontiershopkeeper:{gold:12,healingHerb:3}},speeches=0;
 const ctx={poiHotbarRead:()=>stock,poiTownDialogue:null,poiTownNpcActors:[buyer,shop],POI_FRONTIER_SHOP_ID:'frontiershopkeeper',
  frontierVendorStock:(k,id)=>k[id],poiEconomyWrite:k=>{stock=k;return true},frontierLifeStock:(k,id,value)=>({...k,[id]:value}),
  frontierMerchantPrice:()=>9,poiTownNpcGesture:()=>{},poiTownNpcAct:(b,k)=>b.activity=k,POI_ECONOMY_GOLD_MAX:999,facilitySite:{toolShop:{x:102,z:24}},
  poiTownNpcSleeping:()=>false,poiTownAmbientSpeak:()=>{speeches++},poiTownNpcStepT:()=>1};
 const buy=vm.runInNewContext([fn('frontierToolshopSeller'),fn('frontierNpcBuyHerb'),'frontierNpcBuyHerb'].join('\n'),ctx);
 a.equal(buy(buyer,500),true);a.equal(stock.frontiermiyamoto.healingHerb,1);a.equal(stock.frontiermiyamoto.gold,3);
 a.equal(stock.frontiershopkeeper.healingHerb,2);a.equal(stock.frontiershopkeeper.gold,21);
 a.equal(buyer.frontierTradeAt,2900);a.equal(shop.frontierTradeAt,2900);a.equal(speeches,1);
 a.equal(buy(buyer,1000),false);a.equal(speeches,1);
}
a.match(s,/person\(id,name,'humanVillager',31,z,3,appearance\)/);
console.log('shop transaction resolves at the actual counter, with a bounded conversation; watch posts outside the west gate');
