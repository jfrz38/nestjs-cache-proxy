/** Returns whether a value is a positive safe integer TTL in milliseconds. */
export function isValidTtl(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
