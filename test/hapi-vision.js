'use strict';

const { Lab, PLAN, TEST_TKO } = require('./code/_main');
const Tester = require('./code/hapi-vision');
const lab = Lab.script();
exports.lab = lab;
// ESM uncomment the following lines...
// TODO : import { Lab, PLAN, TEST_TKO } from './code/_main.mjs';
// TODO : import * as Tester from './code/hapi-vision.mjs';
// TODO : export * as lab from lab;

const plan = `${PLAN} Hapi.js + vision`;

// "node_modules/.bin/lab" test/hapi-vision.js -vi 1

lab.experiment(plan, () => {

  lab.beforeEach(Tester.stopServer);
  lab.afterEach(Tester.stopServer);

  lab.test(`${plan}: Default Engine`, { timeout: TEST_TKO }, Tester.defaultEngine);
  lab.test(`${plan}: Default Engine - Partials Fetch From HTTPS Server`, { timeout: TEST_TKO }, Tester.defaultEnginePartialFetchHttpServer);
  lab.test(`${plan}: LevelDB Engine`, { timeout: TEST_TKO }, Tester.levelDbEngine);
  lab.test(`${plan}: Files Engine`, { timeout: TEST_TKO }, Tester.filesEngine);
});