import assert from 'node:assert/strict';

// Combat-specific regressions exercise deterministic legal births that are
// deliberately NOT the authored loot anchors. Production random selection /
// roaming are independently exercised by outdoor-wild-roam-browser.mjs.
const points={
 monsterSkelArcher:{x:105,z:88},
 monsterSkelMage:{x:40,z:90},
 monsterSkelLongStaff:{x:43,z:9},
};
export function stableRegionalCombat(html,...types){
 const select=' const spawn=poiWildRegionalPick(home,p,rng,traversable,(x,z)=>';
 const wander=' if(state.wildSpawn&&(dist>6.5||state.regionalWild&&!poiArmedBound(obj,poiWalkX,poiWalkZ))){';
 const fallback=" if(obj.type==='monsterPondSkater'&&typeof poiPondSkaterGuard==='function'){";
 for(const t of [select,wander,fallback])assert.equal(html.split(t).length,2,t);
 const allowed=Object.fromEntries(types.map(t=>[t,points[t]]));
 for(const t of types)assert(allowed[t]);
 const isFixed='state.regionalWild&&Object.hasOwn('+JSON.stringify(allowed)+',obj.type)';
 return html.replace(select,select+String.fromCharCode(10)+'  (!Object.hasOwn('+JSON.stringify(allowed)+',home.type)||'+JSON.stringify(allowed)+'[home.type].x===x&&'+JSON.stringify(allowed)+'[home.type].z===z)&&')
  .replace(wander,' if(!('+isFixed+')&&state.wildSpawn&&(dist>6.5||state.regionalWild&&!poiArmedBound(obj,poiWalkX,poiWalkZ))){')
  .replace(fallback,' if('+isFixed+')continue;'+String.fromCharCode(10)+fallback);
}
