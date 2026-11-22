const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const oldLength=5677,addedLength=158;
const exactMine='64584a1eb89a0d25dc48b080cc0f8332cb9040a31d835e870973030efe49eb47';
// Reinsert only the four historically documented cut walls; all old
// authored records and their ordering stay covered by the v189 digest.
function beforeMineDepths(world){
 const cutoff=5832;
 const restored=Array.from(world.slice(0,cutoff));
 assert.equal(restored.at(-1).type,'mineSurveyMarker');
 assert(world.length>cutoff&&world.length<6105);
 for(const [i,x,z,type] of [[5774,115,58,'mosswall'],[5776,113,60,'mosswall'],
  [5799,121,50,'stonewall'],[5828,115,57,'mosswall']])restored.splice(i,0,{x,z,y:-1,type,rot:0});
 return restored;
}
function beforeAbandonedMine(site){
 if(!site.mine)return site;
 const {mine,map:{world,...map},...other}=site;
 const suffix=(mine.vault?beforeMineDepths(world):Array.from(world)).slice(oldLength);
 assert.equal(suffix.length,addedLength+1,'the only extra records are the mine and its one survey marker');
 assert.deepEqual({...suffix.pop()},{x:119,z:59,y:-1,type:'mineSurveyMarker',rot:2},
  'only the exact wall-mounted v189 survey record is exempted from the existing mine digest');
 const digest=createHash('sha256').update(JSON.stringify(suffix)).digest('hex');
 assert.equal(digest,exactMine,'only the exact v167 mine records are exempt; untouched v166 mine records are pinned separately');
 return {...other,map:{...map,world:world.slice(0,oldLength)}};
}
module.exports={beforeAbandonedMine,beforeMineDepths};
