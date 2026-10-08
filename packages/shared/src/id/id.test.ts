import { describe, it, expect } from 'vitest';
import { generateUuidV7, isUuid, isUuidv7, extractTimestampFromUuidv7 } from './index.js';

describe('UUIDv7 Helpers', () => {
  it('generates valid UUIDv7 format', () => {
    const id = generateUuidV7();
    expect(isUuid(id)).toBe(true);
    expect(isUuidv7(id)).toBe(true);
    // Version check (character 14 is '7')
    expect(id.split('-')[2]![0]).toBe('7');
  });

  it('generates monotonically ordered UUIDs', () => {
    const id1 = generateUuidV7();
    const id2 = generateUuidV7();
    expect(id1 < id2).toBe(true);
  });

  it('extracts accurate timestamp from UUIDv7', () => {
    const testTime = 1700000000000;
    const id = generateUuidV7(testTime);
    const date = extractTimestampFromUuidv7(id);
    expect(date.getTime()).toBe(testTime);
  });

  it('rejects invalid UUID formats', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuidv7('550e8400-e29b-41d4-a716-446655440000')).toBe(false); // v4 UUID
  });
});
