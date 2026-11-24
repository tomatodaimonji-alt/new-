const {test}=require('node:test'),a=require('node:assert/strict'),fixture=require('./orchestral-legacy-fixture.cjs');
test('town, actual field/named exterior and custom maps have the intended scores',()=>{
 const f=fixture();a.equal(f.tick(10,10).active,'town');const t=f.deck('town');
 a.equal(f.tick(10.3,112).active,'town');a.equal(f.deck('outside'),undefined);
 a.equal(f.tick(10.6,67).active,'town','no cue starts mid-fade');
 a.equal(f.tick(10.7,10).active,'town');a.equal(f.deck('town'),t,'quick return reuses existing musical clock');
 a.equal(f.tick(11.8,67).active,'town');
 a.equal(f.tick(12.54,67).active,'outside','scout camp is outside despite its district name');
 const field=f.deck('outside');a.notEqual(t.score.duration,field.score.duration);
 a.equal(f.deck('town'),undefined);a.equal(f.tick(12.6).decks.length,1);
 a.equal(fixture('lodging').tick(10,112).active,'indoor');
});

