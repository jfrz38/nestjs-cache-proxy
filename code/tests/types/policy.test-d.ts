import {
  buildCacheKey,
  cachedProvider,
  defineCachePolicy,
  type BuildCacheKeyInput,
  type CacheErrorEvent,
  type CacheErrorHook,
  type CachedProvider,
  type StructuredKeyInput,
} from '../../src/index.js';
import {
  buildPolicyCacheKey,
  createTestCache,
  type TestCache,
} from '../../src/testing/index.js';

abstract class UserRepository {
  public abstract findById(id: string): Promise<User | null>;
  public abstract findByCriteria(criteria: Criteria): Promise<readonly User[]>;
  public abstract update(id: string, name: string): Promise<User>;
  public abstract remove(id: string): Promise<void>;
  public abstract synchronousMethod(): User;
}

interface Criteria {
  readonly tenantId: string;
  readonly email: string;
}

interface User {
  readonly id: string;
  readonly name: string;
}

const policy = defineCachePolicy<UserRepository>()({
  resources: {
    userById: {
      method: 'findById',
      version: 1,
      ttl: 60_000,
      key: ([id]) => id,
    },
  },
  methods: {
    findById: { cache: 'userById' },
    update: {
      effects: [
        {
          writeThrough: {
            resource: 'userById',
            keyArgs: ({ args }) => [args[0]] as [string],
            value: ({ result }) => result,
          },
        },
      ],
    },
    remove: {
      effects: [
        {
          invalidate: {
            resource: 'userById',
            keyArgs: ({ args, result }) => {
              const ignored: void = result;
              return [args[0] + ignored] as [string];
            },
          },
        },
      ],
    },
  },
});

const structuredInput: StructuredKeyInput = {
  page: 1,
  values: [true, null, 'value'],
};

const cacheKeyInput: BuildCacheKeyInput = {
  namespace: { application: 'users-api', environment: 'test' },
  resource: 'userById',
  version: 1,
  input: structuredInput,
};

const cacheKey = buildCacheKey(cacheKeyInput);
const cacheErrorHook: CacheErrorHook = (event: CacheErrorEvent) => {
  const operation: 'delete' | 'get' | 'set' = event.operation;
  void operation;
};

class DefaultUserRepository extends UserRepository {
  public findById(id: string): Promise<User | null> {
    return Promise.resolve({ id, name: 'Ada' });
  }

  public findByCriteria(criteria: Criteria): Promise<readonly User[]> {
    void criteria;
    return Promise.resolve([]);
  }

  public update(id: string, name: string): Promise<User> {
    return Promise.resolve({ id, name });
  }

  public remove(id: string): Promise<void> {
    void id;
    return Promise.resolve();
  }

  public synchronousMethod(): User {
    return { id: '1', name: 'Ada' };
  }
}

const provider: CachedProvider<UserRepository> = {
  provide: UserRepository,
  useClass: DefaultUserRepository,
  policy,
};

cachedProvider(provider);

cachedProvider<UserRepository>({
  provide: UserRepository,
  // @ts-expect-error useClass cannot be an abstract class.
  useClass: UserRepository,
  policy,
});

cachedProvider<UserRepository>({
  provide: UserRepository,
  // @ts-expect-error useClass must implement the public token contract.
  useClass: class {
    public findById(): Promise<string> {
      return Promise.resolve('invalid');
    }
  },
  policy,
});

void provider;
void structuredInput;
void cacheKey;
void cacheErrorHook;

const testCache: TestCache = createTestCache();
const policyCacheKey = buildPolicyCacheKey({
  args: ['user-1'],
  namespace: { application: 'users-api', environment: 'test' },
  policy,
  resource: 'userById',
});
void testCache;
void policyCacheKey;

buildPolicyCacheKey({
  // @ts-expect-error The resource key function requires one string argument.
  args: [],
  namespace: { application: 'users-api', environment: 'test' },
  policy,
  resource: 'userById',
});

defineCachePolicy<UserRepository>()({
  resources: {
    usersByCriteria: {
      method: 'findByCriteria',
      version: 1,
      ttl: 30_000,
      key: ([criteria]) => ({
        email: criteria.email,
        tenantId: criteria.tenantId,
      }),
    },
  },
  methods: { findByCriteria: { cache: 'usersByCriteria' } },
});

// @ts-expect-error A Date is not a structured key input.
const invalidStructuredInput: StructuredKeyInput = new Date();
void invalidStructuredInput;

// @ts-expect-error Cache-key input follows the structured-key grammar.
buildCacheKey({ ...cacheKeyInput, input: new Date() });

defineCachePolicy<UserRepository>()({
  resources: {
    userById: {
      method: 'findById',
      version: 1,
      ttl: 60_000,
      key: ([id]) => id,
    },
  },
  methods: {
    update: {
      effects: [
        {
          writeThrough: {
            resource: 'userById',
            // @ts-expect-error The target read resource receives one string argument.
            keyArgs: () => [],
            // @ts-expect-error A write-through value must match the target resource result.
            value: () => ({ id: '1' }),
          },
        },
      ],
    },
    // @ts-expect-error Read and mutation rules cannot be combined.
    findById: { cache: 'userById', effects: [] },
  },
});
