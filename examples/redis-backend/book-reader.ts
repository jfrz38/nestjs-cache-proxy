import type { Book } from './book.js';

export const REDIS_BOOK_READER = Symbol('examples.redis.book-reader');

export interface BookReader {
  findById(id: string): Promise<Book | null>;
}
