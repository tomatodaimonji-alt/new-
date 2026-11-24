const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
test('only the actual near ordinary camera gradually makes the own avatar transparent',()=>{
 const a=h.indexOf('function poiHomeCloseAvatarKeep('),b=h.indexOf('// END ORDINARY HOME CAMERA ARM',a);
 assert(a>=0&&b>a);const c=vm.createContext({});vm.runInContext(h.slice(a,b),c);
 assert.equal(c.poiHomeCloseAvatarKeep(false,.01),1);
 assert.equal(c.poiHomeCloseAvatarKeep(true,2),1);
 assert(c.poiHomeCloseAvatarKeep(true,.371)>.1&&c.poiHomeCloseAvatarKeep(true,.371)<.45);
 assert(c.poiHomeCloseAvatarKeep(true,.81)>c.poiHomeCloseAvatarKeep(true,.371));
 assert.match(h,/poiHomeAvatarDrawKeep=p.homeAvatarKeep\?\?1;[\s\S]*?poiDrawWalkAvatar\(p.vp,now\)/);
 assert.match(h,/if\(uOcclusionInfo.w< -2.5\)/);
});
