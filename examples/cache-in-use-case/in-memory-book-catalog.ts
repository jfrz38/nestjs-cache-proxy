import { Injectable } from '@nestjs/common';
import type { Book } from './book.js';
import type { BookCatalog } from './book-catalog.js';

@Injectable()
export class InMemoryBookCatalog implements BookCatalog {
  private readonly books = new Map<string, Book>([
    ['1', { id: '1', title: 'Refactoring' }],
  ]);

  public findById(id: string): Promise<Book | null> {
    return Promise.resolve(this.books.get(id) ?? null);
  }
}
