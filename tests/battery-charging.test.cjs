const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const source=html.match(/async function pineInitBatteryIndicator\(\)\{[\s\S]*?\npineInitBatteryIndicator\(\);/)[0];
async function fixture(navigator){
 const classes=new Set(['unknown']), attributes={};
 const element={title:'バッテリー情報を取得できません',style:{setProperty(){}},classList:{remove:n=>classes.delete(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n)},setAttribute:(k,v)=>attributes[k]=v};
 const percent={textContent:'--%'};
 await vm.runInNewContext(source,{navigator,$:id=>id==='batteryIndicator'?element:percent});
 return {element,percent,classes,attributes};
}
test('bolt exists exclusively when the real charging class is present',()=>{
 assert.match(html,/header #batteryIndicator\.charging \.batteryShape::before\s*\{/);
 assert.doesNotMatch(html,/header #batteryIndicator \.batteryShape::before\s*\{/);
});
test('chargingchange toggles charging, preserves percent, and restores low',async()=>{
 const b=Object.assign(new EventTarget(),{level:.16,charging:false});
 const f=await fixture({getBattery:async()=>b});
 assert.equal(f.percent.textContent,'16%');
 assert.ok(f.classes.has('low'));
 b.charging=true;b.dispatchEvent(new Event('chargingchange'));
 assert.ok(f.classes.has('charging'));assert.ok(!f.classes.has('low'));
 assert.match(f.attributes['aria-label'],/充電中/);
 b.charging=false;b.dispatchEvent(new Event('chargingchange'));
 assert.ok(f.classes.has('low'));assert.ok(!f.classes.has('charging'));
 assert.doesNotMatch(f.attributes['aria-label'],/充電中/);
});
test('unavailable readings remain unknown; no guessed charger state',async()=>{
 for(const navigator of [{},{getBattery:async()=>{throw Error('unavailable')}}]){
  const f=await fixture(navigator);
  assert.equal(f.percent.textContent,'--%');assert.deepEqual([...f.classes],['unknown']);
 }
});
