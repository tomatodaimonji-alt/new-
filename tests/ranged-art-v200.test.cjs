const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+1));
test('bow holds its pull until release and the string, grips, arrow nock align toward all four actual facings',()=>{
 const c={poiPlayerWeaponProfile:()=>({hit:650,pose:850})};
 vm.runInNewContext(cut('function poiPlayerProfilePose(','// Visual release only:')+cut('function poiBowAimPoints(','function poiBuildPlayerMesh(')+cut('function rot2(','function rotY(').split('\n')[0],c);
 const wind=c.poiPlayerProfilePose('equipWoodBow',325),aim=c.poiPlayerProfilePose('equipWoodBow',649),
  fire=c.poiPlayerProfilePose('equipWoodBow',650),settle=c.poiPlayerProfilePose('equipWoodBow',780);
 assert(wind.bowDraw>0&&wind.bowDraw<aim.bowDraw);assert(aim.bowDraw>.99);
 assert.equal(aim.bowReleased,false);assert.equal(fire.bowReleased,true);assert(settle.bowDraw<aim.bowDraw);
 const p=c.poiBowAimPoints(aim);
 assert.equal(p.front[0],p.draw[0]);assert.equal(p.front[1],p.draw[1]);
 assert(p.front[2]-p.draw[2]>.45);
 for(const [f,r] of [[0,2],[1,3],[2,0],[3,1]]){
  const v=Array.from(c.rot2(p.front[0]-p.draw[0],p.front[2]-p.draw[2],r));
  assert(v.map(n=>Math.sign(n)||0).every((n,i)=>n===[[0,-1],[1,0],[0,1],[-1,0]][f][i]));
 }
});
test('player projectiles use an arrow silhouette and flame facets, leaving the old Mage recipe alone',()=>{
 const calls=[],c={terrainY:()=>0,facilitySite:null,
  tri:(_m,...p)=>calls.push(['tri',...p]),quad:(_m,...p)=>calls.push(['quad',...p]),
  cube:(_m,...p)=>calls.push(['cube',...p])};
 vm.runInNewContext(cut('function poiPlayerProjectileSample(','function poiPlayerWeaponDraw('),c);
 const draw=(type,toX,toZ,now=50,impact)=>{calls.length=0;c.poiAppendWeaponProjectile({},{
  type,x:2,z:2,y:0,facing:1,started:0,travel:100,toX,toZ,...(impact===undefined?{}:{impact})
 },now);return calls.slice()};
 const east=draw('equipWoodBow',7,2),north=draw('equipWoodBow',2,0);
 assert(east.some(n=>n[0]==='tri')&&north.some(n=>n[0]==='tri'));
 const sample=c.poiPlayerProjectileSample({type:'equipWoodBow',x:2,z:2,y:0,facing:1,started:0,travel:100,toX:7,toZ:2},0);
 assert(sample.x>2.9&&sample.x<3.4&&Math.abs(sample.z-2.618)<.000001);
 const stopped=c.poiPlayerProjectileSample({type:'equipWoodBow',x:2,z:2,y:0,facing:3,started:0,travel:100,toX:2,toZ:2,impact:10},15);
 assert.equal(stopped.progress,1);assert.equal(stopped.x,2.5);assert.equal(stopped.z,2.5);assert.equal(stopped.dx,-1);
 const fire=draw('fireWand',7,2);assert(fire.filter(n=>n[0]==='tri').length>=12);assert(fire.every(n=>n[0]!=='cube'));
 assert.notDeepEqual(fire,draw('fireWand',7,2,90));
 assert.deepEqual(draw('monsterSkelMage',7,2).map(d=>d[0]),['cube','cube','cube']);
 assert.notDeepEqual(draw('fireWand',7,2,108,100),draw('fireWand',7,2,165,100));
});
test('a projectile tip aligns with the resolved tile center at first and later cell contact',()=>{
 const c={terrainY:()=>0,facilitySite:null};
 vm.runInNewContext(cut('function poiPlayerProjectileSample(','function poiWeaponArrowGeometry('),c);
 for(const [type,range,cellMs,minFlight] of [['equipWoodBow',5,65,70],['fireWand',8,55,55]]){
  const flight={type,x:2,z:2,y:0,facing:1,started:0,travel:range*cellMs,toX:2+range,toZ:2,profile:{cellMs,minFlight}};
  for(let n=1;n<=range;n++){
   const sample=c.poiPlayerProjectileSample(flight,Math.max(minFlight,n*cellMs));
   assert(Math.abs(sample.x-(2.5+n))<.000001,[type,n,sample.x]);
   assert(Math.abs(sample.z-2.5)<.000001,[type,n,sample.z]);
  }
 }
});
