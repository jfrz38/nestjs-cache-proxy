import { rm } from 'node:fs/promises';

await Promise.all([
  rm(new URL('../LICENSE', import.meta.url), { force: true }),
  rm(new URL('../README.md', import.meta.url), { force: true }),
]);
