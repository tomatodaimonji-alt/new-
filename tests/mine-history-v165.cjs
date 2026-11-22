const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const oldLength=5677,addedLength=158;
const exactMine='64584a1eb89a0d25dc48b080cc0f8332cb9040a31d835e870973030efe49eb47';
function beforeAbandonedMine(site){
 if(!site.mine)return site;
 const {mine,map:{world,...map},...other}=site;
 const suffix=Array.from(world.slice(oldLength));
 assert.equal(suffix.length,addedLength,'the only extra authored records are the mine and its widened B1 chamber');
 const digest=createHash('sha256').update(JSON.stringify(suffix)).digest('hex');
 assert.equal(digest,exactMine,'only the exact v167 mine records are exempt; untouched v166 mine records are pinned separately');
 return {...other,map:{...map,world:world.slice(0,oldLength)}};
}
module.exports={beforeAbandonedMine};
