var jsdocp = new JSDocp();

function JSDocp() {
  var jp = this, py = window.pageYOffset;
  var chglogId = 'jsdocpChangelog', chglogContentId = 'jsdocpChangelogContent';
  var chglogCloseId = 'jsdocpChangelogClose', navId = 'jsdocpNav', navState;
  var logoSrcSel = '.jsdocp-logo-svg', logoSrcAttr = 'jsdocp-logo-src';

  jp.throttles = {};
  jp.nav = document.getElementById(navId);
  jp.navOpts = jp.nav ? navOpts() : {};

  if (jp.nav) setTimeout(function setNavPos() { // need timeout so prototypes will be set
    jp.setNavPosition();
  });

  // handles nav menu showing/hiding based upon scrolling direction
  if (jp.nav && (jp.navOpts.smAH || jp.navOpts.mdAH || jp.navOpts.lgAH)) {
    navState = navAutoHides();
    window.addEventListener('scroll', navAutoHideListener);
    window.addEventListener('resize', navAutoHideListener);
  }

  // handle loading of versions.json and populates the version drop-down select
  window.addEventListener('load', function loaded() {
    changelogLink();
    jp.loadVersions();
    jp.imgSvgToInline(document.querySelectorAll(logoSrcSel), logoSrcAttr);
  });

  /**
   * Attempt to override the link to the CHANGELOG in order to keep it within the same page wrapper
   */
  function changelogLink() {
    var cla = document.getElementById(chglogId), cl = document.getElementById(chglogContentId);
    if (cla && cl) {
      var cls = document.getElementById(chglogCloseId);
      var toggleChangelog = function toggleChangelog() {
        var isOpen = cl.classList.contains('jsdocp-open');
        var hasSB = (window.innerHeight && (document.body.offsetHeight > window.innerHeight)) || document.documentElement.scrollHeight > 
          document.documentElement.offsetHeight || document.body.scrollHeight > document.body.offsetHeight;
        document.body.classList[!isOpen && hasSB ? 'add' : 'remove']('jsdocp-noscroll');
        if (isOpen) {
          var stl = getComputedStyle(cl), mtch = stl && stl.transition && stl.transition.match(/\s+(\d+\.?\d+)(m?s)/i);
          var dur = (mtch && mtch[1] && parseFloat(mtch[1])) || 0;
          dur = mtch && mtch[2] && mtch[2].length > 1 ? dur : dur * 1000;
          cl.classList.toggle('jsdocp-open');
          setTimeout(function cltko() {
            document.body.classList.toggle('jsdocp-cover');
          }, dur);
        } else {
          document.body.classList.toggle('jsdocp-cover');
          cl.classList.toggle('jsdocp-open');
        }
      };
      if (cls) cls.addEventListener('click', toggleChangelog);
      cla.addEventListener('click', function overrideChglogClick(event) {
        try {
          toggleChangelog();
        } catch (err) {
          console.error(err);
        }
        event.preventDefault();
        event.stopPropagation();
        return false;
      }, { capture: true });
    }
  }

  /**
   * Handles/throttles scrolling/resize events and adjusts the navigation menu for auto-hiding the menu and positioning
   * @param {Event} evt The event being listened to
   */
  function navAutoHideListener(evt) {
    if (navState.running === evt.type) return;
    navState.running = evt.type;
    requestAnimationFrame(function jsdocpScrolling() {
      var y = window.pageYOffset;
      var nah = navAutoHides();
      if (navState.isSmAH !== nah.isSmAH || navState.isMdAH !== nah.isMdAH || navState.isLgAH !== nah.isLgAH) jp.setNavPosition();
      if (nah.isSmAH || nah.isMdAH || nah.isLgAH) {
        if (jp.nav.classList.contains('jsdocp-nav-vertical')) {
          jp.nav.style[jp.nav.classList.contains('jsdocp-nav-right') ? 'right' : 'left'] = py >= y ? 0 : '-' + getComputedStyle(jp.nav).width;
        } else jp.nav.style[jp.nav.classList.contains('jsdocp-nav-bottom') ? 'bottom' : 'top'] = py >= y ? 0 : '-' + getComputedStyle(jp.nav).height;
      }
      py = y;
      navState = nah;
      navState.running = false;
    });
  }

  /**
   * Extracts the navigation menu options from the data attributes set on the navigation menu element
   * @returns {Object} The extracted navigation menu options
   */
  function navOpts() {
    var smPos = jp.nav && jp.nav.dataset.jsdocpSmPosition;
    var mdPos = jp.nav && jp.nav.dataset.jsdocpMdPosition;
    var lgPos = jp.nav && jp.nav.dataset.jsdocpLgPosition;
    var sm = jp.nav && window.matchMedia(jp.nav.dataset.jsdocpSmMatchMedia);
    var md = jp.nav && window.matchMedia(jp.nav.dataset.jsdocpMdMatchMedia);
    var lg = jp.nav && window.matchMedia(jp.nav.dataset.jsdocpLgMatchMedia);
    var smAH = jp.nav && jp.nav.dataset.jsdocpSmAutoHide === 'true';
    var mdAH = jp.nav && jp.nav.dataset.jsdocpMdAutoHide === 'true';
    var lgAH = jp.nav && jp.nav.dataset.jsdocpLgAutoHide === 'true';
    if (jp.nav) {
      jp.nav.removeAttribute('data-jsdocp-sm-position');
      jp.nav.removeAttribute('data-jsdocp-md-position');
      jp.nav.removeAttribute('data-jsdocp-lg-position');
      jp.nav.removeAttribute('data-jsdocp-sm-match-media');
      jp.nav.removeAttribute('data-jsdocp-md-match-media');
      jp.nav.removeAttribute('data-jsdocp-lg-match-media');
      jp.nav.removeAttribute('data-jsdocp-sm-auto-hide');
      jp.nav.removeAttribute('data-jsdocp-md-auto-hide');
      jp.nav.removeAttribute('data-jsdocp-lg-auto-hide');
    }
    return { sm: sm, md: md, lg: lg, smAH: smAH, mdAH: mdAH, lgAH: lgAH, smPos: smPos, mdPos: mdPos, lgPos: lgPos };
  }

  /**
   * Checks the navigation menu options to determine if the media query for different display resolutions matches what
   * is on the client
   * @returns {Object} The checked auto-hides
   */
  function navAutoHides() {
    var isSmAH = jp.navOpts.smAH && jp.navOpts.sm.matches;
    var isMdAH = !isSmAH && jp.navOpts.mdAH && jp.navOpts.md.matches;
    var isLgAH = !isSmAH && !isMdAH && jp.navOpts.lgAH && jp.navOpts.lg.matches;
    return { isSmAH: isSmAH, isMdAH: isMdAH, isLgAH: isLgAH };
  }
}

/**
 * Sets the proper CSS classes required for the navigation menu based upon the specified `MediaQueryList` for resolution sizes and the
 * corresponding `data-jsdocp-sm-position`, `data-jsdocp-md-position` and `data-jsdocp-lg-position` attributes on the navigation menu element.
 * @returns {Boolean} `true` when able to set, `false` when not
 */
JSDocp.prototype.setNavPosition = function setNavPosition() {
  var jp = this, opts = jp.navOpts;
  var pos = ((opts.sm.matches ? opts.smPos : opts.md.matches ? opts.mdPos : opts.lg.matches ? opts.lgPos : '') || '').toLowerCase();
  var ahd = opts.sm.matches ? opts.smAH : opts.md.matches ? opts.mdAH : opts.lg.matches ? opts.lgAH : false;
  if (!pos) return false;
  if (pos === 'left' || pos === 'right') jp.nav.classList.add('jsdocp-nav-vertical');
  else jp.nav.classList.remove('jsdocp-nav-vertical');
  if (pos === 'right') jp.nav.classList.add('jsdocp-nav-right');
  else jp.nav.classList.remove('jsdocp-nav-right');
  if (pos === 'bottom') jp.nav.classList.add('jsdocp-nav-bottom');
  else jp.nav.classList.remove('jsdocp-nav-bottom');
  if (ahd) jp.nav.classList.add('jsdocp-nav-auto-hide');
  else jp.nav.classList.remove('jsdocp-nav-auto-hide');
  jp.nav.classList.remove('jsdocp-remove-me');
  return true;
};

/**
 * Loads the `versions.json` into the `#jsdocpVersions` select element from it's `data-jsdocp-json-url` attribute URL. Uses the `data-jsdocp-from`,
 * `data-jsdocp-type` to filter what versions are shown.
 */
JSDocp.prototype.loadVersions = function loadVersions() {
  var jp = this, sel = document.getElementById('jsdocpVersions');
  if (!sel) return;
  var versioned = function(ver) {
    var parts = String(ver).split('.');
    return {
      major: (parts && parts[0] && !isNaN(parts[0]) && parseInt(parts[0])) || 0,
      minor: (parts && parts[1] && !isNaN(parts[1]) && parseInt(parts[1])) || 0,
      patch: (parts && parts[2] && !isNaN(parts[2]) && parseInt(parts[2])) || 0
    };
  };
  sel.addEventListener('change', function versionChange(event) {
    var trg = event.currentTarget || event.target, base = (trg && trg.dataset.jsdocpVersionBase) || '';
    if (trg && trg.value && trg.value !== trg.dataset.jsdocpVersion) window.location = (base ? base + '/' : '') + 'v' + trg.value;
  });
  jp.fetch(sel.dataset.jsdocpJsonUrl, 'application/json', function versionsLoaded(error, req) {
    if (error) return console.warn(error);
    var vrs = JSON.parse(req.responseText);
    var i = vrs.length, last, curr, from = sel.dataset.jsdocpFrom ? versioned(sel.dataset.jsdocpFrom) : null;
    while (i--) { // add in reverse order 
      if (from || sel.dataset.jsdocpType) {
        if (!last) last = versioned(sel.dataset.jsdocpVersion);
        curr = versioned(vrs[i]);
        if (sel.dataset.jsdocpVersion !== vrs[i]) {
          if (from && curr.major < from.major) break;
          if (from && curr.major === from.major && curr.minor < from.minor) break;
          if (from && curr.major === from.major && curr.minor === from.minor && curr.patch < from.patch) break;
          if (sel.dataset.jsdocpType === 'major' && curr.major === last.major) continue;
          if (sel.dataset.jsdocpType === 'minor' && curr.minor === last.minor) continue;
        }
        last = curr;
      }
      opt = document.createElement('option');
      opt.setAttribute('value', vrs[i]);
      if (vrs[i] === sel.dataset.jsdocpVersion) opt.setAttribute('selected', 'selected');
      opt.appendChild(document.createTextNode(vrs[i]));
      sel.appendChild(opt);
    }
  });
};

/**
 * Replaces element(s) that have the `urlAttr` with a value ending in `.svg` with the retrieved svg content-
 * preserving the `className` of the original element
 * @param {(NodeList | Element[] | Element)} els The element(s) to replace in the DOM with retrieved svg content
 * @param {String} [urlAttr='src'] The attribute that will contain the URL to retrieve the svg content from 
 */
JSDocp.prototype.imgSvgToInline = function imgSvgToInline(els, urlAttr) {
  var jp = this;
  els = els instanceof NodeList || Array.isArray(els) ? els : (els && [els]) || [];
  urlAttr = urlAttr || 'src';
  var svgHandler = function svgHandler(error, req, el) {
    if (error) return console.warn(error);
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(req.responseText, 'text/xml');
    var svg = xmlDoc.getElementsByTagName('svg')[0];
    svg.className = el.className;
    svg.removeAttribute('xmlns:a');
    if (!svg.getAttribute('viewBox') && svg.getAttribute('height') && svg.getAttribute('width')) {
      svg.setAttribute('viewBox', '0 0 ' + svg.getAttribute('height') + ' ' + svg.getAttribute('width'));
    }
    el.parentNode.replaceChild(svg, el);
  }
  for (var i = 0, url; i < els.length && (url = els[i].getAttribute(urlAttr)); i++) {
    if (url.indexOf('.svg')) {
      if (els[i].tagName.toLowerCase() === 'iframe') els[i].outerHTML = els[i].contentWindow.document.documentElement.innerHTML;
      else jp.fetch(url, null, svgHandler, els[i]);
    }
  }
};

/**
 * Fetches resources
 * @param {String} url The URL to the resource
 * @param {String} [mime] The mime to override (if any)
 * @param {Function} [cb] The callback `function(error, request, arg)`
 * @param {*} [arg] An argument to pass to the callback as the last argument
 */
JSDocp.prototype.fetch = function fetch(url, mime, cb, arg) {
  var req = new XMLHttpRequest();
  if (mime) req.overrideMimeType(mime);
  req.open('GET', url, true);
  req.onreadystatechange = function fetched() {
    if (req.readyState === 4) {
      error = req.status !== 200 ? new Error(req.status + ' (' + req.statusText + '): Unable to capture ' + url) : null;
      if (error) error.status = req.status;
      cb(error, req, arg);
    }
  };
  req.onerror = function fetchError(error) {
    cb(error, req, arg);
  };
  req.send(null);
};

 /**
  * Throttles how many times a function is called over a given time
  * @param {*} [id] an id that will be used for throttling
  * @param {String} [type] the type of throttle (e.g. event type)
  * @param {Integer} [timeout] the number of milliseconds to wait between function calls before re-executing
  * @param {function} fn the function that will be throttled
  * @returns {String} the cached id
  */
 JSDocp.prototype.throttle = function throttle(id, type, timeout, fn) {
  var nid = id + '-type-' + type;
  clearTimeout(this.throttles[nid]);
  if (timeout >= 0) this.throttles[nid] = setTimeout(function throttleTimeout() {
    fn(nid);
  }, timeout);
  return id;
};