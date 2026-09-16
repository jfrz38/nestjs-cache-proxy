import { defineCachePolicy } from '../../src/index.js';

interface Provider {
  findById(id: string): Promise<string>;
  list(): Promise<readonly string[]>;
  update(id: string): Promise<string>;
}

defineCachePolicy<Provider>()({
  resources: {
    users: {
      key: () => 'all',
      method: 'list',
      ttl: 1,
      version: 1,
    },
  },
  methods: {
    update: {
      effects: [
        { invalidate: { resource: 'users' } },
        { writeThrough: { resource: 'users', value: () => [] } },
      ],
    },
  },
});

defineCachePolicy<Provider>()({
  resources: {
    userById: {
      key: ([id]) => id,
      method: 'findById',
      ttl: 1,
      version: 1,
    },
  },
  methods: {
    update: {
      effects: [
        {
          // @ts-expect-error A non-constant resource needs key arguments.
          invalidate: { resource: 'userById' },
        },
      ],
    },
  },
});
