/* simulation-gap: what the sweep found, drawn from data.js only. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var C = 'http://www.w3.org/2000/svg';
  function el(t, a, x) {
    var n = document.createElementNS(C, t);
    for (var k in a) n.setAttribute(k, a[k]);
    if (x != null) n.textContent = x;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[<>&]/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c];
    });
  }
  function num(x, d) { return x == null ? 'n/a' : Number(x).toFixed(d == null ? 3 : d); }
  function n(x) { return x == null ? 'n/a' : Number(x).toLocaleString('en-GB'); }
  // A caption drawn inside an SVG shrinks with the SVG, so on a phone it becomes
  // unreadable while an overflow probe still calls the page clean. Captions live in
  // HTML beside the chart and stay at body size at every width.
  function caption(id, text) { var e = $(id + '-cap'); if (e) e.textContent = text; }
  // These charts are drawn in an 860-wide coordinate space and rendered into whatever
  // width the column has. On a phone that is about 350px, so every label inside the SVG
  // renders at 40 percent of its stated size and an 11px caption becomes 5px. Drawing a
  // narrower picture on a narrow screen keeps the text near its intended size.
  function isNarrow() { return window.innerWidth < 620; }
  function redrawOnWidthChange(fn) {
    if (fn._bound) return;
    fn._bound = true;
    var last = isNarrow();
    window.addEventListener('resize', function () {
      var now = isNarrow();
      if (now !== last) { last = now; fn(); }
    });
  }

  var state = { axis: null };

  function drawDomain() {
    var host = $('#domainviz'); if (!host) return;
    var boxes = [
      { t: 'Simulator settings', s: '27 numbers deciding what a synthetic worm looks like and how it moves' },
      { t: 'Synthetic footage', s: 'frames where every worm position is known by construction' },
      { t: 'A trained model', s: 'the published architecture, trained from scratch on those frames' },
      { t: 'Real footage', s: 'clips a human labelled, which the model has never seen' }
    ];
    var loop = 'The loop the fellowship wants closed without labels: let the real footage choose the settings.';
    // Four boxes side by side need 900 units of width. Rendered into a phone column that
    // scales every label to under four pixels, so on a narrow screen the same four boxes
    // are stacked instead and each one gets the full width.
    var narrow = isNarrow();
    var s2;
    function wrap(text, perLine, put) {
      var words = text.split(' '), line = '';
      words.forEach(function (w) {
        if ((line + ' ' + w).length > perLine) { put(line); line = w; } else line = line ? line + ' ' + w : w;
      });
      if (line) put(line);
    }
    if (narrow) {
      var BW = 380, BH = 74, GAP = 16, W = 400, H = boxes.length * (BH + GAP) + 46;
      s2 = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        'aria-label': 'Simulator settings produce synthetic footage, which trains a model, which is scored on real footage' });
      boxes.forEach(function (b, i) {
        var y = i * (BH + GAP);
        s2.appendChild(el('rect', { x: 10, y: y, width: BW, height: BH, rx: 6, fill: '#fff', stroke: '#c9c5be' }));
        s2.appendChild(el('text', { x: 22, y: y + 22, 'font-family': "'Newsreader',Georgia,serif",
          'font-size': 15, 'font-weight': 600, fill: '#1a1d21' }, b.t));
        var ty = y + 40;
        wrap(b.s, 52, function (line) {
          s2.appendChild(el('text', { x: 22, y: ty, 'font-family': "'IBM Plex Sans',sans-serif",
            'font-size': 11, fill: '#5b6470' }, line));
          ty += 14;
        });
        if (i < boxes.length - 1) {
          s2.appendChild(el('line', { x1: 200, y1: y + BH + 2, x2: 200, y2: y + BH + GAP - 2,
            stroke: '#8b95a1', 'stroke-width': 1.5 }));
          s2.appendChild(el('circle', { cx: 200, cy: y + BH + GAP - 3, r: 2.5, fill: '#8b95a1' }));
        }
      });
      var ly = boxes.length * (BH + GAP) + 6;
      wrap(loop, 56, function (line) {
        s2.appendChild(el('text', { x: 10, y: ly, 'font-family': "'IBM Plex Sans',sans-serif",
          'font-size': 11, fill: '#b03a3a' }, line));
        ly += 14;
      });
    } else {
      var W2 = 900, H2 = 190;
      s2 = el('svg', { viewBox: '0 0 ' + W2 + ' ' + H2, role: 'img',
        'aria-label': 'Simulator settings produce synthetic footage, which trains a model, which is scored on real footage' });
      var xs = [{ x: 8, w: 196 }, { x: 232, w: 196 }, { x: 456, w: 196 }, { x: 692, w: 200 }];
      boxes.forEach(function (b, i) {
        var g = xs[i];
        s2.appendChild(el('rect', { x: g.x, y: 26, width: g.w, height: 116, rx: 6, fill: '#fff', stroke: '#c9c5be' }));
        s2.appendChild(el('text', { x: g.x + 13, y: 50, 'font-family': "'Newsreader',Georgia,serif",
          'font-size': 16, 'font-weight': 600, fill: '#1a1d21' }, b.t));
        var y = 70;
        wrap(b.s, 28, function (line) {
          s2.appendChild(el('text', { x: g.x + 13, y: y, 'font-family': "'IBM Plex Sans',sans-serif",
            'font-size': 11, fill: '#5b6470' }, line));
          y += 14;
        });
        if (i < boxes.length - 1) {
          var x1 = g.x + g.w + 4, x2 = xs[i + 1].x - 4;
          s2.appendChild(el('line', { x1: x1, y1: 84, x2: x2, y2: 84, stroke: '#8b95a1', 'stroke-width': 1.5 }));
          s2.appendChild(el('circle', { cx: x2 - 2, cy: 84, r: 2.5, fill: '#8b95a1' }));
        }
      });
      s2.appendChild(el('path', { d: 'M 890 148 L 890 170 L 106 170 L 106 148', fill: 'none',
        stroke: '#b03a3a', 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }));
      s2.appendChild(el('text', { x: 498, y: 166, 'text-anchor': 'middle', 'font-family': "'IBM Plex Sans',sans-serif",
        'font-size': 11.5, fill: '#b03a3a' }, loop));
    }
    host.innerHTML = ''; host.appendChild(s2);
  }

  function axes() {
    if (D.axes && D.axes.length) return D.axes;
    var seen = {};
    (D.configs || []).forEach(function (c) { seen[c.axis] = true; });
    return Object.keys(seen).map(function (k) { return { key: k, label: k }; });
  }

  function renderAxes() {
    var host = $('#axischips'); if (!host) return;
    host.innerHTML = '';
    var list = axes();
    if (!state.axis && list.length) state.axis = list[0].key;
    list.forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'chip';
      b.setAttribute('aria-pressed', a.key === state.axis ? 'true' : 'false');
      b.textContent = a.label || a.key;
      b.onclick = function () { state.axis = a.key; renderAxes(); drawSweep(); };
      host.appendChild(b);
    });
  }

  function drawSweep() {
    var host = $('#sweepviz'); if (!host) return;
    var rows = (D.configs || []).filter(function (c) { return c.axis === state.axis && c.real_score != null; })
      .sort(function (a, b) { return (a.axis_value || 0) - (b.axis_value || 0); });
    if (!rows.length) {
      host.innerHTML = '<p class="small">No finished runs on this setting yet.</p>';
      $('#sweeplegend').innerHTML = '';
      return;
    }
    var axis = axes().filter(function (a) { return a.key === state.axis; })[0] || { label: state.axis };
    var narrow = isNarrow();
    var W = narrow ? 400 : 860, H = narrow ? 300 : 280;
    var P = narrow ? { l: 46, r: 14, t: 22, b: 52 } : { l: 62, r: 30, t: 24, b: 48 };
    var vals = rows.map(function (r) { return r.axis_value; });
    var scores = rows.map(function (r) { return r.real_score; });
    var base = D.defaults_run && D.defaults_run.real_score != null ? D.defaults_run.real_score : null;
    // One y range for every setting. Rescaling per chip drew four settings at the same
    // visual amplitude while the verdict said they differ by a factor of two, so the
    // chart contradicted the sentence under it. The range spans every scored run.
    var allScored = (D.configs || []).filter(function (c) { return c.real_score != null; })
      .map(function (c) { return c.real_score; });
    var all = allScored.concat(base != null ? [base] : []);
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (hi - lo < 1e-9) { hi = lo + 1; }
    lo -= (hi - lo) * 0.15; hi += (hi - lo) * 0.12;
    var vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
    var X = function (v) { return vmax === vmin ? (W / 2) : P.l + (v - vmin) / (vmax - vmin) * (W - P.l - P.r); };
    var Y = function (v) { return H - P.b - (v - lo) / (hi - lo) * (H - P.t - P.b); };
    var s = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Real-footage score against ' + (axis.label || state.axis) });
    [lo, (lo + hi) / 2, hi].forEach(function (g) {
      s.appendChild(el('line', { x1: P.l, y1: Y(g), x2: W - P.r, y2: Y(g), stroke: '#e2e0dc' }));
      s.appendChild(el('text', { x: P.l - 8, y: Y(g) + 4, 'text-anchor': 'end',
        'font-family': "'IBM Plex Mono',monospace", 'font-size': 10, fill: '#8b95a1' }, num(g, 2)));
    });
    if (base != null) {
      s.appendChild(el('line', { x1: P.l, y1: Y(base), x2: W - P.r, y2: Y(base),
        stroke: '#2c4a6b', 'stroke-dasharray': '5 4', 'stroke-width': 1.6 }));
      s.appendChild(el('text', { x: W - P.r, y: Y(base) - 6, 'text-anchor': 'end',
        'font-family': "'IBM Plex Sans',sans-serif", 'font-size': 11.5, fill: '#2c4a6b' },
        'the settings the authors chose'));
    }
    var d = rows.map(function (r, i) { return (i ? 'L' : 'M') + X(r.axis_value).toFixed(1) + ' ' + Y(r.real_score).toFixed(1); }).join(' ');
    s.appendChild(el('path', { d: d, fill: 'none', stroke: '#b03a3a', 'stroke-width': 2.4 }));
    rows.forEach(function (r) {
      s.appendChild(el('circle', { cx: X(r.axis_value), cy: Y(r.real_score), r: 4.5, fill: '#b03a3a' }));
      s.appendChild(el('text', { x: X(r.axis_value), y: H - P.b + 16, 'text-anchor': 'middle',
        'font-family': "'IBM Plex Mono',monospace", 'font-size': 10.5, fill: '#8b95a1' }, String(r.axis_value)));
    });
    s.appendChild(el('text', { x: 0, y: 12, 'font-family': "'IBM Plex Sans',sans-serif", 'font-size': 11.5, fill: '#5b6470' },
      'Score on real labelled footage, higher is better'));
    s.appendChild(el('text', { x: W - P.r, y: H - 8, 'text-anchor': 'end',
      'font-family': "'IBM Plex Sans',sans-serif", 'font-size': 11.5, fill: '#5b6470' },
      (axis.label || state.axis) + (axis.unit ? ', ' + axis.unit : '')));
    host.innerHTML = ''; host.appendChild(s);
    $('#sweeplegend').innerHTML = '<span class="hint">' +
      esc(axis.why_it_might_matter || '') + '</span>';

    var spread = Math.max.apply(null, scores) - Math.min.apply(null, scores);
    var byAxis = {};
    (D.configs || []).forEach(function (c) {
      if (c.real_score == null) return;
      byAxis[c.axis] = byAxis[c.axis] || [];
      byAxis[c.axis].push(c.real_score);
    });
    // An axis with one finished run has a spread of zero, which would read as "this
    // setting does not matter" when the truth is that it was measured once. Those are
    // left out of the comparison and counted, so the verdict can say how many.
    var axesSeen = Object.keys(byAxis).length;
    var ranked = Object.keys(byAxis).filter(function (k) { return byAxis[k].length > 1; })
      .map(function (k) {
        var v = byAxis[k];
        return { k: k, spread: Math.max.apply(null, v) - Math.min.apply(null, v), n: v.length };
      }).sort(function (a, b) { return b.spread - a.spread; });
    var tooThin = axesSeen - ranked.length;
    var lbl = function (k) {
      var a = axes().filter(function (x) { return x.key === k; })[0];
      return (a && a.label ? a.label : k).toLowerCase();
    };
    // The verdict has to change when the reader clicks a chip, or the control looks
    // broken. It leads with the setting they selected, then places it among the others.
    var here = ranked.filter(function (r) { return r.k === state.axis; })[0];
    var place = here ? ranked.indexOf(here) + 1 : null;
    var lead = '<b>Moving ' + lbl(state.axis) + ' across its range changes the real score by ' +
      num(spread, 3) + '.</b> ';
    if (place && ranked.length > 1) {
      lead += 'That is the ' + (place === 1 ? 'largest' : (place === ranked.length ? 'smallest' : 'number ' + place)) +
        ' of the ' + ranked.length + ' settings measured across a range here' +
        (place === 1 ? '.' : ', against ' + num(ranked[0].spread, 3) + ' for ' + lbl(ranked[0].k) + '.') + ' ';
    }
    if (ranked.length > 1) {
      var nf0 = noiseFloor();
      var clears = nf0 ? ranked[0].spread > nf0.spread * 2 : null;
      lead += (clears === false
        ? '<b>No setting here is shown to matter more than another.</b> '
        : (clears === true ? '<b>The settings do not matter equally.</b> '
                           : '<b>The settings appear to move the score by different amounts.</b> ')) +
        'The largest effect is ' + lbl(ranked[0].k) + ' at ' + num(ranked[0].spread, 3) +
        ' and the smallest is ' + lbl(ranked[ranked.length - 1].k) + ' at ' +
        num(ranked[ranked.length - 1].spread, 3) + '. ' +
        (tooThin ? tooThin + (tooThin === 1 ? ' setting is' : ' settings are') +
          ' left out of that comparison, because only one run of ' +
          (tooThin === 1 ? 'it' : 'each') + ' finished and a single point has no range to move across. ' : '');
    }
    $('#v2').innerHTML = lead + noiseClause(ranked.length ? ranked : [{ k: state.axis, spread: spread }]);
  }

  // A difference between two configurations means nothing until you know how much the
  // same configuration moves when you only change the seed. The page will not recommend
  // where to spend tuning effort without that number, because its own limits say a
  // single unrepeated run cannot tell a real difference from run-to-run variation.
  function noiseFloor() {
    var reps = (D.defaults_run || {}).repeats;
    if (!reps || reps.length < 2) return null;
    var v = reps.map(function (r) { return r.real_score; }).filter(function (x) { return x != null; });
    if (v.length < 2) return null;
    return { n: v.length, spread: Math.max.apply(null, v) - Math.min.apply(null, v) };
  }

  function noiseClause(ranked) {
    var nf = noiseFloor();
    if (!nf) {
      return 'How much of that is the setting and how much is chance cannot be said from this page: ' +
        'no configuration was trained twice, so there is no measurement of how far the same settings ' +
        'move when only the seed changes. Read the ordering as a lead to follow, not as a finding.';
    }
    var top = ranked[0].spread, bottom = ranked[ranked.length - 1].spread;
    var clause = 'Training the same configuration ' + nf.n + ' times with different seeds moved the score by ' +
      num(nf.spread, 3) + ', so that is the floor below which a difference here is not a difference. ';
    if (top > nf.spread * 2) {
      clause += 'The first is comfortably above it' +
        (bottom <= nf.spread ? ' and the last is not above it at all, so a laboratory tuning this simulator should spend its time on the first and leave the last alone.'
                             : ', so it is worth tuning; the smaller effects are closer to the floor and should be treated with more caution.');
    } else {
      clause += '<b>Nothing here clears that floor by a comfortable margin</b>, so this sweep does not ' +
        'establish that any of these settings matters more than the others, and the honest reading is ' +
        'that a longer schedule or repeated runs would be needed before advising anyone where to tune.';
    }
    return clause;
  }

  // Spearman, computed here rather than taken from the results file, because the sign
  // convention is where this goes wrong. The x axis is distance from real, where smaller
  // is more realistic, and the y axis is score, where larger is better. So the
  // fellowship's idea holding means low distance goes with high score, which is a
  // NEGATIVE correlation between the two raw quantities. Reporting that raw number as
  // "agreement" would call a success a failure, which is what this page did.
  function rankAgreement(rows) {
    var n = rows.length;
    if (n < 3) return null;
    function ranks(vals) {
      var idx = vals.map(function (v, i) { return [v, i]; }).sort(function (a, b) { return a[0] - b[0]; });
      var r = new Array(vals.length);
      for (var i = 0; i < idx.length;) {
        var j = i;
        while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
        var avg = (i + j) / 2 + 1;
        for (var k = i; k <= j; k++) r[idx[k][1]] = avg;
        i = j + 1;
      }
      return r;
    }
    var a = ranks(rows.map(function (r) { return r.stat_distance_to_real; }));
    var b = ranks(rows.map(function (r) { return r.real_score; }));
    var ma = a.reduce(function (s, v) { return s + v; }, 0) / n;
    var mb = b.reduce(function (s, v) { return s + v; }, 0) / n;
    var num = 0, da = 0, db = 0;
    for (var i = 0; i < n; i++) {
      num += (a[i] - ma) * (b[i] - mb);
      da += (a[i] - ma) * (a[i] - ma);
      db += (b[i] - mb) * (b[i] - mb);
    }
    if (da === 0 || db === 0) return null;
    var raw = num / Math.sqrt(da * db);
    // Flip so that positive means the idea works: realistic-looking settings score well.
    return { agreement: -raw, raw_distance_vs_score: raw, n: n };
  }

  function drawThesis() {
    var host = $('#thesisviz'); if (!host) return;
    var rows = (D.configs || []).filter(function (c) {
      return c.real_score != null && c.stat_distance_to_real != null;
    });
    if (rows.length < 3) {
      host.innerHTML = '<p class="small">Not enough finished runs yet to compare the two rankings.</p>';
      $('#thesisstat').innerHTML = '';
      $('#v3').innerHTML = '<b>This act is empty until the sweep finishes.</b> It will either show that unlabelled statistics pick the settings that work, or that they do not, and both are worth publishing.';
      return;
    }
    var narrow = isNarrow();
    var W = narrow ? 400 : 860, H = narrow ? 350 : 320;
    var P = narrow ? { l: 44, r: 14, t: 22, b: 50 } : { l: 70, r: 26, t: 22, b: 50 };
    var xs = rows.map(function (r) { return r.stat_distance_to_real; });
    var ys = rows.map(function (r) { return r.real_score; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var px = (x1 - x0) * 0.1 || 1, py = (y1 - y0) * 0.1 || 1;
    x0 -= px; x1 += px; y0 -= py; y1 += py;
    var X = function (v) { return P.l + (v - x0) / (x1 - x0) * (W - P.l - P.r); };
    var Y = function (v) { return H - P.b - (v - y0) / (y1 - y0) * (H - P.t - P.b); };
    var s = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Real score against how far the synthetic image statistics sit from the real ones' });
    [0, 0.5, 1].forEach(function (f) {
      var gy = y0 + f * (y1 - y0), gx = x0 + f * (x1 - x0);
      s.appendChild(el('line', { x1: P.l, y1: Y(gy), x2: W - P.r, y2: Y(gy), stroke: '#e2e0dc' }));
      s.appendChild(el('text', { x: P.l - 8, y: Y(gy) + 4, 'text-anchor': 'end',
        'font-family': "'IBM Plex Mono',monospace", 'font-size': 10, fill: '#8b95a1' }, num(gy, 2)));
      s.appendChild(el('text', { x: X(gx), y: H - P.b + 16, 'text-anchor': 'middle',
        'font-family': "'IBM Plex Mono',monospace", 'font-size': 10, fill: '#8b95a1' }, num(gx, 2)));
    });
    rows.forEach(function (r) {
      s.appendChild(el('circle', { cx: X(r.stat_distance_to_real), cy: Y(r.real_score), r: 5, fill: '#2c4a6b' }));
      s.appendChild(el('text', { x: X(r.stat_distance_to_real) + 8, y: Y(r.real_score) + 4,
        'font-family': "'IBM Plex Mono',monospace", 'font-size': 9.5, fill: '#8b95a1' }, esc(r.name)));
    });
    s.appendChild(el('text', { x: 0, y: 12, 'font-family': "'IBM Plex Sans',sans-serif", 'font-size': 11.5, fill: '#5b6470' },
      'Score on real labelled footage, higher is better'));
    s.appendChild(el('text', { x: W, y: H - 6, 'text-anchor': 'end', 'font-family': "'IBM Plex Sans',sans-serif",
      'font-size': 11.5, fill: '#5b6470' }, narrow ? 'Statistical distance to real' :
      'Distance between synthetic and real image statistics, no labels used'));
    host.innerHTML = ''; host.appendChild(s);
    $('#thesislegend').innerHTML = '<span class="hint">Left is more like real footage, up is a better ' +
      'score. If the idea holds, the points run from the top left down to the bottom right, because ' +
      'the settings that look most like the real thing are the settings that work. Rank agreement is ' +
      'written so that <b>positive means exactly that</b>: it is the correlation between the two ' +
      'orderings, both taken best first, so plus one is the idea working perfectly and minus one is ' +
      'it working backwards.</span>';

    var t = D.thesis_test || {};
    // The page computes the agreement itself so the sign convention lives where it is
    // used. A value from the results file is only trusted if it declares its own sign.
    var ra = rankAgreement(rows);
    var agree = ra ? ra.agreement : null;
    var supports = agree == null ? null : agree > 0.3;
    // Best by each criterion, computed from the same rows as the agreement. Taking these
    // from the results file let the page say the rankings agreed perfectly and then name
    // two different winners.
    var bestStats = rows.slice().sort(function (a, b) { return a.stat_distance_to_real - b.stat_distance_to_real; })[0];
    var bestReal = rows.slice().sort(function (a, b) { return b.real_score - a.real_score; })[0];
    var nameStats = bestStats ? bestStats.name : null, nameReal = bestReal ? bestReal.name : null;
    $('#thesisstat').innerHTML =
      '<div><div class="k">Configurations</div><div class="n">' + (t.n_configs != null ? t.n_configs : rows.length) +
      '</div><div class="s">each a model trained from scratch</div></div>' +
      '<div><div class="k">Rank agreement</div><div class="n">' + (agree != null ? num(agree, 2) : 'n/a') +
      '</div><div class="s">between the two orderings</div></div>' +
      '<div><div class="k">Best without labels</div><div class="n" style="font-size:15px">' + esc(nameStats || 'n/a') +
      '</div><div class="s">chosen by statistics alone</div></div>' +
      '<div><div class="k">Best with labels</div><div class="n" style="font-size:15px">' + esc(nameReal || 'n/a') +
      '</div><div class="s">the answer</div></div>';

    if (agree == null) {
      // A partial sweep is a likely way for this to end, so say what is missing and
      // what the finished part does show, rather than printing the word "nothing"
      // twice and leaving a reader to work out whether that is a result.
      var both = nameStats && nameReal;
      $('#v3').innerHTML = '<b>Too few configurations to put a number on it.</b> ' +
        rows.length + ' finished ' +
        ((t.n_configs || rows.length) === 1 ? 'configuration cannot' : 'configurations cannot') +
        ' support a rank correlation worth quoting, so none is quoted. ' +
        (both
          ? 'Of what did finish, the statistics pick ' + esc(nameStats) + ' and the real scores pick ' +
            esc(nameReal) + ', which is ' + (nameStats === nameReal ? 'agreement' : 'disagreement') +
            ' on a sample far too small to lean on.'
          : 'Until enough runs finish, this act reports nothing, which is the correct thing for it to report.');
    } else if (supports) {
      $('#v3').innerHTML = '<b>Unlabelled statistics do pick settings that work, on this system.</b> ' +
        'The two rankings agree to ' + num(agree, 2) + ' across ' + rows.length +
        ' configurations, and the setting chosen without labels, ' + esc(nameStats) +
        ', is ' + (nameStats === nameReal ? 'the same one the labels chose' : 'not the one the labels chose, ' + esc(nameReal)) +
        '. That is one species and one microscope, so it is evidence that the loop is worth building rather than proof it generalises.';
    } else {
      $('#v3').innerHTML = '<b>Unlabelled statistics do not pick the settings that work here.</b> ' +
        'The two rankings agree to only ' + num(agree, 2) + ' across ' + rows.length +
        ' configurations. Matching what a frame looks like is not the same as matching what a detector needs, and on this system the difference is large enough to matter. ' +
        'That is a finding rather than a failure: it says the tuning signal has to come from somewhere other than plain image statistics.' +
        // A weak correlation is only evidence against the thesis if the thing it is
        // correlated against is itself stable. If seed noise is comparable to the spread
        // across configurations, the real ranking is partly noise and no statistic could
        // track it, which would look identical to the thesis being wrong.
        (function () {
          var nf = noiseFloor();
          if (!nf) {
            return ' One caution before anyone quotes this: no configuration was trained twice, so ' +
              'there is no measure of how much the real ranking moves on seed alone. If it moves a ' +
              'lot, no statistic could track it and this null would say more about the noise than ' +
              'about the idea.';
          }
          var sc = rows.map(function (r) { return r.real_score; });
          var spread = Math.max.apply(null, sc) - Math.min.apply(null, sc);
          return spread > nf.spread * 2
            ? ' The real ranking it is measured against is stable enough to carry the weight: the ' +
              'scores span ' + num(spread, 3) + ' while the same configuration retrained on a different ' +
              'seed moves ' + num(nf.spread, 3) + '.'
            : ' <b>Treat this null with care.</b> The scores span only ' + num(spread, 3) +
              ' while retraining the same configuration on a different seed moves ' + num(nf.spread, 3) +
              ', so the ranking these statistics failed to predict is itself largely noise. Nothing could ' +
              'have predicted it, and that is a fact about this schedule rather than about the idea.';
        })();
    }
  }

  function fillProse() {
    var b = D.baseline || {}, dr = D.defaults_run || {}, m = D.metric || {}, rd = D.real_data || {}, hw = D.hardware || {};
    $('#byrepo').textContent = (D.repo && D.repo.url ? D.repo.url.replace('https://github.com/', '') : 'deeptangle');
    $('#dek').innerHTML =
      'The detector this page takes apart was trained entirely on simulated worms, by the group that wrote both. ' +
      '<strong>Changing one simulator setting at a time and retraining shows which of them the result actually depends on</strong>, ' +
      'scored against ' + (rd.clips != null ? rd.clips + ' clips of real footage a human labelled' : 'real labelled footage') + '. ' +
      'The last act asks the question the fellowship is built on: whether those settings can be chosen with no labels at all. ' +
      // The strongest fact against this page's own premise, computed, in the first screen.
      (function () {
        var cov = (D.labelling_check || {}).simulator_length_coverage;
        return cov ? 'One finding sits against all of it: only ' + cov.inside_range_pct +
          ' percent of the real worms are even inside the length range the simulator can produce, ' +
          'so there are worms here that no setting on this page can reach.' : '';
      })();
    $('#baselinestat').innerHTML =
      '<div><div class="k">Published weights</div><div class="n">' + num(b.real_score) +
      '</div><div class="s">' + esc(b.what || 'the model released with the paper') + '</div></div>' +
      '<div><div class="k">Retrained here</div><div class="n">' + num(dr.real_score) +
      '</div><div class="s">same settings, shorter training</div></div>' +
      '<div><div class="k">Real clips</div><div class="n">' + (rd.clips != null ? rd.clips : 'n/a') +
      '</div><div class="s">' + esc(rd.licence || '') + '</div></div>' +
      // Precision is only shown because the labelling was checked and found exhaustive.
      // On a partially labelled set it would be a number about the labelling effort.
      ((D.baseline_per_clip && D.baseline_per_clip.stated && D.baseline_per_clip.stated.precision != null &&
        (D.labelling_check || {}).verdict_exhaustive)
        ? '<div><div class="k">Its precision</div><div class="n">&ge; ' + num(D.baseline_per_clip.stated.precision) +
          '</div><div class="s">' + n(D.baseline_per_clip.stated.predictions) + ' detections against ' +
          n(D.baseline_per_clip.stated.labels) + ' labelled worms at the repository\'s own threshold of 0.5. ' +
          'A floor, badly understated: the labels sit in the middle of each frame and detections are ' +
          'counted across all of it. The coda explains</div></div>'
        : '') +
      '<div><div class="k">Metric</div><div class="n" style="font-size:15px">' + esc(m.name || 'n/a') +
      '</div><div class="s">' + esc(m.what_it_measures || '') + '</div></div>';
    $('#v1').innerHTML = b.real_score == null
      ? '<b>The baseline has not finished running.</b> Until it has, no number on this page should be read.'
      : '<b>The published weights score ' + num(b.real_score) + ' on real footage.</b> ' +
        (b.paper_reports != null
          ? 'The paper reports ' + num(b.paper_reports) + ' on its own evaluation, so the two are close enough that the code below is measuring what it claims to. '
          : 'The paper does not report a directly comparable figure, so this is an internal reference rather than a reproduction. ') +
        (dr.real_score != null
          ? 'Retraining with the authors\' own settings at the shorter schedule used here reaches ' + num(dr.real_score) +
            ', and that offset, not the published number, is what every swept configuration should be compared against.'
          : '');
    $('#hardwaretext').innerHTML = hw.where
      ? 'Every model was trained on ' + esc(hw.where) + ', a ' + esc(hw.gpu || 'single GPU') + ', through ' +
        esc(hw.backend || 'the repository\'s own stack') + ', at ' +
        (hw.one_run_seconds != null ? Math.round(hw.one_run_seconds / 60) + ' minutes a run' : 'a reduced schedule') + '. ' +
        // Worth stating for anyone planning the same thing on one card: the fixed cost of
        // starting a run is large, and it is compilation rather than the training itself.
        ((hw.startup_seconds != null && hw.seconds_per_step != null)
          ? 'Starting a run costs about ' + Math.round(hw.startup_seconds) + ' seconds before any ' +
            'training happens, almost all of it compilation, against ' + num(hw.seconds_per_step, 2) +
            ' seconds a step afterwards. On a card like this one the fixed cost is what decides how ' +
            'a sweep should be shaped: many short runs waste most of their time compiling, and each ' +
            'additional distinct worm count is another shape to compile.'
          : '')
      : '';
    var lims = D.limits || [];
    $('#lim1').textContent = lims[0] || 'One setting is moved at a time, so nothing here says what happens when two are wrong together, which is the usual case.';
    $('#lim2').textContent = lims[1] || 'The real footage is one published labelled set from the same laboratory that wrote the simulator, so it is the friendliest real data this system will ever see.';

    // The hardest limit on this page, and it is a limit on the approach rather than on
    // the sweep: a real worm outside the length range the simulator draws from is a worm
    // no configuration can produce, so no amount of tuning reaches it.
    var cov = (D.labelling_check || {}).simulator_length_coverage;
    var l3 = $('#lim3');
    if (l3) {
      if (!cov) { l3.textContent = ''; }
      else {
        var dates = Object.keys(cov.by_recording_date || {}).filter(function (k) { return /\d{4}-/.test(k); });
        var spread = '';
        if (dates.length >= 2) {
          var a = cov.by_recording_date[dates[0]], b2 = cov.by_recording_date[dates[dates.length - 1]];
          spread = ' And there is no single right answer to aim at: worms recorded on ' + esc(dates[0]) +
            ' have a median length of ' + a.median_length_px + ' px against ' + b2.median_length_px +
            ' px on ' + esc(dates[dates.length - 1]) + ', so one length setting cannot match both ' +
            'and every configuration here is being tuned against a mixture.';
        }
        l3.innerHTML = '<b>Only ' + cov.inside_range_pct + ' percent of the real worms are inside the ' +
          'length range the simulator can produce</b>, which is ' + cov.simulator_length_range_px[0] +
          ' to ' + cov.simulator_length_range_px[1] + ' pixels against a real median of ' +
          cov.real_length_px.median + '. A worm outside that range is one no configuration on this page ' +
          'can generate, so it is a limit on the whole approach rather than on this sweep.' + spread;
      }
    }
    if (D.repo) {
      $('#src-repo').innerHTML = 'The detector and its simulator: <a href="' + esc(D.repo.url) + '">' +
        esc((D.repo.url || '').replace('https://github.com/', '')) + '</a>, commit ' + esc(D.repo.commit || '') +
        ', licensed ' + esc(D.repo.licence || '') + '. Used unmodified.';
    }
    if (rd.url) {
      $('#src-data').innerHTML = 'The labelled real footage: <a href="' + esc(rd.url) + '">' + esc(rd.source || rd.url) +
        '</a>, ' + esc(rd.licence || '') + '.';
    }
  }

  // Every model here is trained far below the published schedule, and a reader from this
  // group will want to know what that buys before they will read anything else. So the
  // defaults run is scored at several points along its training rather than only at the
  // end, and the curve says whether the schedule is above the threshold where the model
  // learns at all. A flat curve would mean the whole sweep compares noise against noise.
  function drawCurve() {
    var dr = D.defaults_run || {};
    var pts = (dr.learning_curve || []).filter(function (p) { return p.steps != null && p.real_score != null; })
      .sort(function (a, b) { return a.steps - b.steps; });
    var text = $('#curvetext'), host = $('#curveviz');
    if (!text || !host) return;
    if (pts.length < 2) {
      text.textContent = pts.length
        ? 'The defaults run was scored at one point only, so there is no curve to read and no way to ' +
          'tell from this page whether the schedule is long enough to be learning.'
        : '';
      caption('#curveviz', '');
      return;
    }
    var last = pts[pts.length - 1], prev = pts[pts.length - 2];
    var gain = last.real_score - prev.real_score;
    var total = last.real_score - pts[0].real_score;
    var base = D.baseline && D.baseline.real_score;
    text.innerHTML = 'Scored along the way, the defaults configuration reaches ' + num(last.real_score) +
      ' after ' + n(last.steps) + ' steps' +
      (base != null ? ', against ' + num(base) + ' for the weights published with the paper, which were trained ' +
        'roughly three hundred thousand steps across eight devices' : '') + '. ' +
      (Math.abs(total) < 0.02
        ? '<b>The curve is flat.</b> At this schedule the model is not learning enough for a difference ' +
          'between configurations to mean anything, so the sweep below should be read as inconclusive ' +
          'rather than as a set of findings about the simulator.'
        : (gain > 0.01
            ? '<b>It is still climbing at the end.</b> The last step interval added ' + num(gain) +
              ', so these models are cut off well before they stop improving. That is the intended ' +
              'trade: every configuration gets the same short schedule, so the comparison between them ' +
              'is fair even though none of them is any good.'
            : '<b>It has flattened by the end.</b> The last step interval added ' + num(gain) +
              ', so more steps at this size would buy little and the comparison below is not being ' +
              'decided by where the schedule was cut.'));

    var narrow = isNarrow();
    var W = narrow ? 400 : 760, H = narrow ? 240 : 220;
    var P = narrow ? { l: 44, r: 14, t: 16, b: 40 } : { l: 58, r: 20, t: 14, b: 38 };
    var xs = pts.map(function (p) { return p.steps; });
    var ys = pts.map(function (p) { return p.real_score; });
    var maxX = Math.max.apply(null, xs);
    var hiY = Math.max.apply(null, ys.concat(base != null ? [base] : []));
    var loY = Math.min.apply(null, ys.concat([0]));
    if (hiY <= loY) hiY = loY + 1;
    var X = function (v) { return P.l + v / maxX * (W - P.l - P.r); };
    var Y = function (v) { return H - P.b - (v - loY) / (hiY - loY) * (H - P.t - P.b); };
    var s = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Score on real footage against training steps for the default settings' });
    [loY, (loY + hiY) / 2, hiY].forEach(function (g) {
      s.appendChild(el('line', { x1: P.l, y1: Y(g), x2: W - P.r, y2: Y(g), stroke: '#e2e0dc' }));
      s.appendChild(el('text', { x: P.l - 8, y: Y(g) + 4, 'text-anchor': 'end',
        'font-family': "'IBM Plex Mono',monospace", 'font-size': 10, fill: '#8b95a1' }, num(g, 2)));
    });
    if (base != null) {
      s.appendChild(el('line', { x1: P.l, y1: Y(base), x2: W - P.r, y2: Y(base),
        stroke: '#2c4a6b', 'stroke-dasharray': '5 4', 'stroke-width': 1.6 }));
      s.appendChild(el('text', { x: W - P.r, y: Y(base) - 6, 'text-anchor': 'end',
        'font-family': "'IBM Plex Sans',sans-serif", 'font-size': 11, fill: '#2c4a6b' },
        'the published weights'));
    }
    s.appendChild(el('path', {
      d: pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.steps).toFixed(1) + ' ' + Y(p.real_score).toFixed(1); }).join(' '),
      fill: 'none', stroke: '#b03a3a', 'stroke-width': 2.4 }));
    pts.forEach(function (p) {
      s.appendChild(el('circle', { cx: X(p.steps), cy: Y(p.real_score), r: 4, fill: '#b03a3a' }));
      s.appendChild(el('text', { x: X(p.steps), y: H - P.b + 15, 'text-anchor': 'middle',
        'font-family': "'IBM Plex Mono',monospace", 'font-size': 10, fill: '#8b95a1' }, n(p.steps)));
    });
    s.appendChild(el('text', { x: W, y: H - 4, 'text-anchor': 'end',
      'font-family': "'IBM Plex Sans',sans-serif", 'font-size': 11, fill: '#5b6470' }, 'training steps'));
    host.innerHTML = ''; host.appendChild(s);
    caption('#curveviz', 'What the default settings score on real footage as training goes on. ' +
      'Every configuration in act two is cut off at the last point on this line.');
  }

  // Seventeen models are trained on this page, so it carries a card saying what they
  // are and what they are not. Every row comes from the study output rather than from
  // prose, so a row that says "not recorded" is a gap in the record and looks like one.
  function modelCard() {
    var host = $('#modelcard'); if (!host) return;
    var t = D.training || {}, hw = D.hardware || {}, m = D.metric || {}, rd = D.real_data || {};
    var cfgs = D.configs || [];
    var done = cfgs.filter(function (c) { return c.real_score != null; });
    var failed = cfgs.filter(function (c) { return c.real_score == null; });
    function miss(v, unit) { return v == null ? '<i>not recorded</i>' : esc(String(v)) + (unit || ''); }
    var rows = [
      ['What is trained', 'The architecture published with ' +
        esc((D.repo && D.repo.url || '').replace('https://github.com/', '') || 'the repository') +
        ', from scratch, once per simulator configuration. No pretrained weights are used as a starting point, ' +
        'because starting from weights trained on the default simulator would bias every result toward the defaults.'],
      ['Trained on', 'Synthetic frames only, generated by the repository\'s own simulator at the configuration ' +
        'under test. No real footage enters training at any point.'],
      ['Evaluated on', (rd.clips != null ? n(rd.clips) : '<i>not recorded</i>') + ' clips of real microscopy carrying ' +
        (rd.worms_labelled != null ? n(rd.worms_labelled) : '<i>not recorded</i>') +
        ' hand-drawn worm centrelines, from ' + esc(rd.source || 'a published dataset') +
        ', ' + esc(rd.licence || '') + '. Never seen during training.'],
      ['Schedule', (t.train_steps != null || t.batch_size != null)
        ? miss(t.train_steps) + ' steps at batch ' + miss(t.batch_size) +
          (t.nworms ? ', worm counts ' + esc(String(t.nworms)) : '') +
          '. Identical for every configuration including the defaults, so the only thing that differs between ' +
          'runs is the simulator setting.'
        : '<i>not recorded in the study output</i>'],
      ['Compared against', 'The defaults configuration retrained here on the same schedule, not the published ' +
        'weights. The published weights were trained roughly three hundred thousand steps across eight devices, ' +
        'so comparing against them would measure the schedule rather than the simulator.'],
      // The description already carries the cutoff, so repeating it reads as two numbers
      // where there is one. It is only appended when the description does not mention it.
      ['Scored by', (function (w) { return /[.!?]$/.test(w) ? w : w + '.'; })(esc(m.what_it_measures || m.name || 'a matching metric')) +
        ' The distance is an average along the labelled centreline, not a worst case. Detections are ' +
        'taken at the repository\'s own confidence threshold of 0.5 with its own overlap suppression, ' +
        'so precision is a property of the model at that setting.' +
        ((m.cutoff_px != null && !/pixel/i.test(m.what_it_measures || ''))
          ? ', at a cutoff of ' + m.cutoff_px + ' pixels' : '') + '.'],
      ['Where', miss(hw.where) + ', ' + miss(hw.gpu) + ', through ' + miss(hw.backend) + '.'],
      ['Runs finished', done.length + ' of ' + cfgs.length +
        (failed.length
          ? '. The ' + failed.length + ' that did not are recorded as unfinished rather than as a low score, ' +
            'because a failed run and a bad setting are different things and the page will not blur them.'
          : '. Every configuration produced a score.')],
      ['What it must not be used for', 'Detecting worms. These models are trained far below the published ' +
        'schedule and every one of them is worse than the released weights. The comparison between them is the ' +
        'result; none of them is.']
    ];
    host.innerHTML = rows.map(function (r) {
      return '<tr><td class="l" style="width:170px;vertical-align:top"><b>' + r[0] + '</b></td><td class="l">' + r[1] + '</td></tr>';
    }).join('');
    var note = $('#modelcardnote');
    if (note) {
      note.innerHTML = (t.train_steps == null)
        ? 'The schedule row is blank because the study output did not record it. That is a gap in the record, ' +
          'not a schedule of zero, and it is left visible rather than filled in from memory.'
        : '';
    }
  }

  // The baseline is the number every other number on this page is compared against, so
  // the browser adds it up again from the per-clip counts. It also shows the one subtlety
  // in the arithmetic: a single detection can sit within three pixels of two different
  // labelled worms, which is the case this detector exists for, so precision counts
  // distinct detections that matched rather than labels that were matched.
  function selfCheck() {
    var host = $('#selfcheck'); if (!host) return;
    var bp = D.baseline_per_clip;
    if (!bp || !bp.sections) { host.textContent = 'The per-clip counts were not shipped, so nothing could be rechecked.'; return; }
    var lab = 0, found = 0, pred = 0, claimed = 0;
    Object.keys(bp.sections).forEach(function (k) {
      var s = bp.sections[k];
      lab += s.labels; found += s.found; pred += s.predictions; claimed += s.claimed;
    });
    var st = bp.stated || {};
    var recall = lab ? found / lab : null;
    var precision = pred ? claimed / pred : null;
    var okCounts = st.labels === lab && st.found === found && st.predictions === pred;
    var okRates = recall != null && precision != null &&
      Math.abs(recall - st.recall) < 5e-4 && Math.abs(precision - st.precision) < 5e-4;
    if (okCounts && okRates) {
      host.innerHTML = '<b>Matched.</b> Adding up the ' + Object.keys(bp.sections).length +
        ' clips here gives ' + found + ' of ' + lab + ' labelled worms found, a recall of ' +
        num(recall) + ', and ' + claimed + ' of ' + pred + ' detections matching something, a precision of ' +
        num(precision) + ', which is a floor rather than a rate for the reason the next section gives. Both are what ' +
        'the study reported. Note that ' + found + ' labels were matched by ' +
        claimed + ' detections: ' + (found - claimed) + ' of them sat within the cutoff of a detection that ' +
        'also matched another worm, which is the overlapping case this detector was built for, so precision ' +
        'counts distinct detections rather than labels.';
    } else {
      host.innerHTML = '<b>Did not match.</b> Adding up the clips gives ' + found + ' of ' + lab +
        ' found and ' + claimed + ' of ' + pred + ' detections matching, which is a recall of ' + num(recall) +
        ' and a precision of ' + num(precision) + ', against the ' + num(st.recall) + ' and ' + num(st.precision) +
        ' this page reports. The totals and the parts disagree, and the parts are the evidence.';
    }
  }

  // Whether precision is a real false-alarm rate or an artefact of how much a human
  // bothered to click. The dataset says nothing either way, so it is measured: if
  // every worm in a crop is labelled, labels per crop must rise in proportion to the
  // stated worm density, on a line through the origin.
  function drawLabelCheck() {
    var lc = D.labelling_check;
    var text = $('#labelcheck');
    if (!lc) {
      text.textContent = 'Not checked. Until it is, an unmatched detection might be a false ' +
        'positive or might be a real worm nobody clicked, so precision is not quoted anywhere above.';
      return;
    }
    var by = lc.labels_per_clip_by_density || {};
    // Keep the keys as written. They are strings like "1.0", so turning them into
    // numbers and back loses the match and every lookup comes out undefined.
    var keys = Object.keys(by).sort(function (a, b) { return Number(a) - Number(b); });
    if (!keys.length) { text.textContent = 'Not checked.'; return; }
    var first = keys[0], last = keys[keys.length - 1];
    var cs = lc.crossing_scaling, reg = lc.label_region;
    var parts = [];
    parts.push('The clips come from videos at stated worm densities from ' + Number(first) + ' to ' +
      Number(last) + ' times, and labels per clip rise in proportion to that density on a line through ' +
      'the origin: ' + by[first].mean_labels + ' a clip at the lowest rising to ' + by[last].mean_labels +
      ' at the highest, fitted at ' + lc.slope_labels_per_unit_density + ' per unit density with an R ' +
      'squared of ' + lc.r_squared_through_origin + '. <b>That rules out a fixed quota per clip and ' +
      'nothing else.</b> Someone marking a constant share of the worms produces the same line with a ' +
      'smaller slope.');
    if (cs) {
      parts.push('A second test, on how often labelled worms cross each other, was written to catch a ' +
        'labeller skipping the tangled ones. <b>It does not work and the page will not lean on it.</b> ' +
        'Marking each worm with a constant probability multiplies the crossings by that probability ' +
        'squared, which cancels out of the slope entirely, so the statistic cannot see a constant share ' +
        'at all. The measurement is also too thin to settle anything on its own terms: the exponent is ' +
        cs.exponent + ' with a 95 percent interval of ' + cs.exponent_95_interval[0] + ' to ' +
        cs.exponent_95_interval[1] + ', across ' + cs.usable_bins + ' usable density bins, and that ' +
        'interval contains the ' + cs.quadratic_would_be + ' it was meant to be distinguished from.');
    }
    if (reg) {
      var bx = reg.smallest_box_holding_97_pct;
      parts.push('<b>Looking directly is what found something.</b> The labels are not spread across the ' +
        'crop. ' + bx.points_inside_pct + ' percent of every clicked point falls inside a central ' +
        bx.side_px + ' pixel box, which is ' + bx.area_share_pct + ' percent of the ' + reg.frame_px +
        ' pixel frame. That mode passes both tests above, which is why neither saw it.');
      parts.push('Two things could put the labels there and this page cannot tell them apart. Someone ' +
        'may have labelled the middle of each crop and left the edges. Or the crops may have been cut ' +
        'around something already found, so the worms of interest sit in the centre by construction and ' +
        'the labelling inside that region is complete. <b>The consequence for scoring is the same either ' +
        'way</b>, which is why the distinction is worth naming and then setting aside.');
      parts.push('<b>So the precision quoted in act one is badly understated, and not by a little.</b> ' +
        'Detections are counted over the whole frame while labels exist in about ' + bx.area_share_pct +
        ' percent of it, so a correct detection in the unlabelled majority is recorded as a false ' +
        'positive. The number is a floor with a large and unmeasured gap beneath the truth. Fixing it ' +
        'means scoring detections inside the labelled region alone, which is a change to the scoring ' +
        'code rather than a caveat, and until that is done this page reports recall and distance as ' +
        'measurements and precision as a floor.');
    }
    text.innerHTML = lc.verdict_exhaustive
      ? parts.join(' ')
      : 'Labels per clip do not track the stated worm density, so an unmatched detection may well be ' +
        'a real worm nobody clicked. Precision is not reported as a rate anywhere on this page.';

    var host = $('#labelcheckviz'); if (!host) return;
    var narrow = isNarrow();
    var W = narrow ? 400 : 760, H = narrow ? 230 : 210;
    var P = narrow ? { l: 42, r: 14, t: 18, b: 38 } : { l: 52, r: 18, t: 16, b: 34 };
    var maxX = Number(last);
    var maxY = Math.max.apply(null, keys.map(function (k) { return by[k].mean_labels; }));
    var sx = function (v) { return P.l + v / maxX * (W - P.l - P.r); };
    var sy = function (v) { return H - P.b - v / maxY * (H - P.t - P.b); };
    var s = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Labels per clip against stated worm density, with the proportional fit' });
    s.appendChild(el('line', { x1: P.l, y1: H - P.b, x2: W - P.r, y2: H - P.b, stroke: '#c9c5bd' }));
    s.appendChild(el('line', { x1: P.l, y1: P.t, x2: P.l, y2: H - P.b, stroke: '#c9c5bd' }));
    // the line the hypothesis predicts, drawn before the points it is tested against
    s.appendChild(el('line', { x1: sx(0), y1: sy(0), x2: sx(maxX),
      y2: sy(lc.slope_labels_per_unit_density * maxX), stroke: '#2c4a6b', 'stroke-width': 1.5,
      'stroke-dasharray': '5 4' }));
    keys.forEach(function (k) {
      var row = by[k], x = Number(k);
      s.appendChild(el('circle', { cx: sx(x), cy: sy(row.mean_labels), r: 4, fill: '#2c4a6b' }));
      s.appendChild(el('text', { x: sx(x), y: H - P.b + 15, 'text-anchor': 'middle',
        'font-family': "'IBM Plex Mono',monospace", 'font-size': 10, fill: '#8b95a1' }, Number(k) + 'x'));
    });
    caption('#labelcheckviz', 'Mean labels per clip against stated worm density. The dashed line is ' +
      'proportional, not fitted to an intercept.');
    host.innerHTML = '';
    host.appendChild(s);
  }

  function tour() {
    var root = $('#tour'), hl = $('.tour-hl', root), card = $('.tour-card', root), idx = 0;
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var STEPS = [
      { sel: 'header h1', k: 'Welcome · 1 of 5', html: 'A detector trained entirely on simulated worms, taken apart to find which of the simulator\'s settings the result depends on.' },
      { sel: '#domain', k: 'The loop · 2 of 5', html: 'Settings make synthetic footage, synthetic footage trains a model, the model is scored on real footage. The dashed line is the loop the fellowship wants closed without labels.' },
      { sel: '#baselinestat', k: 'The reference · 3 of 5', html: 'The published weights, scored by this page\'s own code. Every number later is a comparison against this one, so the coda adds the per-clip counts up again in your browser to show it is the sum of its own parts.' },
      { sel: '#sweepviz', k: 'One setting at a time · 4 of 5', html: '<b>Click a setting above the chart.</b> Each point is a model trained from scratch with that setting moved and scored on the same real footage.' },
      { sel: '#thesisviz', k: 'The real question · 5 of 5', html: 'Every configuration ranked twice: once by real score, once by how closely its synthetic frames match real ones statistically, with no labels. Whether those two agree is the point of the page.' }
    ];
    function place() {
      var st = STEPS[idx], elm = document.querySelector(st.sel);
      if (!elm) { next(); return; }
      var r = elm.getBoundingClientRect(), sx = window.scrollX, sy = window.scrollY;
      var docTop = r.top + sy, docLeft = r.left + sx;
      root.style.height = document.documentElement.scrollHeight + 'px';
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      var target = Math.max(0, Math.min(docTop - 14, maxScroll)), vTop = docTop - target;
      var cw = Math.min(400, innerWidth - 32), ch = 250;
      var fitsRight = r.left + r.width + 18 + cw <= innerWidth - 16;
      var hh = fitsRight ? r.height : Math.max(120, Math.min(r.height, innerHeight - vTop - ch - 40));
      hl.style.left = (docLeft - 8) + 'px'; hl.style.top = (docTop - 8) + 'px';
      hl.style.width = (r.width + 16) + 'px'; hl.style.height = (hh + 16) + 'px';
      var dots = STEPS.map(function (_, i) { return '<i class="' + (i === idx ? 'on' : '') + '"></i>'; }).join('');
      card.innerHTML = '<div class="tk">' + st.k + '</div><p>' + st.html + '</p><div class="tour-nav"><div class="dots">' + dots + '</div>' +
        (idx > 0 ? '<button class="tour-btn" id="tprev">Back</button>' : '') +
        '<button class="tour-btn" id="tskip">Close</button><button class="tour-btn primary" id="tnext">' +
        (idx < STEPS.length - 1 ? 'Next' : 'Done') + '</button></div>';
      var cx, cy;
      if (fitsRight) { cx = docLeft + r.width + 18; cy = docTop; }
      else { cx = Math.min(docLeft, sx + innerWidth - 16 - cw); cy = docTop + hh + 22; }
      card.style.left = Math.max(sx + 16, cx) + 'px';
      card.style.top = Math.max(target + 16, cy) + 'px';
      $('#tnext').onclick = next; $('#tskip').onclick = stop;
      var pv = $('#tprev'); if (pv) pv.onclick = function () { idx = Math.max(0, idx - 1); place(); };
      window.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
    }
    function next() { if (idx >= STEPS.length - 1) { stop(); return; } idx++; place(); }
    function stop() { root.classList.remove('on'); try { localStorage.setItem('sg-tour', 'seen'); } catch (e) { } }
    function start() { idx = 0; root.classList.add('on'); place(); }
    $('#tourbtn').addEventListener('click', start);
    var replace = function () { if (root.classList.contains('on')) place(); };
    window.addEventListener('resize', replace);
    window.addEventListener('load', replace);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(replace);
    if (!location.search.includes('tour=off')) setTimeout(start, 700);
  }

  // A page that renders nothing looks the same as a page whose study has not run,
  // and fixture data used while building the layout looks the same as a result.
  // Both get said out loud rather than drawn, so no number here is ever a stand-in.
  function halt(msg) {
    var b = document.body;
    var d = document.createElement('div');
    d.setAttribute('style', 'margin:24px;padding:16px 18px;border:1px solid #b3261e;' +
      'border-radius:6px;background:#fff4f3;color:#5b1a14;font:14px/1.5 system-ui,sans-serif');
    d.textContent = msg;
    b.insertBefore(d, b.firstChild);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof D === 'undefined') {
      halt('The study output is missing, so this page has nothing to draw. ' +
        'Run study/build_page_data.py to write docs/data.js.');
      return;
    }
    // The guard used to test generated_at for the literal string FIXTURE, which meant
    // fixture content passed silently: a legend reading "fixture" and two limits reading
    // "fixture limit one" and "fixture limit two" rendered as though measured. It now
    // looks for the word anywhere in the data, which is the thing that must never ship.
    var raw = '';
    try { raw = JSON.stringify(D); } catch (e) { raw = ''; }
    var mark = raw.match(/fixture|placeholder|lorem ipsum|TODO/i);
    if (mark) {
      halt('This page is showing fixture data used to check the layout, not a result. The word "' +
        mark[0] + '" appears in the study output, so nothing here is measured. Run ' +
        'study/build_page_data.py against the real sweep output.');
      return;
    }
    redrawOnWidthChange(drawDomain); redrawOnWidthChange(drawLabelCheck); redrawOnWidthChange(drawSweep); redrawOnWidthChange(drawThesis); redrawOnWidthChange(drawCurve);
    drawDomain(); renderAxes(); drawSweep(); drawThesis(); fillProse(); drawCurve(); modelCard(); selfCheck(); drawLabelCheck(); tour();
  });
})();
