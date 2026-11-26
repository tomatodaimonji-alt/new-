const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const actual=fs.readFileSync(process.argv[2]||'rollback.html','utf8');
const old=fs.readFileSync(process.argv[3]||'../workshop-frontier-v449/candidate.html','utf8');
const region=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return s.slice(i,j);};
assert.ok(!actual.includes('POI_STICK_HERO_BODY'));
for(const [a,b] of [['function poiBowAimPoints(','const POI_MONSTER_BREAK_MS='],
                     ['function poiDrawPlayerBlockArms(','// BEGIN INSTANT MELEE ART']])
 assert.equal(region(actual,a,b),region(old,a,b),'pre-stick player geometry, motion, grips and avatar upload restored byte-for-byte');
const call='poiDrawPaperDoll(view,poiBuildPlayerMesh(weapon,null,gear))';
assert.ok(actual.includes(call)&&old.includes(call),'old inventory appearance too');
assert.match(actual,/\{key:'regent-rune',shape:'lane',range:6.15/);
for(const m of actual.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
console.log('PASS exactly restored v449 avatar while keeping v450 combat and earlier optimizations');
