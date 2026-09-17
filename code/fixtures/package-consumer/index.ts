import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import {
  CacheProxyModule,
  cachedProvider,
  defineCachePolicy,
} from '@jfrz38/nestjs-cache-proxy';
import {
  buildPolicyCacheKey,
  createTestCache,
  TestCacheOperationType,
} from '@jfrz38/nestjs-cache-proxy/testing';

interface UserRepository {
  findById(id: string): Promise<{ id: string } | null>;
}

class SqlUserRepository implements UserRepository {
  public async findById(id: string): Promise<{ id: string }> {
    return { id };
  }
}

const policy = defineCachePolicy<UserRepository>()({
  resources: {
    userById: {
      method: 'findById',
      version: 1,
      ttl: 300_000,
      key: ([id]) => id,
    },
  },
  methods: { findById: { cache: 'userById' } },
});

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    CacheProxyModule.forRoot({
      namespace: { application: 'consumer', environment: 'test' },
    }),
    CacheProxyModule.forFeature([
      { provide: SqlUserRepository, useClass: SqlUserRepository, policy },
    ]),
  ],
})
class ApplicationModule {}

const testCache = createTestCache();
const key: string = buildPolicyCacheKey({
  args: ['user-1'],
  namespace: { application: 'consumer', environment: 'test' },
  policy,
  resource: 'userById',
});
const operationType: TestCacheOperationType = TestCacheOperationType.GET;

void ApplicationModule;
void cachedProvider({
  provide: 'repository',
  useClass: SqlUserRepository,
  policy,
});
void testCache;
void key;
void operationType;
