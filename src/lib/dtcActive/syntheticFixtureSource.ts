import { createHash } from "node:crypto";
import { syntheticPhaseBConstants } from "@/lib/dtcActive/fixtures";

export const syntheticFixtureLayout = {
  size: 4096,
  crcOffset: 4092,
  dtcOffset: 0x200,
  linkOffset: 0x300,
  dtcRecordSize: 16,
  linkRecordSize: 8,
  magic: "MGDTCFX1",
} as const;

const syntheticRecords = [
  { code: "P0100", encoded: 0x0100, eventId: 1001 },
  { code: "P0200", encoded: 0x0200, eventId: 1002 },
  { code: "P0300", encoded: 0x0300, eventId: 1003 },
  { code: "P0400", encoded: 0x0400, eventId: 1004 },
] as const;

const syntheticIdentityFields = [
  "MG AutoTech",
  "SYNTHETIC_DTC_FIXTURE",
  "MG_DTC_FIXTURE_V1",
  "MG-SYN-HW-0001",
  "MG-SYN-SW-0001",
  "MG-SYN-CAL-0001",
] as const;

export function sha256Hex(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function getApprovedSyntheticSourceBytes() {
  const bytes = createSyntheticSourceBytes();
  const digest = sha256Hex(bytes);
  if (digest !== syntheticPhaseBConstants.sourceSha256) {
    throw new Error("Approved synthetic fixture digest mismatch.");
  }
  return Buffer.from(bytes);
}

export function makeArtifactId(role: string, attemptId: string, sha256: string) {
  return `dtc-phase-c/${attemptId}/${role}/${sha256.slice(0, 16)}`;
}

export function applySyntheticCrc32(preIntegrity: Uint8Array) {
  if (preIntegrity.length !== syntheticFixtureLayout.size) {
    throw new Error("Synthetic CRC adapter rejected unexpected byte size.");
  }
  const final = Buffer.from(preIntegrity);
  putSyntheticCrc(final);
  return final;
}

export function syntheticCrcValid(bytes: Uint8Array) {
  if (bytes.length !== syntheticFixtureLayout.size) return false;
  const stored = readUInt32Le(bytes, syntheticFixtureLayout.crcOffset);
  return stored === crc32(bytes.subarray(0, syntheticFixtureLayout.crcOffset));
}

function createSyntheticSourceBytes() {
  const bytes = Buffer.alloc(syntheticFixtureLayout.size);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index * 73 + 19) & 0xff;
  }

  Buffer.from(syntheticFixtureLayout.magic, "ascii").copy(bytes, 0);
  writeUInt16Le(bytes, 8, 1);
  bytes[10] = 1;
  bytes[11] = 0;
  writeUInt32Le(bytes, 12, syntheticFixtureLayout.size);
  writeUInt32Le(bytes, 16, syntheticFixtureLayout.dtcOffset);
  writeUInt32Le(bytes, 20, syntheticFixtureLayout.linkOffset);
  writeUInt16Le(bytes, 24, syntheticRecords.length);
  writeUInt16Le(bytes, 26, syntheticFixtureLayout.dtcRecordSize);
  writeUInt16Le(bytes, 28, syntheticFixtureLayout.linkRecordSize);

  syntheticIdentityFields.forEach((field, index) => {
    fixedAscii(field, 0x20).copy(bytes, 0x20 + index * 0x20);
  });

  syntheticRecords.forEach((record, index) => {
    const dtcOffset = syntheticFixtureLayout.dtcOffset + index * syntheticFixtureLayout.dtcRecordSize;
    writeUInt16Le(bytes, dtcOffset, record.encoded);
    writeUInt16Le(bytes, dtcOffset + 2, record.eventId);
    bytes[dtcOffset + 4] = 1;
    bytes[dtcOffset + 5] = 2;
    bytes[dtcOffset + 6] = 1;
    bytes[dtcOffset + 7] = 0;
    writeUInt32Le(bytes, dtcOffset + 8, 0);
    Buffer.from([0xa5, 0xa5, 0xa5, 0xa5]).copy(bytes, dtcOffset + 12);

    const linkOffset = syntheticFixtureLayout.linkOffset + index * syntheticFixtureLayout.linkRecordSize;
    writeUInt16Le(bytes, linkOffset, record.eventId);
    bytes[linkOffset + 2] = 1;
    bytes[linkOffset + 3] = 0;
    writeUInt16Le(bytes, linkOffset + 4, index);
    writeUInt16Le(bytes, linkOffset + 6, 0xd7c0);
  });

  putSyntheticCrc(bytes);
  return bytes;
}

function putSyntheticCrc(bytes: Buffer) {
  writeUInt32Le(bytes, syntheticFixtureLayout.crcOffset, crc32(bytes.subarray(0, syntheticFixtureLayout.crcOffset)));
}

function fixedAscii(value: string, length: number) {
  const bytes = Buffer.from(value, "ascii");
  if (bytes.length >= length) throw new Error(`Synthetic fixture field too long: ${value}`);
  const out = Buffer.alloc(length);
  bytes.copy(out);
  return out;
}

function readUInt32Le(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function writeUInt16Le(bytes: Buffer, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeUInt32Le(bytes: Buffer, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
