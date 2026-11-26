const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict');const h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
const fn=n=>{const m=h.match(new RegExp('^function '+n+'\\([^]*?^}','m'));a.ok(m,n);return m[0]};
const c=vm.createContext({facilitySite:{id:'frontier'},poiNpcTalkCursor:new WeakMap(),poiHotbarRead:()=>c.kit,kit:{},
 frontierSouthBossDefeated:k=>k.boss===true,frontierExpeditionRuinsWarning:a=>a.y===-1?'なぜついてきた？':null,
 POI_FRONTIER_SHOP_ID:'other',POI_NPC_EXTRA_SPEECH:{}});
for(const n of ['frontierExpeditionClearTopic','poiNpcOpeningTopic'])vm.runInContext(fn(n),c);
const regna={actor:{role:{id:'frontierregna'},y:-1},greeting:'明日行く'},lyzel={actor:{role:{id:'frontierlyzel'},y:0},greeting:'明日行く'};
a.equal(c.poiNpcOpeningTopic(regna),'なぜついてきた？');a.equal(c.poiNpcOpeningTopic(lyzel),'明日行く');
c.kit={boss:true};
a.match(c.poiNpcOpeningTopic(regna),/先を越/);
const independent=c.poiNpcOpeningTopic(lyzel);a.match(independent,/先に/);
c.kit.frontierExpedition={result:'success',phase:'back'};
const l1=c.poiNpcOpeningTopic(lyzel),l2=c.poiNpcOpeningTopic(lyzel);
a.notEqual(l1,l2);a.notEqual(l1,independent);a.notEqual(c.poiNpcOpeningTopic(regna),l1);
a.ok([l1,l2,c.poiNpcOpeningTopic(regna)].every(s=>!/明日|ついてきた/.test(s)));
console.log('PASS completed voices precede catch-following warning, paired and other-clear outcomes distinguished');
