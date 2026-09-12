import cleanArchitecture from '@jfrz38/eslint-plugin-clean-architecture-highlighter';
import { ESLint } from 'eslint';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  architectureRuleOptions,
  coreImportRestrictions,
} from '../../architecture-layers.mjs';

async function lint(source: string, relativePath: string) {
  const directory = await mkdtemp(join(tmpdir(), 'nestjs-cache-proxy-lint-'));
  const filePath = join(directory, relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, source);
  const eslint = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['src/**/*.ts'],
        plugins: {
          'clean-architecture-highlighter': cleanArchitecture,
        },
        rules: {
          'clean-architecture-highlighter/no-layer-violation': [
            'error',
            {
              ...architectureRuleOptions,
              sourceFolder: join(directory, 'src'),
            },
          ],
          'no-restricted-imports': ['error', coreImportRestrictions],
        },
      },
    ],
  });

  return eslint.lintFiles([filePath]);
}

describe('architecture layer boundaries', () => {
  it('allows NestJS composition to depend on the runtime and core layers', async () => {
    const [result] = await lint(
      "import { CacheProxyFactory } from '../runtime/cache-proxy-factory.js';\nimport { CacheNamespace } from '../key/cache-namespace.js';",
      'src/nest/cache-proxy.module.ts',
    );

    expect(result?.messages).toEqual([]);
  });

  it('rejects NestJS and backend dependencies from the framework-independent core', async () => {
    const [runtimeResult] = await lint(
      "import { CacheProxyModule } from '../nest/cache-proxy.module.js';",
      'src/runtime/cache-proxy-factory.ts',
    );
    const [keyResult] = await lint(
      "import { createCache } from 'cache-manager';",
      'src/key/cache-key.types.ts',
    );

    expect(runtimeResult?.messages[0]?.message).toBe(
      'application layer should not depend on infrastructure layer.',
    );
    expect(keyResult?.messages[0]?.message).toContain(
      'Framework and cache backend dependencies belong in the nest layer.',
    );
  });
});
