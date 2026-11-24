const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function engine(){
 const a=h.indexOf('function poiOrchestraDrop('),b=h.indexOf('function poiOrchestraTick(',a);assert(a>=0&&b>a);
 const calls=[],node=(name)=>({
  name,gain:{value:0,cancelScheduledValues:t=>calls.push([name,'cancel',t]),setValueAtTime:(v,t)=>calls.push([name,'set',v,t]),
   linearRampToValueAtTime:(v,t)=>calls.push([name,'ramp',v,t]),setTargetAtTime:(v,t,k)=>calls.push([name,'target',v,t,k])},
  connect(to){calls.push([name,'connect',to.name]);return to},disconnect(){calls.push([name,'disconnect'])}
 });
 let count=0;
 const c={poiAudioContext:{currentTime:0,createGain:()=>node('gain'+(++count))},poiAudioMusic:node('BGM'),poiOrchestraRoom:null,
  poiOrchestraActive:null,poiOrchestraHasOpened:false,poiOrchestraDecks:new Map(),POI_ORCHESTRA_ENTRY_DECAY:.38,POI_ORCHESTRA_BOOT_DECAY:.30,POI_ORCHESTRA_FADE:.93,
  poiOrchestraScore:scene=>({scene}),poiOrchestraRoomStart:(ctx,target)=>{const room=node('room');room.connect(target||c.poiAudioMusic);c.poiOrchestraRoom={nodes:[room]};return room}};
 vm.createContext(c);vm.runInContext(h.slice(a,b),c);
 return {c,calls,go:(s,t)=>c.poiOrchestraActivate(s,t),stop:()=>c.poiOrchestraReset()};
}
test('whole outgoing dry and wet signal reaches absolute zero before the latest requested zone can allocate',()=>{
 const f=engine(),a=f.go('town',10),r=f.c.poiOrchestraRoom;
 assert(a&&a.output&&a.bus!==a.output);assert(f.calls.some(v=>v[0]==='room'&&v[2]===a.output.name));
 let stopped=null;a.sources.add({source:{stop:t=>{stopped=t}},cleanup(){}});
 assert.equal(f.go('town',10.8),a,'unchanged zone does not restart');
 assert.equal(f.go('outside',11),null,'outgoing sound retains exclusive slot');
 assert.equal(f.go('snow',11.4),null,'intermediate zone cannot schedule');
 assert.equal(f.c.poiOrchestraActive,'town');assert.equal(f.c.poiOrchestraDecks.size,1);
 assert(f.calls.some(v=>v[0]===a.output.name&&v[1]==='ramp'&&v[2]===0&&v[3]===11.72));
 const s=f.go('snow',11.73);assert(s&&s!==a);assert.equal(stopped,11.73);
 assert(f.calls.some(v=>v[0]===r.nodes[0].name&&v[1]==='disconnect'));
 assert(f.calls.some(v=>v[0]===s.output.name&&v[1]==='set'&&v[2]===0&&v[3]===11.73));
 assert(f.calls.some(v=>v[0]===s.output.name&&v[1]==='ramp'&&v[2]===1&&v[3]===12.73));
 assert.deepEqual([...f.c.poiOrchestraDecks.keys()],['snow']);
});
test('direction can reverse before zero, canceling a stale handoff without restarting same deck; background cleanup drops it',()=>{
 const f=engine();const a=f.go('outside',3);
 assert.equal(f.go('town',4),null);
 assert.equal(f.go('outside',4.3),a);
 assert.equal(f.go('outside',5.1),a);
 assert.deepEqual([...f.c.poiOrchestraDecks.keys()],['outside']);
 assert(f.calls.some(v=>v[0]===a.output.name&&v[1]==='set'&&v[2]>0&&v[2]<1&&v[3]===4.3));
 f.stop();assert.equal(f.c.poiOrchestraActive,null);assert.equal(f.c.poiOrchestraDecks.size,0);
});
