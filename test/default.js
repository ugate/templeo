'use strict';

const Assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const { PLAN, TEST_TKO, LOGGER } = require('./code/_main.js');
const Tester = require('./code/default');

const plan = `${PLAN} Default`;

describe(plan, { concurrency: false }, () => {
  test(`${plan}: JSON - Engine.create (ERROR not Cachier)`, { timeout: TEST_TKO },
    expectFailure(null, Tester.nonCachierEngineCreate));
  test(`${plan}: JSON - register`, { timeout: TEST_TKO }, Tester.jsonRegisterPartials);
  test(`${plan}: HTML - register`, { timeout: TEST_TKO }, Tester.htmlRegisterPartials);
  test(`${plan}: HTML - registerHelper`, { timeout: TEST_TKO }, Tester.htmlregisterHelper);
  test(`${plan}: HTML - Partials Fetch From HTTPS Server (compile-time)`, { timeout: TEST_TKO }, Tester.htmlPartialsFetchHttpsServerCompiletimeRead);
  test(`${plan}: HTML - Partials Fetch From HTTPS Server (compile-time ERROR missing "options.partialsURL")`, { timeout: TEST_TKO },
    expectFailure('ERR_INVALID_URL', Tester.htmlPartialsFetchHttpsServerCompiletimeReadNoPathError));
  test(`${plan}: HTML - Partials Fetch From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlPartialsFetchHttpsServerRendertimeRead);
  test(`${plan}: HTML - Partials Fetch From HTTPS Server (render-time ERROR missing "options.partialsURL")`, { timeout: TEST_TKO },
    expectFailure('ERR_INVALID_URL', Tester.htmlPartialsFetchHttpsServerRendertimeReadNoPathError));
  test(`${plan}: HTML - Template/Context Fetch From HTTPS Server (compile-time/render-time)`, { timeout: TEST_TKO }, Tester.htmlTmplAndContextFetchHttpsServerRead);
  test(`${plan}: HTML - Include With One URLSearchParams From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlIncludeSearchParamsHttpsServerRead);
  test(`${plan}: HTML - Include With Multiple Same URLSearchParams From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlIncludeMultiSameSearchParamsHttpsServerRead);
  test(`${plan}: HTML - Include With Multiple Different URLSearchParams From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlIncludeMultiDiffSearchParamsHttpsServerRead);
  test(`${plan}: HTML - Include With One URLSearchParams, One JSON Params From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlIncludeOneSearchOneJsonParamsHttpsServerRead);
  test(`${plan}: HTML - Include With Multiple Different JSON Params From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlIncludeMultiDiffJsonParamsHttpsServerRead);
});

function expectFailure(code, func) {
  return async () => {
    await Assert.rejects(func, err => {
      if (LOGGER.info || LOGGER.debug) {
        (LOGGER.debug || LOGGER.info)(`Expected error message received for${code ? ` (code ${err.code})` : ''}: ${err.message}`,
          LOGGER.debug ? err : '');
      }
      Assert.ok(err instanceof Error);
      if (code) Assert.equal(err.code, code);
      return true;
    });
  };
}
