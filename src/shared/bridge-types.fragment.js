const BRIDGE_IDS=new Set(['bridgeWood','bridgeWoodEnd','bridgeStone','bridgeStoneEnd']);
function bridgeDirection(rot){return ((rot||0)%4+4)%4;}
function bridgeAligned(a,b){return a&&b&&BRIDGE_IDS.has(a.type)&&BRIDGE_IDS.has(b.type)&&
 a.type.startsWith('bridgeWood')===b.type.startsWith('bridgeWood')&&
 bridgeDirection(a.rot)%2===bridgeDirection(b.rot)%2;}
