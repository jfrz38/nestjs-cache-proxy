import { CompiledReadRule } from './compiled-read-rule.js';

export class CompiledCachePolicy {
  private readonly reads: ReadonlyMap<string, CompiledReadRule>;

  public constructor(reads: ReadonlyMap<string, CompiledReadRule>) {
    this.reads = new Map(reads);
  }

  public readRuleFor(method: string): CompiledReadRule | undefined {
    return this.reads.get(method);
  }
}
