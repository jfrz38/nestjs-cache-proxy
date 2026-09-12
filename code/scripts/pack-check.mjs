import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, '..');
const artifactsDirectory = join(packageDirectory, '.artifacts');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const node = process.execPath;

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 */
function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

/** @param {string[]} args @param {string} cwd */
function runPnpm(args, cwd) {
  if (process.platform === 'win32') {
    execFileSync(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/s', '/c', `pnpm ${args.join(' ')}`],
      { cwd, stdio: 'inherit' },
    );
    return;
  }

  run(pnpm, args, cwd);
}

/** @param {string} cwd */
function getPackedFileList(cwd) {
  if (process.platform === 'win32') {
    return execFileSync(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/s', '/c', 'pnpm --reporter silent pack --dry-run --json'],
      { cwd, encoding: 'utf8' },
    );
  }

  return execFileSync(
    pnpm,
    ['--reporter', 'silent', 'pack', '--dry-run', '--json'],
    { cwd, encoding: 'utf8' },
  );
}

/** @param {'module' | 'commonjs'} type */
async function createConsumer(type) {
  const nestjsVersion = process.env.NESTJS_VERSION ?? '12.0.1';
  const nestjsCacheManagerVersion =
    process.env.NESTJS_CACHE_MANAGER_VERSION ?? '12.0.0';
  const cacheManagerVersion = process.env.CACHE_MANAGER_VERSION ?? '7.2.9';
  const directory = await mkdtemp(join(tmpdir(), 'nestjs-cache-proxy-'));
  await writeFile(
    join(directory, 'package.json'),
    `${JSON.stringify(
      {
        dependencies: {
          '@nestjs/cache-manager': nestjsCacheManagerVersion,
          '@nestjs/common': nestjsVersion,
          '@nestjs/core': nestjsVersion,
          'cache-manager': cacheManagerVersion,
          keyv: '^5.5.0',
          'nestjs-cache-proxy': `file:${tarball}`,
          rxjs: '^7.8.2',
        },
        devDependencies: {
          '@types/node': '24.10.1',
        },
        private: true,
        type,
      },
      null,
      2,
    )}\n`,
  );
  return directory;
}

let tarball = '';
let esmDirectory = '';
let cjsDirectory = '';

try {
  runPnpm(['run', 'build'], packageDirectory);
  await rm(artifactsDirectory, { force: true, recursive: true });
  runPnpm(['pack', '--pack-destination', artifactsDirectory], packageDirectory);

  const packageFiles = await readdir(artifactsDirectory);
  const packageFile = packageFiles.find((file) => file.endsWith('.tgz'));
  if (packageFile === undefined) {
    throw new Error('pnpm pack did not produce a tarball.');
  }
  tarball = join(artifactsDirectory, packageFile);

  const packedFileList = getPackedFileList(packageDirectory);
  for (const forbiddenPath of [
    '"path": "src/',
    '"path": "tests/',
    '"path": "scripts/',
  ]) {
    if (packedFileList.includes(forbiddenPath)) {
      throw new Error(`Tarball unexpectedly includes ${forbiddenPath}`);
    }
  }

  esmDirectory = await createConsumer('module');
  cjsDirectory = await createConsumer('commonjs');
  runPnpm(['install', '--ignore-scripts', '--no-lockfile'], esmDirectory);
  runPnpm(['install', '--ignore-scripts', '--no-lockfile'], cjsDirectory);

  run(
    node,
    [
      '--input-type=module',
      '--eval',
      "import { CacheProxyModule, defineCachePolicy } from 'nestjs-cache-proxy'; import { createTestCache, TestCacheOperationType } from 'nestjs-cache-proxy/testing'; if (typeof defineCachePolicy !== 'function' || typeof CacheProxyModule.forRoot !== 'function' || typeof createTestCache !== 'function' || TestCacheOperationType.GET !== 'get') process.exit(1);",
    ],
    esmDirectory,
  );
  run(
    node,
    [
      '--eval',
      "const { CacheProxyModule, defineCachePolicy } = require('nestjs-cache-proxy'); const { createTestCache, TestCacheOperationType } = require('nestjs-cache-proxy/testing'); if (typeof defineCachePolicy !== 'function' || typeof CacheProxyModule.forFeature !== 'function' || typeof createTestCache !== 'function' || TestCacheOperationType.GET !== 'get') process.exit(1);",
    ],
    cjsDirectory,
  );

  await writeFile(
    join(esmDirectory, 'index.ts'),
    "import { CacheProxyModule, cachedProvider, defineCachePolicy } from 'nestjs-cache-proxy';\nimport { buildPolicyCacheKey, createTestCache, TestCacheOperationType } from 'nestjs-cache-proxy/testing';\ninterface Provider { findById(id: string): Promise<string>; }\nclass DefaultProvider implements Provider { findById(id: string): Promise<string> { return Promise.resolve(id); } }\nconst policy = defineCachePolicy<Provider>()({ resources: { byId: { method: 'findById', version: 1, ttl: 1, key: ([id]) => id } }, methods: { findById: { cache: 'byId' } } });\nconst testCache = createTestCache();\nconst key: string = buildPolicyCacheKey({ args: ['1'], namespace: { application: 'consumer', environment: 'test' }, policy, resource: 'byId' });\nconst operationType: TestCacheOperationType = TestCacheOperationType.GET;\nvoid testCache;\nvoid key;\nvoid operationType;\ncachedProvider({ provide: 'provider', useClass: DefaultProvider, policy });\nCacheProxyModule.forRoot({ namespace: { application: 'consumer', environment: 'test' } });\nCacheProxyModule.forFeature([{ provide: 'provider', useClass: DefaultProvider, policy }]);\n",
  );
  const tsc = resolve(packageDirectory, 'node_modules/typescript/bin/tsc');
  run(
    node,
    [
      tsc,
      '--noEmit',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2022',
      '--types',
      'node',
      'index.ts',
    ],
    esmDirectory,
  );
} finally {
  await Promise.all([
    esmDirectory === ''
      ? Promise.resolve()
      : rm(esmDirectory, { force: true, recursive: true }),
    cjsDirectory === ''
      ? Promise.resolve()
      : rm(cjsDirectory, { force: true, recursive: true }),
    rm(join(packageDirectory, 'LICENSE'), { force: true }),
    rm(join(packageDirectory, 'README.md'), { force: true }),
  ]);
}
