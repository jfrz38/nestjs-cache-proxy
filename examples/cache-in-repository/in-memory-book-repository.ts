import { Injectable } from '@nestjs/common';
import type { Book } from './book.js';
import type { BookRepository } from './book-repository.js';

@Injectable()
export class InMemoryBookRepository implements BookRepository {
  private readonly books = new Map<string, Book>([
    ['1', { id: '1', title: 'Clean Code' }],
  ]);

  public findById(id: string): Promise<Book | null> {
    return Promise.resolve(this.books.get(id) ?? null);
  }

  public updateTitle(id: string, title: string): Promise<Book | null> {
    const book = this.books.get(id);
    if (book === undefined) {
      return Promise.resolve(null);
    }

    const updated = { ...book, title };
    this.books.set(id, updated);
    return Promise.resolve(updated);
  }
}
