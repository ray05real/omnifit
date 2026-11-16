// The phone-side label reader (see ios/LabelReaderModule.swift). Missing in the PC's web preview and in Expo Go.

import { requireOptionalNativeModule } from 'expo';

export type ScannedLine = { text: string; x: number; y: number; w: number; h: number };
export type ScanResult = { lines: ScannedLine[]; barcodes: string[] };

const native = requireOptionalNativeModule<{
  scan(uri: string, maxSide: number, deleteAfter: boolean): Promise<ScanResult>;
}>('LabelReader');

export const labelReaderAvailable = native != null;

// maxSide: shrink the photo first (0 = full size). deleteAfter: remove the photo once it's read.
export function scanPhoto(uri: string, opts: { maxSide?: number; deleteAfter?: boolean } = {}): Promise<ScanResult> {
  if (!native) return Promise.reject(new Error('The label reader is not part of this build.'));
  return native.scan(uri, Math.round(opts.maxSide ?? 0), !!opts.deleteAfter);
}
