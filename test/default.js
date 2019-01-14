'use strict';

const { Lab, PLAN, TEST_TKO } = require('./code/_main.js');
const Tester = require('./code/default');
const lab = Lab.script();
exports.lab = lab;
// ESM uncomment the following lines...
// TODO : import { Lab, PLAN, TEST_TKO } from './code/_main.mjs';
// TODO : import * as Tester from './code/default.mjs';
// TODO : export * as lab from lab;

const plan = `${PLAN} Default`;

// "node_modules/.bin/lab" test/default.js -vi 1

lab.experiment(plan, () => {

  lab.test(`${plan}: HTML - registerPartials`, { timeout: TEST_TKO }, Tester.htmlRegisterPartials);
  lab.test(`${plan}: HTML - Partials Names Content Fetch From HTTPS Server`, { timeout: TEST_TKO }, Tester.htmlWithPartialNamesFetchHttpServer);
  lab.test(`${plan}: HTML - Partials Fetch From HTTPS Server`, { timeout: TEST_TKO }, Tester.htmlPartialsFetchHttpServer);
});