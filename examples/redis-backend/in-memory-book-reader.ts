import { Injectable } from '@nestjs/common';
import type { Book } from './book.js';
import type { BookReader } from './book-reader.js';

@Injectable()
export class InMemoryBookReader implements BookReader {
  private readonly books = new Map<string, Book>([
    ['1', { id: '1', title: 'Designing Data-Intensive Applications' }],
  ]);

  public findById(id: string): Promise<Book | null> {
    return Promise.resolve(this.books.get(id) ?? null);
  }
}
