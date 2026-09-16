import { cp } from 'node:fs/promises';

await Promise.all([
  cp(
    new URL('../../LICENSE', import.meta.url),
    new URL('../LICENSE', import.meta.url),
  ),
  cp(
    new URL('../../README.md', import.meta.url),
    new URL('../README.md', import.meta.url),
  ),
]);
