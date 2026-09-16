export interface TestClock {
  readonly now: number;
  advanceBy(milliseconds: number): void;
}

export class ManualTestClock implements TestClock {
  public get now(): number {
    return this.currentTime;
  }

  public constructor(private currentTime = 0) {
    this.validateTime(currentTime);
  }

  public advanceBy(milliseconds: number): void {
    this.validateTime(milliseconds);
    this.currentTime += milliseconds;
  }

  public reset(time = 0): void {
    this.validateTime(time);
    this.currentTime = time;
  }

  private validateTime(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(
        'Test clock time must be a non-negative safe integer.',
      );
    }
  }
}
