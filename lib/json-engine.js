'use strict';

/**
 * Micro JSON rendering template engine
 */
class JsonEngine {
// TODO : ESM use... export class JsonEngine {

  /**
   * Creates a JSON parsing engine
   * @param {EngineOpts} [opts] the {@link EngineOpts}
   */
  constructor(opts) {
    const ns = internal(this);
    ns.at.prts = {};
  }

  /**
   * Processes a template
   * @param {String} tmpl the raw template source
   * @param {String} [name] an optional name to be given to the template
   * @returns {function} the function(data) that returns a template result string based uopn the data object provided
   */
  compile(tmpl, options) { // TODO : Add templating JSON values and ensure no performance impact is made
    return function frmt(context, options) {
      return context;
    };
  }

  /**
   * Registers, loads and caches a partial template
   * @param {String} name the template name that uniquely identifies the template content
   * @param {String} partial the partial template content to register
   * @param {Boolean} [initFn] true to set the template function
   */
  registerPartial(name, partial) {
    const ns = internal(this);
    ns.at.prts[name] = JSON.parse(partial.charCodeAt(0) === 0xFEFF ? partial.substring(1) : partial);
    ns.at.prts[name].ext = 'json';
  }

  /**
   * Traverses an object source key/value pairs and replaces any templated string values that are surrounded by open/closing double parentheses
   * within the destination (all other source values will be set on the destination)
   * @param {(String | Object)} dest where replacements will be made
   * @param {Object} src the object whose property names/values will be used as replacements (can be the same object as the destination)
   * @param {String} [locale] the locale that will be used for formatting date parameters (when omitted toISOString is used instead)
   * @param {Boolean} [noEncode] true will prevent URI encoding values when setting
   * @param {Boolean} [useTemplStrs] true to use standard template strings (i.e. `${my.object.path}`) instead of the default double parentheses
   * @returns {String} the replaced string or object
   */
  static params(dest, src, locale, noEncode, useTemplStrs) {
    const rxm = useTemplStrs ? /(\${)([^}]+)(})/g : /(\({2,})([^\)]+)(\){2,})/g;
    const prms = (dest, src, locale, noEncode, desto, srco) => {
      if (!src) return dest;
      if (Array.isArray(src)) { // traverse the
        const isDestStr = typeof dest === 'string';
        dest = (!isDestStr && Array.isArray(dest) && dest) || dest;
        for (let si = 0, sl = src.length; si < sl; ++si) {
          if (isDestStr) dest = prms(dest, src[si], locale, noEncode, desto, srco);
          else dest[si] = prms(isDestStr ? dest : dest[si]
            || (dest[si] = JsonEngine.clone(src[si])), src[si], locale, noEncode, desto, srco);
        }
        return dest;
      }
      var rtn = dest, rx, val;
      const rtyp = typeof rtn, isRStr = rtyp === 'string', fn = (ss, nm) => {
        if (ss !== null && typeof ss === 'object') { // traverse the source tree
          if ((val = rtyp === 'object' && rtn && nm ? rtn[nm] : rtn)) {
            if (isRStr) rtn = prms(val, ss, locale, noEncode, desto, srco);
            else prms(val, ss, locale, noEncode, desto, srco);
          }
        } else {
          rx = (isRStr || typeof rtn[nm] === 'string') && rxm;
          if (rx) {
            val = (isRStr ? rtn : rtn[nm]).replace(rx, function rpl(m, lp, rk, rp) {
              var left = lp.length > 2 ? lp.substr(2) : '', right = rp.length > 2 ? rp.substr(2) : '';
              for (var i = 0, pths = rk.split('.'), pth, valn = srco; (pth = pths[i]); ++i) {
                if (!valn) throw new Error(`No such path "${pth}" in "${rk}"`);
                else if (typeof valn === 'string') {
                  valn = ((val = ss && ss instanceof Date ? 
                    (locale && JsonEngine.dateString(ss, locale)) || ss.toISOString() : 
                    JsonEngine.clone(ss)) && !noEncode && encodeURIComponent(val)) || val;
                } else valn = valn[pth];
              }
              // leave values untouched when there is no matching path in the template
              return typeof valn === 'undefined' ? m : left + valn + right;
            });
            if (isRStr) rtn = val;
            else rtn[nm] = rtn[nm] = val;
          } else if (!isRStr) rtn[nm] = ss;
        }
      };
      if (typeof src === 'string') fn(src);
      else for (let k in src) fn(src[k], k);
      return rtn;
    };
    return prms(dest, src, locale, noEncode, dest, src);
  }
  /**
   * Clones an element
   * @param {*} el the element to clone
   * @returns {*} the cloned element
   */
  static clone(el) {
    return (el !== null && typeof el === 'object' && JSON.parse(JSON.stringify(el))) || el;
  }

  /**
   * Converts a Date to a string that can be consumed by the remote
   * @param {Date} date the date to convert
   * @param {String} locale the loace to use in the conversion
   */
  static dateString(date, locale) {
    return date && date.toLocaleString(locale,
      { 'month': '2-digit', 'day': '2-digit', 'year': 'numeric', 'timeZone': 'UTC' }).replace(/(\d+)\/(\d+)\/(\d+)/, '$3$1$2');
  }
}

// TODO : ESM remove the following line...
module.exports = JsonEngine;

// private mapping
let map = new WeakMap();
let internal = function(object) {
  if (!map.has(object)) map.set(object, {});
  return {
    at: map.get(object),
    this: object
  };
};