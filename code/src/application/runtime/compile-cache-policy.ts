import { CacheKeyVersion } from '../../domain/key/cache-key-version.js';
import type { CacheNamespace } from '../../domain/key/cache-namespace.js';
import { CacheResourceName } from '../../domain/key/cache-resource-name.js';
import { TimeToLive } from '../../domain/policy/time-to-live.js';
import { ValidatedCachePolicy } from '../../domain/policy/validated-cache-policy.js';
import { CompiledCachePolicy } from './compiled-cache-policy.js';
import { CompiledMutationRule } from './compiled-mutation-rule.js';
import type {
  CompiledCacheEffect,
  RuntimeCacheEffect,
  RuntimePolicy,
  RuntimeResource,
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
    resources: Record<string, RuntimeResource>,
  ): CompiledCacheEffect {
    const definition = effect.invalidate ?? effect.writeThrough;
    if (definition === undefined) {
      throw new Error('Validated cache effect is missing its definition.');
    }

    const resource = resources[definition.resource];
    if (resource === undefined) {
      throw new Error('Validated cache effect references an unknown resource.');
    }

    const compiledResource = new CompiledReadRule(
      CacheResourceName.from(definition.resource),
      CacheKeyVersion.from(resource.version),
      TimeToLive.fromMilliseconds(resource.ttl),
      resource.key,
    );
    const buildCacheKey = (
      namespace: CacheNamespace,
      args: readonly unknown[],
      result: unknown,
    ) => {
      const keyArgs = definition.keyArgs?.({ args, result }) ?? [];
      return compiledResource.buildCacheKey(namespace, keyArgs);
    };

    if (effect.invalidate !== undefined) {
      return {
        buildCacheKey,
        kind: 'invalidate',
        resource: definition.resource,
      };
    }

    return {
      buildCacheKey,
      kind: 'writeThrough',
      resource: definition.resource,
      ttl: TimeToLive.fromMilliseconds(resource.ttl),
      value: (args, result) => effect.writeThrough!.value({ args, result }),
    };
  }
}
