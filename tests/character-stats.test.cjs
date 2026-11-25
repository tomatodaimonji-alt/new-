const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.argv[2],'utf8');
const fields=['名前','職業','HP','攻撃','防御'];
const parse=(start,end)=>{const i=html.indexOf(start),j=html.indexOf(end,i);assert(i>=0&&j>i);return html.slice(i,j)};
test('player inventory exposes five fields in order and reads defense from equipment',()=>{
 const s=parse('<div id="poiBagPlayerStats"','   </div>');
 assert.deepEqual([...s.matchAll(/<b>([^<]+)<\/b>/g)].map(x=>x[1]),fields);
 assert.match(html,/poiBagPlayerDefenseValue[^\n]+/);assert.match(html,/defense\.textContent=String\(poiPlayerDefense\(kit\)\)/);
});
test('actual NPC inventory render separates plain identity and profession and shows real unarmed fallback power',()=>{
 const ctx=vm.createContext({POI_TOWN_JOB_LABELS:{keeper:'料理人'},POI_TOWN_RESIDENT_HP:100,POI_TOWN_RESIDENT_MELEE:13,
  poiTownNpcAttackPower:()=>null,poiTownNpcDefense:()=>4,poiTownNpcLoadout:()=>({weapon:null,gear:{},tools:[]}),
  document:{createElement:()=>({dataset:{},children:[],setAttribute(){},append(...args){this.children.push(...args)}})}});
 vm.runInContext(parse('function poiTownNpcStatus(actor)','function poiNpcPortraitModel'),ctx);
 const rows=vm.runInContext("poiNpcStatusView({role:{id:'keeper',name:'ラン',role:'keeper'},hp:81}).children.map(n=>n.textContent)",ctx);
 assert.deepEqual(Array.from(rows),['名前','ラン','職業','料理人','HP','81/100','攻撃','13','防御','4']);
});
test('soul shows actual monster identity, duty, HP and numeric defense in same field order',()=>{
 const s=parse('<dl id="poiItemDetailSoulStats"',' </dl>');
 assert.deepEqual([...s.matchAll(/<dt>([^<]+)<\/dt>/g)].map(x=>x[1]),fields);
 const ctx=vm.createContext({poiCompanionType:()=>({name:'スライムの魂',attack:6,hp:36})});
 vm.runInContext(parse('function poiItemDetailSoulStats','function poiItemDetailRenderSoulStats'),ctx);
 const data=vm.runInContext("poiItemDetailSoulStats({type:'slimeSoul',durability:13})",ctx);
 assert.deepEqual({...data},{name:'スライム',job:'モンスター',hp:'13／36',attack:'6',defense:'0'});
});
