import { CompiledReadRule } from './compiled-read-rule.js';
import { CompiledMutationRule } from './compiled-mutation-rule.js';

export class CompiledCachePolicy {
  private readonly reads: ReadonlyMap<string, CompiledReadRule>;
  private readonly mutations: ReadonlyMap<string, CompiledMutationRule>;

  public constructor(
    reads: ReadonlyMap<string, CompiledReadRule>,
    mutations: ReadonlyMap<string, CompiledMutationRule>,
  ) {
    this.reads = new Map(reads);
    this.mutations = new Map(mutations);
  }

  public readRuleFor(method: string): CompiledReadRule | undefined {
    return this.reads.get(method);
  }

  public mutationRuleFor(method: string): CompiledMutationRule | undefined {
    return this.mutations.get(method);
  }
}
