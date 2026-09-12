export class CacheResourceRegistry {
  public constructor(private readonly resources: Record<string, unknown>) {}

  public has(value: unknown): value is string {
    return typeof value === 'string' && Object.hasOwn(this.resources, value);
  }

  public get(value: unknown): { readonly key: (...args: never[]) => unknown } | undefined {
    if (!this.has(value)) {
      return undefined;
    }

    return this.resources[value] as { readonly key: (...args: never[]) => unknown };
  }
}
