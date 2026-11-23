const {test}=require('node:test'),a=require('node:assert/strict'),fixture=require('./orchestral-legacy-fixture.cjs');
test('town, actual field/named exterior and custom maps have the intended scores',()=>{
 const f=fixture();a.equal(f.tick(10,10).active,'town');const t=f.deck('town');
 a.equal(f.tick(10.3,112).active,'outside');const field=f.deck('outside');
 a.notEqual(t.score.duration,field.score.duration);
 a.equal(f.tick(10.6,67).active,'outside','scout camp is outside despite its district name');
 a.equal(f.tick(10.7,10).active,'town');a.equal(f.deck('town'),t,'quick return reuses existing musical clock');
 a.equal(f.tick(11.8,10).decks.length,1,'old field deck releases');
 a.equal(fixture('lodging').tick(10,112).active,'indoor');
});
