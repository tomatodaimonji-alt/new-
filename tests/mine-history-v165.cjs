const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const oldLength=5677,addedLength=113,cornerLength=8;
const exactCorners='a7f60db626cd8697558ac16ca9447c4b08d65e363fe574226dbd7e6538af5710';
const exactAdded='fd410418b69db181d08ec897beeaae39d7e95dc7f1cc478944b464ba624c96a5';
function beforeAbandonedMine(site){
 if(!site.mine)return site;
 const {mine,map:{world,...map},...other}=site;
 const end=oldLength+addedLength;
 const digest=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
 assert.equal(world.length,end+cornerLength,'only the bounded mine and its eight corner blocks were added');
 assert.equal(digest(world.slice(oldLength,end)),exactAdded,'the exact v165 mine parcel stays in its original order');
 assert.equal(digest(world.slice(end)),exactCorners,'only the exact v166 wall corner additions are exempt');
 return {...other,map:{...map,world:world.slice(0,oldLength)}};
}
module.exports={beforeAbandonedMine};
