'use strict';

const { afterEach, beforeEach, describe, test } = require('node:test');
const { PLAN, TEST_TKO } = require('./code/_main');
const Tester = require('./code/express');

const plan = `${PLAN} Express`;

describe(plan, { concurrency: false }, () => {
  beforeEach(Tester.beforeEach);
  afterEach(Tester.afterEach);

  test(`${plan}: Default Engine`, { timeout: TEST_TKO }, Tester.defaultEngine);
  test(`${plan}: Default Engine - Partials Fetch From HTTPS Server`, { timeout: TEST_TKO }, Tester.defaultEnginePartialFetchHttpServer);
  test(`${plan}: LevelDB Engine`, { timeout: TEST_TKO }, Tester.levelDbEngine);
  test(`${plan}: Files Engine`, { timeout: TEST_TKO }, Tester.filesEngine);
});
