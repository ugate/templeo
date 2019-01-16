'use strict';

const { expect, Lab, PLAN, TEST_TKO, LOGGER } = require('./code/_main.js');
const Tester = require('./code/default');
const lab = Lab.script();
exports.lab = lab;
// ESM uncomment the following lines...
// TODO : import { expect, Lab, PLAN, TEST_TKO, LOGGER } from './code/_main.mjs';
// TODO : import * as Tester from './code/default.mjs';
// TODO : export * as lab from lab;

const plan = `${PLAN} Default`;

// "node_modules/.bin/lab" test/default.js -vi 1

lab.experiment(plan, () => {

  lab.test(`${plan}: HTML - registerPartials`, { timeout: TEST_TKO }, Tester.htmlRegisterPartials);
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server (compile-time)`, { timeout: TEST_TKO }, Tester.htmlPartialsFetchHttpsServerCompiletimeRead);
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server (compile-time ERROR missing "options.pathBase")`, { timeout: TEST_TKO }, flags => {
    return new Promise(resolve => {
      flags.onUnhandledRejection = err => {
        expect(err).to.be.error();
        if (LOGGER.info) LOGGER.info(`Expected error message received for: ${err.message}`);
        resolve();
      };
      return Tester.htmlPartialsFetchHttpsServerCompiletimeReadNoPathError();
    });
  });
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server (runtime)`, { timeout: TEST_TKO }, Tester.htmlPartialsFetchHttpsServerRuntimeRead);
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server (runtime ERROR missing "options.pathBase")`, { timeout: TEST_TKO }, flags => {
    return new Promise(resolve => {
      flags.onUnhandledRejection = err => {
        expect(err).to.be.error();
        expect(err.code).to.equal('ERR_INVALID_URL');
        if (LOGGER.info) LOGGER.info(`Expected error message received for: ${err.message}`);
        resolve();
      };
      return Tester.htmlPartialsFetchHttpsServerRuntimeReadNoPathError();
    });
  });
});