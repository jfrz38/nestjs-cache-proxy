import type { StructuredKeyInput } from './structured-key.types.js';
import { encodeStructuredKeyInput } from './encode-structured-key-input.js';

/** Returns the canonical tagged JSON representation used by cache-key format k1. */
export function canonicalizeKey(input: StructuredKeyInput): string {
  return JSON.stringify(encodeStructuredKeyInput(input));
}
