import type { Book } from './book.js';

export const CACHED_BOOK_READER = Symbol('examples.cross-module.book-reader');

export interface BookReader {
  findById(id: string): Promise<Book | null>;
}
