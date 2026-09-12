export enum CacheEnvelopeState {
  HIT = 'hit',
  MALFORMED = 'malformed',
  MISS = 'miss',
}

export interface CacheEnvelopeResult {
  readonly state: CacheEnvelopeState;
  readonly value?: unknown;
}

export class CacheEnvelope {
  private static readonly marker = 'nestjs-cache-proxy';
  private static readonly version = 1;

  public static encode(value: unknown): unknown {
    if (value === undefined) {
      return undefined;
    }

    return {
      marker: CacheEnvelope.marker,
      payload: value,
      version: CacheEnvelope.version,
    };
  }

  public static decode(value: unknown): CacheEnvelopeResult {
    if (value === undefined || value === null) {
      return { state: CacheEnvelopeState.MISS };
    }

    if (!CacheEnvelope.isEnvelope(value)) {
      return { state: CacheEnvelopeState.MALFORMED };
    }

    return { state: CacheEnvelopeState.HIT, value: value.payload };
  }

  private static isEnvelope(value: unknown): value is {
    readonly marker: string;
    readonly payload: unknown;
    readonly version: number;
  } {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const descriptor = Object.getOwnPropertyDescriptors(value);
    return (
      Reflect.ownKeys(descriptor).length === 3 &&
      descriptor.marker?.value === CacheEnvelope.marker &&
      descriptor.version?.value === CacheEnvelope.version &&
      descriptor.payload?.value !== undefined &&
      Object.values(descriptor).every(
        (property) => property.get === undefined && property.set === undefined,
      )
    );
  }
}
