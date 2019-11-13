'use strict';

const { Lab, PLAN, TEST_TKO } = require('./code/_main.js');
const Tester = require('./code/files');
const lab = Lab.script();
exports.lab = lab;
// ESM uncomment the following lines...
// TODO : import { Lab, PLAN, TEST_TKO } from './_main.mjs';
// TODO : import * as Tester from './code/files.mjs';
// TODO : export * as lab from lab;

const plan = `${PLAN} Files`;

// "node_modules/.bin/lab" test/files.js -vi 4

lab.experiment(plan, () => {

  lab.after(Tester.after); // cleanup temp files

  lab.test(`${plan}: HTML (cache)`, { timeout: TEST_TKO }, Tester.htmlPartialReadCache);
  lab.test(`${plan}: HTML (no-cache)`, { timeout: TEST_TKO }, Tester.htmlPartialReadNoCache);
  lab.test(`${plan}: HTML (cache w/register)`, { timeout: TEST_TKO }, Tester.htmlCacheWithRegisterPartials);
  // TODO: lab.test(`${plan}: HTML (cache w/watch)`, { timeout: TEST_TKO }, Tester.htmlCacheWithWatch);
  lab.test(`${plan}: HTML (render-time cache)`, { timeout: TEST_TKO }, Tester.htmlRenderTimePartialReadCache);
  lab.test(`${plan}: HTML (render-time no-cache)`, { timeout: TEST_TKO }, Tester.htmlRenderTimePartialReadNoCache);
  lab.test(`${plan}: HTML (render-time cache read/write)`, { timeout: TEST_TKO }, Tester.htmlRenderTimeReadWrite);
  // TODO: lab.test(`${plan}: HTML (render-time w/watch)`, { timeout: TEST_TKO }, Tester.htmlRenderTimeCacheWithWatch);
});