import type { Book } from './book.js';

export const BOOK_CATALOG = Symbol('examples.use-case.book-catalog');

export interface BookCatalog {
  findById(id: string): Promise<Book | null>;
}
