import { Inject, Injectable } from '@nestjs/common';
import type { Book } from './book.js';
import { BOOK_CATALOG, type BookCatalog } from './book-catalog.js';

export const FIND_BOOK_USE_CASE = Symbol('examples.use-case.find-book');

export interface FindBookUseCase {
  dispatch(id: string): Promise<Book | null>;
}

@Injectable()
export class FindBookUseCaseHandler implements FindBookUseCase {
  public constructor(
    @Inject(BOOK_CATALOG) private readonly catalog: BookCatalog,
  ) {}

  public dispatch(id: string): Promise<Book | null> {
    return this.catalog.findById(id);
  }
}
