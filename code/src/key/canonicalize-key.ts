import type { StructuredKeyInput } from './structured-key.types.js';
import { encodeStructuredKeyInput } from './encode-structured-key-input.js';

export function canonicalizeKey(input: StructuredKeyInput): string {
  return JSON.stringify(encodeStructuredKeyInput(input));
}
