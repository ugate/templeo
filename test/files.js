'use strict';

const { Lab, PLAN, TEST_TKO } = require('./code/_main.js');
const tester = require('./code/files');
const lab = Lab.script();
exports.lab = lab;
// ESM uncomment the following lines...
// TODO : import { Lab, PLAN, TEST_TKO } from './_main.mjs';
// TODO : import * as tester from './code/files.mjs';
// TODO : export * as lab from lab;

const plan = `${PLAN} Files`;

// "node_modules/.bin/lab" test/files.js -vi 4

lab.experiment(plan, () => {

  lab.after(async () => {
    return tester.close(); // cleanup temp files
  });

  lab.test(`${plan}: HTML (cache)`, { timeout: TEST_TKO }, async flags => {
    return tester.testHtmlCache();
  });

  lab.test(`${plan}: HTML (no-cache)`, { timeout: TEST_TKO }, async flags => {
    return tester.testHtmlNoCache()
  });

  lab.test(`${plan}: HTML (cache w/watch)`, { timeout: TEST_TKO }, async flags => {
    return tester.testHtmlCacheWithWatch();
  });

  lab.test(`${plan}: HTML (cache w/registerPartials)`, { timeout: TEST_TKO }, async flags => {
    return tester.testHtmlCacheWithRegisterPartials();
  });
});