/* Work management (SMRP pillar 5): PM and schedule compliance, planned vs emergency work, backlog in crew-weeks,
   finding-to-WO conversion, backlog by trade and age, shutdown-dependent work. Source: Work_Orders + Labour. */
(function () {
  const U = AHIM.ui, C = AHIM.calc, K = AHIM.kpis;
  AHIM.pages.work = function (ctx) {
    const { m, D, month, area, assets } = ctx;
    const ids = new Set(assets.map(a => a.id));
    const wo = m.wo.filter(w => area === 'All' ? true : ids.has(w.asset));
    const mm = { ...m, wo }, W = K.work(mm, month, D), T = m.settings.targets;
    const conv = m.records.filter(r => r.isRec && r.wo && ids.has(r.asset)).map(r => { const w = m.wo.find(x => x.wo === r.wo); return w && w.raised != null ? (w.raised - r.date) / C.DAY : null; }).filter(x => x != null && x >= 0).sort((a, b) => a - b);
    const med = conv.length ? conv[Math.floor(conv.length / 2)] : null;
    const tile = (v, l, t, r) => `<div class="mk ${r}"><div class="v">${v}</div><div class="l">${U.esc(l)}</div><div class="tg">${U.esc(t)}</div></div>`;
    const rg = (v, tg, hi) => v == null ? '' : hi ? (v >= tg ? 'g' : v >= tg * 0.9 ? 'w' : 'r') : (v <= tg ? 'g' : v <= tg * 1.5 ? 'w' : 'r');
    const pct = v => v == null ? '–' : v + '%';
    const tiles = `<div class="mk-grid">
      ${tile(pct(W.pmPct), 'PM compliance (done by required date)', `${W.pmOk.length} of ${W.pm.length} · target ≥ 90%`, rg(W.pmPct, 90, true))}
      ${tile(pct(W.scPct), 'Schedule compliance (done in scheduled week)', `${W.scOk.length} of ${W.sc.length} · target ≥ 85%`, rg(W.scPct, 85, true))}
      ${tile(pct(W.plannedPct), 'Planned work, % of hours worked', 'Target ≥ 85%', rg(W.plannedPct, 85, true))}
      ${tile(pct(W.emergPct), 'Emergency work, % of hours worked', 'Target < 10%', rg(W.emergPct, 10, false))}
      ${tile(W.backlogW == null ? '–' : W.backlogW.toFixed(1), 'Backlog (crew-weeks)', `Ready ${W.readyW == null ? '–' : W.readyW.toFixed(1)} · healthy band 2 to 4`, W.backlogW == null ? '' : W.backlogW >= 2 && W.backlogW <= 4 ? 'g' : W.backlogW <= 6 ? 'w' : 'r')}
      ${tile(pct(W.otPct), 'Overtime, % of available hours', 'Target < 8%', rg(W.otPct, 8, false))}
      ${tile(med == null ? '–' : med.toFixed(0) + ' d', 'Finding to work order (median)', `${U.pct(conv.filter(x => x <= 2).length, conv.length) ?? '–'}% within 2 days`, med == null ? '' : med <= 2 ? 'g' : med <= 7 ? 'w' : 'r')}
      ${tile(W.open.length, 'Open work orders', `${W.open.filter(w => w.shut).length} need a shutdown`, '')}</div>
      ${area !== 'All' ? '<p class="small">Labour-based indicators (planned, emergency, overtime, crew-weeks) are site-wide.</p>' : ''}`;
    // trends
    const labels = [], bl = [], pmT = [], scT = [];
    for (let i = 11; i >= 0; i--) {
      const ms = C.addMonths(month, -i), me = i === 0 ? D : C.monthEnd(ms); labels.push(U.mon(ms));
      const w = K.work(mm, ms, me); bl.push(w.backlogW == null ? null : Math.round(w.backlogW * 10) / 10); pmT.push(w.pmPct); scT.push(w.scPct);
    }
    const ch1 = AHIM.charts.bars({ labels, series: [{ values: pmT, color: 'var(--f2)', name: 'PM' }, { values: scT, color: 'var(--f4)', name: 'Schedule' }], target: 90, yMax: 100, fmt: v => Math.round(v) + '%', label: 'Compliance trend' });
    const ch2 = AHIM.charts.bars({ labels, series: [{ values: bl, color: 'var(--f3)', name: 'Backlog' }], target: 4, fmt: v => v.toFixed ? v.toFixed(1) : v, label: 'Backlog trend' });
    // mix, trade, age
    const inM = w => (w.raised != null && w.raised >= month && w.raised <= C.monthEnd(month));
    const types = {}; wo.filter(inM).forEach(w => { const t = types[w.type] = types[w.type] || { n: 0, h: 0 }; t.n++; t.h += w.planH; });
    const tl = Object.entries(types).sort((a, b) => b[1].h - a[1].h), tmax = Math.max(1, ...tl.map(x => x[1].h));
    const trades = {}; W.open.forEach(w => { const t = trades[w.trade] = trades[w.trade] || { n: 0, h: 0, r: 0, old: 0 }; t.n++; t.h += w.planH; if (w.ready) t.r += w.planH; t.old = Math.max(t.old, (D - w.raised) / C.DAY); });
    const labT = {}; W.lab.forEach(l => { labT[l.trade] = l.avail / 4.33; });
    const BK = [['0–30 days', 0, 30], ['31–60 days', 31, 60], ['61–90 days', 61, 90], ['Over 90 days', 91, 1e9]];
    const ages = BK.map(b => [b[0], W.open.filter(w => { const a = (D - w.raised) / C.DAY; return a >= b[1] && a <= b[2]; }).length]), amax = Math.max(1, ...ages.map(x => x[1]));
    const shut = W.open.filter(w => w.shut).sort((a, b) => a.raised - b.raised);
    const p1 = W.open.filter(w => /P1/.test(w.prio) || w.type === 'Emergency').sort((a, b) => a.raised - b.raised);
    const tag = id => (m.byId[id] || {}).tag || id || '–';
    const woTable = list => list.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>WO</th><th>Asset</th><th>Description</th><th>Type</th><th>Trade</th><th class="r">Hours</th><th>Raised</th><th>Status</th></tr></thead><tbody>
      ${list.slice(0, 15).map(w => `<tr ${w.asset ? `data-asset="${U.esc(w.asset)}"` : ''}><td class="b">${U.esc(w.wo)}</td><td>${U.esc(tag(w.asset))}</td><td>${U.esc(w.desc)}</td><td>${U.esc(w.type)}</td><td>${U.esc(w.trade)}</td><td class="r">${w.planH}</td><td>${U.fmt(w.raised)}</td><td>${U.esc(w.status)}${w.ready ? ' · ready' : ''}</td></tr>`).join('')}</tbody></table></div>${list.length > 15 ? `<p class="small">… and ${list.length - 15} more.</p>` : ''}` : U.empty('None.');
    return `<div class="grid">${U.block('s12', 'Work management performance', U.fmtMonth(month) + ' · SMRP Best Practice Metrics · source: Work_Orders and Labour', tiles, 1)}
      ${U.block('s7', 'PM and schedule compliance trend', 'Dark: PM compliance · light: schedule compliance', `<div class="chart">${ch1}</div>`, 2)}
      ${U.block('s5', 'Backlog trend (crew-weeks)', 'Healthy band 2 to 4 weeks', `<div class="chart">${ch2}</div>`, 3)}
      ${U.block('s5', 'Work mix this month', 'Planned hours by work type', tl.map(([k, v]) => U.hbar(k, Math.round(v.h), tmax, /Breakdown|Emergency/.test(k) ? 'var(--danger)' : 'var(--f2)', `${Math.round(v.h)} h · ${v.n}`)).join('') || U.empty('No work orders raised this month.'), 4)}
      ${U.block('s7', 'Backlog by trade', 'Open work orders, hours and crew-weeks (from available hours)', Object.keys(trades).length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Trade</th><th class="r">Open WOs</th><th class="r">Hours</th><th class="r">Ready hours</th><th class="r">Crew-weeks</th><th class="r">Oldest (days)</th></tr></thead><tbody>
        ${Object.entries(trades).sort((a, b) => b[1].h - a[1].h).map(([k, t]) => `<tr><td>${U.esc(k)}</td><td class="r">${t.n}</td><td class="r">${Math.round(t.h)}</td><td class="r">${Math.round(t.r)}</td><td class="r b">${labT[k] ? (t.h / labT[k]).toFixed(1) : '–'}</td><td class="r">${Math.round(t.old)}</td></tr>`).join('')}</tbody></table></div>` : U.empty('No open work orders.'), 5)}
      ${U.block('s5', 'Backlog age', 'Open work orders by age', ages.map(([l, n]) => U.hbar(l, n, amax, /90/.test(l) ? 'var(--danger)' : 'var(--f3)')).join(''), 6)}
      ${U.block('s7', 'Shutdown-dependent backlog', `${shut.length} open work orders need a shutdown: plan them into the next window`, woTable(shut), 7)}
      ${U.block('s12', 'Open P1 and emergency work', 'Oldest first', woTable(p1), 8)}</div>`;
  };
})();
