const fs=require('node:fs'),a=require('node:assert/strict'),h=fs.readFileSync(process.argv[2],'utf8');
a(h.includes('function frontierEstateOnDeath('),'Human companion needs a persisted bag');
const start=h.indexOf('function frontierEstateKey('),end=h.indexOf('// END FRONTIER ESTATE',start);
const f=new Function(`const POI_CHEST_SIZE=18,POI_NPC_TRADE_MAX_STOCK=9,POI_ECONOMY_GOLD_MAX=999999,FRONTIER_W=192,FRONTIER_H=64;
const frontierIntroVillager=id=>id==='frontiersera'||id==='frontierren';
const poiInventorySanitizeCell=c=>c?.type?c:null,poiEquipmentDurabilityMax=()=>40;
const facilitySite={id:'frontier',residents:[]};let poiWalkX=20,poiWalkZ=30,poiWalkLevel=0;
const poiWalkCanStep=()=>true;
${h.slice(start,end)}
const initial={frontierFallen:['frontiersera'],frontierTrades:{frontiersera:{gold:9,healingHerb:3,cannedFood:1}}};
const added=frontierEstateOnDeath(initial,{npcId:'frontiersera',weapon:'equipWoodBow',gear:{torso:'starterTunic'}},{x:82,z:28,y:0});
const key=frontierEstateKey('frontiersera'),bag=frontierEstateDecode(added[key]);
return {bag,remainingTrade:added.frontierTrades?.frontiersera,emptied:frontierEstateReplace(added,key,{...bag,gold:0,slots:Array(18).fill(null)})[key]};
`);
const r=f();a.equal(r.bag.gold,9);a.equal(r.bag.x,82);a.equal(r.bag.slots.filter(Boolean).find(x=>x.type==='healingHerb').count,3);a.equal(r.bag.slots[0].type,'equipWoodBow');a(!r.remainingTrade);a.equal(r.emptied,undefined);
a(h.includes("['recruit','sell','buy','back']"));console.log('PASS persisted estate contents, remaining stock and empty removal');
