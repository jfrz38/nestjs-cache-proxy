import type { CompiledMutationRule } from './compiled-mutation-rule.js';
import { CacheEffectsExecutor } from './execute-cache-effects.js';

export class MutationExecutor {
  public constructor(private readonly effectsExecutor: CacheEffectsExecutor) {}

  public async execute<Result>(
    rule: CompiledMutationRule,
    args: readonly unknown[],
    invoke: () => Result | Promise<Result>,
  ): Promise<Result> {
    const result = await invoke();
    await this.effectsExecutor.execute(rule.effects, args, result);

    return result;
  }
}
