// Exact authorized exterior art changes against the v140 release. Each row
// is [x,z,y,type,rot]; no rectangular terrain or route exceptions.
const pinned=require('./outside-history-v141.json');
const record=o=>typeof o==='string'?o:JSON.stringify([o.x,o.z,o.y,o.type,o.rot]);
const added=new Set(pinned.added.map(row=>JSON.stringify(row)));
const removed=new Set(pinned.removed.map(row=>JSON.stringify(row)));
function prior(objects){
 const retained=Array.from(objects,record).filter(row=>!added.has(row));
 return retained.concat([...removed]);
}
module.exports={pinned,record,added,removed,prior};
