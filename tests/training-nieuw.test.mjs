// [20261127t] Oude trainingen tellen niet als "nieuw" (badge bij Trainingen).
import assert from 'node:assert/strict';
import { trainingNieuw, trainingWeekSleutel } from '../public/js/training-nieuw.js';

const nu = new Date('2026-11-27T12:00');   // vrijdag, week 48
const sec = d => ({ seconds: new Date(d + 'T12:00').getTime() / 1000 });

// oude week: niet nieuw, ook als nooit geopend
assert.equal(trainingNieuw({ id: 'a', week: 'Week 36 - training 1', gemaakt: sec('2026-08-20') }, {}, nu), false);
// deze week en volgende week: wel nieuw
assert.equal(trainingNieuw({ id: 'b', week: 'Week 48 - training 1', gemaakt: sec('2026-08-20') }, {}, nu), true);
assert.equal(trainingNieuw({ id: 'c', weekStart: '2026-11-30' }, {}, nu), true);
// geopend: nooit nieuw
assert.equal(trainingNieuw({ id: 'c', weekStart: '2026-11-30' }, { c: true }, nu), false);
// vaste datum gaat voor
assert.equal(trainingNieuw({ id: 'd', datum: '2026-11-16', week: 'Week 49' }, {}, nu), false);
// geen week: alleen recent geüpload telt
assert.equal(trainingNieuw({ id: 'e', titel: 'los', gemaakt: sec('2026-11-20') }, {}, nu), true);
assert.equal(trainingNieuw({ id: 'f', titel: 'los', gemaakt: sec('2026-09-01') }, {}, nu), false);
// jaarwisseling: week 1 die in december is gemaakt hoort bij volgend jaar
assert.equal(trainingWeekSleutel({ week: 'Week 1', gemaakt: sec('2026-12-20') }), '2027-01');
assert.equal(trainingNieuw({ id: 'g', week: 'Week 1', gemaakt: sec('2026-12-20') }, {}, new Date('2026-12-28T12:00')), true);
// seizoenJaar wint
assert.equal(trainingWeekSleutel({ week: '35', seizoenJaar: 2026 }), '2026-35');
console.log('training-nieuw: ok');
