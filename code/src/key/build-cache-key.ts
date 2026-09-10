import type { BuildCacheKeyInput } from './cache-key.types.js';
import {
  InvalidCacheKeyNamespaceError,
  InvalidCacheKeyResourceError,
  InvalidCacheKeyVersionError,
} from './cache-key-validation-error.js';
import { canonicalizeKey } from './canonicalize-key.js';

const formatPrefix = 'ncp:k1:';

/** Builds a deterministic, versioned cache key without delimiter ambiguity. */
export function buildCacheKey({
  input,
  namespace,
  resource,
  version,
}: BuildCacheKeyInput): string {
  if (namespace === null || typeof namespace !== 'object') {
    throw new InvalidCacheKeyNamespaceError(
      'Cache key namespace must be an object.',
    );
  }

  validateComponent(namespace.application, 'application');
  validateComponent(namespace.environment, 'environment');
  validateComponent(resource, 'resource');

  if (!Number.isSafeInteger(version) || version <= 0) {
    throw new InvalidCacheKeyVersionError(
      'Cache key version must be a positive safe integer.',
    );
  }

  return `${formatPrefix}{"input":${canonicalizeKey(input)},"namespace":{"application":${JSON.stringify(namespace.application)},"environment":${JSON.stringify(namespace.environment)}},"resource":${JSON.stringify(resource)},"version":${version}}`;
}

function validateComponent(value: unknown, name: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    const message = `Cache key ${name} must be a non-empty string.`;
    throw name === 'resource'
      ? new InvalidCacheKeyResourceError(message)
      : new InvalidCacheKeyNamespaceError(message);
  }
}
