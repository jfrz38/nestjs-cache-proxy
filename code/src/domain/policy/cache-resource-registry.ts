export class CacheResourceRegistry {
  public constructor(private readonly resources: Record<string, unknown>) {}

  public has(value: unknown): value is string {
    return typeof value === 'string' && Object.hasOwn(this.resources, value);
  }
}
