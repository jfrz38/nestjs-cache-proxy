import Keyv from 'keyv';

import {
  describeCacheBackendContract,
  type BackendFixture,
} from '../../contract/cache-backend.contract.js';

const backend: BackendFixture = {
  name: 'memory',
  createStore: (namespace) => Promise.resolve(new Keyv({ namespace })),
};

describeCacheBackendContract(backend);
