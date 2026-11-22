// Only the one v162 kitchen chest is absent from historical snapshots.
// Frames shift x and z together; the immutable cellar level and turn also match.
function kitchenChestAddedV162(o,offset=0){
 return o.type==='kitchenChest'&&o.x===5+offset&&o.z===10+offset&&o.y===-1&&o.rot===3;
}
module.exports={kitchenChestAddedV162};
