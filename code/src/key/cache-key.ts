import { canonicalizeKey } from './canonicalize-key.js';
import type { StructuredKeyInput } from './structured-key.types.js';
import { CacheKeyVersion } from './cache-key-version.js';
import { CacheNamespace } from './cache-namespace.js';
import { CacheResourceName } from './cache-resource-name.js';

const formatPrefix = 'ncp:k1:';

/** Deterministic, versioned key accepted by the internal cache-store port. */
export class CacheKey {
  private constructor(public readonly value: string) {}

  public static create({
    input,
    namespace,
    resource,
    version,
  }: CreateCacheKeyInput): CacheKey {
    return new CacheKey(
      `${formatPrefix}{"input":${canonicalizeKey(input)},"namespace":{"application":${JSON.stringify(namespace.application)},"environment":${JSON.stringify(namespace.environment)}},"resource":${JSON.stringify(resource.value)},"version":${version.value}}`,
    );
  }
}

interface CreateCacheKeyInput {
  readonly input: StructuredKeyInput;
  readonly namespace: CacheNamespace;
  readonly resource: CacheResourceName;
  readonly version: CacheKeyVersion;
}
