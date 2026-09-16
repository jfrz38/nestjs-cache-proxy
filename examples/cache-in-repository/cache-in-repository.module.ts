import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { CacheProxyModule } from 'nestjs-cache-proxy';
import { bookRepositoryCachePolicy } from './book-repository.cache-policy.js';
import { BOOK_REPOSITORY } from './book-repository.js';
import { InMemoryBookRepository } from './in-memory-book-repository.js';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    CacheProxyModule.forRoot({
      namespace: { application: 'repository-example', environment: 'local' },
    }),
    CacheProxyModule.forFeature([
      {
        provide: BOOK_REPOSITORY,
        useClass: InMemoryBookRepository,
        policy: bookRepositoryCachePolicy,
      },
    ]),
  ],
  exports: [CacheProxyModule],
})
export class CacheInRepositoryModule {}
