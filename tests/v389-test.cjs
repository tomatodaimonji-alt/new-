const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
for(const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
a(h.includes('function frontierHomeInteriorAt(')&&h.includes('function frontierHomeCameraRows('),'house camera should follow its physical walls and real room bounds');
a(h.includes('function frontierFurniturePosition(')&&h.includes('function frontierBedPose('),'bed positions must match both furniture and sleeping poses');
a(h.includes("[46,32,'benchWood',2],[44,27,'benchWood',0]"));
a(h.includes('POI_ENEMY_BAR_GAP*.36')&&h.includes('(.66+.34*pace)/stepMs'));
console.log('PASS shared house wall and furniture placement, street-facing benches, ally pace and bar gap');
a(h.includes('function poiCompanionNavGridEdge(')&&h.includes('function poiCompanionNavSweep('),'navigation cannot plan through wall placeholder tiles');
a(h.includes('a.localFailedLeg={x:waypoint.x,z:waypoint.z,until:'),'an immobile follower needs to invalidate its stale waypoint');
