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
  // Cutting a chart label at a fixed character count leaves half-words on the page.
  // Strings from the study output start lowercase, and they get injected after a full
  // stop, so they need lifting rather than a sentence rewritten around each one.
  function cap1(t) { t = String(t || ''); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
  function shorten(t, n) {
    t = String(t);
    if (t.length <= n) return t;
    var cut = t.slice(0, n), sp = cut.lastIndexOf(' ');
    return (sp > n * 0.5 ? cut.slice(0, sp) : cut).replace(/[ ,_-]+$/, '') + '\u2026';
  }
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
      // An empty chart with an empty verdict box under it reads as broken rather than
      // as unfinished, so the act says which it is and what it is waiting for.
      var all = (D.configs || []);
      var anyDone = all.filter(function (c) { return c.real_score != null; }).length;
      host.innerHTML = '<p class="small">No finished runs on this setting yet.</p>';
      $('#sweeplegend').innerHTML = '';
      $('#v2').innerHTML = anyDone
        ? '<b>Nothing has finished on this setting yet.</b> ' + anyDone + ' of ' + all.length +
          ' configurations have trained and scored, and none of them is this one. Pick another setting, ' +
          'or read the last section, which says where the sweep stands.'
        : '<b>The sweep has not run yet.</b> The harness, the ' + all.length + ' configurations and the ' +
          'scoring are built and in the repository; what is missing is the training, which needs a GPU ' +
          'for several hours. Until it runs this act is empty, and the page says so rather than showing ' +
          'a chart of nothing. What is measured already sits in act one and in the method section below, ' +
          'and the strongest of it is about the evaluation set rather than about the simulator.';
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
    // Nothing on the chart said where the authors' own value sits, so a reader could not
    // tell which point is the setting they chose and which are departures from it.
    var axisDef = (axes().filter(function (a) { return a.key === state.axis; })[0] || {}).default_value;
    if (axisDef != null && axisDef >= vmin && axisDef <= vmax) {
      s.appendChild(el('line', { x1: X(axisDef), y1: P.t, x2: X(axisDef), y2: H - P.b,
        stroke: '#c8860d', 'stroke-width': 1.4, 'stroke-dasharray': '4 3' }));
      s.appendChild(el('text', { x: X(axisDef) + 5, y: P.t + 11, 'font-family': "'IBM Plex Sans',sans-serif",
        'font-size': 11, fill: '#c8860d' }, 'the value they chose'));
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
    var a = ranks(rows.map(function (r) { return statDist(r); }));
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

  // Half of act three needs no training at all: the unlabelled statistics can be computed
  // for every configuration and ranked. That half is a result on its own, and the most
  // useful thing on this page is a hazard it exposes before any model exists.
  function drawStatsOnly() {
    var rows = (D.configs || []).filter(function (c) { return statDist(c) != null; })
      .slice().sort(function (a, b) { return statDist(a) - statDist(b); });
    var text = $('#statsonly'), host = $('#statrankviz'), v = $('#vstats');
    if (!text) return;
    if (rows.length < 3) {
      text.textContent = 'The statistics have not been computed yet.';
      if (v) v.innerHTML = '';
      var v0 = $('#vstats2'); if (v0) v0.innerHTML = '';
      var p0 = $('#poolcheck'); if (p0) p0.innerHTML = '';
      caption('#statrankviz', '');
      drawGranulometry();
      return;
    }
    var f = D.statistics_only_finding || {};
    var dups = (D.configs || []).filter(function (c) { return c.is_repo_default_on_its_axis; }).length;
    text.innerHTML = 'Every configuration can be compared against the real footage without a model and ' +
      'without a label, by measuring the same things in both: intensity, how sharp the edges are, a ' +
      'size curve from morphological openings that stands in for body width, and how much a frame ' +
      'changes from the one before. The distance below is the average of those, in standard deviations ' +
      'of the spread across the ' + (D.real_data ? D.real_data.clips : '178') + ' real clips. Lower is ' +
      'closer to real footage.' +
      (statDistIsMean() ? ' The whole sweep was run on ' +
        word(((D.stats_noise_floor || {}).seeds || []).length || 3) +
        ' draws of synthetic clips and each bar is the mean of them, because a single draw cannot ' +
        'tell a difference between settings from the luck of which worms came out.' : '') +
      (dups ? ' ' + dups + ' of the ' + (D.configs || []).length + ' configurations hold the repository\'s ' +
        'own value on their own axis, so they are the defaults under another name and score identically; ' +
        'they are kept as reference points and marked.' : '');

    var narrow = isNarrow();
    var W = narrow ? 400 : 860, rowH = narrow ? 24 : 22;
    var P = { l: narrow ? 118 : 150, r: narrow ? 46 : 60, t: 10, b: 18 };
    var H = P.t + P.b + rows.length * rowH;
    var maxD = statDist(rows[rows.length - 1]);
    var X = function (d) { return P.l + d / maxD * (W - P.l - P.r); };
    var s2 = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Configurations ranked by how closely their synthetic frames match real footage' });
    rows.forEach(function (r, i) {
      var y = P.t + i * rowH + rowH / 2;
      var isDef = r.is_repo_default_on_its_axis;
      s2.appendChild(el('text', { x: P.l - 8, y: y + 4, 'text-anchor': 'end',
        'font-family': "'IBM Plex Mono',monospace", 'font-size': narrow ? 9.5 : 10.5,
        fill: isDef ? '#c8860d' : '#5b6470' }, shorten(r.name, narrow ? 15 : 22)));
      var pc = nfOf(r.name);
      var yBar = pc && pc.min != null ? y - 2.5 : y;
      s2.appendChild(el('line', { x1: P.l, y1: yBar, x2: X(statDist(r)), y2: yBar,
        stroke: isDef ? '#c8860d' : '#2c4a6b', 'stroke-width': 5.5, 'stroke-linecap': 'round' }));
      // Where the same configuration landed on each individual draw, drawn clear of the
      // bar rather than across it. Across it, the lower end hides inside the bar and the
      // spread reads as one-sided, which is the opposite of what it is.
      if (pc && pc.min != null && pc.max != null) {
        var yw = y + 4.5;
        s2.appendChild(el('line', { x1: X(pc.min), y1: yw, x2: X(pc.max), y2: yw,
          stroke: '#8b95a1', 'stroke-width': 1 }));
        [pc.min, pc.max].forEach(function (v2) {
          s2.appendChild(el('line', { x1: X(v2), y1: yw - 2.5, x2: X(v2), y2: yw + 2.5,
            stroke: '#8b95a1', 'stroke-width': 1 }));
        });
      }
      s2.appendChild(el('text', { x: X(pc && pc.max != null ? Math.max(pc.max, statDist(r)) : statDist(r)) + 8,
        y: y + 3.5, 'font-family': "'IBM Plex Mono',monospace",
        'font-size': narrow ? 9 : 10, fill: '#8b95a1' }, num(statDist(r), 2)));
    });
    host.innerHTML = ''; host.appendChild(s2);
    caption('#statrankviz', 'Distance from real footage, no labels and no training used. Lower is closer. ' +
      (statDistIsMean() ? 'Each bar is the mean over ' +
        word(((D.stats_noise_floor || {}).seeds || []).length || 3) + ' draws of synthetic clips, and ' +
        'the thin line through it spans what that same configuration scored on the individual draws. ' : '') +
      'Amber rows hold the repository\'s own value on their axis.');

    drawNoiseFloor();

    // The radius warning and the other axes are rendered into two blocks with the
    // granulometry chart between them, because the chart is evidence for the first and
    // would read as evidence for the last if it sat under the whole thing.
    if (v) {
      // The mechanism comes first when it is there, because it is what makes the radius
      // warning, the alpha negative and the length disagreement one thing rather than
      // three separate observations a reader has to join up themselves.
      v.innerHTML = (f.what_the_distance_is_actually_chasing
        ? '<b>The thing worth taking from this act, and it is a warning rather than a result.</b> ' +
          cap1(esc(f.what_the_distance_is_actually_chasing)) +
          ' <b>It detects a motion problem, cannot use the motion parameter to fix it, and ' +
          'spends two appearance parameters instead.</b><br><br>'
        : '') +
        (f.radius_axis_warning
        ? (f.what_the_distance_is_actually_chasing
            ? '<b>The same thing seen from the body radius axis.</b> '
            : '<b>The thing worth taking from this act, and it is a warning rather than a result.</b> ') +
          cap1(esc(f.radius_axis_warning)) + ' <b>So a laboratory tuning on this statistic would thicken ' +
          'its worms and never find what is actually missing from its simulator.</b> The distance has one ' +
          'lever on an error that has nothing to do with body radius, so it pulls that lever. Nothing in ' +
          'the number says it happened, and it is visible here with no labels and no training, which is ' +
          'the cheapest place there is to find it.'
        : '');
    }
    // Each axis is rendered in the words the study output uses for it, including the
    // two it withdraws. A retraction written on the page and a retraction written in
    // the record can drift apart, and only one of them is the study.
    var v2 = $('#vstats2');
    if (v2) {
      var blocks = [];
      var block = function (head, body) {
        if (body) blocks.push('<b>' + head + '</b> ' + cap1(esc(body)));
      };
      // The heading for an axis states its verdict, and the verdict is looked up rather
      // than written here, so an axis that changes when more clips are measured cannot
      // keep a heading that says the opposite of its own paragraph.
      var held = function (axis) {
        var row = ((D.stats_pool_check || {}).axes || []).filter(function (r) {
          return r.axis === axis; })[0];
        if (row) return { holds: row.big.holds, needed: row.big.holds && !row.small.holds };
        var c = axisClaim(axis);
        return { holds: !!(c && c.survives_reseeding), needed: false };
      };
      var noiseV = held('sensor_noise'), radV = held('body_radius'),
          lenV = held('worm_length'), dragV = held('drag_anisotropy');
      block('Sensor noise keeps its ordering.', f.noise_axis_CLEARS_the_floor);
      block('Body radius keeps its ordering.', f.radius_axis_CLEARS_the_floor);
      block(lenV.needed ? 'Worm length keeps its ordering, but only once the pool is big enough.'
            : lenV.holds ? 'Worm length keeps its ordering.'
            : 'Worm length does not, and a finding of this page goes with it.',
            f.length_axis_NEEDED_a_bigger_pool || f.length_axis_DOES_NOT_clear_the_floor);
      block(dragV.holds ? 'The axis that matters most holds, and barely moves.'
            : 'The axis that matters most does not, and that costs the page the most.',
            f.motion_axis_DOES_NOT_clear_the_floor);
      block('The statistic set moves the ordering too.', f.ranking_depends_on_statistic_choice);
      v2.innerHTML = blocks.join('<br><br>');
    }
    drawPoolCheck();
    drawSubsets();
    drawGranulometry();
  }

  // The claim this page makes about one axis, checked against the redrawn sweeps.
  // Small counts read better as words in a sentence than as digits.
  function word(k) {
    var w = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
             'eleven', 'twelve'];
    if (k === 50) return 'fifty';
    if (k === 20) return 'twenty';
    if (k === 25) return 'twenty-five';
    return (k >= 0 && k < w.length) ? w[k] : String(k);
  }

  // The statistics sweep was run on three seeds. Where the seed mean is present it is
  // the number to rank and plot, because that is what the study output ranks on, and a
  // chart drawn from a single seed beside a ranking computed from three would disagree
  // with itself in a way only someone holding both files would notice.
  function statDist(c) {
    return c.stat_distance_mean_over_seeds != null
      ? c.stat_distance_mean_over_seeds : c.stat_distance_to_real;
  }
  // The tightest paired scatter on the axis that carries the page's warning.
  function strongestScatter(nf) {
    var c = (nf.axis_claims || []).filter(function (x) { return x.axis === 'body_radius'; })[0];
    return c && c.strongest_gap ? c.strongest_gap.sd_of_paired_difference : null;
  }

  function nfOf(name) {
    var pc = (D.stats_noise_floor || {}).per_config;
    return pc ? pc[name] : null;
  }
  function statDistIsMean() {
    return (D.configs || []).some(function (c) { return c.stat_distance_mean_over_seeds != null; });
  }

  function axisClaim(key) {
    var nf = D.stats_noise_floor;
    if (!nf || !nf.axis_claims) return null;
    return nf.axis_claims.filter(function (c) { return c.axis === key; })[0] || null;
  }

  function axisLabel(key) {
    var a = (D.axes || []).filter(function (x) { return x.key === key; })[0];
    return a ? a.label.toLowerCase() : key.replace(/_/g, ' ');
  }

  // Act three reads its findings off an ordering, and part of every gap in that
  // ordering is the draw of synthetic clips rather than the setting. Running the
  // whole sweep again on two more seeds is the only thing that separates them,
  // and it costs three minutes a seed because nothing here is trained.
  function drawNoiseFloor() {
    var nf = D.stats_noise_floor;
    var text = $('#noisefloortext'), tbl = $('#noisefloortable'),
        wrap = $('#noisefloorwrap'), note = $('#noisefloornote');
    if (!text || !tbl) return;
    if (!nf || !nf.axis_claims || !nf.axis_claims.length) {
      text.innerHTML = '<b>The statistics were computed once.</b> Every gap below carries an ' +
        'unknown amount of the synthetic draw in it, and nothing here can say how much, so no ' +
        'ordering on this chart should be read as a finding.';
      tbl.innerHTML = '';
      if (wrap) wrap.style.display = 'none';
      if (note) note.textContent = '';
      return;
    }
    if (wrap) wrap.style.display = '';
    var seeds = nf.seeds || [];
    var lost = (nf.does_not_survive || []).length, kept = (nf.survives || []).length;
    var shift = nf.common_shift_between_draws;
    text.innerHTML = 'Those distances come from one pool of synthetic clips, so part of every gap is ' +
      'which worms happened to be drawn. The whole sweep was run ' +
      (seeds.length > 1 ? word(seeds.length) : 'several') + ' times with the worms redrawn and nothing ' +
      'else changed. ' +
      (shift ? 'The draw moves the whole field together, by ' + num(shift.range, 2) +
        ' in the mean distance across all sixteen configurations. Subtract each draw\'s own field ' +
        'mean and a configuration\'s spread across draws falls from ' + num(shift.per_config_sd, 3) +
        ' to ' + num(shift.per_config_sd_after_removing_the_shift, 3) + ', so most of it is that ' +
        'shared shift and not the setting. Settings are therefore compared inside a draw and the ' +
        'differences averaged afterwards. ' : '') +
      (lost
        ? 'On that comparison ' + word(kept) + ' of the ' + word(kept + lost) + ' axes keep their ' +
          'ordering every time and ' + word(lost) + ' do not, and one of the findings this page ' +
          'reported from the first draw does not survive the other two.'
        : 'Every axis keeps its ordering.');

    var head = '<thead><tr><th>Simulator setting</th><th>Repository value</th>' +
      '<th>Where it sits on its axis, by draw</th><th>Ordering</th></tr></thead>';
    var body = nf.axis_claims.map(function (c) {
      var pos = seeds.map(function (s) { return c.repo_position_on_axis_by_seed[String(s)]; });
      var ok = c.survives_reseeding;
      return '<tr><td class="l">' + esc(axisLabel(c.axis)) + '</td>' +
        '<td class="num">' + n(c.repo_value) + '</td>' +
        '<td class="num">' + pos.join(', ') + ' of ' + c.settings_tested_on_axis + '</td>' +
        '<td class="num ' + (ok ? 'pos' : 'neg') + '">' + (ok ? 'holds' : 'moves') + '</td></tr>';
    }).join('');
    tbl.innerHTML = head + '<tbody>' + body + '</tbody>';

    // Why the paired comparison is the one the design asks for, rather than a choice
    // made here to get a better answer. This is the part a reader who knows the code
    // can check, so it names what to look at.
    var why = $('#noisefloorwhy');
    if (why) {
      why.innerHTML = shift && shift.common_random_numbers
        ? '<b>Why the comparison is made inside a draw.</b> ' +
          cap1(esc(shift.common_random_numbers)) +
          ((nf.axis_claims || []).length && strongestScatter(nf) != null
            ? ' That is common random numbers, the standard way to compare settings on a ' +
              'shared draw, and it is why the scatter on the radius difference is ' +
              num(strongestScatter(nf), 3) + ' while one configuration on its own moves by ' +
              num(shift.per_config_sd, 3) + ' between draws.'
            : '')
        : '';
    }
    if (note) {
      var dup = nf.identical_configurations;
      note.textContent = 'Position means where the repository\'s own value ranks among the settings ' +
        'tested on that axis, once per draw. An axis marked holds keeps that position in every draw, ' +
        'every setting on it stays on the same side of the repository\'s value every time, and at ' +
        'least one of those differences is more than three times its own scatter across draws.' +
        (dup && dup.configs ? ' The floor is measurable because ' + word(dup.configs.length) +
          ' of the configurations hold the repository value on their own axis, so they are the same ' +
          'simulator under different names: within one draw they agree to the digit, and across ' +
          'draws they move together.' : '');
    }
  }

  // Whether the answer depends on which statistics are in the distance. Each group is
  // something a laboratory might measure on its own, so a disagreement between them is
  // not a technicality: it means two reasonable people get opposite answers from the
  // same footage, and the scalar they both computed cannot tell them which is right.
  function drawSubsets() {
    var host = $('#subsets');
    if (!host) return;
    var sr = D.subset_rankings;
    var pools = sr && sr.pools ? Object.keys(sr.pools).map(Number).sort(function (a, b) { return b - a; }) : [];
    if (!pools.length) { host.innerHTML = ''; return; }
    var pool = pools[0], axes = sr.pools[String(pool)], names = Object.keys(sr.subsets || {});
    var order = ['all', 'spatial', 'granulometry', 'motion'].filter(function (k) {
      return names.indexOf(k) >= 0; });
    var split = Object.keys(axes).filter(function (a) { return axes[a].answer_depends_on_weighting; });

    var head = '<thead><tr><th>Simulator setting</th>' + order.map(function (k) {
      return '<th>' + esc(k === 'all' ? 'All fourteen' : sr.subsets[k]) + '</th>'; }).join('') +
      '</tr></thead>';
    var rows = Object.keys(axes).sort().map(function (a) {
      var r = axes[a];
      return '<tr><td class="l">' + esc(axisLabel(a)) + '</td>' + order.map(function (k) {
        var v = r.by_subset[k];
        if (!v) return '<td class="num">n/a</td>';
        var odd = r.subsets_that_point_elsewhere.indexOf(k) >= 0;
        return '<td class="num' + (odd ? ' neg' : '') + '">' + n(v.prefers_value) +
          (v.every_setting_keeps_its_side ? '' : '<span class="plus"> unstable</span>') + '</td>';
      }).join('') + '</tr>';
    }).join('');

    host.innerHTML =
      '<h3 style="margin-top:28px">Whether the answer depends on which statistics you use</h3>' +
      '<p class="small">The distance averages fourteen statistics with equal weight, and nothing ' +
      'justifies that weight. So the fourteen were split into the three groups a laboratory might ' +
      'plausibly measure on its own, and each group ranked the configurations by itself, on the ' +
      'pool of ' + word(pool) + ' clips per configuration. Each cell is the setting that group ' +
      'puts closest to real.' +
      (split.length
        ? ' On ' + split.map(function (a) { return esc(axisLabel(a)); }).join(' and ') +
          ' the groups point to opposite sides of the repository\'s own value, each of them ' +
          'consistently across every draw, so the combined answer on that axis is decided by how ' +
          'many statistics sit in each group rather than by the footage.'
        : ' Every group points the same way as the whole on every axis, so no answer here rests ' +
          'on the weighting.') +
      '</p>' +
      '<div class="tscroll"><table>' + head + '<tbody>' + rows + '</tbody></table></div>' +
      '<p class="hint">Red marks a group pointing to the other side of the repository value from ' +
      'the full distance. A cell marked unstable is one where the settings on that axis did not ' +
      'all keep the same side across draws, so that group has no direction to report.</p>';
  }

  // Whether the pool each configuration is measured from was big enough. A difference
  // too small to resolve on a small pool is unresolved rather than absent, and the two
  // call for different sentences. The only way to tell them apart is to measure again
  // on a bigger pool, so the whole sweep was run again at five times the clips.
  function drawPoolCheck() {
    var pc = D.stats_pool_check, host = $('#poolcheck');
    if (!host) return;
    if (!pc || !pc.axes || !pc.axes.length) { host.innerHTML = ''; return; }
    var moved = pc.axes.filter(function (r) { return !r.agrees; });
    var gapTxt = function (side) {
      if (side.gap == null) return 'nothing beats the repository value';
      return num(side.gap, 3) + ' &plusmn; ' + num(side.scatter, 3);
    };
    var rows = pc.axes.map(function (r) {
      return '<tr><td class="l">' + esc(axisLabel(r.axis)) + '</td>' +
        '<td class="num ' + (r.small.holds ? 'pos' : 'neg') + '">' +
          (r.small.holds ? 'holds' : 'moves') + '</td>' +
        '<td class="num">' + gapTxt(r.small) + '</td>' +
        '<td class="num ' + (r.big.holds ? 'pos' : 'neg') + '">' +
          (r.big.holds ? 'holds' : 'moves') + '</td>' +
        '<td class="num">' + gapTxt(r.big) + '</td></tr>';
    }).join('');

    host.innerHTML =
      '<h3 style="margin-top:28px">Whether ' + word(pc.small_clips) + ' clips was enough to decide</h3>' +
      '<p class="small">Each configuration above is measured from a pool of ' + word(pc.small_clips) +
      ' synthetic clips, which is what makes the spread as large as it is. A difference too small ' +
      'to resolve on that pool is unresolved rather than absent, and those call for different ' +
      'sentences. So the whole sweep was run again at ' + word(pc.big_clips) + ' clips per ' +
      'configuration, on ' + word(pc.big_seeds) + ' draws.' +
      (moved.length
        ? ' ' + cap1(word(pc.axes.length - moved.length)) + ' of the ' + word(pc.axes.length) +
          ' axes give the same verdict at both sizes. ' + moved.map(function (r) {
            return '<b>' + cap1(esc(axisLabel(r.axis))) + ' does not</b>, and the bigger pool is the ' +
              'one to believe: it ' + (r.big.holds ? 'resolves a difference the smaller pool could ' +
              'not see, so the right sentence is that ' + word(pc.small_clips) + ' clips could not ' +
              'settle this axis rather than that the axis is flat'
              : 'fails to reproduce what the smaller pool showed, so the smaller result was the pool ' +
              'talking') + '.';
          }).join(' ')
        : ' Every axis gives the same verdict at both sizes, which is the check that matters: a ' +
          'conclusion that survives five times the clips is not a property of the pool.') +
      '</p>' +
      '<div class="tscroll"><table><thead><tr><th>Simulator setting</th>' +
      '<th>At ' + pc.small_clips + ' clips</th><th>Best gap, paired</th>' +
      '<th>At ' + pc.big_clips + ' clips</th><th>Best gap, paired</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
  }

  // The size curve behind the radius warning. Every line is the share of bright pixels in a
  // frame that survives an opening of radius r, so a line that sits below the real one is a
  // frame with less bright structure at that scale. The point of drawing it is the shape:
  // thickening the bodies lifts the left end onto real and pushes the right end further off,
  // which is what a single distance number cannot say.
  function drawGranulometry() {
    var g = D.granulometry, host = $('#granviz'), card = $('#grancard'), leg = $('#granlegend');
    if (!host || !card) return;
    if (!g || !g.series || g.series.length < 2) {
      card.style.display = 'none';
      caption('#granviz', '');
      return;
    }
    card.style.display = '';
    var narrow = isNarrow();
    var W = narrow ? 400 : 700, H = narrow ? 240 : 280;
    var P = { l: narrow ? 42 : 52, r: narrow ? 56 : 92, t: 12, b: 34 };
    var radii = g.radii, real = g.series[0];
    var sims = g.series.slice(1);
    var all = g.series.reduce(function (acc, s) { return acc.concat(s.values); }, []);
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    var pad = (hi - lo) * 0.12 || 0.05;
    lo = Math.max(0, lo - pad); hi = Math.min(1, hi + pad);
    var X = function (i) { return P.l + i / (radii.length - 1) * (W - P.l - P.r); };
    var Y = function (v) { return P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b); };
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Share of bright pixels surviving a morphological opening, real footage against each body radius' });

    [lo, (lo + hi) / 2, hi].forEach(function (t) {
      svg.appendChild(el('line', { x1: P.l, y1: Y(t), x2: W - P.r, y2: Y(t),
        stroke: '#e6e3dd', 'stroke-width': 1 }));
      svg.appendChild(el('text', { x: P.l - 7, y: Y(t) + 3.5, 'text-anchor': 'end',
        'font-family': "'IBM Plex Mono',monospace", 'font-size': narrow ? 8.5 : 9.5, fill: '#8b95a1' },
        num(t, 2)));
    });
    radii.forEach(function (r, i) {
      svg.appendChild(el('text', { x: X(i), y: H - 14, 'text-anchor': 'middle',
        'font-family': "'IBM Plex Mono',monospace", 'font-size': narrow ? 9 : 10, fill: '#8b95a1' },
        'r=' + r));
    });
    svg.appendChild(el('text', { x: (P.l + W - P.r) / 2, y: H - 2, 'text-anchor': 'middle',
      'font-size': narrow ? 9 : 10, fill: '#8b95a1' }, 'opening radius, pixels'));

    function path(vals) {
      return vals.map(function (v, i) { return (i ? 'L' : 'M') + X(i) + ' ' + Y(v); }).join(' ');
    }
    // The repository's own value is amber wherever it appears on this page, so it is amber
    // here too. The rest run light to dark with radius.
    var shades = ['#cdd6e0', '#a8bccf', '#7f9fbd', '#2c4a6b'];
    var colourOf = function (s, i) {
      if (s.is_repo_default) return '#c8860d';
      var j = sims.filter(function (x) { return !x.is_repo_default; }).indexOf(s);
      return shades[Math.min(Math.max(j, 0), shades.length - 1)];
    };
    sims.forEach(function (s, i) {
      var col = colourOf(s, i);
      svg.appendChild(el('path', { d: path(s.values), fill: 'none', stroke: col,
        'stroke-width': s.is_repo_default ? 2.4 : 1.8 }));
      if (!narrow) {
        svg.appendChild(el('text', { x: X(radii.length - 1) + 7, y: Y(s.values[s.values.length - 1]) + 3.5,
          'font-family': "'IBM Plex Mono',monospace", 'font-size': 10, fill: col },
          'R=' + num(s.axis_value, 1)));
      }
    });
    svg.appendChild(el('path', { d: path(real.values), fill: 'none', stroke: '#8b2f2f',
      'stroke-width': 2.6 }));
    if (!narrow) {
      svg.appendChild(el('text', { x: X(radii.length - 1) + 7, y: Y(real.values[real.values.length - 1]) + 3.5,
        'font-family': "'IBM Plex Mono',monospace", 'font-size': 10, fill: '#8b2f2f', 'font-weight': '600' },
        'real'));
    }
    host.innerHTML = ''; host.appendChild(svg);

    if (leg) {
      leg.innerHTML = '<span><i style="border-color:#8b2f2f"></i>real footage</span>' +
        sims.map(function (s, i) {
          return '<span><i style="border-color:' + colourOf(s, i) + '"></i>body radius ' +
            num(s.axis_value, 1) + (s.is_repo_default ? ', the repository value' : '') + '</span>';
        }).join('');
    }
    var thick = sims[sims.length - 1];
    var repo = sims.filter(function (s) { return s.is_repo_default; })[0] || sims[0];
    caption('#granviz', 'Share of bright pixels surviving an opening of radius r, which is a size curve ' +
      'for the bright structure in a frame. Every synthetic line sits below the real one at every ' +
      'radius. Thickening the worms from ' + num(repo.axis_value, 1) + ' to ' + num(thick.axis_value, 1) +
      ' closes the gap at r=1, from ' + num(real.values[0] - repo.values[0], 3) + ' to ' +
      num(real.values[0] - thick.values[0], 3) + ', and widens it at r=' + radii[radii.length - 1] +
      ', from ' + num(real.values[radii.length - 1] - repo.values[radii.length - 1], 3) + ' to ' +
      num(real.values[radii.length - 1] - thick.values[radii.length - 1], 3) +
      '. No radius reproduces the shape.');
  }

  // What came out of reading the authors' simulator rather than sweeping it. This is here
  // because it is the half of the study that never needed the machine that went down, and
  // because four of the five sit in lines no configuration file reaches, which is the part
  // of the fellowship's own question that a tuning loop cannot answer for itself.
  function drawSimRead() {
    var s = D.simulator_findings;
    var text = $('#simreadtext'), host = $('#simreadlist'), sec = $('#simread');
    if (!text || !host) return;
    if (!s) { if (sec) sec.style.display = 'none'; return; }

    var items = [];
    var a = s.drag_anisotropy_prior_is_unphysical;
    if (a) {
      var dd = a.drawn_distribution || {};
      items.push({
        h: 'The drag ratio is drawn from a prior that is mostly unphysical',
        b: '<p class="small"><code>' + esc(a.code) + '</code></p>' +
           '<p class="small">Alpha is ' + esc(a.what_alpha_is || '') +
           (a.slender_body_theory ? ' Slender body theory gives ' + esc(a.slender_body_theory) + '.' : '') +
           ' Sampling that line gives a median of ' + num(dd.median, 2) +
           (dd.p5 != null && dd.p95 != null ? ', with the middle nine tenths of draws running from ' +
             num(dd.p5, 2) + ' to ' + num(dd.p95, 2) : '') + '.</p>' +
           '<p class="small">' + cap1(esc(a.why_it_matters || '')) + ' It is also the only one of ' +
           'these five the sweep can reach, as the drag anisotropy axis in act two moves the centre ' +
           'of that prior.</p>'
      });
    }
    var w = s.wave_amplitude_is_gated_at_a_fixed_rate;
    if (w) {
      items.push({
        h: 'The stroke amplitude is gated at a rate no parameter can change',
        b: '<p class="small"><code>' + esc(w.code) + '</code></p>' +
           '<p class="small">That ' + esc(w.what_it_does || '') + ' Rectifying a sine doubles its rate, ' +
           'so the envelope repeats every ' + num(w.envelope_period_s, 2) + ' seconds.</p>' +
           '<p class="small">' + cap1(esc(w.why_it_matters || '')) + '</p>'
      });
    }
    var f = s.a_flag_that_does_nothing;
    if (f) {
      items.push({
        h: 'One training flag does nothing',
        b: '<p class="small"><code>' + esc(f.flag || '') + '</code></p>' +
           '<p class="small">It exists in the argument parser and nowhere else, because ' +
           esc(f.what_happens || '') + '</p>' +
           '<p class="small">It would not do anything if it were wired up, because ' +
           esc(f.would_not_work_anyway || '') + ' The setting appears in the run record either way, ' +
           'so a reader of that record would believe it had been applied.</p>'
      });
    }
    var dfl = s.defaults_are_not_the_published_configuration;
    if (dfl) {
      var keys = Object.keys(dfl).filter(function (k) {
        return dfl[k] && typeof dfl[k] === 'object' && dfl[k].repo_default != null;
      });
      var rows = keys.map(function (k) {
        return '<tr><td class="l mono">' + esc(k) + '</td><td class="num">' +
          n(dfl[k].repo_default) + '</td><td class="num">' + n(dfl[k].published_run) + '</td></tr>';
      }).join('');
      items.push({
        h: 'The repository defaults are not the configuration that was published',
        b: '<div class="tscroll"><table><thead><tr><th>Setting</th><th>Repo default</th>' +
           '<th>Published run</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
           '<p class="small" style="margin-top:10px">' + cap1(esc(dfl.why_it_matters || '')) +
           ' Anyone starting from the repository and reporting a weaker result has changed the ' +
           'training before touching the simulator, and would have no way of knowing it.</p>'
      });
    }
    if (s.frame_rate_already_matches) {
      var rec = (D.baseline_per_clip && D.baseline_per_clip.stated || {}).recall;
      items.push({
        h: 'One thing was already matched to the camera',
        b: '<p class="small">' + cap1(esc(s.frame_rate_already_matches)) + ' Nothing above is a list ' +
           'of oversights. The simulator is good enough that a detector trained only on it finds ' +
           (rec != null ? num(rec * 100, 1) + ' percent' : 'almost all') +
           ' of the hand-clicked worms on real footage, which is what act one measures. These are ' +
           'the places where a tuning loop would be working blind, not a verdict on the simulator.</p>'
      });
    }

    text.innerHTML = 'These came from reading the simulator and sampling its own code, with nothing ' +
      'trained and no sweep involved. ' +
      (a ? 'Only the first is something a sweep over simulator settings actually moves. The rest sit in a ' +
           'hardcoded envelope, a flag that is never passed, and the training configuration, so no ' +
           'ranking over simulator configurations can see them. '
         : 'Most of them sit outside the simulator settings entirely, so no ranking over ' +
           'configurations can see them. ') +
      'That bounds what the loop in act three can do, whatever the correlation turns out to be.';

    host.innerHTML = '';
    items.forEach(function (it, i) {
      var d = document.createElement('div');
      d.className = 'card';
      if (i) d.style.marginTop = '14px';
      d.innerHTML = '<div class="card-title">' + it.h + '</div>' + it.b;
      host.appendChild(d);
    });
  }

  function drawThesis() {
    var host = $('#thesisviz'); if (!host) return;
    var rows = (D.configs || []).filter(function (c) {
      return c.real_score != null && statDist(c) != null;
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
    var xs = rows.map(function (r) { return statDist(r); });
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
      s.appendChild(el('circle', { cx: X(statDist(r)), cy: Y(r.real_score), r: 5, fill: '#2c4a6b' }));
      s.appendChild(el('text', { x: X(statDist(r)) + 8, y: Y(r.real_score) + 4,
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
    // The dek must not describe a sweep that has not run. It states what has been done.
    var cfgAll = D.configs || [];
    var cfgDone = cfgAll.filter(function (c) { return c.real_score != null; }).length;
    // The primer promises a method. If the training half did not run, saying so here
    // rather than in act two keeps a reader from carrying an expectation for four
    // screens and then finding an empty chart.
    var p4 = $('#primer4');
    if (p4 && !cfgDone) {
      p4.innerHTML = 'The simulator has settings, and someone chose them. This page asks <b>which of ' +
        'those choices the result actually depends on</b>, by changing one at a time, retraining, ' +
        'and scoring against real footage a human labelled. <b>The retraining did not happen</b>, ' +
        'for a reason act two gives, so four settings are set up and none is scored. What did ' +
        'happen needed no training at all, and it is the last two sections.';
    }
    $('#dek').innerHTML =
      'The detector this page takes apart was trained entirely on simulated worms, by the group that wrote both. ' +
      (cfgDone
        ? '<strong>Changing one simulator setting at a time and retraining shows which of them the result ' +
          'actually depends on</strong>, scored against ' +
          (rd.clips != null ? rd.clips + ' clips of real footage a human labelled' : 'real labelled footage') + '. '
        : '<strong>The training half of the sweep is built and waiting on a machine, and the half that ' +
          'needs no training is done</strong>: every configuration is already ranked by how closely its ' +
          'synthetic frames match ' +
          (rd.clips != null ? rd.clips + ' clips of real footage' : 'real footage') + ', using no labels, ' +
          'and that ranking has a warning in it worth more than the ranking. ') +
      'The last act asks the question the fellowship is built on: whether those settings can be chosen with no labels at all. ' +
      ((D.simulator_findings || {}).wave_amplitude_is_gated_at_a_fixed_rate
        ? 'Reading the simulator turned up a wave envelope that no parameter can change and a training ' +
          'flag that silently does nothing, which is the part of the problem no tuning loop can see. '
        : '') +
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
        ? (function () {
            var bp = D.baseline_per_clip, rs = bp.region_stated || {};
            return '<div><div class="k">Its precision</div><div class="n">&ge; ' +
              num(rs.precision != null ? rs.precision : bp.stated.precision) + '</div><div class="s">' +
              (rs.precision != null
                ? 'scored inside the disc the hand labels occupy, where ' + n(rs.predictions) +
                  ' detections meet ' + n(rs.labels) + ' labelled worms. Over the whole frame it reads ' +
                  num(bp.stated.precision) + ', and that difference is an artefact of where the labels are'
                : n(bp.stated.predictions) + ' detections against ' + n(bp.stated.labels) + ' labelled worms') +
              '</div></div>';
          })()
        : '') +
      '<div><div class="k">Metric</div><div class="n" style="font-size:15px">' + esc(m.name || 'n/a') +
      '</div><div class="s">' + esc(m.what_it_measures || '') + '</div></div>';
    $('#v1').innerHTML = b.real_score == null
      ? '<b>The baseline has not finished running.</b> Until it has, no number on this page should be read.'
      : '<b>The published weights find ' + (100 * b.real_score).toFixed(1) + ' percent of the worms a human marked, ' +
        'with a median error of half a pixel.</b> ' +
        (b.paper_reports != null
          ? 'The paper reports ' + num(b.paper_reports) + ' on its own evaluation, so the two are close enough that the code below is measuring what it claims to. '
          : 'The paper reports no directly comparable recall, so that figure is an internal reference. ' +
            'The median error is a check against it though: the paper puts human labelling accuracy at ' +
            'the half-pixel level, and that is where this lands. ') +
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
    // Every limit the study wrote, plus the two this page measures for itself, rendered
    // into one container. Fixed slots used to drop all but the first two, and a paragraph
    // cannot hold paragraphs, which duplicated one when they were pushed into it.
    var lims = (D.limits || []).slice();
    if ((D.configs || []).some(function (c) { return c.per_statistic_z; })) {
      lims.push('The ordering by unlabelled statistics is sensitive to which statistics are in it. ' +
        'Adding the three frame-to-frame motion measures reversed the preferred direction on the ' +
        'length axis, so read the ordering as one defensible choice rather than as the answer.');
    }
    var cov = (D.labelling_check || {}).simulator_length_coverage;
    if (cov) {
      var dates = Object.keys(cov.by_recording_date || {}).filter(function (k) { return /\d{4}-/.test(k); });
      var spread = '';
      if (dates.length >= 2) {
        var a0 = cov.by_recording_date[dates[0]], b0 = cov.by_recording_date[dates[dates.length - 1]];
        spread = ' And there is no single target: worms recorded on ' + dates[0] + ' have a median length of ' +
          a0.median_length_px + ' px against ' + b0.median_length_px + ' px on ' + dates[dates.length - 1] + '.';
      }
      lims.push('Only ' + cov.inside_range_pct + ' percent of the real worms are inside the length range ' +
        'the simulator can produce, ' + cov.simulator_length_range_px[0] + ' to ' +
        cov.simulator_length_range_px[1] + ' pixels against a real median of ' + cov.real_length_px.median +
        '. A worm outside that range is one no configuration here can generate, which is a limit on the ' +
        'approach rather than on this sweep.' + spread);
    }
    lims.push('One species, one imaging setup, one laboratory\'s footage. Nothing here says which settings ' +
      'matter for a different organism or a different microscope.');
    var host2 = $('#limitlist');
    if (host2) {
      host2.innerHTML = '';
      lims.forEach(function (t, i) {
        var pEl = document.createElement('p');
        pEl.textContent = t;
        if (i) pEl.style.marginTop = '6px';
        host2.appendChild(pEl);
      });
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

  // A model that scores zero could be a model that finds nothing, or a model that finds
  // things and is too unsure to say so. Those need different words, so the difference is
  // measured by sweeping the confidence threshold rather than asserted.
  function drawThreshold() {
    var t = (D.defaults_run || {}).not_merely_a_threshold_artefact;
    var text = $('#thresholdtext'), tbl = $('#thresholdtable');
    if (!text || !tbl) return;
    if (!t || !t.rows || !t.rows.length) {
      text.textContent = '';
      tbl.innerHTML = '';
      return;
    }
    var best = t.rows.slice().sort(function (a, b) { return b.recall - a.recall; })[0];
    var strict = t.rows.filter(function (r) { return r.score_threshold >= 0.5; })[0] || t.rows[0];
    var bl = D.baseline_per_clip && D.baseline_per_clip.stated;
    text.innerHTML = 'A score of zero has two readings, and they call for different words. The model ' +
      'might find nothing, or it might find things and be too unsure to report them. Lowering the ' +
      'confidence threshold separates those, so it was swept rather than argued about, on ' +
      t.clips_scored + ' clips.' +
      ' Recall only rises by carpet bombing. At a threshold of ' + best.score_threshold + ' it reaches ' +
      num(best.recall, 3) + ', and it does that by emitting ' + num(best.predictions_per_label, 1) +
      ' predictions for every labelled worm, for a precision of ' + num(best.precision, 3) + '. ' +
      'The median distance never falls below ' + num(best.median_adtw_px, 2) + ' pixels' +
      (bl && bl.median_adtw_px != null ? ', against ' + num(bl.median_adtw_px, 2) +
        ' for the published weights' : '') + '. ' +
      '<b>There is no setting at which this model is doing the task.</b> The zero is a zero.';

    var head = '<thead><tr><th>Confidence threshold</th><th class="num">Recall</th>' +
      '<th class="num">Precision</th><th class="num">Predictions per label</th>' +
      '<th class="num">Median distance, px</th></tr></thead>';
    tbl.innerHTML = head + '<tbody>' + t.rows.map(function (r) {
      return '<tr><td>' + r.score_threshold + (r.score_threshold === 0.5 ? ' (the repository default)' : '') +
        '</td><td class="num">' + num(r.recall, 4) + '</td><td class="num">' + num(r.precision, 4) +
        '</td><td class="num">' + num(r.predictions_per_label, 1) +
        (r.cap_bound_on_clips ? ' <span class="hint">capped</span>' : '') +
        '</td><td class="num">' + num(r.median_adtw_px, 2) + '</td></tr>';
    }).join('') + '</tbody>';
  }

  // The scoring was wrong once, by a factor of two, and the way that was caught is a
  // better argument for trusting the rest of the page than the corrected number is.
  function drawFlip() {
    var bp = D.baseline_per_clip || {};
    var rows = bp.recall_by_density || [];
    var text = $('#fliptext');
    if (!text) return;
    if (!rows.length) { text.textContent = ''; caption('#flipviz', ''); return; }
    text.innerHTML =
      'The first version of the scoring here reported that the published model found about half the ' +
      'worms. It was wrong, and wrong for a reason worth stating: the distance measure walks the ' +
      'labelled centreline along the predicted one in a single direction, while the model\'s head and ' +
      'tail orientation is arbitrary. Their own training loss handles that by taking the minimum over ' +
      'the label and its reverse. The scoring did not, so roughly half of all correct detections were ' +
      'counted as misses. ' +
      '<b>The tell was in the shape, not the total.</b> The broken run gave almost exactly the same ' +
      'recall at every worm density, from about one worm per clip to eighteen. A real detection limit ' +
      'has to degrade as the field crowds and worms overlap; a coin flip does not. Corrected, it does ' +
      'degrade, and the chart below is what that looks like. The corrected median error of half a pixel ' +
      'is a second check: the paper puts human labelling accuracy at that same half-pixel level.';

    var narrow = isNarrow();
    var W = narrow ? 400 : 760, H = narrow ? 230 : 210;
    var P = narrow ? { l: 42, r: 14, t: 16, b: 38 } : { l: 52, r: 18, t: 14, b: 34 };
    var s2 = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Recall against worm density, corrected' });
    var maxD = rows[rows.length - 1].density;
    var X = function (v) { return P.l + v / maxD * (W - P.l - P.r); };
    var Y = function (v) { return H - P.b - (v - 0.4) / 0.62 * (H - P.t - P.b); };
    [0.5, 0.75, 1.0].forEach(function (g) {
      s2.appendChild(el('line', { x1: P.l, y1: Y(g), x2: W - P.r, y2: Y(g), stroke: '#e2e0dc' }));
      s2.appendChild(el('text', { x: P.l - 6, y: Y(g) + 4, 'text-anchor': 'end',
        'font-family': "'IBM Plex Mono',monospace", 'font-size': 10, fill: '#8b95a1' }, g.toFixed(2)));
    });
    s2.appendChild(el('path', { d: rows.map(function (r, i) {
      return (i ? 'L' : 'M') + X(r.density).toFixed(1) + ' ' + Y(r.recall).toFixed(1); }).join(' '),
      fill: 'none', stroke: '#2f7d54', 'stroke-width': 2.4 }));
    rows.forEach(function (r) {
      s2.appendChild(el('circle', { cx: X(r.density), cy: Y(r.recall), r: 4, fill: '#2f7d54' }));
      s2.appendChild(el('text', { x: X(r.density), y: H - P.b + 15, 'text-anchor': 'middle',
        'font-family': "'IBM Plex Mono',monospace", 'font-size': 10, fill: '#8b95a1' }, r.density + 'x'));
    });
    var fh = $('#flipviz'); if (fh) { fh.innerHTML = ''; fh.appendChild(s2); }
    caption('#flipviz', 'Corrected recall against worm density. It falls as the field crowds, which is ' +
      'what a detection limit does. The broken version was flat across this whole range.');
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
        'far longer, see the note below' : '') + '. ' +
      (Math.abs(total) < 0.02
        ? '<b>The curve is flat, and the reason is not the schedule.</b> ' +
          (dr.not_achievable_because
            ? (function (t) { return /[.!?]$/.test(t) ? t : t + '.'; })(cap1(esc(dr.not_achievable_because))) + ' '
            : '') +
          'Training is working: the loss falls cleanly and the confidence term with it. At this budget ' +
          'the model emits one candidate per clip and detects nothing, which is what an untrained ' +
          'detector does rather than what a broken one does. So the sweep below is not inconclusive ' +
          'in the sense of a close result. ' +
          'It was not attempted, and the page says so rather than drawing a flat line and calling it a ' +
          'finding about the simulator.'
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
      ['The published run, for comparison', 'Its own record sets 300,000 steps at batch 128 per device, ' +
        'worm counts 5 to 250, seed 87, resumed from an earlier checkpoint. The released parameters carry ' +
        '338,800 optimizer updates, read from the counters saved beside them, so at least 38,800 steps ' +
        'happened before that run. How many devices it used is not recorded anywhere in the release, so ' +
        'the number of frames it saw cannot be worked out from what was published.'],
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
        'weights, which were trained far longer. Their own record sets 300,000 steps at batch 128 per device ' +
        'and resumes from an earlier checkpoint, and the released parameters carry 338,800 optimizer updates, ' +
        'so at least 38,800 came from before that run. The device count is not recorded anywhere in the ' +
        'release. Comparing against them would measure the schedule rather than the simulator.'],
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
    var pc = lc.per_clip_fit, inv = (lc.non_monotonic_steps || [])[0];
    parts.push('The clips come from videos at worm densities the dataset states as ' + Number(first) +
      ' to ' + Number(last) + ' times a baseline concentration, and labels per clip rise in proportion ' +
      'to that: ' + by[first].mean_labels + ' a clip at the lowest rising to ' + by[last].mean_labels +
      ' at the highest, on a line through the origin at ' + lc.slope_labels_per_unit_density +
      ' per unit density.' +
      (pc ? ' Two fits, and the difference matters. Across the nine density averages the R squared is ' +
        lc.r_squared_through_origin + ', which is the number worth being suspicious of, because ' +
        'averaging first hides how much clips at the same density differ. Fitted on all ' + pc.clips +
        ' clips individually the slope is the same, ' + pc.slope + ', and the R squared is ' +
        pc.r_squared_through_origin + '. The proportionality is real; the tightness is an artefact of ' +
        'averaging.' : '') +
      (inv ? ' The climb is not even monotonic: the ' + inv.density + ' times bin averages ' +
        inv.mean_labels + ' labels a clip against ' + inv.previous_mean_labels + ' at ' +
        inv.previous_density + ' times, which you can see on the chart.' : '') +
      ' <b>And all of it rules out a fixed quota per clip and nothing else.</b> Someone marking a ' +
      'constant share of the worms produces the same line with a smaller slope.');
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
      var prof = reg.radial_profile_of_worm_centres || [];
      var inner = prof.length ? prof[0].density_vs_uniform : null;
      var outer = prof.length ? prof[prof.length - 1].density_vs_uniform : null;
      parts.push('<b>Looking directly is what found something.</b> The labels are not spread across ' +
        'the crop. ' + reg.worm_centres_inside_pct + ' percent of labelled worm centres sit inside a ' +
        'disc of radius ' + reg.hard_radius_px + ' pixels, which is ' + reg.labelled_area_share_pct +
        ' percent of the ' + reg.frame_px + ' pixel frame, and its centre is ' +
        Math.abs(reg.offset_from_frame_centre_px[0]) + ' pixels left and ' +
        Math.abs(reg.offset_from_frame_centre_px[1]) + ' pixels up from the centre of the frame. ' +
        (inner != null ? 'The edge is sharp rather than a fading: worm centres sit at ' + inner +
          ' times a uniform spread in the middle and ' + outer + ' times beyond the boundary. ' : '') +
        'That mode passes both tests above, which is why neither saw it.');
      if (reg.verdict === 'annotation behaviour') {
        parts.push('<b>Three checks say this is how the labelling was done, not what the picture ' +
          'contains.</b> The region is a disc, and the corners a rectangular annotation window would ' +
          'fill are empty. The imagery outside the disc carries as much worm-like structure as inside ' +
          'it, measured as the average image gradient, flat to within a few percent from the middle out ' +
          'to the corners, so there is no fading at the edges for the labelling to be following. And ' +
          'the concentration does not loosen as the field gets crowded: at the highest density there ' +
          'are hundreds of labelled worms per set and they are still inside the disc. Crop selection ' +
          'would have to loosen, because eighteen worms a clip cannot be placed centrally by ' +
          'construction, and optics would have shown in the imagery. Neither did.');
      }
      parts.push('<b>So the precision quoted in act one is badly understated.</b> Detections are ' +
        'counted over the whole frame while labels exist in about a quarter of it, so a correct ' +
        'detection in the unlabelled majority is recorded as a false positive. The number is a floor ' +
        'with a large gap beneath the truth. Fixing it means scoring detections inside the labelled ' +
        'disc alone, which is a change to the scoring code rather than a caveat.');
      parts.push('One thing this does not settle, and the page will not stretch it: <b>it says where ' +
        'the labels are, not what share of the worms inside that disc were marked.</b> Everything ' +
        'above still leaves a constant share unlabelled as a live possibility, so recall is a ' +
        'measurement and precision stays a floor even after the region is fixed.');
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
    redrawOnWidthChange(drawDomain); redrawOnWidthChange(drawLabelCheck); redrawOnWidthChange(drawSweep); redrawOnWidthChange(drawStatsOnly); redrawOnWidthChange(drawThesis); redrawOnWidthChange(drawCurve);
    drawDomain(); renderAxes(); drawSweep(); drawStatsOnly(); drawSimRead(); drawThesis(); fillProse(); drawThreshold(); drawFlip(); drawCurve(); modelCard(); selfCheck(); drawLabelCheck(); tour();
  });
})();
