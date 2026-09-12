import { CacheKeyVersion } from '../../domain/key/cache-key-version.js';
import type { CacheNamespace } from '../../domain/key/cache-namespace.js';
import { CacheResourceName } from '../../domain/key/cache-resource-name.js';
import { TimeToLive } from '../../domain/policy/time-to-live.js';
import { ValidatedCachePolicy } from '../../domain/policy/validated-cache-policy.js';
import { CompiledCachePolicy } from './compiled-cache-policy.js';
import { CompiledMutationRule } from './compiled-mutation-rule.js';
import {
  CacheEffectKind,
  type CompiledCacheEffect,
  type RuntimeCacheEffect,
  type RuntimePolicy,
  type RuntimeResourceMap,
} from './compiled-policy.types.js';
import { CompiledReadRule } from './compiled-read-rule.js';

export class CachePolicyCompiler {
  public compile(policy: ValidatedCachePolicy): CompiledCachePolicy {
    const runtimePolicy = policy.value as RuntimePolicy;
    const reads = new Map<string, CompiledReadRule>();
    const mutations = new Map<string, CompiledMutationRule>();

    for (const [method, rule] of Object.entries(runtimePolicy.methods)) {
      if (rule.cache === undefined) {
        continue;
      }

      const resource = runtimePolicy.resources[rule.cache];

      if (resource === undefined) {
        continue;
      }

      reads.set(
        method,
        new CompiledReadRule(
          CacheResourceName.from(rule.cache),
          CacheKeyVersion.from(resource.version),
          TimeToLive.fromMilliseconds(resource.ttl),
          resource.key,
        ),
      );

      continue;
    }

    for (const [method, rule] of Object.entries(runtimePolicy.methods)) {
      if (rule.effects === undefined) {
        continue;
      }

      mutations.set(
        method,
        new CompiledMutationRule(
          rule.effects.map((effect) =>
            this.compileEffect(effect, runtimePolicy.resources),
          ),
        ),
      );
    }

    return new CompiledCachePolicy(reads, mutations);
  }

  private compileEffect(
    effect: RuntimeCacheEffect,
    resources: RuntimeResourceMap,
  ): CompiledCacheEffect {
    const target = effect.invalidate ?? effect.writeThrough;
    if (target === undefined) {
      throw new Error('Validated cache effect is missing its target.');
    }

    const resource = resources[target.resource];
    if (resource === undefined) {
      throw new Error('Validated cache effect references an unknown resource.');
    }

    const compiledResource = new CompiledReadRule(
      CacheResourceName.from(target.resource),
      CacheKeyVersion.from(resource.version),
      TimeToLive.fromMilliseconds(resource.ttl),
      resource.key,
    );
    const buildCacheKey = (
      namespace: CacheNamespace,
      args: readonly unknown[],
      result: unknown,
    ) => {
      const keyArgs = target.keyArgs?.({ args, result }) ?? [];
      return compiledResource.buildCacheKey(namespace, keyArgs);
    };

    if (effect.invalidate !== undefined) {
      return {
        buildCacheKey,
        kind: CacheEffectKind.INVALIDATE,
        resource: target.resource,
      };
    }

    return {
      buildCacheKey,
      kind: CacheEffectKind.WRITE_THROUGH,
      resource: target.resource,
      ttl: TimeToLive.fromMilliseconds(resource.ttl),
      value: (args, result) => effect.writeThrough.value({ args, result }),
    };
  }
}
