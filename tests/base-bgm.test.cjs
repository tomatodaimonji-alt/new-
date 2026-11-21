const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function capture(id){
 const begin=html.indexOf('const PINE_AUDIO_SETTINGS_KEY'),end=html.indexOf('const POI_PLAYER_MAX_HP',begin);
 const ctx=vm.createContext({window:{addEventListener(){}},document:{hidden:false,addEventListener(){}},
  localStorage:{getItem(){return null}},facilitySite:id===null?null:{id},poiWalkActive:true,poiWalkX:19,poiWalkZ:21,poiRegionAt:()=>({name:"拠点"}),notes:[]});
 vm.runInContext(html.slice(begin,end)+`
 poiAudioContext={currentTime:10,createGain(){return {gain:{value:0},connect(){}}},suspend(){return Promise.resolve()}};
 poiPianoKey=(...args)=>notes.push(args);
 `,ctx);
 return {notes:ctx.notes,run:s=>vm.runInContext(s,ctx)};
}
test('new quiet score is strictly base-only; other facility and ordinary map retain original cues',()=>{
 for(const id of [null,'stable','kitchen','lodging','guildsaved','guildrenewal']){
  const {notes,run}=capture(id);run('poiAudioMusicPhrase()');
  assert.deepEqual(notes.map(n=>n[0]),[73.415,220,174.61,293.66],id);
 }
 const {notes,run}=capture('base');run('poiAudioMusicPhrase()');
 assert.ok(Math.abs(notes[0][0]-130.8128)<.001);
 assert.ok(notes.every(n=>n[2]<.5));
});
test('base score is varied, soft, shares an exact repeating clock and clears pending notes on lifecycle stop',()=>{
 const {notes,run}=capture('base');
 for(let i=0;i<=1450;i++) run(`poiAudioContext.currentTime=${10+i*.1};poiAudioMusicPhrase()`);
 assert.ok(notes.length>160&&notes.length<400,notes.length);
 assert.ok(new Set(notes.filter(n=>n[1]<78).map(n=>n[0])).size>=16);
 assert.ok(notes.every(n=>n[2]>=.1&&n[2]<=.45));
 assert.ok(notes.every((n,i)=>!i||n[1]>=notes[i-1][1]));
 const loop=16*4*60/56;
 const first=notes[0],repeat=notes.find(n=>Math.abs(n[1]-first[1]-loop)<1e-6);
 assert.ok(repeat);assert.equal(repeat[0],first[0]);assert.equal(repeat[2],first[2]);
 const nearThird=notes.find(n=>Math.abs(n[1]-first[1]-loop*2)<1e-6);
 assert.ok(nearThird);assert.equal(nearThird[0],first[0]);
 const original=notes.length;
 run('document.hidden=true;poiAudioStop(true);poiAudioContext.currentTime=200;poiAudioMusicPhrase()');
 assert.equal(notes.length,original);
 run('document.hidden=false;poiAudioMusicPhrase()');
 assert.ok(notes.length>original);
 assert.equal(notes[original][0],first[0]);
 assert.ok(notes[original][1]>=200);
});
