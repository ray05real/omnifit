// How the owner's Renpho scale (ES-28ML, built on the ES-30M hardware: the "QN" family) talks over Bluetooth.
// Renpho doesn't publish this; the message layout comes from the open-source openScale project's notes on
// the QN / ES-30M scales (github.com/oliexdev/openScale). Only the weight is read here.
//
// The conversation, in short: the scale says what it is (0x12), the app answers with the unit and the time
// (0x13), the scale asks for a couple of acknowledgements (0x14, 0x21), then sends the weight (0x10) several
// times a second until it is stable. Nothing here touches Bluetooth itself, so it can be tested on the PC.

// The scale counts seconds from the year 2000.
const SCALE_EPOCH_OFFSET = 946_702_800;
const MAX_STORED_QUERIES = 10;
const STALE_SECONDS = 90;

export type QnWrite = { to: 'command' | 'time'; bytes: number[] };

export type QnResult = {
  writes: QnWrite[];
  live?: number; // kg on the display right now (still moving)
  final?: number; // kg, settled: this is the weigh-in
  retryStoredIn?: number; // ask for the stored reading again after this many ms
  note: string; // for the report the owner can send when something doesn't work
};

export function hex(bytes: number[]): string {
  return bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
}

// The last byte of every message is the sum of the others.
export function withChecksum(bytes: number[]): number[] {
  const out = bytes.slice();
  let s = 0;
  for (let i = 0; i < out.length - 1; i++) s = (s + (out[i] & 0xff)) & 0xff;
  out[out.length - 1] = s;
  return out;
}

const u16be = (a: number, b: number) => ((a & 0xff) << 8) | (b & 0xff);
const u32le = (a: number, b: number, c: number, d: number) =>
  ((a & 0xff) | ((b & 0xff) << 8) | ((c & 0xff) << 16)) + (d & 0xff) * 16777216;
const le32 = (t: number) => [t & 0xff, (t >>> 8) & 0xff, (t >>> 16) & 0xff, (t >>> 24) & 0xff];

function plausible(kg: number): boolean {
  return kg > 5 && kg < 300;
}

// The scale's readings are to 0.05 kg; the app keeps tenths, like the wheel.
export function roundKg(kg: number): number {
  return Math.round(kg * 10) / 10;
}

export function createQnSession(opts: { renpho: boolean; nowSec: () => number }) {
  let factor = 100; // raw weight ÷ this = kg (the 0x12 message says whether it is 100 or 10)
  let proto = 0; // the scale's "type" byte, echoed back in every answer
  let configured = false;
  let done = false;
  let storedQueries = 0;
  const startedScaleSec = opts.nowSec() - SCALE_EPOCH_OFFSET;

  const isVa = () => opts.renpho && proto === 0xff; // the newer Renpho firmware ("VA")

  function storedQuery(): QnWrite[] {
    if (done || storedQueries >= MAX_STORED_QUERIES) return [];
    storedQueries++;
    return [{ to: 'command', bytes: withChecksum([0x22, 0x06, proto, 0x00, 0x03, 0x00]) }];
  }

  function finish(kg: number, note: string, writes: QnWrite[] = []): QnResult {
    done = true;
    return { writes, final: roundKg(kg), note };
  }

  return {
    get done() {
      return done;
    },

    // Ask again for the reading the scale stored (when the first answer was empty).
    retryStored(): QnResult {
      const writes = storedQuery();
      return { writes, note: writes.length ? 'asked again for the stored reading' : 'gave up asking for the stored reading' };
    },

    onFrame(data: number[]): QnResult {
      if (data.length < 3) return { writes: [], note: 'too short' };
      if (proto === 0) proto = data[2] & 0xff;
      const op = data[0] & 0xff;

      // The scale introduces itself: how its weight is scaled. Answer with kg and the time.
      if (op === 0x12) {
        if (data.length <= 10) return { writes: [], note: '0x12 too short' };
        factor = data[10] === 1 ? 100 : 10;
        if (configured) return { writes: [], note: `scale info again (÷${factor})` };
        configured = true;
        const t = opts.nowSec() - SCALE_EPOCH_OFFSET;
        return {
          writes: [
            { to: 'command', bytes: withChecksum([0x13, 0x09, proto, 0x01, 0x10, 0x00, 0x00, 0x00, 0x00]) },
            { to: 'time', bytes: [0x02, ...le32(t)] },
          ],
          note: `scale info: weight ÷${factor}, type 0x${proto.toString(16)}; sent kg + time`,
        };
      }

      // It took the unit: send the time in its own message.
      if (op === 0x14) {
        const t = opts.nowSec() - SCALE_EPOCH_OFFSET;
        return { writes: [{ to: 'command', bytes: withChecksum([0x20, 0x08, proto, ...le32(t), 0x00]) }], note: 'sent time sync' };
      }

      // It wants to know who is on it. Only the weight matters here, so a neutral guest is sent.
      if (op === 0x21) {
        if (isVa()) {
          // Guest mode (doesn't touch the people saved by Renpho's own app): male, 25, 175 cm.
          const heightMm = 1750;
          const profile = withChecksum([0xa0, 0x0d, 0x02, 0xfe, 0xff, 0xee, 0x00, 25, heightMm >> 8, heightMm & 0xff, 0x04, 0x02, 0x00]);
          return { writes: [{ to: 'command', bytes: profile }, ...storedQuery()], note: 'sent guest profile' };
        }
        // The ES-30M wants exactly these two answers before it will send a weight.
        return {
          writes: [
            { to: 'command', bytes: withChecksum([0xa0, 0x0d, 0x04, 0xfe, 0, 0, 0, 0, 0, 0, 0, 0, 0x00]) },
            { to: 'command', bytes: withChecksum([0xa0, 0x0d, 0x02, 0x01, 0x00, 0x08, 0x00, 0x21, 0x06, 0xb8, 0x04, 0x02, 0x00]) },
            ...storedQuery(),
          ],
          note: 'sent the two acknowledgements',
        };
      }

      // The weight, several times a second, with a flag that says when it has settled.
      if (op === 0x10) {
        if (data.length < 10) return { writes: [], note: 'weight too short' };
        const es30m = (data[4] & 0xff) <= 0x02 && factor === 10; // newer layout: flag first, then the weight
        let stable: boolean;
        let raw: number;
        if (es30m) {
          if (data.length < 11) return { writes: [], note: 'weight too short' };
          const flag = data[4] & 0xff;
          stable = proto === 0xff ? flag === 0x02 : flag === 0x02 || flag === 0x01;
          raw = u16be(data[5], data[6]);
        } else {
          stable = data[5] === 1;
          raw = u16be(data[3], data[4]);
        }
        let kg = raw / factor;
        if (kg <= 5 || kg >= 250) kg = kg / 10; // some scales use ÷10 before saying so
        if (!stable) return { writes: [], live: plausible(kg) ? roundKg(kg) : undefined, note: `moving ${kg.toFixed(2)}` };

        // The newer firmware expects a "got it" for the settled reading.
        const ack: QnWrite[] = proto === 0xff ? [{ to: 'command', bytes: withChecksum([0x1f, 0x05, proto, 0x10, 0x00]) }] : [];
        if (done) return { writes: ack, note: 'settled (already saved)' };
        if (!plausible(kg)) return { writes: ack, note: `settled but not believable: ${kg.toFixed(2)}` };
        return finish(kg, `settled ${kg.toFixed(2)} kg (${es30m ? 'ES-30M' : 'classic'} layout)`, ack);
      }

      // A reading the scale stored (someone stepped on before the app connected).
      if (op === 0x23) {
        if (done) return { writes: [], note: 'stored reading ignored (already saved)' };
        if (data.length < 17) return { writes: [], retryStoredIn: 5000, note: 'stored reading too short' };
        if (isVa() && (data.length < 19 || data[3] === 0)) return { writes: [], retryStoredIn: 5000, note: 'stored slot empty' };
        const kg = u16be(data[10], data[11]) / 100;
        const at = u32le(data[6], data[7], data[8], data[9]);
        if (!plausible(kg)) return { writes: [], retryStoredIn: 5000, note: `stored reading not believable: ${kg}` };
        // An old reading from another day must not be saved as today's.
        if (at + STALE_SECONDS < startedScaleSec) return { writes: [], retryStoredIn: 5000, note: 'stored reading is old' };
        return finish(kg, `stored reading ${kg.toFixed(2)} kg`);
      }

      if (op === 0xa1 || op === 0xa3) return { writes: [], note: 'scale acknowledged' };
      return { writes: [], note: `unknown message 0x${op.toString(16)}` };
    },
  };
}

// Some QN scales don't need a connection at all: they shout the weight in their Bluetooth advert
// ("AABB" adverts). `data` is the manufacturer data after the two company-id bytes.
export function parseBroadcast(data: number[]): { kg: number; stable: boolean } | null {
  if (data.length < 19 || (data[0] & 0xff) !== 0xaa || (data[1] & 0xff) !== 0xbb) return null;
  const kg = ((data[17] & 0xff) | ((data[18] & 0xff) << 8)) / 100;
  if (kg < 0.5 || kg > 300) return null;
  return { kg: roundKg(kg), stable: (data[15] & 0x20) !== 0 };
}

// Is this Bluetooth device the scale? (By its name, or by the services only this family has.)
export function looksLikeScale(name: string | null | undefined, serviceUuids: string[] | null | undefined): boolean {
  const n = (name ?? '').toLowerCase();
  const short = (serviceUuids ?? []).map((u) => {
    const s = u.toLowerCase();
    return s.length > 8 ? s.slice(4, 8) : s.padStart(4, '0');
  });
  const named = ['qn-scale', 'renpho', 'seb-scale', 'es-28', 'es-30', 'es-26'].some((k) => n.includes(k)) || n === 'fit plus';
  return named || short.includes('ffe0') || short.includes('ae00');
}

// ───────── base64, which is how the Bluetooth library hands bytes over ─────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function fromBase64(s: string): number[] {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return out;
}

export function toBase64(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] & 0xff;
    const b = i + 1 < bytes.length ? bytes[i + 1] & 0xff : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] & 0xff : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[c & 63] : '=';
  }
  return out;
}
