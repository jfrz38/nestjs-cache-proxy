import { Scope } from '@nestjs/common';
import { SCOPE_OPTIONS_METADATA } from '@nestjs/common/constants.js';

import { CachePolicyValidator } from '../policy/cache-policy-validator.js';
import type { CachedProvider } from './cached-provider.types.js';
import { InvalidCachedProviderError } from './invalid-cached-provider-error.js';

export class CachedProviderRegistrationValidator {
  public constructor(
    private readonly policyValidator: CachePolicyValidator = new CachePolicyValidator(),
  ) {}

  public validate<T extends object>(registration: CachedProvider<T>): void {
    if (!this.isRecord(registration)) {
      throw new InvalidCachedProviderError(
        'Cached provider registration must be an object.',
      );
    }

    if (!this.isRuntimeToken(registration.provide)) {
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

    this.policyValidator.validate(registration.policy);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private isRuntimeToken(value: unknown): boolean {
    return (
      typeof value === 'function' ||
      typeof value === 'symbol' ||
      (typeof value === 'string' && value.length > 0)
    );
  }
}
