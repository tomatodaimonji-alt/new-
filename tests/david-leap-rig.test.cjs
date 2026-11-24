const assert=require('node:assert/strict'), test=require('node:test'), fs=require('node:fs'), vm=require('node:vm');
const source=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const a=source.indexOf('function poiDavidHeadPoint('),b=source.indexOf('function poiDavidTempleArchitecture(',a);
const c=vm.createContext({Math,POI_DAVID_BLADE:3.1,POI_DAVID_EYE_Y:4.75,POI_DAVID_EYE_FRONT:.29});
vm.runInContext(source.slice(a,b),c);
const rig=(phase,progress)=>c.poiDavidRig({kind:'leap',phase,progress});
test('launch loads both knees, flight tucks asymmetric feet, and recovery lands planted then rises',()=>{
 const start=rig('windup',0),load=rig('windup',1),air=rig('airborne',.5),down=rig('impact',1);
 assert.ok(start.leapCrouch<.01&&load.leapCrouch>.39,'anticipation progressively loads both knees');
 assert.deepEqual(load.feet,rig('airborne',0).feet);assert.deepEqual(load.knees,rig('airborne',0).knees);
 assert.ok(air.feet[0][1]>.45&&air.feet[1][1]>.33);
 assert.ok(Math.abs(air.feet[0][1]-air.feet[1][1])>.17);
 assert.equal(down.feet[0][1],0);assert.equal(down.feet[1][1],0);
 assert.ok(down.knees[0][2]>.4&&down.knees[1][2]>.3);
 assert.ok(down.leapCrouch>.55);
 const recovery=rig('recover',0),rise=rig('recover',.75),rest=rig('recover',1);
 assert.deepEqual(down.feet,recovery.feet);assert.deepEqual(down.knees,recovery.knees);
 assert.equal(down.leapCrouch,recovery.leapCrouch);
 assert.ok(recovery.leapCrouch>rise.leapCrouch&&rise.leapCrouch>rest.leapCrouch);
 assert.equal(rest.leapCrouch,0);
});
test('actual torso projection drops visibly on landing without changing mesh foot floor or ordinary attacks',()=>{
 assert.equal(typeof c.poiDavidLeapBodyY,'function','height warp used at world mesh submission');
 assert.equal(c.poiDavidLeapBodyY(.04,.65),.04);
 assert.ok(Math.abs(c.poiDavidLeapBodyY(4.2,.65)-3.55)<1e-9);
 assert.equal(c.poiDavidLeapBodyY(4.2,0),4.2);
 assert.deepEqual(c.poiDavidRig({kind:'double',phase:'impact',progress:.2}).leapCrouch,0);
});
