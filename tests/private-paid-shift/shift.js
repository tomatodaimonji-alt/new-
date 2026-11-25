// BEGIN TOWN NPC PAID SHIFT
const POI_NPC_SHIFT_COUNTER=Object.freeze({x:32,z:38,y:0,facing:0});
function poiTownNpcPaidShift(a,clock,now,budget){
 if(a.role?.id!=='resadventurer'||facilitySite?.id!=='base'||a.target||a.hitAt!=null||a.death)return false;
 const m=clock.minute,abs=clock.absoluteMinute,day=Math.floor(abs/1440);
 if(m<915||m>=985||!Number.isSafeInteger(abs)||abs<0||a.hp<=84)return false;
 if(Number.isFinite(a.npcShiftMealAt)&&now>=a.npcShiftMealAt&&now-a.npcShiftMealAt<1120)return true;
 if(a.npcShiftMealDay===day)return false;
 const p=poiTownNpcPurseRead(),price=3,wage=1;
 if(!p||p.shift.day>=day||p.resadventurer.coins<6+price||
    p.food.supplier-(p.order?.quantity??0)<=2)return false;
 const marta=poiTownNpcActors.find(b=>b.role?.id==='diningkeeper'),ines=poiTownNpcActors.find(b=>b.role?.id==='towncook');
 if(marta?.activity!=='work'||ines?.activity!=='work'||
    !poiTownNpcHere(marta,{x:31,z:36,y:0})||!poiTownNpcHere(ines,{x:26,z:42,y:0})||
    poiTownNpcStepT(marta,now)<1||poiTownNpcStepT(ines,now)<1)return false;
 const g=poiTownNpcGraph(),counter=POI_NPC_SHIFT_COUNTER;
 if(!g.cells.get(poiTownNpcKey(32,37,0))?.includes('counterWood')||
    !g.cells.get(poiTownNpcKey(33,39,0))?.some(t=>/Door/.test(t))||
    !g.cells.get(poiTownNpcKey(25,42,0))?.includes('kitchenStove')||
    !poiTownNpcStance(counter,g))return false;
 if(!poiTownNpcMove(a,counter,'going-visit',now,budget)||!poiTownNpcHere(a,counter)||poiTownNpcStepT(a,now)<1)return true;
 // Cash received by the restaurant pays only this completed service.
 // Save purse, food and wage experience together before showing effects.
 p.resadventurer.coins-=price;p.diningkeeper+=price-wage;p.towncook+=wage;p.food.supplier--;
 p.shift={day,served:p.shift.served+1,xp:Math.min(20,p.shift.xp+1)};
 if(!poiTownNpcPurseSave(p))return true;
 a.coins=p.resadventurer.coins;marta.coins=p.diningkeeper;ines.coins=p.towncook;
 a.npcShiftMealDay=day;a.npcShiftMealAt=now;
 poiTownNpcAct(a,'meal-break');poiTownNpcGesture(a,'eat-inn',now);
 poiTownNpcGesture(marta,'trade-sell',now);poiTownNpcGesture(ines,'serve',now);
 return true;
}
// END TOWN NPC PAID SHIFT
