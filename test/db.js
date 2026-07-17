'use strict';

import { after, before, describe, test } from 'node:test';
import { PLAN, TEST_TKO } from './code/_main.js';
import Tester from './code/db.js';

const plan = `${PLAN} IndexedDB`;

describe(plan, { concurrency: false }, () => {
  before(Tester.before);
  after(Tester.after);

  test(`${plan}: HTML/LevelDB from register (compile-time write)`, { timeout: TEST_TKO }, Tester.levelDbFromRegisterPartialsComileTimeWrite);
  test(`${plan}: HTML/LevelDB from partials in DB (compile-time read)`, { timeout: TEST_TKO }, Tester.levelDbFromPartialsInDbCompileTimeRead);
  test(`${plan}: HTML/LevelDB from partials in DB default policy (render-time read)`, { timeout: TEST_TKO }, Tester.levelDbFromPartialsInDbRenderTimeRead);
  test(`${plan}: HTML/LevelDB from partials in DB "read-and-close" policy (render-time read)`,
    { timeout: TEST_TKO }, Tester.levelDbFromPartialsInDbRenderTimeReadAndClose);
  test(`${plan}: HTML/LevelDB from partials in DB with search parameters (render-time read)`,
    { timeout: TEST_TKO }, Tester.levelDbFromPartialsInDbRenderTimeReadWithSearchParams);
  test(`${plan}: HTML/LevelDB from partials in DB with registered search parameters (render-time read)`,
    { timeout: TEST_TKO }, Tester.levelDbFromPartialsInDbRenderTimeReadWithRegisteredSearchParams);
  test(`${plan}: HTML/LevelDB write template, context and partials (compile-time write)`, { timeout: TEST_TKO }, Tester.levelDbWriteAll);
  test(`${plan}: HTML/LevelDB read template, context and partials (compile-time read)`, { timeout: TEST_TKO }, Tester.levelDbReadFromWriteAll);
  test(`${plan}: HTML/LevelDB read template, context and partials (render-time read)`, { timeout: TEST_TKO }, Tester.levelDbRenderReadFromWriteAll);
});
