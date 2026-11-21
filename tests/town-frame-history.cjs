// v142 changes only the following exact gate/approach rows in the old frame.
const fixture=require('./town-frame-v142.fixture.json');
const record=o=>typeof o==='string'?o:JSON.stringify([o.x,o.z,o.y,o.type,o.rot]);
const added=new Set(fixture.add.map(row=>JSON.stringify(row)));
const removed=fixture.remove.map(row=>JSON.stringify(row));
function prior(objects){
 return Array.from(objects,record).filter(row=>!added.has(row)).concat(removed);
}
module.exports={fixture,record,added,removed,prior};
