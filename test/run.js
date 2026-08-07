'use strict';

import { spawnSync } from 'node:child_process';
import * as Path from 'node:path';

const mode = process.argv[2] || 'prod';
const args = [
  '--test',
  '--test-concurrency=1',
  '--test-reporter=spec',
  '--experimental-test-coverage',
  '--test-coverage-include=index.js',
  '--test-coverage-exclude=lib/**',
  '--test-coverage-lines=60',
  'test/docs.js',
  'test/db.js',
  'test/default.js',
  'test/express.js',
  'test/level-modern.js',
  'test/files.js',
  'test/regressions.js',
  'test/cache-v23.js',
  'test/v3-regressions.js',
  'test/watchers.js',
  'test/browser.js'
];

const result = spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: mode,
    NODE_EXTRA_CA_CERTS: Path.resolve('test/cert/localhost-cert.pem')
  },
  stdio: 'inherit'
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
