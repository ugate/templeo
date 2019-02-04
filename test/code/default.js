'use strict';

const { expect, LOGGER, Engine, JsFrmt, Main, JSDOM } = require('./_main.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, JsFrmt, Main, JSDOM } from './_main.mjs';

// DEBUGGING:
// Use the following:
// node --inspect-brk test/code/default.js
// ...or with optional test function name appended to the end:
// node --inspect-brk test/code/default.js htmlRegisterPartials

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
    const rslt = await renderer({ person: { name: 'World' } });
    
    if (LOGGER.info) LOGGER.info(template, '\nRESULTS:', rslt);
    const dom = new JSDOM(rslt), label = 'Person H1 element';
    const h1s = dom.window.document.getElementsByTagName('h1');
    expect(h1s, label).to.not.be.null();
    expect(h1s.length, label).to.be.equal(1);
    expect(h1s[0].innerHTML.trim(), label).to.be.equal('Hello World!');

    const rslt2 = await renderer({});
    if (LOGGER.info) LOGGER.info(template, '\nRESULTS:', rslt2);
    const dom2 = new JSDOM(rslt2), label2 = 'Person input element';
    const el = dom2.window.document.getElementById('personName');
    expect(el, label2).to.not.be.null();
    expect(el.placeholder, label2).to.be.equal('Please enter your name');
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

  static async htmlIncludeWithSearchParametersHttpsServerRead() {
    const idPrefix = 'inclParamFromServer_';
    const tests = getIncludeParamTests(idPrefix);
    const opts = baseOptions();
    // uncomment to debug rendering functions:
    //opts.debugger = true;
    const svr = await Main.httpsServer(opts.compile, idPrefix);
    try {
      opts.render.templatePathBase = svr.url;

      const files = await Main.getTemplateFiles();
      const engine = new Engine(opts.compile, JsFrmt, LOGGER);
      
      let renderer, rslt, cases, dom, els, label;
      for (let test of tests) {
        renderer = await engine.compile(test.template);
        rslt = await renderer(files.htmlContext, opts.render);
        if (LOGGER.info) LOGGER.info(test.template, '\nRESULTS:', rslt);
        dom = new JSDOM(rslt);
        cases = Array.isArray(test.cases) ? test.cases : [test.cases];
        for (let cased of cases) {
          for (let name in cased.params) {
            if (cased.usesSearchParams) {
              // dynamic parameters generated by the server
              label = `"${idPrefix}${name}" include parameter by name DOM`;
              els = dom.window.document.getElementsByName(`${idPrefix}${name}`);
              expect(els, label).to.not.be.null();
              expect(els.length, `${label} # of elements`).to.equal(1);
              expect(els[0].value, label).to.equal(cased.params[name]);
            }
            if (!cased.hasOwnProperty('usesIncludeParams') || cased.usesIncludeParams) {
              label = `"${name}" include parameter by name DOM`;
              // dynamic parameters generated within the partial template itself
              // using the scoped "params"
              els = dom.window.document.getElementsByName(`${name}`);
              expect(els, label).to.not.be.null();
              expect(els.length, `${label} # of elements`).to.equal(1);
              expect(els[0].value, label).to.equal(cased.params[name]);
            }
          }
        }
      }
    } finally {
      await svr.close();
    }
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
 * @returns {Object[]} The test metadata. Each entry can contain the following:
 * - `template:String` The template to test
 * - `cases:(Object | Object[])` One or more test cases that describe the validation that should take place
 * - `cases[].params:Object` The parameters that will be checked within the rendered template result
 * - `[cases[].usesSearchParams:Boolean=false]` Whether or not to validate the case for URLSearchParams
 * - `[cases[].usesIncludeParams:Boolean=true]` Whether or not to validate the case for scope resolved parameters
 */
function getIncludeParamTests() {
  const params = {
    hello: 'world',
    performing: 'tests'
  };
  const params2 = {
    someParam: 'someParamValue'
  };
  return [
    {
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) }\` }</body></html>`,
      cases: {
        params,
        usesSearchParams: true,
        usesIncludeParams: false
      }
    },
    {
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) } text \${ new URLSearchParams(${ JSON.stringify(params2) }) }\` }</body></html>`,
      cases: [{
        params,
        usesSearchParams: true,
        usesIncludeParams: false
      },
      {
        params: params2,
        usesSearchParams: true,
        usesIncludeParams: false
      }]
    },
    {
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) } params \${ ${ JSON.stringify(params2) } }\` }</body></html>`,
      cases: [{
        params,
        usesSearchParams: true,
        usesIncludeParams: false
      },
      {
        params: params2
      }]
    },
    {
      template: `<html><body>\${ await include\`params\${ ${ JSON.stringify(params) } }params\${ ${ JSON.stringify(params2) } }\` }</body></html>`,
      cases: [{ params }, { params: params2 }]
    }
  ];
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