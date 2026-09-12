type RegisteredCacheResource = {
  readonly key: (...args: never[]) => unknown;
};

export class CacheResourceRegistry {
  public constructor(private readonly resources: Record<string, unknown>) {}

  public has(value: unknown): value is string {
    return typeof value === 'string' && Object.hasOwn(this.resources, value);
  }

  public hasParameterlessKey(value: unknown): boolean {
    return (
      this.has(value) &&
      (this.resources[value] as RegisteredCacheResource).key.length === 0
    );
  }
}
