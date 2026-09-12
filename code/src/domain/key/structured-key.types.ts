export type StructuredKeyInput =
  | boolean
  | null
  | number
  | string
  | readonly StructuredKeyInput[]
  | { readonly [key: string]: StructuredKeyInput };
