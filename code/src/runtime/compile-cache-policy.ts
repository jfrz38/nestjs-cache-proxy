import type { StructuredKeyInput } from '../key/structured-key.types.js';
import { CacheKeyVersion } from '../key/cache-key-version.js';
import { CacheResourceName } from '../key/cache-resource-name.js';
import { TimeToLive } from '../policy/time-to-live.js';
import { validateCachePolicy } from '../policy/validate-policy.js';
import {
  CompiledCachePolicy,
  CompiledReadRule,
} from './compiled-policy.types.js';

interface RuntimePolicy {
  readonly resources: Record<string, RuntimeResource>;
  readonly methods: Record<string, RuntimeMethodRule>;
}

interface RuntimeResource {
  readonly key: (args: readonly unknown[]) => StructuredKeyInput;
  readonly ttl: number;
  readonly version: number;
}

interface RuntimeMethodRule {
  readonly cache?: string;
}

/** Compiles public policy objects into immutable runtime rules. */
export class CachePolicyCompiler {
  public compile(policy: unknown): CompiledCachePolicy {
    validateCachePolicy(policy);

    const runtimePolicy = policy as RuntimePolicy;
    const reads = new Map<string, CompiledReadRule>();

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
    }

    return new CompiledCachePolicy(reads);
  }
}
