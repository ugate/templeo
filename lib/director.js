'use strict';

module.exports = class Director {
  // TODO : ESM use... export class Director {

  /**
   * Directive that drives template loops in the `for of` or `for in` flavor
   * @example
   * ${ repeat(it.metadata, (m, i) => `
   *  <meta name="${ m.name }" content="${ m.content }" />
   * `)}
  * @param {*} itr The iterable array, array-like objects, etc. that will be repeated in the form of a `for of` loop
  * or an iterable non-symbol enumerable whose properties will be traversed in the form of a `for in` loop
  * @param {*} fni The function that will return a result for each iteration. `for of` will pass the __item__ being iterated
  * and the __index__ of the iteration. `for in` will pass the __key__, the __value__ and the __index__.
  * @returns {String} The comulative `fni` result
  */
  repeat(itr, fni) {
    var rtn = '', idx = -1;
    if (Array.isArray(itr)) {
      for (let itm of itr) {
        rtn += fni(itm, ++idx);
      }
    } else {
      for (let key in itr) {
        rtn += fni(key, itr[key], ++idx);
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
  comment() {
    return '';
  }

  /**
   * Adds a directive function
   * @param {Function} func The __named__ directive function to add
   */
  add(func) {
    if (!func || typeof func !== 'function' || !func.name) throw new Error(`Directive functions must be a named function`);
    const ns = internal(this);
    if (!ns.at.adds) ns.at.adds = [func];
    else ns.at.adds.push(func);
  }

  /**
   * @returns {Object[]} An object array that contains `{ name:String, code: String }` where `name` is
   * the _directive_ name and `code` is the code representation of the directive
   */
  get directives() {
    return Director.getDirectives(this);
  }

  /**
   * @returns {String} The named function directive code
   */
  toString() {
    return Director.getDirectives(this).reduce((acc, obj) => acc + obj.code, '');
  }

  /**
   * Extracts class/sub-class {@link Director.directives}
   * @param {(Director | Class<Director>)} dirOrDirClass The {@link Director} instance or class to extract the
   * {@link Director.directives} from
   * @returns {Object[]} An object array that contains `{ name:String, code: String }` where `name` is the _directive_
   * name and `code` is the code representation of the directive
   */
  static getDirectives(dirOrDirClass) {
    const isDirInst = dirOrDirClass instanceof Director;
    if (!isDirInst && dirOrDirClass !== Director && !Director.isPrototypeOf(dirOrDirClass)) {
      throw new Error(`Expected ${Director.name} instance or class, but found ${(dirOrDirClass && dirOrDirClass.name) || dirOrDirClass}`);
    }
    const prps = isDirInst ? Object.getOwnPropertyNames(Object.getPrototypeOf(dirOrDirClass)) : Object.getOwnPropertyNames(dirOrDirClass);
    var rtn = [];
    for (let prop of prps) {
      if (prop === 'toString' || prop === 'directives' || prop === 'getDirectives' || prop === 'getString' || prop === 'add'
      || typeof dirOrDirClass[prop] !== 'function' || prop === 'constructor') {
        continue;
      }
      rtn.push(directive(prop, dirOrDirClass[prop]));
    }
    if (isDirInst) {
      const ns = internal(dirOrDirClass);
      if (ns.at.adds) {
        for (let func of ns.at.adds) {
          rtn.push(directive(func.name, func));
        }
      }
    }
    return rtn;
  }

  /**
   * Extracts class/sub-class {@link Director.toString()}
   * @param {Class<Director>} dirOrDirClass The {@link Director} instance or class to extract the {@link Director.directives} from
   * @returns {String} The named function directive code
   */
  static getString(dirOrDirClass) {
    return Director.getDirectives(dirOrDirClass).reduce((acc, obj) => acc + obj.code, '');
  }
}

/**
 * Creates a directive metadata
 * @private
 * @ignore
 * @param {String} name The directive name
 * @param {Function} func The function that will be serialized
 * @returns {Object} The `{ name:String, code:String }` directive metadata
 */
function directive(name, func, prefix) {
  var fstr = func.toString();
  if (!fstr.startsWith('function')) fstr = `function ${fstr}`;
  return { name, code: `const ${name}=${fstr};` }
}

// private mapping substitute until the following is adopted: https://github.com/tc39/proposal-class-fields#private-fields
let map = new WeakMap();
let internal = function(object) {
  if (!map.has(object)) map.set(object, {});
  return {
    at: map.get(object),
    this: object
  };
};