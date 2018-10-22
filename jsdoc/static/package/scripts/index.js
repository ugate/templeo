window.addEventListener('load', function loadVersions(event) {
  var sel = document.querySelector('#versions');
  if (!sel) return;
  var versioned = function(ver) {
    var parts = String(ver).split('.');
    return {
      major: (parts && parts[0] && !isNaN(parts[0]) && parseInt(parts[0])) || 0,
      minor: (parts && parts[1] && !isNaN(parts[1]) && parseInt(parts[1])) || 0,
      patch: (parts && parts[2] && !isNaN(parts[2]) && parseInt(parts[2])) || 0
    };
  };
  var req = new XMLHttpRequest();
  req.overrideMimeType('application/json');
  req.open('GET', sel.dataset.jsonUrl, true);
  req.onreadystatechange = function versionsLoaded() {
    if (req.readyState === 4) {
      if (req.status !== 200) return console.warn(req.status + ' (' + req.statusText + '): Unable to capture ' + sel.dataset.jsonUrl);
      var vrs = JSON.parse(req.responseText);
      var i = vrs.length, last, curr, from = sel.dataset.from ? versioned(sel.dataset.from) : null;
      while (i--) { // add in reverse order 
        if (from || sel.dataset.include) {
          if (!last) last = versioned(sel.dataset.version);
          curr = versioned(vrs[i]);
          if (from && curr.major < from.major) break;
          if (from && curr.major === from.major && curr.minor < from.minor) break;
          if (from && curr.major === from.major && curr.minor === from.minor && curr.patch < from.patch) break;
          if (sel.dataset.include === 'major' && curr.major === last.major) continue;
          if (sel.dataset.include === 'minor' && curr.minor === last.minor) continue;
          last = curr;
        }
        opt = document.createElement('option');
        opt.setAttribute('value', vrs[i]);
        opt.appendChild(document.createTextNode(vrs[i]));
        sel.appendChild(opt);
      }
    }
  };
  req.send(null);
});