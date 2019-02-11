'use strict';

/**
 * Template options for an `IndexedDB`-like back-end. All DB options inherit from [TemplateOpts]{@link module:templeo/options.Options}.
 * @typedef {module:templeo/options.Options} module:templeo/options.DBOptions
 * @property {String} [dbTypeName='indexedDB'] The `IndexedDB` type to use. The default `indexedDB` value uses the global accessible instance that contains
 * a property matching the type name. When not present in the current global scope, a module will be loaded using the provided type name.
 * @property {String} [dbLocName='templeo'] Either the [`IDBDatabase.name`](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/name) that will be
 * used or the __location__ name/path passed into the module loaded via `dbTypeName`.
 */

const TemplateOpts = require('./template-options');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateOpts from './template-options.mjs';

const DEFAULTS = Object.freeze({
  dbTypeName: 'indexedDB',
  dbLocName: 'templeo',
  dbPartialStoreName: 'partials',
  dbSourceStoreName: 'sources'
});

/**
 * Template options for an `IndexedDB`-like back-end. See {@link module:templeo/options.DBOptions} for a full listing of options.
 * @see module:templeo/options.DBOptions
 * @see module:templeo/options.Options
 */
class TemplateDBOpts extends TemplateOpts {
  // TODO : ESM use... export class TemplateDBOpts extends TemplateOpts {

  /**
   * Template DB options
   * @param {module:templeo/options.DBOptions} [opts] The template DB options
   */
  constructor(opts) {
    super(opts);
  }

  /**
   * @see module:templeo/options.DBOptions
   * @see module:templeo/options.Options
   * @override
   * @inheritdoc
   */
  build(opts, dflt, to) {
    super.build(opts, dflt, to);
    super.build(opts, TemplateDBOpts.defaults, to);
  }

  /**
   * @see module:templeo/options.DBOptions
   * @see module:templeo/options.Options
   * @returns {module:templeo/options.DBOptions} The default options
   */
  static get defaults() {
    return DEFAULTS;
  }
}

// TODO : ESM remove the following line...
module.exports = TemplateDBOpts;