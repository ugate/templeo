'use strict';

/**
 * Template engine options for a file/system back-end
 * @typedef {module:templeo/options.Options} module:templeo/options.FileOptions
 * @property {String} [opts.pathBase='/'] A base path used as prefix for `opts.path` and `opts.pathPartials`. Depending on the `engine`/`cache`
 * being used, the path may be just a virtual path that identifies a group of templates.
 * @property {String} [opts.path='views'] The root path where views are located/identified. Depending on the `engine`/`cache` being used, the
 * path may be just a virtual path that identifies a group of views.
 * @property {String} [opts.pathPartials='views/partials'] The root path where partials are located/identified. Partials are small segments of
 * template code that can be nested and reused throughout other templates. Depending on the `engine`/`cache` being used, the path may be just
 * a virtual path that identifies a group of templates as partial/fragments.
 * @property {String} [opts.outputPath] When defined, templates will be written to an engine's `cache` (__otherwise, compiled templates reside
 * in-memory__)
 * @property {String} [opts.outputSourcePath] When defined, will be used as the directory structure that will be generated within the
 * `outputPath`. When not defined, no directory structure is initialized. __NOTE:__ The path may or may not differ from
 * `opts.path`/`opts.pathPartials` since there may or may not be an actual file associated with a template or partial.
 * @property {String} [opts.outputExtension=.js] Extension used for generated output sources __ignored when `outputPath` is omitted__
 * @property {Object} [opts.formatOptions] The formatting options passed into {@link Cachier} _format function_ that will format the compiled
 * template source __ignored when `outputPath` is omitted__
 */

const EngineOpts = require('./engine-opts');
// TODO : ESM uncomment the following lines...
// import * as EngineOpts from './engine-opts.mjs';

const DEFAULT_OPTIONS = Object.freeze({
  pathBase: '/',
  path: 'views',
  pathPartials: 'views/partials',
  outputPath: null,
  outputSourcePath: null,
  outputExtension: 'js'
});

/**
 * Template engine options for a file/system back-end
 */
class EngineFileOpts extends EngineOpts {
  // TODO : ESM use... export class EngineFileOpts extends EngineOpts {

  /**
   * @override
   * @inheritdoc
   */
  build(opts, dflt, to) {
    super.build(opts, dflt, to);
    super.build(opts, EngineFileOpts.defaultOptions, to);
  }

  /**
   * @returns {module:templeo/options.FileOptions} The default options
   */
  static get defaultOptions() {
    return DEFAULT_OPTIONS;
  }
}

// TODO : ESM remove the following line...
module.exports = EngineFileOpts;