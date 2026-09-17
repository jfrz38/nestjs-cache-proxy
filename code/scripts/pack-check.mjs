import { execFileSync } from 'node:child_process';
import {
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageDirectory = resolve(scriptDirectory, '..');
const artifactsDirectory = join(packageDirectory, '.artifacts');
const consumerFixture = join(
  packageDirectory,
  'fixtures',
  'package-consumer',
  'index.ts',
);
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const node = process.execPath;
const maxTarballSize = 1_000_000;
const requiredFiles = new Set([
  'LICENSE',
  'README.md',
  'package.json',
  'dist/index.cjs',
  'dist/index.cjs.map',
  'dist/index.d.ts',
  'dist/index.js',
  'dist/index.js.map',
  'dist/testing/index.cjs',
  'dist/testing/index.cjs.map',
  'dist/testing/index.d.ts',
  'dist/testing/index.js',
  'dist/testing/index.js.map',
]);
const forbiddenPathPrefixes = [
  'src/',
  'tests/',
  'scripts/',
  'fixtures/',
  'examples/',
  'docs/',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
];
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /(?:npm|github|ghp)_[A-Za-z0-9_-]{20,}/u,
  /AKIA[0-9A-Z]{16}/u,
];

/** @param {string} command @param {string[]} args @param {string} cwd */
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

/** @param {string} path */
function toTarPath(path) {
  if (process.platform !== 'win32') {
    return path;
  }
  return `/${path.slice(0, 1).toLowerCase()}${path.slice(2)}`.replaceAll(
    '\\',
    '/',
  );
}

/** @param {string} cwd */
function getPackedManifest(cwd) {
  const output =
    process.platform === 'win32'
      ? execFileSync(
          process.env.ComSpec ?? 'cmd.exe',
          ['/d', '/s', '/c', 'pnpm --reporter silent pack --dry-run --json'],
          { cwd, encoding: 'utf8' },
        )
      : execFileSync(
          pnpm,
          ['--reporter', 'silent', 'pack', '--dry-run', '--json'],
          {
            cwd,
            encoding: 'utf8',
          },
        );
  /** @type {unknown} */
  const parsed = JSON.parse(output.trim());
  if (Array.isArray(parsed)) {
    /** @type {unknown} */
    const firstManifest = parsed[0];
    return firstManifest;
  }
  return parsed;
}

/** @param {unknown} value */
function isRecord(value) {
  return typeof value === 'object' && value !== null;
}

/** @param {unknown} manifest */
function packedPaths(manifest) {
  if (!isRecord(manifest) || !('files' in manifest)) {
    throw new Error('pnpm pack --dry-run did not return a file manifest.');
  }
  const { files } = manifest;
  if (!Array.isArray(files)) {
    throw new Error('pnpm pack --dry-run returned an invalid files field.');
  }
  return files.map((file) => {
    if (typeof file === 'string') {
      return file;
    }
    if (isRecord(file) && 'path' in file) {
      const { path } = file;
      return String(path);
    }
    throw new Error('pnpm pack --dry-run returned an invalid file entry.');
  });
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
          '@keyv/redis': '5.1.6',
          cacheable: '2.5.0',
          'cache-manager': cacheManagerVersion,
          keyv: '5.6.0',
          '@jfrz38/nestjs-cache-proxy': `file:${tarball}`,
          rxjs: '7.8.2',
        },
        devDependencies: { '@types/node': '24.10.1' },
        private: true,
        type,
      },
      null,
      2,
    )}\n`,
  );
  return directory;
}

/** @param {string[]} paths */
function verifyManifest(paths) {
  for (const requiredFile of requiredFiles) {
    if (!paths.includes(requiredFile)) {
      throw new Error(`Tarball is missing required file: ${requiredFile}`);
    }
  }
  for (const path of paths) {
    if (
      forbiddenPathPrefixes.some(
        (prefix) => path === prefix || path.startsWith(prefix),
      )
    ) {
      throw new Error(`Tarball unexpectedly includes ${path}`);
    }
  }
}

/** @param {string} extractedDirectory */
async function verifyExtractedPackage(extractedDirectory) {
  const packageRoot = join(extractedDirectory, 'package');
  /** @type {unknown} */
  const packageJson = JSON.parse(
    await readFile(join(packageRoot, 'package.json'), 'utf8'),
  );
  if (!isRecord(packageJson) || packageJson.version !== '0.1.0') {
    throw new Error('Packaged package.json does not declare version 0.1.0.');
  }
  const { exports: packageExports } = packageJson;
  if (
    !isRecord(packageExports) ||
    Object.keys(packageExports).join(',') !== '.,./testing,./package.json'
  ) {
    throw new Error(
      'Tarball exports do not match the public entry-point allowlist.',
    );
  }

  const declarationFiles = [
    join(packageRoot, 'dist', 'index.d.ts'),
    join(packageRoot, 'dist', 'testing', 'index.d.ts'),
  ];
  for (const declarationFile of declarationFiles) {
    const declaration = await readFile(declarationFile, 'utf8');
    if (
      /from ['"]\.\/(?:application|domain|infrastructure)\//u.test(
        declaration,
      ) ||
      /\b(?:CacheAsideExecutor|CachePolicyCompiler|CacheProxyFactory)\b/u.test(
        declaration,
      )
    ) {
      throw new Error(
        `Declaration audit found an internal dependency in ${declarationFile}.`,
      );
    }
  }

  const entries = await readdir(packageRoot, { recursive: true });
  for (const entry of entries) {
    const path = String(entry);
    const fullPath = join(packageRoot, path);
    if ((await stat(fullPath)).isFile()) {
      const content = await readFile(fullPath, 'utf8');
      if (secretPatterns.some((pattern) => pattern.test(content))) {
        throw new Error(`Potential secret found in tarball file: ${path}`);
      }
    }
  }
}

let tarball = '';
let esmDirectory = '';
let cjsDirectory = '';
let extractedDirectory = '';

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
  if ((await stat(tarball)).size > maxTarballSize) {
    throw new Error(
      `Tarball exceeds the ${maxTarballSize}-byte release limit.`,
    );
  }

  verifyManifest(packedPaths(getPackedManifest(packageDirectory)));
  extractedDirectory = await mkdtemp(
    join(tmpdir(), 'nestjs-cache-proxy-tarball-'),
  );
  run(
    'tar',
    ['-xzf', toTarPath(tarball), '-C', toTarPath(extractedDirectory)],
    packageDirectory,
  );
  await verifyExtractedPackage(extractedDirectory);

  esmDirectory = await createConsumer('module');
  cjsDirectory = await createConsumer('commonjs');
  runPnpm(['install', '--ignore-scripts', '--no-lockfile'], esmDirectory);
  runPnpm(['install', '--ignore-scripts', '--no-lockfile'], cjsDirectory);

  run(
    node,
    [
      '--input-type=module',
      '--eval',
      "import { CacheProxyModule, defineCachePolicy } from '@jfrz38/nestjs-cache-proxy'; import { createTestCache, TestCacheOperationType } from '@jfrz38/nestjs-cache-proxy/testing'; if (typeof defineCachePolicy !== 'function' || typeof CacheProxyModule.forRoot !== 'function' || typeof createTestCache !== 'function' || TestCacheOperationType.GET !== 'get') process.exit(1);",
    ],
    esmDirectory,
  );
  run(
    node,
    [
      '--eval',
      "const { CacheProxyModule, defineCachePolicy } = require('@jfrz38/nestjs-cache-proxy'); const { createTestCache, TestCacheOperationType } = require('@jfrz38/nestjs-cache-proxy/testing'); if (typeof defineCachePolicy !== 'function' || typeof CacheProxyModule.forFeature !== 'function' || typeof createTestCache !== 'function' || TestCacheOperationType.GET !== 'get') process.exit(1);",
    ],
    cjsDirectory,
  );
  run(
    node,
    [
      '--input-type=module',
      '--eval',
      "import('@jfrz38/nestjs-cache-proxy/dist/index.js').then(() => process.exit(1), (error) => { if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') process.exit(1); });",
    ],
    esmDirectory,
  );

  await cp(consumerFixture, join(esmDirectory, 'index.ts'));
  const tsc = resolve(packageDirectory, 'node_modules/typescript/bin/tsc');
  run(
    node,
    [
      tsc,
      '--noEmit',
      '--experimentalDecorators',
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
    extractedDirectory === ''
      ? Promise.resolve()
      : rm(extractedDirectory, { force: true, recursive: true }),
    rm(join(packageDirectory, 'LICENSE'), { force: true }),
    rm(join(packageDirectory, 'README.md'), { force: true }),
  ]);
}
