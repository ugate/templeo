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

  lab.test(`${plan}: JSON - registerPartials`, { timeout: TEST_TKO }, Tester.jsonRegisterPartials);
  lab.test(`${plan}: HTML - registerPartials`, { timeout: TEST_TKO }, Tester.htmlRegisterPartials);
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server (compile-time)`, { timeout: TEST_TKO }, Tester.htmlPartialsFetchHttpsServerCompiletimeRead);
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server (compile-time ERROR missing "options.templatePathBase")`, { timeout: TEST_TKO }, flags => {
    return new Promise(resolve => {
      flags.onUnhandledRejection = err => {
        if (LOGGER.info) LOGGER.info(`Expected error message received for: ${err.message}`, err);
        expect(err).to.be.error();
        expect(err.code).to.equal('ERR_INVALID_URL');
        resolve();
      };
      return Tester.htmlPartialsFetchHttpsServerCompiletimeReadNoPathError();
    });
  });
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server (render-time)`, { timeout: TEST_TKO }, Tester.htmlPartialsFetchHttpsServerRendertimeRead);
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server (render-time ERROR missing "options.templatePathBase")`, { timeout: TEST_TKO }, flags => {
    return new Promise(resolve => {
      flags.onUnhandledRejection = err => {
        if (LOGGER.info) LOGGER.info(`Expected error message received for: ${err.message}`, err);
        expect(err).to.be.error();
        expect(err.code).to.equal('ERR_INVALID_URL');
        resolve();
      };
      return Tester.htmlPartialsFetchHttpsServerRendertimeReadNoPathError();
    });
  });
  lab.test(`${plan}: HTML - Template/Context Fetch From HTTPS Server (compile-time/render-time)`, { timeout: TEST_TKO }, Tester.htmlTmplAndContextFetchHttpsServerRead);
  lab.test(`${plan}: JSON - Engine.create (ERROR not Cachier)`, { timeout: TEST_TKO }, flags => {
    return new Promise(resolve => {
      flags.onUncaughtException = err => {
        if (LOGGER.info) LOGGER.info(`Expected error message received for: ${err.message}`, err);
        expect(err).to.be.error();
        resolve();
      };
      setTimeout(() => Engine.create({}));
    });
  });
});