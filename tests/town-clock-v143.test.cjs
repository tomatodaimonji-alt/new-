const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function fixture(saved){
 const a=h.indexOf('const POI_TOWN_CLOCK_KEY='),b=h.indexOf('function poiShopIsOpen(',a);
 assert(a>=0&&b>a,'town clock source');
 const panel={hidden:true},value={textContent:''},writes=new Map();if(saved)writes.set('world-workshop-town-clock-v1',saved);
 const c={facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,document:{hidden:false},
  $:id=>id==='poiClockHud'?panel:value,localStorage:{getItem:k=>writes.get(k)||null,setItem:(k,v)=>writes.set(k,v)}};
 vm.createContext(c);vm.runInContext(h.slice(a,b),c);
 return {c,panel,value,writes};
}
test('base clock ticks from 08:00 at two minutes per real second, pauses outside foreground play',()=>{
 const {c,panel,value}=fixture();c.poiTownClockFrame(0);assert.equal(value.textContent,'08:00');assert(!panel.hidden);
 c.poiTownClockFrame(1000);assert.equal(value.textContent,'08:02');
 c.document.hidden=true;c.poiTownClockFrame(2000);c.poiTownClockFrame(600000);
 c.document.hidden=false;c.poiTownClockFrame(603000);assert.equal(value.textContent,'08:02');
 c.poiTownClockFrame(604000);assert.equal(value.textContent,'08:04');
 c.pineAIActive=true;c.poiTownClockFrame(605000);assert(panel.hidden);
 c.pineAIActive=false;c.facilitySite.id='workshop';c.poiTownClockFrame(606000);assert(panel.hidden);
 assert.equal(c.poiTownClockSnapshot().absoluteMinute,484);
});
test('24h wraps and a separate saved clock resumes without altering other storage',()=>{
 const {c,value,writes}=fixture('{"version":1,"gameMs":719500}');c.poiTownClockFrame(0);assert.equal(value.textContent,'23:59');
 c.poiTownClockFrame(500);assert.equal(value.textContent,'00:00');
 assert.deepEqual({...c.poiTownClockSnapshot()},{minute:0,hour:0,day:2,absoluteMinute:1440});
 c.poiTownClockSuspend();
 assert.equal(JSON.parse(writes.get('world-workshop-town-clock-v1')).gameMs,720000);
 assert.equal(writes.size,1);
});
test('clock HUD follows wallet and the pale shared gameplay panel',()=>{
 assert.match(h,/<div id="poiGoldHud"[\s\S]*?<div id="poiClockHud" hidden>[\s\S]*?id="poiClockValue"/);
 assert.match(h,/#poiGoldHud,#poiClockHud\{[^}]+background:var\(--workshop-panel-surface\)/);
});
