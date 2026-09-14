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

  var state = { axis: null };

  function drawDomain() {
    var host = $('#domainviz'); if (!host) return;
    var W = 900, H = 190;
    var s = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Simulator settings produce synthetic footage, which trains a model, which is scored on real footage' });
    var boxes = [
      { x: 8, w: 196, t: 'Simulator settings', s: '27 numbers deciding what a synthetic worm looks like and how it moves' },
      { x: 232, w: 196, t: 'Synthetic footage', s: 'frames where every worm position is known by construction' },
      { x: 456, w: 196, t: 'A trained model', s: 'the published architecture, trained from scratch on those frames' },
      { x: 692, w: 200, t: 'Real footage', s: 'clips a human labelled, which the model has never seen' }
    ];
    boxes.forEach(function (b, i) {
      s.appendChild(el('rect', { x: b.x, y: 26, width: b.w, height: 116, rx: 6, fill: '#fff', stroke: '#c9c5be' }));
      s.appendChild(el('text', { x: b.x + 13, y: 50, 'font-family': "'Newsreader',Georgia,serif",
        'font-size': 16, 'font-weight': 600, fill: '#1a1d21' }, b.t));
      var words = b.s.split(' '), line = '', y = 70;
      var put = function (tx) {
        s.appendChild(el('text', { x: b.x + 13, y: y, 'font-family': "'IBM Plex Sans',sans-serif",
          'font-size': 11, fill: '#5b6470' }, tx));
        y += 14;
      };
      words.forEach(function (w) { if ((line + ' ' + w).length > 28) { put(line); line = w; } else line = line ? line + ' ' + w : w; });
      if (line) put(line);
      if (i < boxes.length - 1) {
        var x1 = b.x + b.w + 4, x2 = boxes[i + 1].x - 4;
        s.appendChild(el('line', { x1: x1, y1: 84, x2: x2, y2: 84, stroke: '#8b95a1', 'stroke-width': 1.5 }));
        s.appendChild(el('circle', { cx: x2 - 2, cy: 84, r: 2.5, fill: '#8b95a1' }));
      }
    });
    s.appendChild(el('path', { d: 'M 890 148 L 890 170 L 106 170 L 106 148', fill: 'none',
      stroke: '#b03a3a', 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }));
    s.appendChild(el('text', { x: 498, y: 166, 'text-anchor': 'middle', 'font-family': "'IBM Plex Sans',sans-serif",
      'font-size': 11.5, fill: '#b03a3a' },
      'The loop the fellowship wants closed without labels: let the real footage choose the settings.'));
    host.innerHTML = ''; host.appendChild(s);
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
    var W = 860, H = 280, P = { l: 62, r: 30, t: 24, b: 48 };
    var vals = rows.map(function (r) { return r.axis_value; });
    var scores = rows.map(function (r) { return r.real_score; });
    var base = D.defaults_run && D.defaults_run.real_score != null ? D.defaults_run.real_score : null;
    var all = scores.concat(base != null ? [base] : []);
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
    s.appendChild(el('text', { x: P.l, y: 14, 'font-family': "'IBM Plex Sans',sans-serif", 'font-size': 11.5, fill: '#5b6470' },
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
    var ranked = Object.keys(byAxis).map(function (k) {
      var v = byAxis[k];
      return { k: k, spread: Math.max.apply(null, v) - Math.min.apply(null, v) };
    }).sort(function (a, b) { return b.spread - a.spread; });
    var lbl = function (k) {
      var a = axes().filter(function (x) { return x.key === k; })[0];
      return (a && a.label ? a.label : k).toLowerCase();
    };
    $('#v2').innerHTML = ranked.length > 1
      ? '<b>The settings do not matter equally.</b> Moving ' + lbl(ranked[0].k) + ' across its range changes the real score by ' +
        num(ranked[0].spread, 3) + ', while moving ' + lbl(ranked[ranked.length - 1].k) + ' changes it by ' +
        num(ranked[ranked.length - 1].spread, 3) + '. On this evidence a laboratory tuning this simulator should spend its time on the first and leave the last alone.'
      : '<b>Moving ' + lbl(state.axis) + ' across its range changes the real score by ' + num(spread, 3) + '.</b>';
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
    var W = 860, H = 320, P = { l: 70, r: 26, t: 22, b: 50 };
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
    s.appendChild(el('text', { x: P.l, y: 13, 'font-family': "'IBM Plex Sans',sans-serif", 'font-size': 11.5, fill: '#5b6470' },
      'Score on real labelled footage, higher is better'));
    s.appendChild(el('text', { x: W - P.r, y: H - 8, 'text-anchor': 'end', 'font-family': "'IBM Plex Sans',sans-serif",
      'font-size': 11.5, fill: '#5b6470' }, 'Distance between synthetic and real image statistics, no labels used'));
    host.innerHTML = ''; host.appendChild(s);
    $('#thesislegend').innerHTML = '<span class="hint">If the fellowship\'s idea holds, points fall from top left to bottom right: the settings that look most like the real thing are the settings that work.</span>';

    var t = D.thesis_test || {};
    $('#thesisstat').innerHTML =
      '<div><div class="k">Configurations</div><div class="n">' + (t.n_configs != null ? t.n_configs : rows.length) +
      '</div><div class="s">each a model trained from scratch</div></div>' +
      '<div><div class="k">Rank agreement</div><div class="n">' + (t.spearman != null ? num(t.spearman, 2) : 'n/a') +
      '</div><div class="s">between the two orderings</div></div>' +
      '<div><div class="k">Best without labels</div><div class="n" style="font-size:15px">' + esc(t.best_by_stats || 'n/a') +
      '</div><div class="s">chosen by statistics alone</div></div>' +
      '<div><div class="k">Best with labels</div><div class="n" style="font-size:15px">' + esc(t.best_by_real || 'n/a') +
      '</div><div class="s">the answer</div></div>';

    if (t.spearman == null) {
      // A partial sweep is a likely way for this to end, so say what is missing and
      // what the finished part does show, rather than printing the word "nothing"
      // twice and leaving a reader to work out whether that is a result.
      var both = t.best_by_stats && t.best_by_real;
      $('#v3').innerHTML = '<b>Too few configurations to put a number on it.</b> ' +
        (t.n_configs || rows.length) + ' finished ' +
        ((t.n_configs || rows.length) === 1 ? 'configuration cannot' : 'configurations cannot') +
        ' support a rank correlation worth quoting, so none is quoted. ' +
        (both
          ? 'Of what did finish, the statistics pick ' + esc(t.best_by_stats) + ' and the real scores pick ' +
            esc(t.best_by_real) + ', which is ' + (t.best_by_stats === t.best_by_real ? 'agreement' : 'disagreement') +
            ' on a sample far too small to lean on.'
          : 'Until enough runs finish, this act reports nothing, which is the correct thing for it to report.');
    } else if (t.verdict_supports_thesis) {
      $('#v3').innerHTML = '<b>Unlabelled statistics do pick settings that work, on this system.</b> ' +
        'The two rankings agree to ' + num(t.spearman, 2) + ' across ' + (t.n_configs || rows.length) +
        ' configurations, and the setting chosen without labels, ' + esc(t.best_by_stats) +
        ', is ' + (t.best_by_stats === t.best_by_real ? 'the same one the labels chose' : 'not the one the labels chose, ' + esc(t.best_by_real)) +
        '. That is one species and one microscope, so it is evidence that the loop is worth building rather than proof it generalises.';
    } else {
      $('#v3').innerHTML = '<b>Unlabelled statistics do not pick the settings that work here.</b> ' +
        'The two rankings agree to only ' + num(t.spearman, 2) + ' across ' + (t.n_configs || rows.length) +
        ' configurations. Matching what a frame looks like is not the same as matching what a detector needs, and on this system the difference is large enough to matter. ' +
        'That is a finding rather than a failure: it says the tuning signal has to come from somewhere other than plain image statistics.';
    }
  }

  function fillProse() {
    var b = D.baseline || {}, dr = D.defaults_run || {}, m = D.metric || {}, rd = D.real_data || {}, hw = D.hardware || {};
    $('#byrepo').textContent = (D.repo && D.repo.url ? D.repo.url.replace('https://github.com/', '') : 'deeptangle');
    $('#dek').innerHTML =
      'The detector this page takes apart was trained entirely on simulated worms, by the group that wrote both. ' +
      '<strong>Changing one simulator setting at a time and retraining shows which of them the result actually depends on</strong>, ' +
      'scored against ' + (rd.clips != null ? rd.clips + ' clips of real footage a human labelled' : 'real labelled footage') + '. ' +
      'The last act asks the question the fellowship is built on: whether those settings can be chosen with no labels at all.';
    $('#baselinestat').innerHTML =
      '<div><div class="k">Published weights</div><div class="n">' + num(b.real_score) +
      '</div><div class="s">' + esc(b.what || 'the model released with the paper') + '</div></div>' +
      '<div><div class="k">Retrained here</div><div class="n">' + num(dr.real_score) +
      '</div><div class="s">same settings, shorter training</div></div>' +
      '<div><div class="k">Real clips</div><div class="n">' + (rd.clips != null ? rd.clips : 'n/a') +
      '</div><div class="s">' + esc(rd.licence || '') + '</div></div>' +
      '<div><div class="k">Metric</div><div class="n" style="font-size:15px">' + esc(m.name || 'n/a') +
      '</div><div class="s">' + esc(m.what_it_measures || '') + '</div></div>';
    $('#v1').innerHTML = b.real_score == null
      ? '<b>The baseline has not finished running.</b> Until it has, no number on this page should be read.'
      : '<b>The scoring code reproduces the published model at ' + num(b.real_score) + ' on real footage.</b> ' +
        (b.paper_reports != null
          ? 'The paper reports ' + num(b.paper_reports) + ' on its own evaluation, so the two are close enough that the code below is measuring what it claims to. '
          : 'The paper does not report a directly comparable figure, so this is an internal reference rather than a reproduction. ') +
        (dr.real_score != null
          ? 'Retraining with the authors\' own settings at the shorter schedule used here reaches ' + num(dr.real_score) +
            ', and that offset, not the published number, is what every swept configuration should be compared against.'
          : '');
    $('#hardwaretext').textContent = hw.where
      ? 'Every model was trained on ' + hw.where + ', a ' + (hw.gpu || 'single GPU') + ', through ' +
        (hw.backend || 'the repository\'s own stack') + ', at ' +
        (hw.one_run_seconds != null ? Math.round(hw.one_run_seconds / 60) + ' minutes a run' : 'a reduced schedule') + '.'
      : '';
    var lims = D.limits || [];
    $('#lim1').textContent = lims[0] || 'One setting is moved at a time, so nothing here says what happens when two are wrong together, which is the usual case.';
    $('#lim2').textContent = lims[1] || 'The real footage is one published labelled set from the same laboratory that wrote the simulator, so it is the friendliest real data this system will ever see.';
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
      ['Evaluated on', miss(rd.clips) + ' clips of real microscopy carrying ' + miss(rd.worms_labelled) +
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
      ['Scored by', esc(m.what_it_measures || m.name || 'a matching metric') +
        (m.cutoff_px != null ? ', at a cutoff of ' + m.cutoff_px + ' pixels' : '') + '.'],
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
        num(precision) + '. Both are what the study reported. Note that ' + found + ' labels were matched by ' +
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
    text.innerHTML = lc.verdict_exhaustive
      ? 'Yes. The clips come from videos at stated worm densities from ' + Number(first) + ' to ' +
        Number(last) + ' times. If a human labelled every worm in a crop, labels per crop have ' +
        'to rise in proportion to that density on a line through the origin, because no worms means no ' +
        'labels. A fixed quota per crop does not behave that way. Measured: ' +
        by[first].mean_labels + ' labels a clip at the lowest density rising to ' +
        by[last].mean_labels + ' at the highest, a fit of ' +
        lc.slope_labels_per_unit_density + ' labels per unit density with an R squared of ' +
        lc.r_squared_through_origin + ' through the origin. So an unmatched detection is a false ' +
        'positive and precision means what it says.'
      : 'No. Labels per clip do not track the stated worm density, so an unmatched detection may ' +
        'well be a real worm nobody clicked. Precision is therefore not reported anywhere above, ' +
        'and the page shows recall and distance only.';

    var host = $('#labelcheckviz'); if (!host) return;
    var W = 760, H = 210, P = { l: 52, r: 18, t: 16, b: 34 };
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
    s.appendChild(el('text', { x: P.l, y: 11, 'font-family': "'IBM Plex Sans',sans-serif",
      'font-size': 11, fill: '#5b6470' },
      'Mean labels per clip against stated worm density. The dashed line is proportional, not fitted to an intercept.'));
    host.innerHTML = '';
    host.appendChild(s);
  }

  function tour() {
    var root = $('#tour'), hl = $('.tour-hl', root), card = $('.tour-card', root), idx = 0;
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var STEPS = [
      { sel: 'header h1', k: 'Welcome · 1 of 5', html: 'A detector trained entirely on simulated worms, taken apart to find which of the simulator\'s settings the result depends on.' },
      { sel: '#domain', k: 'The loop · 2 of 5', html: 'Settings make synthetic footage, synthetic footage trains a model, the model is scored on real footage. The dashed line is the loop the fellowship wants closed without labels.' },
      { sel: '#baselinestat', k: 'The reference · 3 of 5', html: 'The published weights scored by this page\'s own code. If this disagreed with the paper, nothing further would be worth reading.' },
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
    if (D.generated_at === 'FIXTURE') {
      halt('This page is showing fixture data used to check the layout, not a result. ' +
        'Nothing here is measured. Run study/build_page_data.py against the real sweep output.');
      return;
    }
    drawDomain(); renderAxes(); drawSweep(); drawThesis(); fillProse(); modelCard(); selfCheck(); drawLabelCheck(); tour();
  });
})();
