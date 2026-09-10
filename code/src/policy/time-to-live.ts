/** Raised when a value cannot represent a positive millisecond TTL. */
export class InvalidTimeToLiveError extends Error {
  public constructor() {
    super('TTL must be a positive safe integer in milliseconds.');
    this.name = 'InvalidTimeToLiveError';
  }
}

/** Positive, safe cache lifetime expressed in milliseconds. */
export class TimeToLive {
  private constructor(public readonly milliseconds: number) {}

  public static fromMilliseconds(value: unknown): TimeToLive {
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value <= 0
    ) {
      throw new InvalidTimeToLiveError();
    }

    return new TimeToLive(value);
  }
}
