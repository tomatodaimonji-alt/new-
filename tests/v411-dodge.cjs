const a=require('node:assert/strict'),fs=require('node:fs');
const s=fs.readFileSync(process.argv[2],'utf8');
a.doesNotMatch(s,/['"]回避['"]|poiDodgeFeedback\(/);
a.match(s,/poiLearnedDodge\(state,key/);
a.match(s,/a\.humanSidestepHold=Math\.max\(now\+POI_HUMAN_SIDESTEP_RECOVER/);
console.log('dodge feedback removed; learned dodge and sidestep still wired');
