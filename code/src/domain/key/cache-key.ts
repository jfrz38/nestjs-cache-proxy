import type { StructuredKeyInput } from './structured-key.types.js';
import { CacheKeyVersion } from './cache-key-version.js';
import { CacheNamespace } from './cache-namespace.js';
import { CacheResourceName } from './cache-resource-name.js';
import { StructuredKeyInputEncoder } from './structured-key-input-encoder.js';

export class CacheKey {
  private static readonly formatPrefix = 'ncp:k1:';
  private static readonly inputEncoder = new StructuredKeyInputEncoder();

  private constructor(public readonly value: string) {}

  public static create({
    input,
    namespace,
    resource,
    version,
  }: CreateCacheKeyInput): CacheKey {
    return new CacheKey(
      `${CacheKey.formatPrefix}{"input":${CacheKey.canonicalizeInput(input)},"namespace":{"application":${JSON.stringify(namespace.application)},"environment":${JSON.stringify(namespace.environment)}},"resource":${JSON.stringify(resource.value)},"version":${version.value}}`,
    );
  }

  private static canonicalizeInput(input: StructuredKeyInput): string {
    return JSON.stringify(CacheKey.inputEncoder.encode(input));
  }
}

interface CreateCacheKeyInput {
  readonly input: StructuredKeyInput;
  readonly namespace: CacheNamespace;
  readonly resource: CacheResourceName;
  readonly version: CacheKeyVersion;
}
