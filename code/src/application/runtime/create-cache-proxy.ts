import type { CompiledCachePolicy } from './compiled-cache-policy.js';
import { CacheAsideExecutor } from './execute-cache-aside.js';
import { MutationExecutor } from './execute-mutation.js';

type ProviderMethod = (...args: unknown[]) => unknown;

export class CacheProxyFactory {
  public constructor(
    private readonly cacheAsideExecutor: CacheAsideExecutor,
    private readonly mutationExecutor: MutationExecutor,
  ) {}

  public create<T extends object>(target: T, policy: CompiledCachePolicy): T {
    const wrappers = new Map<string, ProviderMethod>();

    return new Proxy(target, {
      get: (target, property) => {
        if (typeof property !== 'string') {
          return Reflect.get(target, property, target) as unknown;
        }

        const value: unknown = Reflect.get(target, property, target);

        if (!this.isProviderMethod(value)) {
          return value;
        }

        const existingWrapper = wrappers.get(property);

        if (existingWrapper !== undefined) {
          return existingWrapper;
        }

        const wrapper = this.createMethodWrapper(
          target,
          value,
          property,
          policy,
        );

        wrappers.set(property, wrapper);

        return wrapper;
      },
      set(target, property, value) {
        return Reflect.set(target, property, value, target);
      },
    });
  }

  private createMethodWrapper(
    target: object,
    method: ProviderMethod,
    property: string,
    policy: CompiledCachePolicy,
  ): ProviderMethod {
    const invoke = (...args: unknown[]): unknown =>
      Reflect.apply(method, target, args);
    const readRule = policy.readRuleFor(property);

    if (readRule !== undefined) {
      return (...args) =>
        this.cacheAsideExecutor.execute(readRule, args, () => invoke(...args));
    }

    const mutationRule = policy.mutationRuleFor(property);

    if (mutationRule !== undefined) {
      return (...args) =>
        this.mutationExecutor.execute(mutationRule, args, () =>
          invoke(...args),
        );
    }

    return invoke;
  }

  private isProviderMethod(value: unknown): value is ProviderMethod {
    return typeof value === 'function';
  }
}
