import type { Book } from './book.js';

export const BOOK_REPOSITORY = Symbol('examples.repository.book-repository');

export interface BookRepository {
  findById(id: string): Promise<Book | null>;
  updateTitle(id: string, title: string): Promise<Book | null>;
}
