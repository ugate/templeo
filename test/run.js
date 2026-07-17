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
  'test/db.js',
  'test/default.js',
  'test/express.js',
  'test/files.js'
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
