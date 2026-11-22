const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const oldLength=5677,addedLength=113;
const exactAdded='fd410418b69db181d08ec897beeaae39d7e95dc7f1cc478944b464ba624c96a5';
function beforeAbandonedMine(site){
 if(!site.mine)return site;
 const {mine,map:{world,...map},...other}=site;
 const suffix=Array.from(world.slice(oldLength));
 assert.equal(suffix.length,addedLength,'the only extra authored records are the bounded mine parcel');
 const digest=createHash('sha256').update(JSON.stringify(suffix)).digest('hex');
 assert.equal(digest,exactAdded,'only the exact v165 appended records are exempt from older fixtures');
 return {...other,map:{...map,world:world.slice(0,oldLength)}};
}
module.exports={beforeAbandonedMine};
