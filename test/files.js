'use strict';

import { after, describe, test } from 'node:test';
import { PLAN, TEST_TKO } from './code/_main.js';
import Tester from './code/files.js';

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
