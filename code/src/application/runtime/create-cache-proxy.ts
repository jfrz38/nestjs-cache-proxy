import type { CompiledCachePolicy } from './compiled-cache-policy.js';
import { CacheAsideExecutor } from './execute-cache-aside.js';
import { MutationExecutor } from './execute-mutation.js';

export class CacheProxyFactory {
  public constructor(
    private readonly cacheAsideExecutor: CacheAsideExecutor,
    private readonly mutationExecutor: MutationExecutor,
  ) {}

  public create<T extends object>(target: T, policy: CompiledCachePolicy): T {
    const wrappers = new Map<string, (...args: unknown[]) => unknown>();

    return new Proxy(target, {
      get: (target, property) => {
        if (typeof property !== 'string') {
          return Reflect.get(target, property, target) as unknown;
        }

        const value: unknown = Reflect.get(target, property, target);

        if (typeof value !== 'function') {
          return value;
        }

        const existingWrapper = wrappers.get(property);

        if (existingWrapper !== undefined) {
          return existingWrapper;
        }

        const readRule = policy.readRuleFor(property);
        const mutationRule = policy.mutationRuleFor(property);
        const wrapper =
          readRule !== undefined
            ? (...args: unknown[]) =>
                this.cacheAsideExecutor.execute(
                  readRule,
                  args,
                  () => Reflect.apply(value, target, args) as unknown,
                )
            : mutationRule !== undefined
              ? (...args: unknown[]) =>
                  this.mutationExecutor.execute(
                    mutationRule,
                    args,
                    () => Reflect.apply(value, target, args) as unknown,
                  )
              : (...args: unknown[]) =>
                  Reflect.apply(value, target, args) as unknown;

        wrappers.set(property, wrapper);

        return wrapper;
      },
      set(target, property, value) {
        return Reflect.set(target, property, value, target);
      },
    });
  }
}
