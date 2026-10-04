/* Strategy page (ISO 17359 / RCM): are the right tasks done at the right interval for each asset? */
(function () {
  const U = AHIM.ui, C = AHIM.calc;
  AHIM.pages.strategy = function (ctx) {
    const { m, D, assets, state } = ctx;
    const S = assets.map(a => ({ a, s: C.strategyAt(m, a, D) }));
    const withS = S.filter(x => x.s && x.s.n), noS = S.filter(x => !x.a.strategy);
    const tot = withS.reduce((t, x) => t + x.s.n, 0), done = withS.reduce((t, x) => t + x.s.done, 0);
    const crit = withS.filter(x => x.a.cls === 'A'), ct = crit.reduce((t, x) => t + x.s.n, 0), cd = crit.reduce((t, x) => t + x.s.done, 0);
    const onlyVis = assets.filter(a => a.cls === 'A' && a.strategy && a.records.length && a.records.every(r => r.tech === 'Visual')).length;
    const kp = `<div class="kpis">${U.kpi((U.pct(done, tot) ?? '–') + '%', 'Strategy compliance: required tasks done within interval', U.pct(done, tot) >= 90 ? 'good' : 'bad')}${U.kpi((U.pct(cd, ct) ?? '–') + '%', 'Compliance on critical (A) assets', U.pct(cd, ct) >= 90 ? 'good' : 'bad')}${U.kpi(onlyVis, 'Critical assets monitored by visual only', onlyVis ? 'bad' : 'good')}${U.kpi(noS.length, 'Assets without a strategy class', noS.length ? 'warn' : 'good')}</div>`;
    // by technique
    const techs = [...new Set(withS.flatMap(x => x.s.tasks.map(t => t.t.tech)))];
    const bt = techs.map(t => { const ts = withS.flatMap(x => x.s.tasks.filter(k => k.t.tech === t)); return { t, n: ts.length, d: ts.filter(k => k.ok).length }; }).sort((a, b) => b.n - a.n);
    const byTech = U.block('s5', 'Compliance by technique', 'Required tasks done within interval',
      bt.map(x => { const p = U.pct(x.d, x.n); return U.hbar(x.t, p, 100, p >= 90 ? 'var(--ok)' : p >= 60 ? 'var(--alert)' : 'var(--danger)', `${x.d}/${x.n}`); }).join('') || U.empty('No strategy tasks.'), 2);
    // by class
    const classes = [...new Set(withS.map(x => x.a.strategy))].sort();
    const byClass = U.block('s7', 'Compliance by equipment class', 'Where the strategy is not being executed',
      `<div class="scroll"><table class="tbl"><thead><tr><th>Strategy class</th><th class="r">Assets</th><th class="r">Tasks</th><th class="r">Done</th><th class="r">Compliance</th><th>Main gap</th></tr></thead><tbody>
      ${classes.map(c => { const xs = withS.filter(x => x.a.strategy === c), n = xs.reduce((t, x) => t + x.s.n, 0), d = xs.reduce((t, x) => t + x.s.done, 0), p = U.pct(d, n);
        const gaps = {}; xs.forEach(x => x.s.tasks.filter(k => !k.ok).forEach(k => { gaps[k.t.tech] = (gaps[k.t.tech] || 0) + 1; }));
        const g = Object.entries(gaps).sort((a, b) => b[1] - a[1])[0];
        return `<tr><td>${U.esc(c)}</td><td class="r">${xs.length}</td><td class="r">${n}</td><td class="r">${d}</td><td class="r b ${p < 60 ? 'late' : ''}">${p}%</td><td class="small">${g ? U.esc(g[0]) + ' (' + g[1] + ' missing)' : '–'}</td></tr>`; }).join('')}</tbody></table></div>`, 3);
    // gaps on critical assets
    const gl = withS.filter(x => x.s.done < x.s.n).sort((x, y) => ('ABC'.indexOf(x.a.cls) - 'ABC'.indexOf(y.a.cls)) || (y.a.aci || 0) - (x.a.aci || 0) || (x.s.done / x.s.n) - (y.s.done / y.s.n)).slice(0, 40);
    const gaps = U.block('s12', 'Strategy gaps', 'Critical assets first: required tasks not done within their interval',
      gl.length ? `<div class="scroll tall"><table class="tbl"><thead><tr><th>Asset</th><th>Class</th><th>Strategy class</th><th class="r">Done</th><th>Missing tasks (technique · interval · last done)</th></tr></thead><tbody>
      ${gl.map(x => `<tr data-asset="${U.esc(x.a.id)}" tabindex="0"><td><b>${U.esc(x.a.tag)}</b><div class="small">${U.esc(x.a.name)}</div></td><td>${U.crit(x.a.cls)}</td><td class="small">${U.esc(x.a.strategy)}</td><td class="r">${x.s.done}/${x.s.n}</td>
        <td class="small">${x.s.tasks.filter(k => !k.ok).map(k => `${U.esc(k.t.tech)} · every ${k.interval} d · ${k.last ? 'last ' + U.fmt(k.last) : '<span class="late">never</span>'}`).join('<br>')}</td></tr>`).join('')}</tbody></table></div>` : U.empty('No gaps.'), 4);
    // library viewer
    const allCls = [...new Set(m.strategy.map(t => t.cls))];
    if (!allCls.includes(state.stClass)) state.stClass = allCls.includes('Centrifugal slurry pump') ? 'Centrifugal slurry pump' : allCls[0];
    const rows = m.strategy.filter(t => t.cls === state.stClass);
    const lib = U.block('s12', 'Strategy library', 'Failure mode → technique → task → interval by criticality (days). Edit in the workbook: Strategy_Library',
      `<div class="hist-top"><select id="stClassSel" aria-label="Strategy class">${allCls.map(c => `<option ${c === state.stClass ? 'selected' : ''}>${U.esc(c)}</option>`).join('')}</select><span class="small">${assets.filter(a => a.strategy === state.stClass).length} assets in view use this class</span></div>
      <div class="scroll"><table class="tbl"><thead><tr><th>Failure mode</th><th>Mechanism / cause</th><th>Technique</th><th>Task</th><th class="r">A</th><th class="r">B</th><th class="r">C</th><th>Alert / Danger criterion</th><th>Reference</th></tr></thead><tbody>
      ${rows.map(t => `<tr><td class="b">${U.esc(t.fm)}</td><td>${U.esc(t.mech)}</td><td>${U.esc(t.tech)}${t.tracked ? '' : '<div class="small">operator round</div>'}</td><td>${U.esc(t.task)}</td><td class="r">${t.iv.A ?? '–'}</td><td class="r">${t.iv.B ?? '–'}</td><td class="r">${t.iv.C ?? '–'}</td><td class="small">${U.esc(t.crit)}</td><td class="small">${U.esc(t.ref)}</td></tr>`).join('')}</tbody></table></div>
      <div class="method">Intervals are starting points: refine each from the failure mode's P-F interval, failure history and OEM data (ISO 17359). Operator-round tasks are listed for completeness but are not measured in AHIM.</div>`, 5);
    return `<div class="grid">${U.block('s12', 'Strategy compliance', 'Required condition monitoring and inspection tasks (Strategy_Library) against what was recorded within the interval for each asset’s criticality class', kp, 1)}${byTech}${byClass}${gaps}${lib}</div>`;
  };
})();
