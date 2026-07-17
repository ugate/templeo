'use strict';

const { after, describe, test } = require('node:test');
const { PLAN, TEST_TKO } = require('./code/_main.js');
const Tester = require('./code/files');

const plan = `${PLAN} Files`;

describe(plan, { concurrency: false }, () => {
  after(Tester.after);

  test(`${plan}: HTML (cache)`, { timeout: TEST_TKO }, Tester.htmlPartialReadCache);
  test(`${plan}: HTML (no-cache)`, { timeout: TEST_TKO }, Tester.htmlPartialReadNoCache);
  test(`${plan}: HTML (cache w/register)`, { timeout: TEST_TKO }, Tester.htmlCacheWithRegisterPartials);
  test(`${plan}: HTML (render-time cache)`, { timeout: TEST_TKO }, Tester.htmlRenderTimePartialReadCache);
  test(`${plan}: HTML (render-time no-cache)`, { timeout: TEST_TKO }, Tester.htmlRenderTimePartialReadNoCache);
  test(`${plan}: HTML (render-time cache read/write)`, { timeout: TEST_TKO }, Tester.htmlRenderTimeReadWrite);
});
