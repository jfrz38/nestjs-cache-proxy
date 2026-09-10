import { describe, expect, it } from 'vitest';

import { packageVersion } from '../src/index.js';

describe('package entry point', () => {
  it('exports the package placeholder', () => {
    expect(packageVersion).toBe('0.0.0');
  });
});
