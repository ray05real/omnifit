// Run with: npm.cmd test
// The sample messages are the ones in openScale's own tests for the QN / ES-30M scales.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createQnSession, fromBase64, hex, looksLikeScale, parseBroadcast, toBase64, withChecksum } from './qnScale.ts';

const NOW = 1_794_600_000; // a moment in November 2026
const session = (renpho = false) => createQnSession({ renpho, nowSec: () => NOW });
const info = (proto: number, flag: number) => [0x12, 0x0f, proto, 0, 0, 0, 0, 0, 0, 0, flag, 0, 0, 0, 0];

test('scale: every message ends with the sum of its bytes', () => {
  assert.equal(hex(withChecksum([0xa0, 0x0d, 0x02, 0x01, 0x00, 0x08, 0x00, 0x21, 0x06, 0xb8, 0x04, 0x02, 0x00])), 'a00d02010008002106b804029d');
  assert.equal(hex(withChecksum([0xa0, 0x0d, 0x04, 0xfe, 0, 0, 0, 0, 0, 0, 0, 0, 0])), 'a00d04fe0000000000000000af');
});

test('scale: the ES-30M conversation ends in a weight', () => {
  const s = session();
  // It introduces itself (weight ÷10): the app answers with kg and the time.
  const hello = s.onFrame(info(0x07, 0));
  assert.equal(hello.writes.length, 2);
  assert.equal(hex(hello.writes[0].bytes), '130907011000000034');
  assert.equal(hello.writes[1].to, 'time');
  assert.equal(hello.writes[1].bytes[0], 0x02);
  // 0x14: time sync. 0x21: the two acknowledgements, then "anything stored?".
  assert.equal(s.onFrame([0x14, 0x05, 0x07, 0, 0]).writes[0].bytes[0], 0x20);
  const ack = s.onFrame([0x21, 0x05, 0x07, 0, 0]);
  assert.deepEqual(ack.writes.map((w) => hex(w.bytes)), ['a00d04fe0000000000000000af', 'a00d02010008002106b804029d', '2206070003' + '32']);
  // Still moving: shown live, not saved.
  const moving = s.onFrame(withChecksum([0x10, 0x0e, 0x07, 0xfe, 0x00, 0x21, 0x10, 0, 0, 0, 0, 0, 0, 0]));
  assert.equal(moving.final, undefined);
  assert.equal(moving.live, 84.6); // raw 8464
  // Settled (openScale's own sample: raw 0x2157 = 85.35 kg).
  const settled = s.onFrame(withChecksum([0x10, 0x0e, 0x07, 0xfe, 0x01, 0x21, 0x57, 0, 0, 0, 0, 0, 0, 0]));
  assert.equal(settled.final, 85.4);
  assert.equal(s.done, true);
  // A second settled message doesn't save twice.
  assert.equal(s.onFrame(withChecksum([0x10, 0x0e, 0x07, 0xfe, 0x01, 0x21, 0x57, 0, 0, 0, 0, 0, 0, 0])).final, undefined);
});

test('scale: the classic layout, and a weight whose low byte looks like a flag', () => {
  const s = session();
  s.onFrame(info(0x07, 1)); // weight ÷100
  const r = s.onFrame([0x10, 0x0a, 0x07, 0x1c, 0x00, 0x01, 0x01, 0xf4, 0x01, 0xf4]);
  assert.equal(r.final, 71.7); // 71.68
  assert.equal(r.writes.length, 0);
});

test('scale: the newer firmware (type 0xFF) gets a "got it", and only state 2 counts as settled', () => {
  const s = session();
  const r = s.onFrame([0x10, 0x0a, 0xff, 7000 >> 8, 7000 & 0xff, 0x01, 0x01, 0xf4, 0x01, 0xf4]);
  assert.equal(r.final, 70);
  assert.equal(hex(r.writes[0].bytes), '1f05ff1033');

  const va = session(true);
  va.onFrame(info(0xff, 0));
  assert.equal(va.onFrame(withChecksum([0x10, 0x0e, 0xff, 0x01, 0x01, 0x1f, 0x72, 0, 0, 0, 0, 0, 0, 0])).final, undefined);
  assert.equal(va.onFrame(withChecksum([0x10, 0x0e, 0xff, 0x01, 0x02, 0x1f, 0x72, 0, 0, 0, 0, 0, 0, 0])).final, 80.5);
  // The Renpho "VA" firmware is sent a guest profile, which leaves the Renpho app's users alone.
  const guest = session(true);
  guest.onFrame(info(0xff, 0));
  assert.equal(hex(guest.onFrame([0x21, 0x05, 0xff, 0, 0]).writes[0].bytes).slice(0, 12), 'a00d02feffee');
});

test('scale: a stored reading is used only if it is from just now', () => {
  const scaleNow = NOW - 946_702_800;
  const stored = (at: number, raw: number) => [0x23, 0x13, 0x07, 1, 0, 0, at & 0xff, (at >>> 8) & 0xff, (at >>> 16) & 0xff, (at >>> 24) & 0xff, raw >> 8, raw & 0xff, 0, 0, 0, 0, 0, 0, 0];
  assert.equal(session().onFrame(stored(scaleNow - 10, 8050)).final, 80.5);
  const old = session().onFrame(stored(scaleNow - 86_400, 8050));
  assert.equal(old.final, undefined);
  assert.equal(old.retryStoredIn, 5000);
  assert.equal(session().onFrame(stored(scaleNow, 120)).final, undefined); // 1.2 kg: not a person
});

test('scale: adverts, names and base64', () => {
  const adv = new Array(22).fill(0);
  adv[0] = 0xaa;
  adv[1] = 0xbb;
  adv[15] = 0x20;
  adv[17] = 8050 & 0xff;
  adv[18] = 8050 >> 8;
  assert.deepEqual(parseBroadcast(adv), { kg: 80.5, stable: true });
  assert.equal(parseBroadcast([1, 2, 3]), null);
  assert.equal(looksLikeScale('QN-Scale', []), true);
  assert.equal(looksLikeScale('Renpho-Scale', null), true);
  assert.equal(looksLikeScale(null, ['0000ffe0-0000-1000-8000-00805f9b34fb']), true);
  assert.equal(looksLikeScale('AirPods', ['0000fff0-0000-1000-8000-00805f9b34fb']), false);
  assert.deepEqual(fromBase64(toBase64([0x13, 0x09, 0xff, 0x01, 0x10])), [0x13, 0x09, 0xff, 0x01, 0x10]);
  assert.equal(toBase64([0x10, 0x0e]), 'EA4=');
  assert.deepEqual(fromBase64('EA4='), [0x10, 0x0e]);
});
