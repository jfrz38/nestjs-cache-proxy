import { Scope } from '@nestjs/common';
import { SCOPE_OPTIONS_METADATA } from '@nestjs/common/constants.js';

import { validateCachePolicy } from '../policy/validate-policy.js';
import type { CachedProvider } from './cached-provider.types.js';
import { InvalidCachedProviderError } from './invalid-cached-provider-error.js';

export function validateRegistration<T extends object>(
  registration: CachedProvider<T>,
): void {
  if (!isRecord(registration)) {
    throw new InvalidCachedProviderError(
      'Cached provider registration must be an object.',
    );
  }

  if (!isRuntimeToken(registration.provide)) {
    throw new InvalidCachedProviderError(
      'Cached provider registration requires a class, string, or symbol token.',
    );
  }

  if (typeof registration.useClass !== 'function') {
    throw new InvalidCachedProviderError(
      'Cached provider registration requires a concrete useClass constructor.',
    );
  }

  const scopeOptions = Reflect.getMetadata(
    SCOPE_OPTIONS_METADATA,
    registration.useClass,
  ) as { readonly scope?: Scope } | undefined;

  if (
    scopeOptions?.scope === Scope.REQUEST ||
    scopeOptions?.scope === Scope.TRANSIENT
  ) {
    throw new InvalidCachedProviderError(
      'Cached providers must use the default singleton scope.',
    );
  }

  validateCachePolicy(registration.policy);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRuntimeToken(value: unknown): boolean {
  return (
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    (typeof value === 'string' && value.length > 0)
  );
}
