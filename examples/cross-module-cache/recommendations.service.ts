import { Inject, Injectable } from '@nestjs/common';
import { CACHED_BOOK_READER, type BookReader } from './book-reader.js';

@Injectable()
export class RecommendationsService {
  public constructor(
    @Inject(CACHED_BOOK_READER) private readonly books: BookReader,
  ) {}

  public async forBook(
    id: string,
  ): Promise<{ readonly bookId: string } | null> {
    const book = await this.books.findById(id);
    return book === null ? null : { bookId: book.id };
  }
}
