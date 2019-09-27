'use strict';

const { expect, LOGGER, Engine, HtmlFrmt, JsFrmt, JSDOM, Main } = require('./_main.js');
const CachierDB = require('../../lib/cachier-db.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, HtmlFrmt, JsFrmt, JSDOM, Main } from './_main.mjs';
// TODO : import * as CachierDB from '../../lib/cachier-db.mjs';

var meta, engines = [];

// DEBUGGING: Use the following
// node --inspect-brk test/code/db.js
// LOGGING: Use the following
// node test/code/db.js -NODE_ENV=test
// LOGGING Single Test: Use the following
// node test/code/db.js -NODE_ENV=test <name_of_func_to_run_here>

// TODO : ESM uncomment the following line...
// export
class Tester {

  static async before() {
    meta = await Main.initDB();
  }

  static async after() {
    // close DB connection(s) and clear files on last test
    for (let engine of engines) {
      await Main.clearDB(engine, engine === engines[engines.length - 1]);
    }
  }

  static async levelDbFromRegisterPartialsComileTimeWrite() {
    const opts = baseOptions(meta);
    const cachier = new CachierDB(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    const engine = Engine.create(cachier);
    engines.push(engine);
    const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR);
    // write template and partials to DB at compile-time
    return Main.baseTest({ write: true, writeTemplate: true, writeContext: true, sendTemplate: true, sendContext: true }, opts.compile, engine, partials, opts.render);
  }

  // read DB entries from prior test 
  static async levelDbFromPartialsInDbCompileTimeRead() {
    const opts = baseOptions(meta);
    // partials should still be cached from previous test w/register
    const cachier = new CachierDB(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    const engine = Engine.create(cachier);
    engines.push(engine);
    // read partials from DB at compile-time
    return Main.baseTest({ read: true }, opts.compile, engine, null, opts.render);
  }

  static async levelDbFromPartialsInDbRenderTimeRead() {
    const opts = baseOptions(meta);
    // partials should still be cached from previous test w/register
    const cachier = new CachierDB(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    const engine = Engine.create(cachier);
    engines.push(engine);
    // read partials from DB at render-time
    return Main.baseTest({}, opts.compile, engine, null, opts.render);
  }

  static async levelDbFromPartialsInDbRenderTimeReadAndClose() {
    const opts = baseOptions(meta);
    opts.render.renderTimePolicy = 'read-write-and-close';
    // partials should still be cached from previous test w/register
    const cachier = new CachierDB(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    const engine = Engine.create(cachier);
    engines.push(engine);
    // read partials from DB at render-time
    return Main.baseTest({}, opts.compile, engine, null, opts.render);
  }

  static async levelDbFromPartialsInDbRenderTimeReadWithSearchParams() { // test requires prior DB write from prior tests
    const opts = baseOptions(meta);
    opts.render.readFetchRequestOptions = {
      rejectUnauthorized: false
    };
    const params = {
      searchParam1: 'Search Param 1 VALUE',
      searchParam2: 'Search Param 2 VALUE'
    };
    const cachier = new CachierDB(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    const test = await Main.paramsTest({
      label: 'Params = Single Search Param',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) }\` }</body></html>`,
      cases: {
        params,
        search: { name: 'text', paramCount: 1, callCount: 1 }
      }
    }, opts, null, false, false, cachier);
    engines.push(test.engine);
  }

  static async levelDbFromPartialsInDbRenderTimeReadWithRegisteredSearchParams() {
    const opts = baseOptions(meta);
    const params = {
      registeredSearchParam1: 'Registered Search Param 1 VALUE',
      registeredSearchParam2: 'Registered Search Param 2 VALUE'
    };
    const text = (await Main.getFile(`${Main.PATH_HTML_PARTIALS_DIR}/text.html`, true)).toString();
    const partials = [{
      name: `text?${new URLSearchParams(params).toString()}`,
      content: text
    }];
    const cachier = new CachierDB(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    // write partial to DB, no HTTPS server
    const test = {
      label: 'Params = Single Search Param',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) }\` }</body></html>`,
      cases: {
        params,
        search: { name: 'text', paramText: text }
      }
    };
    // write the test partial to the DB
    await Main.paramsTest(test, opts, partials, false, true, cachier, false);
    engines.push(test.engine);
    if (LOGGER.info) LOGGER.info(`>>>>>>> Checking previously written search params...`);
    // now include the search params again, but read from the DB
    await Main.paramsTest(test, opts, null, true, false, cachier, false);
  }

  static async levelDbWriteAll() {
    const opts = baseOptions(meta);
    const cachier = new CachierDB(opts.compile, null, null, LOGGER);//{ dbLocName: 'my-indexed-db-name', defaultTemplateName: 'main', defaultContextName: 'mainContext' });
    const engine = Engine.create(cachier);
    engines.push(engine);

    // read any partials from the DB (2nd arg passing "true")
    // and write the partials to the DB (3rd arg passing "true")
    await engine.register([{
      name: 'template',
      content: '\
        <ol>\
          <li>${ await include`part1` }</li>\
          <li>${ await include`part2` }</li>\
        </ol>\
      '
    },{
      name: 'part1',
      content: 'First Name: <input id="firstName" value="${it.firstName}">'
    },{
      name: 'part2',
      content: 'Last Name: <input id="lastName" value="${it.lastName}">'
    },{
      name: 'context',
      content: {
        firstName: 'John',
        lastName: 'Doe'
      }
    }], false, true);

    return validateWriteAll(engine);
  }

  static async levelDbReadFromWriteAll() {
    const opts = baseOptions(meta);
    const cachier = new CachierDB(opts.compile, null, null, LOGGER);
    const engine = Engine.create(cachier);
    engines.push(engine);

    // read template, context and partials from the DB (2nd arg passing "true")
    await engine.register(null, true);

    return validateWriteAll(engine);
  }

  static async levelDbRenderReadFromWriteAll() {
    const opts = baseOptions(meta);
    const cachier = new CachierDB(opts.compile, null, null, LOGGER);
    const engine = Engine.create(cachier);
    engines.push(engine);

    // read template, context and partials from the DB (render-time)
    return validateWriteAll(engine, opts.render, true);
  }
}

// TODO : ESM remove the following line...
module.exports = Tester;

// when not ran in a test runner execute static Tester functions (excluding what's passed into Main.run) 
if (!Main.usingTestRunner()) {
  (async () => await Main.run(Tester))();
}

function baseOptions(meta) {
  return {
    compile: {
      dbTypeName: meta.type,
      dbLocName: meta.loc
    },
    render: {
      dbTypeName: meta.type,
      dbLocName: meta.loc
    }
  };
}

/**
 * Validates that the test write to the DB has been successful
 * @param {Engine} engine The template engine
 * @param {Object} [renderOpts] The rendering options
 */
async function validateWriteAll(engine, renderOpts, go) {
  const renderer = await engine.compile();
  const rslt = await renderer(undefined, renderOpts);

  const dom = new JSDOM(rslt);
  const fnm = dom.window.document.querySelector('#firstName'), lnm = dom.window.document.querySelector('#lastName');
  expect(fnm).not.null();
  expect(fnm.value).equal('John');
  expect(lnm).not.null();
  expect(lnm.value).equal('Doe');
}