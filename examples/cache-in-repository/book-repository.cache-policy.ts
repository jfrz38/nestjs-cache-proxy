import { defineCachePolicy } from '@jfrz38/nestjs-cache-proxy';
import type { BookRepository } from './book-repository.js';

export const bookRepositoryCachePolicy = defineCachePolicy<BookRepository>()({
  resources: {
    bookById: {
      method: 'findById',
      version: 1,
      ttl: 60_000,
      key: ([id]) => id,
    },
  },
  methods: {
    findById: { cache: 'bookById' },
    updateTitle: {
      effects: [
        {
          invalidate: {
            resource: 'bookById',
            keyArgs: ({ args }) => [args[0]] as [string],
          },
        },
      ],
    },
  },
});
