const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),t=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
t.test('one explicit ticket materializes at exactly its successful spawned actor, no cold restore or replay',()=>{
 const i=h.indexOf('// BEGIN COMPANION SUMMON EFFECT'),j=h.indexOf('// END COMPANION SUMMON EFFECT');
 a(i>0&&j>i,'runtime present');
 const s={x:0,z:1,y:0},talk=[],site={},c=vm.createContext({poiCompanionPlace:()=>site,
  poiCompanionSame:(a,b)=>a===b,poiCompanionPosition:a=>a,terrainY:()=>0,poiCompanionAllowed:()=>true,
  poiAudioStart:()=>{},poiAudioAllowed:()=>true,poiAudioNativeForeground:true,poiAudioEnabled:true,
  poiAudioContext:{state:'running',currentTime:2,createBuffer:()=>({getChannelData:()=>new Float32Array(14400)})},
  poiAudioLevels:{master:1,se:1},poiPlayImpactBuffer:(b,n,g,cb)=>{talk.push({b,n,g});cb({stop(){},context:{currentTime:2}})}});
 vm.runInContext(h.slice(i,j),c);
 const ally={...s,id:'slimeSoul'};
 a.equal(c.poiCompanionSummonAttach(ally,50),false);
 c.poiCompanionSummonIntent('slimeSoul',100);
 a.equal(c.poiCompanionSummonAttach({...s,id:'orvasSoul'},140),false);
 a.equal(c.poiCompanionSummonAttach(ally,150),true);
 a.equal(c.poiCompanionSummonAttach(ally,151),false);
 a.equal(talk.length,1);a(talk[0].g>0&&talk[0].g<.6);
 a(c.poiCompanionSummonOpacity(ally,150)<.1);
 a(c.poiCompanionSummonOpacity(ally,380)>.3);
 a.equal(c.poiCompanionSummonOpacity(ally,730),1);
 c.poiCompanionSummonIntent('slimeSoul',1000);
 a.equal(c.poiCompanionSummonAttach(ally,5000),false);a.equal(talk.length,1);
});
