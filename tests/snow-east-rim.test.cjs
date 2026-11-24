'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const h=fs.readFileSync(process.env.WORKSHOP_HTML||'world-editor.html','utf8');
const get=name=>{
 const key='function '+name+'(',from=h.indexOf(key);
 assert(from>0,name);
 return h.slice(from,h.indexOf('\n}',from)+2);
};
test('the continuous east-flank ownership retains the approach and every actual enclosed tile',()=>{
 const rim=h.includes('function poiSnowTempleRim(')?'poiSnowTempleRim':'poiSnowExteriorBaseRim';
 const site={id:'base',davidTemple:{interior:true,enclosure:new Set(['40,151','24,128','24,158'])}};
 const load=new Function('facilitySite',get('poiOverlandScope')+get('poiSquareFieldSite')+get('poiSquareFieldNear')+get('poiDavidTempleEnclosedAt')+get(rim)+
  ';return [poiOverlandScope,'+rim+'];');
 const [scope,visible]=load(site);
 assert(visible(41.70,153)&&scope('base',41.70,153));
 assert(visible(38.5,140)&&scope('base',38.5,140));
 assert(visible(47,167)&&scope('base',47,167));
 assert(!visible(40,151),'actual enclosed tile is never switched to exterior owned');
 assert(!visible(24,128)&&!visible(24,158),'main approach and authentic room remain original');
 assert(!visible(38.49,153)&&!visible(41.7,171)&&!visible(41.7,139.99),'bounded to related exterior');
 assert(scope('snowpass',0,14)&&scope('base',47,153));
});
