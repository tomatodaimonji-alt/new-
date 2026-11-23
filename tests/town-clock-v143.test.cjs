const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function fixture(saved){
 const a=h.indexOf('const POI_TOWN_CLOCK_KEY='),b=h.indexOf('function poiShopIsOpen(',a);
 assert(a>=0&&b>a,'town clock source');
 const panel={hidden:true},value={textContent:''},day={textContent:''},writes=new Map();if(saved)writes.set('world-workshop-town-clock-v1',saved);
 const c={facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,document:{hidden:false},
  $:id=>({poiClockHud:panel,poiClockValue:value,poiClockDay:day}[id]),localStorage:{getItem:k=>writes.get(k)||null,setItem:(k,v)=>writes.set(k,v)}};
 vm.createContext(c);vm.runInContext(h.slice(a,b),c);
 return {c,panel,value,day,writes};
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
 const {c,value,day,writes}=fixture('{"version":1,"gameMs":719500}');c.poiTownClockFrame(0);assert.equal(value.textContent,'23:59');assert.equal(day.textContent,'1日目');
 c.poiTownClockFrame(500);assert.equal(value.textContent,'00:00');assert.equal(day.textContent,'2日目');
 assert.deepEqual({...c.poiTownClockSnapshot()},{minute:0,hour:0,day:2,absoluteMinute:1440});
 c.poiTownClockSuspend();
 assert.equal(JSON.parse(writes.get('world-workshop-town-clock-v1')).gameMs,720000);
 assert.equal(writes.size,1);
});
test('clock HUD follows wallet and the pale shared gameplay panel',()=>{
 assert.match(h,/<div id="poiClockHud" hidden>[\s\S]*?id="poiClockValue"/);
 assert.match(h,/#app #viewWrap :is\(#poiMiniMap,#poiLocationPanel,#poiClockHud\)\{[^}]+background-color:var\(--workshop-panel-surface\)/);
});
test('light cycles smoothly across sunrise, noon and midnight, only in Game World above-ground play',()=>{
 const {c}=fixture();c.poiWalkLevel=0;
 const at=m=>{assert.equal(c.poiTownClockSetTest(m),true);return [...c.poiTownSceneLight()]};
 const midnight=at(0),dawn=at(390),noon=at(720),late=at(1439);
 assert.deepEqual(noon,[1,1,1]);assert(midnight[0]<.6&&midnight[2]>midnight[0]);
 assert(dawn[0]>midnight[0]+.15&&dawn[0]>dawn[2]+.1&&dawn[0]<noon[0]-.1);
 assert(late.every((v,i)=>Math.abs(v-midnight[i])<.003));
 c.poiWalkLevel=2;assert.deepEqual([...c.poiTownSceneLight()],late);c.poiWalkLevel=0;
 for(const [key,value] of [['poiWalkLevel',-1],['poiWalkActive',false],['pineAIActive',true],['facilitySite',{id:'lodging'}]]){
  const old=c[key];c[key]=value;assert.deepEqual([...c.poiTownSceneLight()],[1,1,1]);c[key]=old;
 }
});
test('day label is beside the existing time and light is confined to 3D programs',()=>{
 assert.match(h,/<div id="poiClockHud" hidden><span id="poiClockDay">1日目<\/span><strong id="poiClockValue">08:00/);
 assert.match(h,/vec3 paint=pow\(max\(vCol,[^\n]*/);
 assert.match(h,/vec3 color=paint\*uTownDaylight;/);
 assert.match(h,/if\(uLootHighlight.w>0.0\)\{[\s\S]*?\n \}\n gl_FragColor=vec4\(mix\(color,vec3\(1\.0,\.13,\.14\),uHitFlash\),1\.0\)/);
 assert.match(h,/gl\.uniform1f\(loc\.hitFlash,0\)/,'temporary actor-only tint is reset');
 assert.match(h,/gl_FragColor=vec4\(c.rgb\*uTownDaylight,c.a\)/);
 assert.match(h,/gl.uniform3f\(loc.daylight,\.\.\.daylight\)/);
 assert.doesNotMatch(h,/#view(?:Wrap)?\{[^}]*filter:brightness/);
});
