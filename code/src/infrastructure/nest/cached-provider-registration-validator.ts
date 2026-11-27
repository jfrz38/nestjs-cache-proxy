import { Scope } from '@nestjs/common';
import { SCOPE_OPTIONS_METADATA } from '@nestjs/common/constants.js';

import { CachePolicyValidator } from '../../domain/policy/cache-policy-validator.js';
import type {
  CachedProvider,
  CachedProviderAsync,
  RuntimeToken,
  UseClass,
} from './cached-provider.types.js';
import { InvalidCachedProviderError } from './invalid-cached-provider-error.js';

export class CachedProviderRegistrationValidator {
  public constructor(
    private readonly policyValidator: CachePolicyValidator = new CachePolicyValidator(),
  ) {}

  public validate<T extends object, Resources extends Record<string, unknown>>(
    registration: CachedProvider<T, Resources>,
  ): void {
    this.validateCommon(registration);
    this.policyValidator.validate(registration.policy);
  }

  public validateAsync<
    T extends object,
    Resources extends Record<string, unknown>,
    FactoryDependencies extends readonly unknown[],
  >(
    registration: CachedProviderAsync<T, Resources, FactoryDependencies>,
  ): void {
    this.validateCommon(registration);

    if (typeof registration.useFactory !== 'function') {
      throw new InvalidCachedProviderError(
        'Async cached provider registration requires a useFactory function.',
      );
    }

    if (
      registration.inject !== undefined &&
      (!Array.isArray(registration.inject) ||
        registration.inject.some(
          (dependency) => !this.isDependency(dependency),
        ))
    ) {
      throw new InvalidCachedProviderError(
        'Async cached provider registration inject must contain valid NestJS injection tokens.',
      );
    }
  }

  private validateCommon(registration: unknown): asserts registration is {
    readonly provide: RuntimeToken<object>;
    readonly useClass: UseClass<object>;
  } {
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

  private isDependency(value: unknown): boolean {
    if (this.isRuntimeToken(value)) {
      return true;
    }

    return (
      this.isRecord(value) &&
      this.isRuntimeToken(value.token) &&
      typeof value.optional === 'boolean'
    );
  }
}
