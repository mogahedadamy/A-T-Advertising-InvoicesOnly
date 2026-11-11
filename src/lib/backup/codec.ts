/**
 * ═══════════════════════════════════════════════════════════════
 * Archive codec — TS reference implementation of the .tabk container
 * ═══════════════════════════════════════════════════════════════
 * This module is the executable specification of the byte format produced by
 * the dependency-free Java code in
 * android/app/src/main/java/com/futureprint/calculator/backup/BackupArchive.java.
 * The Node test-suite round-trips Java-shaped archives through it and checks
 * that both sides agree, so drift in either implementation fails CI.
 *
 * Why a JSON-in-binary envelope instead of a ZIP:
 *  - Java can read it with no APK-size cost;
 *  - the header (schema version, counts, hashes) lives inside the AES-GCM
 *    authenticated region, so it cannot be edited without breaking the seal;
 *  - SQLite already stores text compactly, so a ZIP buys little and adds a
 *    ZIP-Slip attack surface we would otherwise have to harden.
 */

import type { BackupKind, BackupManifest } from "./types";
import {
  BACKUP_ARCHIVE_FORMAT_VERSION,
  BACKUP_ARCHIVE_MAGIC,
  BACKUP_ARCHIVE_PREFIX_LEN,
  BACKUP_GCM_TAG_LEN,
  BACKUP_SEALED_FLAG,
} from "./types";
import {
  base64ToBytes,
  bytesToBase64,
  concatBytes,
  openPayload,
  sealPayload,
  utf8Decode,
  utf8Encode,
} from "./crypto";

export interface ParsedArchive {
  archiveVersion: number;
  sealed: boolean;
  keyId: string;
  /** Stored payload bytes (ciphertext when sealed). */
  payload: Uint8Array;
  totalLength: number;
}

export class ArchiveFormatError extends Error {
  code: "BAD_MAGIC" | "UNSUPPORTED_VERSION" | "TRUNCATED" | "BAD_LENGTHS";
  constructor(code: ArchiveFormatError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "ArchiveFormatError";
  }
}

function u16(value: number): Uint8Array {
  return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
}

function u64(value: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(Math.max(0, Math.trunc(value))));
  return out;
}

function readU64(view: DataView, offset: number): number {
  const hi = view.getUint32(offset);
  const lo = view.getUint32(offset + 4);
  return hi * 0x100000000 + lo;
}

/**
 * Builds the variable-length header:
 *   magic | version | flags | keyIdLen(2) | reserved(2) | payloadLen(8) | keyId
 * The field order is fixed in this one place because both the JS and Java
 * encoders are validated against it by the byte-parity test.
 */
export function buildArchivePrefix(keyId: string, payloadLength: number, sealed: boolean): Uint8Array {
  const keyIdBytes = utf8Encode(keyId);
  return concatBytes(
    utf8Encode(BACKUP_ARCHIVE_MAGIC),
    new Uint8Array([BACKUP_ARCHIVE_FORMAT_VERSION, sealed ? BACKUP_SEALED_FLAG : 0]),
    u16(keyIdBytes.length),
    new Uint8Array([0, 0]),
    u64(payloadLength),
    keyIdBytes
  );
}

/**
 * Builds a complete archive.
 * When `rawKey` is provided the plaintext is AES-256-GCM sealed; the keyId is
 * written in the header and a 16-byte slot is reserved after the payload
 * (the tag itself is embedded at the end of the sealed bytes).
 */
export async function encodeArchive(
  plaintext: Uint8Array,
  options: { rawKey?: Uint8Array; keyId?: string } = {}
): Promise<Uint8Array> {
  const sealed = Boolean(options.rawKey);
  const payload = sealed ? await sealPayload(plaintext, options.rawKey!) : plaintext;
  const keyId = sealed ? options.keyId ?? "" : "";
  if (sealed && keyId.length === 0) throw new Error("keyId is required for encrypted archives");
  const prefix = buildArchivePrefix(keyId, payload.length, sealed);
  const tagSlot = sealed ? new Uint8Array(BACKUP_GCM_TAG_LEN) : new Uint8Array(0);
  return concatBytes(prefix, payload, tagSlot);
}

/** Parses and length-validates an archive without decrypting it. */
export function parseArchive(bytes: Uint8Array): ParsedArchive {
  if (bytes.length < BACKUP_ARCHIVE_PREFIX_LEN) {
    throw new ArchiveFormatError("TRUNCATED", "Archive is shorter than its header (" + bytes.length + " bytes).");
  }
  const magic = utf8Decode(bytes.subarray(0, 4));
  if (magic !== BACKUP_ARCHIVE_MAGIC) {
    throw new ArchiveFormatError("BAD_MAGIC", "Not a T.A backup archive.");
  }
  const version = bytes[4];
  if (version !== BACKUP_ARCHIVE_FORMAT_VERSION) {
    throw new ArchiveFormatError("UNSUPPORTED_VERSION", "Unsupported archive version " + version + ".");
  }
  const sealed = (bytes[5] & BACKUP_SEALED_FLAG) !== 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const keyIdLen = view.getUint16(6);
  const payloadLen = readU64(view, 10);
  if (keyIdLen > 128) {
    throw new ArchiveFormatError("BAD_LENGTHS", "Archive header contains an invalid keyId length.");
  }
  const expected = BACKUP_ARCHIVE_PREFIX_LEN + keyIdLen + payloadLen + (sealed ? BACKUP_GCM_TAG_LEN : 0);
  if (bytes.length !== expected) {
    throw new ArchiveFormatError(
      "TRUNCATED",
      "Archive length mismatch: header promises " + expected + " bytes but file has " + bytes.length + "."
    );
  }
  const keyId = utf8Decode(bytes.subarray(BACKUP_ARCHIVE_PREFIX_LEN, BACKUP_ARCHIVE_PREFIX_LEN + keyIdLen));
  const payloadStart = BACKUP_ARCHIVE_PREFIX_LEN + keyIdLen;
  return {
    archiveVersion: version,
    sealed,
    keyId,
    payload: bytes.subarray(payloadStart, payloadStart + payloadLen),
    totalLength: bytes.length,
  };
}

export interface OpenedArchive {
  manifest: BackupManifest;
  database: Uint8Array;
}

/** Builds the JSON envelope that is sealed inside the archive (exported for tests). */
export function encodePayloadEnvelope(manifest: BackupManifest, database: Uint8Array): Uint8Array {
  return utf8Encode(JSON.stringify({ header: manifest, databaseBase64: bytesToBase64(database) }));
}

/**
 * Decrypts (if needed) and decodes the JSON envelope.
 * Header fields travel inside the authenticated payload, so a successful
 * GCM tag check also authenticates the manifest.
 */
export async function openArchive(archive: Uint8Array, rawKey?: Uint8Array): Promise<OpenedArchive> {
  const parsed = parseArchive(archive);
  let plaintext: Uint8Array;
  if (parsed.sealed) {
    if (!rawKey) throw new Error("ENCRYPTED_NEEDS_KEY");
    const opened = await openPayload(parsed.payload, rawKey);
    if (!opened) throw new Error("BAD_SEAL");
    plaintext = opened;
  } else {
    plaintext = parsed.payload;
  }

  let envelope: any;
  try {
    envelope = JSON.parse(utf8Decode(plaintext));
  } catch {
    throw new Error("BAD_ENVELOPE");
  }
  if (!envelope?.header || typeof envelope?.databaseBase64 !== "string") {
    throw new Error("BAD_ENVELOPE");
  }
  return { manifest: envelope.header as BackupManifest, database: base64ToBytes(envelope.databaseBase64) };
}

export type { BackupKind };
