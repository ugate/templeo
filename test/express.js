'use strict';

import { afterEach, beforeEach, describe, test } from 'node:test';
import { PLAN, TEST_TKO } from './code/_main.js';
import Tester from './code/express.js';

const plan = `${PLAN} Express`;

describe(plan, { concurrency: false }, () => {
  beforeEach(Tester.beforeEach);
  afterEach(Tester.afterEach);

  test(`${plan}: Default Engine`, { timeout: TEST_TKO }, Tester.defaultEngine);
  test(`${plan}: Default Engine - Partials Fetch From HTTPS Server`, { timeout: TEST_TKO }, Tester.defaultEnginePartialFetchHttpServer);
  test(`${plan}: LevelDB Engine`, { timeout: TEST_TKO }, Tester.levelDbEngine);
  test(`${plan}: Files Engine`, { timeout: TEST_TKO }, Tester.filesEngine);
});
