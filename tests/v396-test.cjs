const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
const spec=h.match(/\/\/ BEGIN FRONTIER WATERSHED\n([\s\S]*?)\/\/ END FRONTIER WATERSHED/);
a(spec,'watershed needs shared geometry for both water and shoreline');
const c=vm.createContext({});vm.runInContext(spec[1]+'\nObject.assign(globalThis,{frontierRiver,frontierRiverCenter,frontierRiverWidth,frontierLakeMix,frontierWaterFields});',c);
const {frontierRiver:d,frontierRiverCenter:center,frontierRiverWidth:w,frontierLakeMix:pool}=c;
for(let z=23;z<=43;z+=.25){
 a(w(z)*2>4.35&&w(z)*2<6.45);
 a(d(center(z),z)<-2&&d(center(z)+w(z)+.3,z)>0);
 a(pool(center(z),z)<.12);
}
for(const [x,z] of [[63,11],[63,53],[66,6],[58,55]])a(d(x,z)<0&&pool(x,z)>.9);
for(let z=6;z<58;z+=.12){a(d(center(z),z)<0,'channel to both lakes should be continuous '+z);}
for(const [x,z] of [[63,2],[63,62],[49,11],[77,53]])a(d(x,z)>0,'closed rounded waters edge');
for(const z of [10,54])for(let x=53;x<75;x+=.5)a(Math.abs(d(x,z-.001)-d(x,z+.001))<.04);
const bridge=h.match(/const FRONTIER_BRIDGE=Object.freeze\(\{west:(\d+),east:(\d+),north:(\d+),south:(\d+)\}\);/).slice(1).map(Number);
a(bridge[1]-bridge[0]<12&&d(bridge[0],30.5)>1&&d(bridge[1],30.5)>1);
a.match(h,/mix\(flow,standing,pool\)/);
for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
console.log('PASS connected narrower river, organic lake ends, two water motion styles and deck reaches dry banks');
