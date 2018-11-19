'use strict';

const { expect, Lab, PLAN, TASK_DELAY, TEST_TKO, ENGINE_LOGGER, LOGGER, httpServer, Engine, JsonEngine, Cache, JsFrmt, getTemplate } = require('./_main');
/* const lab = exports.lab = Lab.script();
// ESM uncomment the following lines...
// import { expect, Lab, PLAN, TASK_DELAY, TEST_TKO, ENGINE_LOGGER, LOGGER, httpServer, Engine, JsonEngine, Cache } from './_main.mjs';

const plan = `${PLAN} Background`;

// "node_modules/.bin/lab" test/basic.js -vi 1

lab.experiment(plan, () => {

  lab.test(`${plan}: waiter, delayed error`, { timeout: TEST_TKO }, async (flags) => {
    const html = (await getTemplate('./test/views/minimal.html')).toString();
    const data = JSON.parse((await getTemplate('./test/data/meta.json')).toString());
    const eng = new Engine({ logger: ENGINE_LOGGER }, new Cache(null, JsFrmt, false));
    const fn = await eng.compile(html, {
      path: 'test/views',
      partialsPath: 'test/views/partials'
    });

    expect(fn).to.be.function();

    console.log(fn, fn(data));
  });
}); */

(async (flags) => {
  const html = (await getTemplate('./test/views/minimal.html')).toString();
  const data = JSON.parse((await getTemplate('./test/data/meta.json')).toString());
  const eng = new Engine({ logger: ENGINE_LOGGER }, new Cache(null, JsFrmt, false));
  const fn = await eng.compile(html, {
    path: 'test/views',
    partialsPath: 'test/views/partials'
  });

  expect(fn).to.be.function();

  console.log(fn, fn(data));
})();