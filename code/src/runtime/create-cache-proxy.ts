import type { CompiledCachePolicy } from './compiled-policy.types.js';
import { CacheAsideExecutor } from './execute-cache-aside.js';

/** Creates a transparent proxy around configured asynchronous provider methods. */
export class CacheProxyFactory {
  public constructor(private readonly executor: CacheAsideExecutor) {}

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

        const rule = policy.readRuleFor(property);
        const wrapper =
          rule === undefined
            ? (...args: unknown[]) =>
                Reflect.apply(value, target, args) as unknown
            : (...args: unknown[]) =>
                this.executor.execute(
                  rule,
                  args,
                  () => Reflect.apply(value, target, args) as unknown,
                );

        wrappers.set(property, wrapper);

        return wrapper;
      },
      set(target, property, value) {
        return Reflect.set(target, property, value, target);
      },
    });
  }
}
