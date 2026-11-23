const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const html=readFileSync(process.env.WORKSHOP_HTML||require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b));
function setup(actors,pose=null,y=0){
 const c={poiTownNpcActors:actors,poiWalkActive:true,poiWalkLevel:y,poiFreePose:pose,poiWalkX:0,poiWalkZ:0,poiWalkFromX:0,poiWalkFromZ:0,poiWalkStarted:0,poiWalkStepMs:175,POI_WALK_MS:175,performance:{now:()=>175}};
 runInNewContext(cut('// BEGIN FREE MOVEMENT SOLVER','// END FREE MOVEMENT SOLVER')+'\n'+
 cut('// BEGIN PLAYER NPC BODY','// END PLAYER NPC BODY')+'\n'+
 cut('const POI_TOWN_RESIDENT_TICK=','const POI_TOWN_OPEN=')+'\n'+
 cut('function poiTownNpcStepT(','function poiTownNpcVisualCadence('),c);
 return c;
}
const npc=(x,z,y=0,extra={})=>({x,z,y,...extra});
test('static same floor body stops at combined radius, allows side slide, refuses direct cardinal crossing',()=>{
 const c=setup([npc(1,0)]);
 const clip=c.poiPlayerNpcBodyClip(175);
 assert(Math.abs(c.poiFreeAdvance(0,0,1,0,.2,()=>true,()=>true,clip).x-.6)<1e-6);
 const slide=c.poiFreeAdvance(.58,0,1,1,.2,()=>true,()=>true,clip);
 assert(slide.x>1&&slide.z>.9);
 const direct=c.poiFreeAdvance(0,0,1,0,.2,()=>true,()=>true,clip);
 assert(direct.x<1);
});
test('a moving cardinal NPC reserves its remaining path; a continuous leg uses its actual position',()=>{
 const c=setup([npc(1,0,0,{fromX:1,fromZ:1,fromY:0,moveAt:0})]);
 const clip=c.poiPlayerNpcBodyClip(175);
 assert(clip(0,.25,1.5,false)<.61);
 assert.equal(clip(0,-.5,1.5,false),1.5);
 const d=setup([npc(2,0,0,{actorLeg:{x:.7,z:0,elapsed:1,duration:2}})]);
 assert(Math.abs(d.poiPlayerNpcBodyClip(175)(0,0,1,false)-.3)<1e-6);
});
test('other floors, recessed, defeated, and overlap escape',()=>{
 const c=setup([npc(1,0,1),npc(1,0,0,{recessed:true}),npc(1,0,0,{death:{}})]);
 assert.equal(c.poiPlayerNpcBodyClip(175),null);
 const d=setup([npc(0,0)]);
 const clip=d.poiPlayerNpcBodyClip(175);
 assert.equal(clip(0,0,1,false),1);
 assert.equal(clip(-.1,0,.1,false),-.1);
});
test('NPC free and canonical movement avoids player from either direction, but existing overlap can retreat',()=>{
 const c=setup([], {x:.72,z:.2,level:0});
 assert.equal(c.poiTownNpcPlayerBodyBlocks(0,0,1,0,0,175),true);
 assert.equal(c.poiTownNpcPlayerBodyBlocks(0,0,1,0,1,175),false);
 assert.equal(c.poiTownNpcPlayerBodyBlocks(.74,.23,1,.24,0,175),false);
 c.poiFreePose=null;c.poiWalkFromX=0;c.poiWalkFromZ=1;c.poiWalkX=1;c.poiWalkZ=1;
 assert.equal(c.poiTownNpcPlayerBodyBlocks(.7,0,.7,2,0,75),true);
});
