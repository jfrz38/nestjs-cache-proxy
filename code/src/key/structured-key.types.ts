/**
 * Values that may become a deterministic cache key in iteration 03.
 */
export type StructuredKeyInput =
  | boolean
  | null
  | number
  | string
  | readonly StructuredKeyInput[]
  | { readonly [key: string]: StructuredKeyInput };
