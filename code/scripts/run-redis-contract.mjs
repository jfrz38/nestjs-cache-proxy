import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const containerName = `nestjs-cache-proxy-${randomUUID()}`;
const image =
  'redis:8.10.1-alpine@sha256:becdda6c7f4b3fb42e42fd7f120bbf5c54c4caaaf16f26da24e4563d2c1f0576';

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').ExecFileSyncOptions} [options]
 */
function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: 'inherit', ...options });
}

/** @param {string} command @param {string[]} args */
function output(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

try {
  run('docker', [
    'run',
    '--detach',
    '--rm',
    '--name',
    containerName,
    '--publish',
    '0:6379',
    image,
  ]);
  const mapping = output('docker', ['port', containerName, '6379/tcp']);
  const port = mapping.slice(mapping.lastIndexOf(':') + 1);
  const redisUrl = `redis://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      run('docker', ['exec', containerName, 'redis-cli', 'ping']);
      break;
    } catch {
      if (attempt === 19) {
        throw new Error('Redis did not become ready within 20 attempts.');
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }

  run(
    process.execPath,
    [
      './node_modules/vitest/vitest.mjs',
      'run',
      'tests/integration/redis/cache-backend.test.ts',
    ],
    {
      env: { ...process.env, REDIS_URL: redisUrl },
    },
  );
} finally {
  try {
    run('docker', ['rm', '--force', containerName]);
  } catch {
    // The container may not have been created or may already have been removed.
  }
}
