'use strict';

const { expect, LOGGER, Engine, JsFrmt, Main, JSDOM } = require('./_main.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, JsFrmt, Main, JSDOM } from './_main.mjs';

// DEBUGGING:
// Use the following:
// node --inspect-brk test/code/default.js
// ...or with optional test function name appended to the end:
// node --inspect-brk test/code/default.js htmlRegisterPartials

const params = {
  hello: 'world',
  performing: 'tests for parameter values!'
};
const params2 = {
  someParam: 'someParamValue'
};

// TODO : ESM uncomment the following line...
// export
class Tester {

  static async jsonRegisterPartials() {
    const opts = baseOptions();
    opts.compile.defaultExtension = 'json'; // testing json 
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    const partials = await Main.getFiles(Main.PATH_JSON_PARTIALS_DIR);
    return Main.baseTest(opts.compile, engine, partials, true, opts.render);
  }

  static async htmlRegisterPartials() {
    const opts = baseOptions();
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR);
    return Main.baseTest(opts.compile, engine, partials, true, opts.render);
  }

  static async htmlregisterHelper() {
    const opts = baseOptions();
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);

    const template = '<html><body>${ hasPerson(it) }</body></html>';
    engine.registerHelper(function hasPerson(it) {
      if (it.person && it.person.name) {
        return `<h1> Hello ${ it.person.name }! </h3>`;
      } else {
        return `<input id="personName" placeholder="Please enter your name">`;
      }
    });

    const renderer = await engine.compile(template);

    const contexts = [{ person: { name: 'World' } }, {}];
    let rslt, dom, els, label;
    for (let ctx of contexts) {
      rslt = await renderer(ctx);
      if (LOGGER.info) LOGGER.info(template, '\nRESULTS:', rslt);
      dom = new JSDOM(rslt);
      label = `Person ${ ctx.person ? 'H1' : 'input' } element`;
      if (ctx.person) {
        els = dom.window.document.getElementsByTagName('h1');
        expect(els, label).to.not.be.null();
        expect(els.length, label).to.be.equal(1);
        expect(els[0].innerHTML.trim(), label).to.be.equal('Hello World!');
      } else {
        els = dom.window.document.getElementById('personName');
        expect(els, label).to.not.be.null();
        expect(els.placeholder, label).to.be.equal('Please enter your name');
      }
    }
  }

  static async htmlPartialsFetchHttpsServerCompiletimeRead() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      opts.compile.templatePathBase = svr.url; // partials will be served from this URL during compile-time
      const engine = new Engine(opts.compile, JsFrmt, LOGGER);
      // partials should be fetched via the HTTPS server during compilation via the cache read/fetch
      const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR, false); // false will only return the partial names w/o content
      await Main.baseTest(opts.compile, engine, partials, true, opts.render); // true to registerPartials at compile-time
    } finally {
      await svr.close();
    }
  }

  static async htmlPartialsFetchHttpsServerCompiletimeReadNoPathError() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      const engine = new Engine(opts.compile, JsFrmt, LOGGER);
      const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR, false); // false will only return the partial names w/o content
      await Main.baseTest(opts.compile, engine, partials, true, opts.render); // true to registerPartials at compile-time
    } finally {
      await svr.close();
    }
  }

  static async htmlPartialsFetchHttpsServerRendertimeRead() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      const context = { dynamicIncludeURL: `${svr.url}text.html` }; // test include from context value
      opts.render.templatePathBase = svr.url; // partials will be served from this URL during render-time
      const engine = new Engine(opts.compile, JsFrmt, LOGGER);
      // partials should be fetched via the HTTPS server when includes are encountered during rendering
      await Main.baseTest(opts.compile, engine, null, false, opts.render, context); // false to prevent compile-time registerPartials
    } finally {
      await svr.close();
    }
  }

  static async htmlPartialsFetchHttpsServerRendertimeReadNoPathError() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      const engine = new Engine(opts.compile, JsFrmt, LOGGER);
      // partials should be fetched via the HTTPS server when includes are encountered during rendering
      await Main.baseTest(opts.compile, engine, null, false, opts.render); // false to prevent compile-time registerPartials
    } finally {
      await svr.close();
    }
  }

  static async htmlTmplAndContextFetchHttpsServerRead() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      // read/load both the template.html and context.json from the HTTPS server
      opts.compile.templatePathBase = svr.url;
      opts.compile.contextPathBase = svr.url;

      const engine = new Engine(opts.compile);
      const renderer = await engine.compile();
      const rslt = await renderer();

      const files = await Main.getTemplateFiles();
      Main.expectDOM(rslt, files.htmlContext);
    } finally {
      await svr.close();
    }
  }

  static htmlIncludeSearchParamsHttpsServerRead() {
    return paramsTest({
      label: 'Params = Single Search Param',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) }\` }</body></html>`,
      cases: {
        params,
        search: { name: 'text', paramCount: 1, callCount: 1 },
        usesIncludeParams: false
      }
    });
  }

  static htmlIncludeMultiSameSearchParamsHttpsServerRead() {
    return paramsTest({
      label: 'Params = Multiple Same Search Params',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) } text \${ new URLSearchParams(${ JSON.stringify(params) }) }\` }</body></html>`,
      cases: [{
        params,
        search: { name: 'text', paramCount: 2, callCount: 1 },
        usesIncludeParams: false
      },
      {
        params,
        // call count should remain the same for 2nd include since it should be cached
        search: { name: 'text', paramCount: 2, callCount: 1 },
        usesIncludeParams: false
      }]
    });
  }

  static htmlIncludeMultiDiffSearchParamsHttpsServerRead() {
    return paramsTest({
      label: 'Params = Multiple Different Search',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) } text \${ new URLSearchParams(${ JSON.stringify(params2) }) }\` }</body></html>`,
      cases: [{
        params,
        search: { name: 'text', paramCount: 1, callCount: 1 },
        usesIncludeParams: false
      },
      {
        params: params2,
        search: { name: 'text', paramCount: 1, callCount: 1 },
        usesIncludeParams: false
      }]
    });
  }

  static htmlIncludeOneSearchOneJsonParamsHttpsServerRead() {
    return paramsTest({
      label: 'Params = Search + JSON',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) } params \${ ${ JSON.stringify(params2) } }\` }</body></html>`,
      cases: [{
        params,
        search: { name: 'text', paramCount: 1, callCount: 1 },
        usesIncludeParams: false
      },
      {
        params: params2
      }]
    });
  }

  static htmlIncludeMultiDiffJsonParamsHttpsServerRead() {
    return paramsTest({
      label: 'Params = Multiple Different JSON',
      template: `<html><body>\${ await include\`params\${ ${ JSON.stringify(params) } }params\${ ${ JSON.stringify(params2) } }\` }</body></html>`,
      cases: [{ params }, { params: params2 }]
    });
  }
}

// TODO : ESM comment the following line...
module.exports = Tester;

// when not ran in a test runner execute static Tester functions (excluding what's passed into Main.run) 
if (!Main.usingTestRunner()) {
  (async () => await Main.run(Tester))();
}

/**
 * Generates test cases to run for `include` parameter detection for both `read`/fetch requests using `URLSearchParams`
 * and scoped resolved parameters that are accessible within the templates themselves
 * @param {Object} test The test metadata
 * @param {String} test.template The template to test
 * @param {Object[]} test.cases One or more test cases that describe the validation that should take place
 * @param {Object} test.cases[].params The parameters that will be checked within the rendered template result. Each
 * property/value in the object represents a key/value pair of parameters to test against
 * @param {Object} [test.cases[].search] The search parmeters to test for. Omit when not using `URLSearchParams`.
 * @param {String} [test.cases[].search.name] The name of the search `include` being tested
 * @param {Integer} [test.cases[].search.paramCount] The number of times that the search parameters should be included
 * in the result
 * @param {Integer} [test.cases[].search.callCount] The number of times the included search should make a request for
 * the content using the provided search parameters
 * @param {Boolean} [test.cases[].usesIncludeParams] Whether or not basic JSON parameters are used
 */
async function paramsTest(test) {
  const idPrefix = 'inclParamFromServer_';
  const opts = baseOptions();
  // uncomment to debug rendering functions:
  //opts.debugger = true;
  const files = await Main.getTemplateFiles();
  
  let els, label = test.label;
  const svr = await Main.httpsServer(opts.compile, idPrefix);
  try {
    opts.render.templatePathBase = svr.url;
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    const renderer = await engine.compile(test.template);
    const rslt = await renderer(files.htmlContext, opts.render);

    if (LOGGER.info) LOGGER.info(test.template, '\nRESULTS:', rslt);
    const dom = new JSDOM(rslt);
    const cases = Array.isArray(test.cases) ? test.cases : [test.cases];

    for (let cased of cases) {
      if (cased.search && cased.search.name && cased.search.callCount) {
        expect(svr.callCount(cased.search.name, cased.params),
          `${label} ${cased.search.name} call count`).to.equal(cased.search.callCount);
      }
      for (let name in cased.params) {
        if (cased.search) {
          // dynamic parameters generated by the server
          label += ` "${idPrefix}${name}" include parameter by name DOM`;
          els = dom.window.document.getElementsByName(`${idPrefix}${name}`);
          expect(els, label).to.not.be.null();
          expect(els.length, `${label} # of elements`).to.equal(cased.search.paramCount);
          for (let ei = 0; ei < cased.search.paramCount; ei++) {
            expect(els[ei], label).to.not.be.null();
            expect(els[ei].value, label).to.equal(cased.params[name]);
          }
        }
        if (!cased.hasOwnProperty('usesIncludeParams') || cased.usesIncludeParams) {
          label += ` "${name}" include parameter by name DOM`;
          // dynamic parameters generated within the partial template itself
          // using the scoped "params"
          els = dom.window.document.getElementsByName(`${name}`);
          expect(els, label).to.not.be.null();
          expect(els.length, `${label} # of elements`).to.equal(1);
          expect(els[0].value, label).to.equal(cased.params[name]);
        }
      }
    }
  } finally {
    await svr.close();
  }
}

function baseOptions() {
  return {
    compile: {
      readFetchRequestOptions: {
        rejectUnauthorized: false
      }
    },
    render: {
      readFetchRequestOptions: {
        rejectUnauthorized: false
      }
    }
  };
}