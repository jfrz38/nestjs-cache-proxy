import { createKeyv } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { CacheProxyModule } from '@jfrz38/nestjs-cache-proxy';
import { REDIS_BOOK_READER } from './book-reader.js';
import { redisBookReaderCachePolicy } from './book-reader.cache-policy.js';
import { InMemoryBookReader } from './in-memory-book-reader.js';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      stores: [createKeyv(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379')],
    }),
    CacheProxyModule.forRoot({
      namespace: { application: 'redis-example', environment: 'local' },
    }),
    CacheProxyModule.forFeature([
      {
        provide: REDIS_BOOK_READER,
        useClass: InMemoryBookReader,
        policy: redisBookReaderCachePolicy,
      },
    ]),
  ],
  exports: [CacheProxyModule],
})
export class RedisBackendModule {}
