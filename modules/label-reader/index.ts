// The phone-side label reader (see ios/LabelReaderModule.swift). Missing in the PC's web preview and in Expo Go.

import { requireOptionalNativeModule } from 'expo';

export type ScannedLine = { text: string; x: number; y: number; w: number; h: number };
export type ScanResult = { lines: ScannedLine[]; barcodes: string[] };

const native = requireOptionalNativeModule<{ scan(uri: string): Promise<ScanResult> }>('LabelReader');

export const labelReaderAvailable = native != null;

export function scanPhoto(uri: string): Promise<ScanResult> {
  if (!native) return Promise.reject(new Error('The label reader is not part of this build.'));
  return native.scan(uri);
}
