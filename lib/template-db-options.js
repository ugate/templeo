'use strict';

/**
 * Template options for an `IndexedDB`-like back-end. All DB options inherit from [TemplateOpts]{@link module:templeo/options.Options}.
 * @typedef {module:templeo/options.Options} module:templeo/options.DBOptions
 * @property {String} [dbTypeName='indexedDB'] The `IndexedDB` type to use. The default `indexedDB` value uses the global accessible instance that contains
 * a property matching the type name. When not present in the current global scope, a module will be loaded using the provided type name.
 * @property {String} [dbLocName='templeo'] Either the [`IDBDatabase.name`](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/name) that will be
 * used or the __location__ name/path passed into the IndexedDB-like module loaded via `dbTypeName` (e.g. `LevelDB`).
 * @property {String} [renderTimeReadPolicy=read-all-on-init-when-empty] The policy applied to partial template DB `read` operations when encountering
 * `include` directives that do not have template content present in cache storage during rendering. __In addition to the policies defined in
 * {@link module:templeo/options.Options}__, the following policies can be applied:
 * - `read-all-on-init-when-empty` When there are no partials registered during compilation, __all__ partial templates are read during the start of each
 * rendering invocation. If partial templates __are__ present/registered during compilation, __no__ DB reads will be made during rendering.
 * - `read-and-close` Like the __read__ policy, partial templates are only read when include directives are encountered that do not already contain content.
 * The DB will be opened before each read and closed after each read has completed for each included partial.
 */

const TemplateOpts = require('./template-options');
// TODO : ESM uncomment the following lines...
// TODO : import * as TemplateOpts from './template-options.mjs';

const OPTIONS = Object.freeze({
  defaults: Object.freeze({
    dbTypeName: 'indexedDB',
    dbLocName: 'templeo',
    renderTimeReadPolicy: 'read-all-on-init-when-empty'
  }),
  valids: Object.freeze({
    renderTimeReadPolicy: Object.freeze([
      'read-all-on-init-when-empty',
      'read-and-close'
    ])
  })
});

var MERGED_OPTIONS;

/**
 * Template options for an `IndexedDB`-like back-end. See {@link module:templeo/options.DBOptions} for a full listing of options.
 * @see module:templeo/options.DBOptions
 * @see module:templeo/options.Options
 */
class TemplateDBOpts extends TemplateOpts {
  // TODO : ESM use... export class TemplateDBOpts extends TemplateOpts {

  /**
   * @see module:templeo/options.DBOptions
   * @see module:templeo/options.Options
   * @returns {Object} The object described by {@link TemplateOpts.defaultOptions}
   */
  static get defaultOptions() {
    if (MERGED_OPTIONS) return MERGED_OPTIONS;
    super.defaultOptionMerge(OPTIONS, MERGED_OPTIONS = {});
    return MERGED_OPTIONS;
  }
}

// TODO : ESM remove the following line...
module.exports = TemplateDBOpts;