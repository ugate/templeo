"use strict";

const Engine = require("minami/publish");
const pkg = require('../package.json');
const { exec } = require('child_process');
const Fs = require('fs').promises;
const Path = require('path');

/**
 * Publishes a mudlues documentation
 * @param {TAFFY} taffyData See <http://taffydb.com/>
 * @param {Object} opts The options
 * @param {Tutorial} tutorials The turtorials
 */
exports.publish = function(taffyData, opts, tutorials) {
  const thiz = this, args = arguments;
  return new Promise((resolve, reject) => {
    env.meta = { package: pkg }; // accessibility in templates
    exec(`npm view ${pkg.name} versions --json`, async (error, stdout, stderr) => {
      try {
        const versions = (!error && !stderr && stdout) || '[]'; // may have never been published to npm before
        opts.template = opts.templateProxy; // actual template
        const published = Engine.publish.apply(thiz, args);
        await Fs.writeFile(Path.join(opts.destination, 'versions.json'), versions);
        resolve(published); // no need to customize how docs are parsed, jut the layout .tmpl files
      } catch(err) {
        reject(err);
      }
    });
  });
};
