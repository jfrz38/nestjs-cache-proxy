const INVALID_TIME_TO_LIVE_ERROR_MESSAGE =
  'TTL must be a positive safe integer in milliseconds.';
const INVALID_TIME_TO_LIVE_ERROR_NAME = 'InvalidTimeToLiveError';

export class InvalidTimeToLiveError extends Error {
  public constructor() {
    super(INVALID_TIME_TO_LIVE_ERROR_MESSAGE);
    this.name = INVALID_TIME_TO_LIVE_ERROR_NAME;
  }
}

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
