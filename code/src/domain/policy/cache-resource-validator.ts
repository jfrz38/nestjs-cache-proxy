import { CacheKeyVersion } from '../key/cache-key-version.js';
import { InvalidCachePolicyError } from './invalid-cache-policy-error.js';
import { TimeToLive } from './time-to-live.js';

export class CacheResourceValidator {
  private static readonly fields = new Set([
    'cacheIf',
    'key',
    'method',
    'ttl',
    'version',
  ]);

  public validate(name: string, resource: unknown): void {
    if (name.trim().length === 0) {
      throw this.invalid('Resource names must not be empty.');
    }

    if (!this.isRecord(resource) || !this.hasOnlyFields(resource)) {
      throw this.invalid(`Resource "${name}" has an unsupported definition.`);
    }

    if (
      typeof resource.method !== 'string' ||
      resource.method.trim().length === 0
    ) {
      throw this.invalid(`Resource "${name}" must declare a method name.`);
    }

    try {
      TimeToLive.fromMilliseconds(resource.ttl);
    } catch {
      throw this.invalid(
        `Resource "${name}" must declare a positive integer TTL in milliseconds.`,
      );
    }

    try {
      CacheKeyVersion.from(resource.version);
    } catch {
      throw this.invalid(
        `Resource "${name}" must declare a positive integer version.`,
      );
    }

    if (typeof resource.key !== 'function') {
      throw this.invalid(`Resource "${name}" must declare a key builder.`);
    }

    if (
      resource.cacheIf !== undefined &&
      typeof resource.cacheIf !== 'function'
    ) {
      throw this.invalid(
        `Resource "${name}" must declare a cache admission predicate.`,
      );
    }
  }

  private hasOnlyFields(value: Record<string, unknown>): boolean {
    return Object.keys(value).every((field) =>
      CacheResourceValidator.fields.has(field),
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private invalid(message: string): InvalidCachePolicyError {
    return new InvalidCachePolicyError(message);
  }
}
