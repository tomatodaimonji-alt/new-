// Exact v137→v138 exterior changes only. Pinned typed coordinates below are
// shared by historical tests; rebuilding a synthetic v137 view does not
// rewrite any save or run browser code.
const legacy={
  "deltaAdded": {
    "benchWood 0 0": "30:49 42:47",
    "bridgeStoneEnd 0 0": "32:55,67",
    "bridgeStoneEnd 0 2": "31:55,67",
    "bushFern 0 0": "34:66",
    "bushFlower 0 0": "30:59",
    "crate 0 1": "34:48",
    "cropVegetable 0 1": "41:56",
    "earth 0 0": "41:56",
    "flowerField 0 0": "35:65",
    "grassMeadow 0 0": "35:65",
    "guildQuestBoard 0 0": "30:48",
    "poiCanalQuay 0 0": "30:52-54,56-61",
    "poiCanalQuay 0 2": "33:52-54,56-61",
    "poiCanalQuay 0 3": "31:51 32:51",
    "poiPottedPlant 0 0": "30:53 34:49 42:52",
    "poiStreetLamp 0 0": "33:60",
    "river 0 0": "31:52-68 32:52-68",
    "roadBrickFull 0 0": "30:53-54",
    "roadCobbleFull 0 0": "30:49-50,52,55-61 33:48-61 34:53 35:53 36:53 37:53 38:53 39:53 40:53 42:50 45:50",
    "roadCutStoneFull 0 0": "31:50-51 32:50-51",
    "roadGravelFull 0 0": "24:51 25:51 26:51 27:51 28:51 29:51 30:51 42:47-48",
    "sack 0 1": "30:50",
    "smallFlowerVase 0 0": "30:60",
    "smallFlowerVase 0 1": "42:56",
    "treeBirch 0 0": "34:64"
  },
  "deltaRemoved": {
    "benchWood 0 0": "41:35",
    "bushFern 0 0": "32:68",
    "bushFlower 0 0": "31:53",
    "cropVegetable 0 1": "34:53",
    "earth 0 1": "34:53",
    "flowerField 0 0": "26:52 32:66",
    "grassForest 0 0": "31:65",
    "grassMeadow 0 0": "32:66",
    "grassTrampled 0 0": "31:67 32:67",
    "grassWild 0 0": "26:52 31:53",
    "moss 0 0": "32:68",
    "poiPottedPlant 0 0": "41:40 43:45",
    "roadBrickFull 0 0": "43:45-46",
    "roadGravelFull 0 0": "31:50-51 32:50-51 33:48-51 35:51-53 36:51-53 37:51-53 38:51-53 39:51-53 40:51-53 41:35-36,51-52 45:50",
    "smallFlowerVase 0 1": "38:53",
    "treeBirch 0 0": "32:64"
  },
  "counts": {
    "same": 1244,
    "add": 124,
    "remove": 51
  }
};
const decode=rows=>{
 const out=[];
 for(const [label,entries] of Object.entries(rows)){
  const [type,y,rot]=label.split(' ');
  for(const entry of entries.split(' ')){
   const [z,spans]=entry.split(':');
   for(const span of spans.split(',')){
    const [a,b=a]=span.split('-').map(Number);
    for(let x=a;x<=b;x++)out.push(JSON.stringify([x,+z,+y,type,+rot]));
   }
  }
 }
 return new Set(out);
};
const added=decode(legacy.deltaAdded),removed=decode(legacy.deltaRemoved);
const key=({x,z,y,type,rot})=>JSON.stringify([x,z,y,type,rot]);
const prior=records=>Array.from(records,r=>typeof r==='string'?r:key(r)).filter(r=>!added.has(r)).concat([...removed]);
module.exports={legacy,added,removed,key,prior};
