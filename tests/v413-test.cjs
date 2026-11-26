const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const s=fs.readFileSync(process.argv[2],'utf8'),line=s.split('\n').find(x=>x.includes("...person('frontierren'"));
const p=line.slice(line.indexOf("...person(")+3,line.indexOf("),home:")+1);
const bridge={west:123,south:32},ctx={FRONTIER_BRIDGE:bridge,FRONTIER_WEST_OFFSET:64,
 person:(id,name,type,x,z,facing)=>({x:x+64,z,facing})};
assert.deepEqual({...vm.runInNewContext(p,ctx)},{x:bridge.west-1,z:bridge.south,facing:0});
console.log('Ren is posted on the south edge of the western bridge approach, not on its deck.');
