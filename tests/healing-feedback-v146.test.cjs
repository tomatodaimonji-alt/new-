const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)};
test('positive healing floats a green explicit amount over the current player, and clicks at zero do nothing',()=>{
 const labels=[],sounds=[],c={poiWalkActive:true,poiWalkLevel:1,poiWalkViewX:22.2,poiWalkViewZ:26.6,
  performance:{now:()=>350},poiCreekPlayerHeight:()=>.12,poiDamageNumber:(...a)=>labels.push(a),
  poiSound:k=>sounds.push(k)};
 vm.createContext(c);vm.runInContext(cut('function poiHealPlayerFeedback(','function poiWorldToScreen('),c);
 for(const v of [0,-3,NaN])c.poiHealPlayerFeedback(v);
 c.poiHealPlayerFeedback(25);
 assert.equal(labels.length,1);const [x,z,y,amount,isPlayer,heal]=labels[0];
 assert.deepEqual([x,z,amount,isPlayer,heal],[22.7,27.1,25,true,true]);
 assert(y>3&&y<3.5);assert.deepEqual(sounds,['heal']);
 assert.match(h,/\.poiDamageNumber\.playerHeal\{color:#8cf5a1/);
 assert.match(h,/\(d\.healing\?'\+':'-'\)\+d\.value/);
});
test('recovery tone is a short warm chord on the effects bus, respects mute and stays distinct from damage',()=>{
 const tone=[],dest={},c={poiAudioLevels:{master:75,se:80},poiAudioEffects:dest,poiAudioTone:(...p)=>tone.push(p)};
 vm.createContext(c);vm.runInContext(cut('function poiHealSound(','function poiSound('),c);
 c.poiHealSound(13);
 assert.deepEqual(tone.map(x=>x[0]),[523.25,659.25,783.99]);
 assert(tone.every(x=>x[5]===dest&&x[2]<.6));
 assert(tone.every((x,i)=>!i||x[1]>tone[i-1][1]));
 c.poiAudioLevels.se=0;c.poiHealSound(14);assert.equal(tone.length,3);
 assert.match(h,/kind==='heal'\)\{\s*poiHealSound\(now\);/);
});
