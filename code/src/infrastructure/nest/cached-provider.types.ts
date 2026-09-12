import type {
  CachePolicy,
  CacheResourceMap,
} from '../../domain/policy/policy.types.js';

export type RuntimeToken<T> =
  (abstract new (...args: never[]) => T) | string | symbol;

export type UseClass<T> = new (...args: never[]) => T;

export interface CachedProvider<
  T,
  Resources extends Record<string, unknown> = CacheResourceMap<T>,
> {
  readonly provide: RuntimeToken<T>;
  readonly useClass: UseClass<T>;
  readonly policy: CachePolicy<T, Resources>;
}
