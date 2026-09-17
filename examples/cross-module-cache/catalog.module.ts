import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { CacheProxyModule } from '@jfrz38/nestjs-cache-proxy';
import { CACHED_BOOK_READER } from './book-reader.js';
import { bookReaderCachePolicy } from './book-reader.cache-policy.js';
import { InMemoryBookReader } from './in-memory-book-reader.js';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    CacheProxyModule.forRoot({
      namespace: { application: 'cross-module-example', environment: 'local' },
    }),
    CacheProxyModule.forFeature([
      {
        provide: CACHED_BOOK_READER,
        useClass: InMemoryBookReader,
        policy: bookReaderCachePolicy,
      },
    ]),
  ],
  exports: [CacheProxyModule],
})
export class CatalogModule {}
