'use strict';

const { expect, Lab, PLAN, TEST_TKO, LOGGER, Engine } = require('./code/_main.js');
const Tester = require('./code/default');
const lab = Lab.script();
exports.lab = lab;
// ESM uncomment the following lines...
// TODO : import { expect, Lab, PLAN, TEST_TKO, LOGGER, Engine } from './code/_main.mjs';
// TODO : import * as Tester from './code/default.mjs';
// TODO : export * as lab from lab;

const plan = `${PLAN} Default`;

// "node_modules/.bin/lab" test/default.js -vi 1

lab.experiment(plan, () => {

  lab.test(`${plan}: JSON - register`, { timeout: TEST_TKO }, Tester.jsonRegisterPartials);
  lab.test(`${plan}: HTML - register`, { timeout: TEST_TKO }, Tester.htmlRegisterPartials);
  lab.test(`${plan}: HTML - registerHelper`, { timeout: TEST_TKO }, Tester.htmlregisterHelper);
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server (compile-time)`, { timeout: TEST_TKO }, Tester.htmlPartialsFetchHttpsServerCompiletimeRead);
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server (compile-time ERROR missing "options.partialsURL")`, { timeout: TEST_TKO }, flags => {
    return new Promise(resolve => {
      flags.onUnhandledRejection = err => {
        if (LOGGER.info || LOGGER.debug) {
          (LOGGER.debug || LOGGER.info)(`Expected error message received for: ${err.message}`, LOGGER.debug ? err : '');
        }
        expect(err).to.be.error();
        expect(err.code).to.equal('ERR_INVALID_URL');
        resolve();
      };
      return Tester.htmlPartialsFetchHttpsServerCompiletimeReadNoPathError();
    });
  });
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlPartialsFetchHttpsServerRendertimeRead);
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server (render-time ERROR missing "options.partialsURL")`, { timeout: TEST_TKO }, flags => {
    return new Promise(resolve => {
      flags.onUnhandledRejection = err => {
        if (LOGGER.info || LOGGER.debug) {
          (LOGGER.debug || LOGGER.info)(`Expected error message received for (code ${err.code}): ${err.message}`, LOGGER.debug ? err : '');
        }
        expect(err).to.be.error();
        expect(err.code).to.equal('ERR_INVALID_URL');
        resolve();
      };
      return Tester.htmlPartialsFetchHttpsServerRendertimeReadNoPathError();
    });
  });
  lab.test(`${plan}: HTML - Template/Context Fetch From HTTPS Server (compile-time/render-time)`, { timeout: TEST_TKO }, Tester.htmlTmplAndContextFetchHttpsServerRead);
  lab.test(`${plan}: HTML - Include With One URLSearchParams From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlIncludeSearchParamsHttpsServerRead);
  lab.test(`${plan}: HTML - Include With Multiple Same URLSearchParams From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlIncludeMultiSameSearchParamsHttpsServerRead);
  lab.test(`${plan}: HTML - Include With Multiple Different URLSearchParams From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlIncludeMultiDiffSearchParamsHttpsServerRead);
  lab.test(`${plan}: HTML - Include With One URLSearchParams, One JSON Params From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlIncludeOneSearchOneJsonParamsHttpsServerRead);
  lab.test(`${plan}: HTML - Include With Multiple Different JSON Params From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlIncludeMultiDiffJsonParamsHttpsServerRead);
  lab.test(`${plan}: JSON - Engine.create (ERROR not Cachier)`, { timeout: TEST_TKO }, flags => {
    return new Promise(resolve => {
      flags.onUncaughtException = err => {
        if (LOGGER.info || LOGGER.debug) {
          (LOGGER.debug || LOGGER.info)(`Expected error message received for: ${err.message}`, LOGGER.debug ? err : '');
        }
        expect(err).to.be.error();
        resolve();
      };
      setTimeout(() => Engine.create({}));
    });
  });
});