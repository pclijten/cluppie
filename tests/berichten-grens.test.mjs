/* [20261127z] Grens voor de berichten-listener: begin van het vorige seizoen (1 juli, NL-tijd). */
import assert from 'node:assert/strict';
const { berichtenGrensMs } = await import('../public/js/berichten.js');
const iso = ms => new Date(ms).toISOString();
assert.equal(iso(berichtenGrensMs(Date.UTC(2026, 10, 27))), '2025-06-30T22:00:00.000Z', 'november 2026: vanaf seizoen 2025/26');
assert.equal(iso(berichtenGrensMs(Date.UTC(2027, 2, 1))), '2025-06-30T22:00:00.000Z', 'maart 2027: nog steeds seizoen 2026/27, dus vanaf 2025/26');
assert.equal(iso(berichtenGrensMs(Date.UTC(2027, 6, 2))), '2026-06-30T22:00:00.000Z', 'juli 2027: nieuw seizoen, vanaf 2026/27');
assert.ok(berichtenGrensMs() < Date.now() - 365 * 864e5 * 0.99, 'altijd minstens een jaar terug');
console.log('berichten-grens: in orde');
