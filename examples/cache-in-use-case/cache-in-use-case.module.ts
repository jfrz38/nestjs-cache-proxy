import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { CacheProxyModule, cachedProvider } from 'nestjs-cache-proxy';
import { BOOK_CATALOG } from './book-catalog.js';
import { findBookCachePolicy } from './find-book.cache-policy.js';
import {
  FIND_BOOK_USE_CASE,
  FindBookUseCaseHandler,
} from './find-book.use-case.js';
import { InMemoryBookCatalog } from './in-memory-book-catalog.js';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    CacheProxyModule.forRoot({
      namespace: { application: 'use-case-example', environment: 'local' },
    }),
  ],
  providers: [
    { provide: BOOK_CATALOG, useClass: InMemoryBookCatalog },
    ...cachedProvider({
      provide: FIND_BOOK_USE_CASE,
      useClass: FindBookUseCaseHandler,
      policy: findBookCachePolicy,
    }),
  ],
  exports: [FIND_BOOK_USE_CASE],
})
export class CacheInUseCaseModule {}
