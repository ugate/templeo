'use strict';

const { Lab, PLAN, TEST_TKO } = require('./code/_main.js');
const Tester = require('./code/db');
const lab = Lab.script();
exports.lab = lab;
// ESM uncomment the following lines...
// TODO : import { Lab, PLAN, TEST_TKO } from './code/_main.mjs';
// TODO : import * as Tester from './code/db.mjs';
// TODO : export * as lab from lab;

const plan = `${PLAN} IndexedDB`;

// "node_modules/.bin/lab" test/db.js -vi 1

lab.experiment(plan, () => {

  lab.before(Tester.before);
  lab.after(Tester.after);

  lab.test(`${plan}: HTML/LevelDB from register (compile-time write)`, { timeout: TEST_TKO }, Tester.levelDbFromRegisterPartialsComileTimeWrite);
  lab.test(`${plan}: HTML/LevelDB from partials in DB (compile-time read)`, { timeout: TEST_TKO }, Tester.levelDbFromPartialsInDbCompileTimeRead);
  lab.test(`${plan}: HTML/LevelDB from partials in DB default policy (render-time read)`, { timeout: TEST_TKO }, Tester.levelDbFromPartialsInDbRenderTimeRead);
  lab.test(`${plan}: HTML/LevelDB from partials in DB "read-and-close" policy (render-time read)`,
    { timeout: TEST_TKO }, Tester.levelDbFromPartialsInDbRenderTimeReadAndClose);
  lab.test(`${plan}: HTML/LevelDB from partials in DB with search parameters (render-time read)`,
    { timeout: TEST_TKO }, Tester.levelDbFromPartialsInDbRenderTimeReadWithSearchParams);
  lab.test(`${plan}: HTML/LevelDB from partials in DB with registered search parameters (render-time read)`,
    { timeout: TEST_TKO }, Tester.levelDbFromPartialsInDbRenderTimeReadWithRegisteredSearchParams);
  lab.test(`${plan}: HTML/LevelDB write template, context and partials (compile-time write)`, { timeout: TEST_TKO }, Tester.levelDbWriteAll);
  lab.test(`${plan}: HTML/LevelDB read template, context and partials (compile-time read)`, { timeout: TEST_TKO }, Tester.levelDbReadFromWriteAll);
  lab.test(`${plan}: HTML/LevelDB read template, context and partials (render-time read)`, { timeout: TEST_TKO }, Tester.levelDbRenderReadFromWriteAll);
});