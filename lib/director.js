'use strict';

module.exports = class Director {
  // TODO : ESM use... export class Director {

  /**
   * Directive that drives template loops in the `for of` or `for in` flavor
   * @example
   * ${ repeat(it.metadata, (m, i) => `
   *  <meta name="${ m.name }" content="${ m.content }" />
   * `)}
  * @param {*[]} itr The iterable string, array, array-like objects, etc. that will be repeated in the form of `for of`
  * or an iterable non-symbol enumerable whose properties will be traversed in the form of `for in`
  * @param {*} fni The function that will return a result for each iteration. `for of` will pass the __item__ being iterated
  * and the __index__ of the iteration. `for in` will pass the __key__, the __value__ and the __index__.
  * @returns {String} The comulative `fni` result
  */
  static repeat(itr, fni) {
    var rtn = '', idx = -1;
    if (Array.isArray(itr)) {
      for (let itm of itr) {
        rtn += fni(itm, idx++);
      }
    } else {
      for (let key in itr) {
        rtn += fni(key, itr[key], idx++);
      }
    }
    return rtn;
  }

  /**
   * Tagged directive for consuming template comments
   * @example
   * ${ comment` This is a comment that will get consumed` }
   * @return {String} The comment replacement
   */
  static comment() {
    return '';
  }

  /**
   * @returns {Object[]} An object array that contains `{ name:String, code: String }` where `name` is
   * the _directive_ name and `code` is the code representation of the directive
   */
  static get directives() {
    const prps = Object.getOwnPropertyNames(Director);
    var rtn = [];
    for (let prop of prps) {
      if (prop === 'toString' || prop === 'directives' || typeof Director[prop] !== 'function') continue;
      rtn.push({ name: prop, code: `var ${prop}=function ${Director[prop].toString()};` });
    }
    return rtn;
  }

  /**
   * @returns {String} The named function directive code
   */
  static toString() {
    return Director.directives.reduce((acc, obj) => acc + obj.code, '');
  }
}