// Weighing with the owner's Bluetooth scale (Renpho ES-28ML). Only in the "with scale" version of the app
// (variant.json); the standard version never loads the Bluetooth library.
//
// What happens: look for the scale → connect → have the conversation in src/lib/qnScale.ts → the settled
// weight. Everything that is seen and said is kept as a report, because this can only be tried on the
// owner's phone with the owner's scale: when it doesn't work, the report says where it stopped.

import { Platform } from 'react-native';
import type { BleManager, Characteristic, Device, Subscription } from 'react-native-ble-plx';

import { createQnSession, fromBase64, hex, looksLikeScale, parseBroadcast, toBase64, type QnWrite } from '../lib/qnScale';

export type ScaleStatus =
  | 'starting'
  | 'unavailable' // this build or device has no Bluetooth for the app
  | 'bluetooth-off'
  | 'not-allowed' // Bluetooth permission refused
  | 'looking' // waiting for the scale to show up: step on it
  | 'connecting'
  | 'weighing'
  | 'done'
  | 'failed';

export type ScaleEvents = {
  onStatus: (s: ScaleStatus, detail?: string) => void;
  onLive: (kg: number) => void;
  onDone: (kg: number) => void;
  onLog: (line: string) => void;
};

const LOOK_FOR_MS = 120_000;
let manager: BleManager | null = null;

// '0000ffe1-0000-1000-8000-00805f9b34fb' → 'ffe1'
const short = (uuid: string) => (uuid.length > 8 ? uuid.toLowerCase().slice(4, 8) : uuid.toLowerCase());

// Starts a weigh-in; call the returned function to stop (closing the sheet).
export function startWeighing(ev: ScaleEvents): () => void {
  const t0 = Date.now();
  const log = (s: string) => ev.onLog(`${((Date.now() - t0) / 1000).toFixed(1)}s  ${s}`);
  let stopped = false;
  let finished = false;
  let connecting = false;
  let device: Device | null = null;
  const subs: Subscription[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const seen = new Set<string>();

  const cleanup = () => {
    timers.forEach(clearTimeout);
    subs.forEach((s) => {
      try {
        s.remove();
      } catch {}
    });
    try {
      manager?.stopDeviceScan();
    } catch {}
    if (device) manager?.cancelDeviceConnection(device.id).catch(() => {});
    device = null;
  };
  const stop = () => {
    stopped = true;
    cleanup();
  };
  const finish = (kg: number) => {
    if (finished || stopped) return;
    finished = true;
    log(`DONE ${kg} kg`);
    ev.onStatus('done');
    ev.onDone(kg);
    timers.push(setTimeout(cleanup, 800)); // let the last "got it" reach the scale first
  };
  const fail = (why: string) => {
    if (finished || stopped) return;
    log('FAILED ' + why);
    ev.onStatus('failed', why);
    cleanup();
  };

  if (Platform.OS === 'web') {
    ev.onStatus('unavailable');
    return stop;
  }
  try {
    if (!manager) {
      // Loaded only here, so the standard version of the app never touches Bluetooth.
      const { BleManager: Manager } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
      manager = new Manager();
    }
  } catch (e) {
    log('no bluetooth library: ' + String(e));
    ev.onStatus('unavailable');
    return stop;
  }
  const ble = manager;

  const scan = () => {
    if (stopped || finished) return;
    connecting = false;
    ev.onStatus('looking');
    ble.startDeviceScan(null, { allowDuplicates: true }, (error, d) => {
      if (stopped || finished) return;
      if (error) return fail(error.message);
      if (!d) return;
      const name = d.name ?? d.localName ?? '';
      const mfr = d.manufacturerData ? fromBase64(d.manufacturerData) : [];
      // Some scales of this family shout the weight in their advert: no connection needed.
      const advert = parseBroadcast(mfr.slice(2)) ?? parseBroadcast(mfr);
      const match = looksLikeScale(name, d.serviceUUIDs);
      if (!seen.has(d.id) && (name || advert || match) && seen.size < 60) {
        seen.add(d.id);
        log(`saw "${name}" signal ${d.rssi} services [${(d.serviceUUIDs ?? []).map(short).join(',')}] data ${hex(mfr).slice(0, 64)}${match ? '  <- scale?' : ''}`);
      }
      if (advert) {
        ev.onStatus('weighing');
        if (advert.stable) finish(advert.kg);
        else ev.onLive(advert.kg);
        return;
      }
      if (match && !connecting) {
        connecting = true;
        ble.stopDeviceScan();
        connect(d, name).catch((e) => {
          log('connect failed: ' + String(e?.message ?? e));
          device = null;
          timers.push(setTimeout(scan, 500));
        });
      }
    });
  };

  const connect = async (d: Device, name: string) => {
    ev.onStatus('connecting');
    log(`connecting to "${name}"`);
    const dev = await ble.connectToDevice(d.id, { timeout: 15000 });
    device = dev;
    await dev.discoverAllServicesAndCharacteristics();
    const chars = new Map<string, Characteristic>();
    for (const s of await dev.services()) {
      for (const c of await s.characteristics()) if (!chars.has(short(c.uuid))) chars.set(short(c.uuid), c);
    }
    log('connected; channels ' + [...chars.keys()].join(','));
    if (stopped || finished) return;

    const session = createQnSession({ renpho: name.toLowerCase() === 'renpho-scale', nowSec: () => Math.floor(Date.now() / 1000) });

    // Messages are sent one after another, in order.
    let queue: Promise<unknown> = Promise.resolve();
    const send = (writes: QnWrite[]) => {
      for (const w of writes) {
        const c = w.to === 'time' ? (chars.get('ffe4') ?? chars.get('fff2')) : (chars.get('fff2') ?? chars.get('ffe3'));
        if (!c) {
          log(`> ${hex(w.bytes)}  (nowhere to send it)`);
          continue;
        }
        queue = queue
          .then(() => (c.isWritableWithResponse ? c.writeWithResponse(toBase64(w.bytes)) : c.writeWithoutResponse(toBase64(w.bytes))))
          .then(() => log(`> ${hex(w.bytes)}  (${short(c.uuid)})`))
          .catch((e) => log(`> ${hex(w.bytes)}  FAILED ${String(e?.message ?? e)}`));
      }
    };

    const onFrame = (from: string, data: number[]) => {
      if (stopped) return;
      const r = session.onFrame(data);
      log(`< ${hex(data)}  (${from}) ${r.note}`);
      send(r.writes);
      if (r.live !== undefined) {
        ev.onStatus('weighing');
        ev.onLive(r.live);
      }
      if (r.final !== undefined) finish(r.final);
      if (r.retryStoredIn) {
        timers.push(
          setTimeout(() => {
            if (stopped || finished) return;
            const again = session.retryStored();
            log(again.note);
            send(again.writes);
          }, r.retryStoredIn),
        );
      }
    };

    let listening = 0;
    for (const id of ['ffe1', 'ffe2', 'fff1']) {
      const c = chars.get(id);
      if (!c) continue;
      listening++;
      subs.push(
        c.monitor((err, ch) => {
          if (err) {
            if (!stopped && !finished) log(`listening on ${id} stopped: ${err.message}`);
            return;
          }
          if (ch?.value) onFrame(id, fromBase64(ch.value));
        }),
      );
    }
    if (listening === 0) log('this device has none of the channels the scale family uses');

    subs.push(
      ble.onDeviceDisconnected(dev.id, () => {
        if (stopped || finished) return;
        log('the scale disconnected; looking again');
        device = null;
        timers.push(setTimeout(scan, 500));
      }),
    );
  };

  ev.onStatus('starting');
  subs.push(
    ble.onStateChange((state) => {
      if (stopped || finished) return;
      log('bluetooth: ' + state);
      if (state === 'PoweredOn') scan();
      else if (state === 'PoweredOff') ev.onStatus('bluetooth-off');
      else if (state === 'Unauthorized') ev.onStatus('not-allowed');
      else if (state === 'Unsupported') ev.onStatus('unavailable');
    }, true),
  );
  timers.push(setTimeout(() => fail('No weight after two minutes.'), LOOK_FOR_MS));

  return stop;
}
