import { createKeyv } from '@keyv/redis';
import { describe } from 'vitest';

import {
  describeCacheBackendContract,
  type BackendFixture,
} from '../../contract/cache-backend.contract.js';

const redisUrl = process.env.REDIS_URL;

if (redisUrl === undefined) {
  describe.skip('redis cache backend', () => {});
} else {
  const backend: BackendFixture = {
    name: 'redis',
    createStore: (namespace) =>
      Promise.resolve(createKeyv(redisUrl, { namespace })),
  };

  describeCacheBackendContract(backend);
}
