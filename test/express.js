'use strict';

const { Lab, PLAN, TEST_TKO } = require('./code/_main');
const Tester = require('./code/express');
const lab = Lab.script();
exports.lab = lab;
// ESM uncomment the following lines...
// TODO : import { Lab, PLAN, TEST_TKO } from './code/_main.mjs';
// TODO : import * as Tester from './code/express.mjs';
// TODO : export * as lab from lab;

const plan = `${PLAN} Express`;

// "node_modules/.bin/lab" test/express.js -vi 1

lab.experiment(plan, () => {

  /*lab.beforeEach(Tester.beforeEach);
  lab.afterEach(Tester.afterEach);

  /*lab.test(`${plan}: Default Engine`, { timeout: TEST_TKO }, Tester.defaultEngine);
  lab.test(`${plan}: Default Engine - Partials Fetch From HTTPS Server`, { timeout: TEST_TKO }, Tester.defaultEnginePartialFetchHttpServer);*/
  lab.test(`${plan}: LevelDB Engine`, { timeout: TEST_TKO }, Tester.levelDbEngine);
  lab.test(`${plan}: Files Engine`, { timeout: TEST_TKO }, Tester.filesEngine);
});