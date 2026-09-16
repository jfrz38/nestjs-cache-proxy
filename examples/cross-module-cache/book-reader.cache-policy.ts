import { defineCachePolicy } from 'nestjs-cache-proxy';
import type { BookReader } from './book-reader.js';

export const bookReaderCachePolicy = defineCachePolicy<BookReader>()({
  resources: {
    bookById: {
      method: 'findById',
      version: 1,
      ttl: 60_000,
      key: ([id]) => id,
    },
  },
  methods: { findById: { cache: 'bookById' } },
});
