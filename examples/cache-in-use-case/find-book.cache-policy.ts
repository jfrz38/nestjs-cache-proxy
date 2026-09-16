import { defineCachePolicy } from 'nestjs-cache-proxy';
import type { FindBookUseCase } from './find-book.use-case.js';

export const findBookCachePolicy = defineCachePolicy<FindBookUseCase>()({
  resources: {
    bookById: {
      method: 'dispatch',
      version: 1,
      ttl: 60_000,
      key: ([id]) => id,
    },
  },
  methods: { dispatch: { cache: 'bookById' } },
});
