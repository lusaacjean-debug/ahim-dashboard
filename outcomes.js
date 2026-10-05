/* Outcomes: availability and production loss by circuit, downtime causes and top downtime assets. Source: Production + Work_Orders. */
(function () {
  const U = AHIM.ui, C = AHIM.calc, K = AHIM.kpis;
  AHIM.pages.outcomes = function (ctx) {
    const { m, D, month } = ctx;
    const P = K.prod(m, month), circuits = [...new Set(m.production.map(p => p.circuit))];
    const y0 = Date.UTC(new Date(month).getUTCFullYear(), 0, 1);
    const lostYtd = m.production.filter(p => p.month >= y0 && p.month <= month).reduce((t, p) => t + p.lost, 0);
    const fails = m.wo.filter(w => w.type === 'Breakdown' && w.raised != null && w.raised >= month && w.raised <= C.monthEnd(month)).length;
    const pts = [];
    for (let i = 11; i >= 0; i--) { const ms = C.addMonths(month, -i), x = K.prod(m, ms); if (x.avail != null) pts.push({ t: ms + 14 * C.DAY, v: Math.round(x.avail * 10) / 10 }); }
    const ch = AHIM.charts.time({ points: pts, xMin: C.addMonths(month, -11), xMax: C.monthEnd(month), yMin: 80, yMax: 100, target: 95, lastStatus: P.avail >= 95 ? 0 : P.avail >= 90 ? 1 : 2, labelEnds: true, label: 'Availability trend' });
    const row = c => { const cur = m.production.find(p => p.circuit === c && p.month === month); const yr = m.production.filter(p => p.circuit === c && p.month > C.addMonths(month, -12) && p.month <= month);
      const pl = yr.reduce((t, p) => t + p.planned, 0), av12 = pl ? (pl - yr.reduce((t, p) => t + p.mDown, 0)) / pl * 100 : null;
      const av = cur && cur.planned ? (cur.planned - cur.mDown) / cur.planned * 100 : null;
      return `<tr><td class="b">${U.esc(c)}</td><td class="r b ${av != null && av < 95 ? 'late' : ''}">${av == null ? '–' : av.toFixed(1) + '%'}</td><td class="r">${av12 == null ? '–' : av12.toFixed(1) + '%'}</td><td class="r">${cur ? cur.mDown : '–'}</td><td class="r">${cur ? cur.pDown : '–'}</td><td class="r">${cur ? cur.oDown : '–'}</td><td class="r">${cur ? Math.round(cur.prod).toLocaleString('en-GB') + ' ' + U.esc(cur.unit) : '–'}</td><td class="r b">${cur ? U.money(cur.lost) : '–'}</td></tr>`; };
    const dt = {}; m.wo.filter(w => /Breakdown|Emergency/.test(w.type) && w.raised != null && w.raised > D - 365 * C.DAY && w.raised <= D && w.asset).forEach(w => { dt[w.asset] = (dt[w.asset] || 0) + w.down; });
    const top = Object.entries(dt).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 10), tmax = Math.max(1, ...top.map(x => x[1]));
    const cause = [['Maintenance', P.mDown], ['Process', P.P.reduce((t, p) => t + p.pDown, 0)], ['Other', P.P.reduce((t, p) => t + p.oDown, 0)]], cmax = Math.max(1, ...cause.map(x => x[1]));
    const tile = (v, l, t, r) => `<div class="mk ${r}"><div class="v">${v}</div><div class="l">${U.esc(l)}</div><div class="tg">${U.esc(t)}</div></div>`;
    const tiles = `<div class="mk-grid">${tile(P.avail == null ? '–' : P.avail.toFixed(1) + '%', 'Availability of critical circuits', 'Target ≥ 95% (maintenance-related)', P.avail >= 95 ? 'g' : P.avail >= 90 ? 'w' : 'r')}
      ${tile(Math.round(P.mDown) + ' h', 'Maintenance downtime this month', 'All circuits', '')}${tile(U.money(P.lost), 'Lost production value this month', 'Maintenance downtime × value per hour', P.lost > 50000 ? 'r' : 'g')}
      ${tile(U.money(lostYtd), 'Lost production value YTD', new Date(month).getUTCFullYear() + '', '')}${tile(fails, 'Breakdowns this month', 'Breakdown work orders', fails ? 'w' : 'g')}</div>`;
    return `<div class="grid">${U.block('s12', 'Business outcomes', U.fmtMonth(month) + ' · availability = (planned hours − maintenance downtime) ÷ planned hours', tiles, 1)}
      ${U.block('s7', 'Availability trend, critical circuits', 'Weighted by planned hours', `<div class="chart">${ch}</div>`, 2)}
      ${U.block('s5', 'Downtime by cause', U.fmtMonth(month) + ', hours', cause.map(([k, v]) => U.hbar(k, Math.round(v), cmax, k === 'Maintenance' ? 'var(--danger)' : 'var(--f3)', Math.round(v) + ' h')).join(''), 3)}
      ${U.block('s12', 'Availability and production by circuit', U.fmtMonth(month), `<div class="scroll"><table class="tbl"><thead><tr><th>Circuit</th><th class="r">Availability</th><th class="r">12-month</th><th class="r">Maint. down (h)</th><th class="r">Process (h)</th><th class="r">Other (h)</th><th class="r">Production</th><th class="r">Lost value</th></tr></thead><tbody>${circuits.map(row).join('')}</tbody></table></div>`, 4)}
      ${U.block('s12', 'Top downtime contributors', 'Breakdown and emergency downtime by asset, last 12 months: candidates for RCA', top.length ? top.map(([a, h]) => U.hbar(((m.byId[a] || {}).tag || a) + ' ' + ((m.byId[a] || {}).name || ''), h, tmax, 'var(--danger)', Math.round(h) + ' h')).join('') : U.empty('No downtime recorded on work orders.'), 5)}</div>`;
  };
})();
