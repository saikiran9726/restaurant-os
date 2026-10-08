/**
 * UUIDv7 implementation according to RFC 9562.
 * UUIDv7 combines a 48-bit Unix timestamp with random bytes for time-ordered uniqueness,
 * making them optimal primary keys for B-tree database indexing.
 */

// Monotonic sequence state
let lastTimestamp = -1;
let sequenceCounter = 0;

/**
 * Generates a standard RFC 9562 UUIDv7 string.
 * Uses cryptographically secure random values and provides millisecond time-ordering.
 */
export function generateUuidV7(timestampMs?: number): string {
  const now = timestampMs ?? Date.now();

  if (now === lastTimestamp) {
    sequenceCounter = (sequenceCounter + 1) & 0xfff; // 12-bit counter
  } else {
    lastTimestamp = now;
    sequenceCounter = 0;
  }

  // 16 bytes for the UUID
  const bytes = new Uint8Array(16);

  // Fill random bytes using global crypto
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments where crypto is not directly global
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // 48-bit timestamp (bytes 0 to 5)
  bytes[0] = (now / 0x10000000000) & 0xff;
  bytes[1] = (now / 0x100000000) & 0xff;
  bytes[2] = (now / 0x1000000) & 0xff;
  bytes[3] = (now / 0x10000) & 0xff;
  bytes[4] = (now / 0x100) & 0xff;
  bytes[5] = now & 0xff;

  // 4-bit version (7) and 12-bit sequence counter (bytes 6 and 7)
  bytes[6] = 0x70 | ((sequenceCounter >> 8) & 0x0f);
  bytes[7] = sequenceCounter & 0xff;

  // 2-bit variant 10xxxxxx (byte 8)
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);

  // Format as 8-4-4-4-12 hex string
  return formatBytesToUuid(bytes);
}

function formatBytesToUuid(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i]!.toString(16).padStart(2, '0'));
  }

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Checks if a string is any valid UUID.
 */
export function isUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Checks if a string is a valid UUIDv7.
 */
export function isUuidv7(id: string): boolean {
  return UUID_V7_REGEX.test(id);
}

/**
 * Extracts the 48-bit Unix timestamp (Date) from a UUIDv7 string.
 */
export function extractTimestampFromUuidv7(uuid: string): Date {
  if (!isUuidv7(uuid)) {
    throw new Error(`Invalid UUIDv7 string: ${uuid}`);
  }

  const clean = uuid.replace(/-/g, '');
  const timestampHex = clean.slice(0, 12);
  const timestampMs = parseInt(timestampHex, 16);

  return new Date(timestampMs);
}
