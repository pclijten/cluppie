// Wie heeft een video bekeken (public/js/video-uitgelicht.js): telling per video en het overzicht per team.
import assert from 'node:assert/strict';
const m = await import("../public/js/video-uitgelicht.js");
const b = m.bekekenPerVideo([{uid:'u1',videos:{v1:{n:2,laatst:5},v2:{n:1,laatst:9}}},{uid:'u3',videos:{v1:{n:1,laatst:7}}},{uid:'u9',videos:{v1:{n:4,laatst:1}}},{videos:{v1:{n:1}}},{uid:'u2',videos:{v1:{n:0}}}]);
assert.deepEqual(Object.keys(b.v1).sort(),['u1','u3','u9']);
const teams=[{id:'t1',naam:'JO8-1',leden:{u1:true,u2:true,ux:false},ledenInfo:{u1:{naam:'Anna'},u2:{naam:'Bas'}}},{id:'t2',naam:'JO9-1',leden:{u1:true,u3:true},ledenInfo:{u3:{naam:'Cor'}}}];
const o = m.bekekenOverzicht({id:'v1',teams:['t1','t2','weg']},teams,b,{u9:'Paul',u1:'Anna'});
assert.equal(o.totaal,3); assert.equal(o.gezien,2); assert.equal(o.keer,7);
assert.deepEqual(o.perTeam[0].trainers.map(t=>[t.naam,t.n]),[['Anna',2],['Bas',0]]);
assert.equal(o.perTeam[1].trainers.find(t=>t.uid==='u1').naam,'Anna');
assert.deepEqual(o.anderen.map(a=>a.naam),['Paul']);
const leeg = m.bekekenOverzicht({id:'x',teams:['t1']},teams,null);
assert.equal(leeg.keer,0); assert.equal(leeg.totaal,2);
console.log('bekeken: in orde');
