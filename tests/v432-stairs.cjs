const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const i=h.indexOf('// BEGIN FRONTIER SOUTH RUINS'),j=h.indexOf('// END FRONTIER SOUTH RUINS',i);
const c=vm.createContext({facilitySite:{id:'frontier'}});
vm.runInContext(h.slice(i,j)+';globalThis.t={frontierSouthRampHeight,frontierSouthRampCell,frontierSouthSlopeLevel,frontierSouthRuinsOwn,FRONTIER_SOUTH_EXPEDITION_ROUTE,FRONTIER_SOUTH_ENEMIES};',c);
const {frontierSouthRampCell:stair,frontierSouthSlopeLevel:layer,frontierSouthRampHeight:height,frontierSouthRuinsOwn:inRoom,FRONTIER_SOUTH_ENEMIES:foes,FRONTIER_SOUTH_EXPEDITION_ROUTE:route}=c.t;
for(let x=159;x<=162;x++){
 for(let z=76;z<=80;z++)a.ok(stair(x,z));
 a.equal(layer(x,79,x,78,0),-1);a.equal(layer(x,78,x,79,-1),0);
}
a.ok(!stair(158,79));a.equal(layer(158,79,158,78,0),null);
a.equal(height(160.5,76),0);a.equal(height(160.5,81),-1.4);
for(let z=76.25;z<=81;z+=.25)a.ok(height(160.5,z)<=height(160.5,z-.25));
for(let x=158;x<=162;x++)for(let z=80;z<=84;z++)a.ok(inRoom(x,z));
a.ok(inRoom(154,81)&&inRoom(154,82)&&inRoom(154,83)&&!inRoom(154,80)&&!inRoom(154,84));
a.ok(foes.every(e=>inRoom(e.x,e.z)));
a.ok(route.filter(p=>p.y===-1).every(p=>inRoom(p.x,p.z)));
a.doesNotMatch(h.slice(i,j),/put\([^\n]+guildStair/);
console.log('PASS 4-wide continuous stair, bidirectional floor seam, 5-by-5 room + 3-wide hall, enemy anchors and syntax');
