/* Finance: maintenance cost vs budget, cost/RAV, cost per unit of production, top cost assets, 5-year renewal forecast. */
(function () {
  const U = AHIM.ui, C = AHIM.calc, K = AHIM.kpis;
  AHIM.pages.finance = function (ctx) {
    const { m, D, month } = ctx, F = K.cost(m, month, D);
    const cm = m.costs.filter(c => c.month === month), ma = cm.reduce((t, c) => t + c.actual, 0), mb = cm.reduce((t, c) => t + c.budget, 0);
    const labels = [], act = [], bud = [];
    for (let i = 11; i >= 0; i--) { const ms = C.addMonths(month, -i), r = m.costs.filter(c => c.month === ms); labels.push(U.mon(ms)); act.push(r.length ? r.reduce((t, c) => t + c.actual, 0) / 1000 : null); bud.push(r.length ? r.reduce((t, c) => t + c.budget, 0) / 1000 : null); }
    const ch = AHIM.charts.bars({ labels, series: [{ values: act, color: 'var(--f2)', name: 'Actual' }], line: { values: bud, name: 'Budget' }, fmt: v => '$' + Math.round(v) + 'k', label: 'Cost vs budget' });
    const grp = key => { const g = {}; F.ytd.forEach(c => { const x = g[c[key]] = g[c[key]] || { a: 0, b: 0 }; x.a += c.actual; x.b += c.budget; }); return Object.entries(g).sort((a, b) => b[1].a - a[1].a); };
    const vt = (a, b) => { const v = b ? (a - b) / b * 100 : 0; return `<span class="${v > 5 ? 'late' : v < -5 ? 'rag-g' : ''}">${v > 0 ? '+' : ''}${v.toFixed(0)}%</span>`; };
    const unitRow = area => { const pr = m.production.filter(p => p.circuit === area && p.month > C.addMonths(month, -12) && p.month <= month), q = pr.reduce((t, p) => t + p.prod, 0);
      const c12 = m.costs.filter(c => c.area === area && c.month > C.addMonths(month, -12) && c.month <= month).reduce((t, c) => t + c.actual, 0);
      return q && c12 ? `$${(c12 / q).toFixed(c12 / q < 10 ? 2 : 0)} / ${U.esc(pr[0].unit)}` : '–'; };
    const tc = {}; m.wo.filter(w => w.asset && w.fin != null && w.fin > D - 365 * C.DAY && w.fin <= D && w.cost).forEach(w => { tc[w.asset] = (tc[w.asset] || 0) + w.cost; });
    const top = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 10), tmax = Math.max(1, ...top.map(x => x[1]));
    // renewal forecast: design life and integrity remaining life
    const yNow = new Date(D).getUTCFullYear(), items = [];
    m.assets.forEach(a => { if (a.installYear && a.life) { const y = a.installYear + a.life; if (y <= yNow + 5) items.push({ a, y: Math.max(y, yNow), why: y < yNow ? `beyond design life since ${y}` : `end of design life ${y}`, v: a.value || 0 }); } });
    m.assets.forEach(a => C.thickness(a, D, AHIM.config.integrity).forEach(t => { if (t.rl != null) { const y = yNow + Math.floor(t.rl); if (y <= yNow + 5 && !items.some(i => i.a === a)) items.push({ a, y, why: `remaining life ${t.rl.toFixed(1)} years (${t.param})`, v: a.value || 0 }); } }));
    const years = [0, 1, 2, 3, 4, 5].map(k => yNow + k), byY = years.map(y => items.filter(i => i.y === y).reduce((t, i) => t + i.v, 0)), ymax = Math.max(1, ...byY);
    const tile = (v, l, t, r) => `<div class="mk ${r}"><div class="v">${v}</div><div class="l">${U.esc(l)}</div><div class="tg">${U.esc(t)}</div></div>`;
    const tiles = `<div class="mk-grid">${tile(U.money(ma), 'Maintenance cost this month', `Budget ${U.money(mb)} · ${mb ? Math.round(ma / mb * 100) : '–'}%`, ma <= mb ? 'g' : ma <= mb * 1.1 ? 'w' : 'r')}
      ${tile(F.pctBudget == null ? '–' : Math.round(F.pctBudget) + '%', 'Year to date vs budget', `${U.money(F.a)} of ${U.money(F.b)}`, F.pctBudget <= 100 ? 'g' : F.pctBudget <= 105 ? 'w' : 'r')}
      ${tile(F.pctRav == null ? '–' : F.pctRav.toFixed(1) + '%', 'Maintenance cost, % of replacement asset value', `RAV ${U.money(F.rav)} · typical 2 to 4%`, F.pctRav == null ? '' : F.pctRav <= 3.5 ? 'g' : F.pctRav <= 4.5 ? 'w' : 'r')}
      ${tile(U.money(byY.reduce((t, v) => t + v, 0)), 'Renewal forecast, next 5 years', `${items.length} assets`, '')}</div>`;
    return `<div class="grid">${U.block('s12', 'Maintenance cost and value', U.fmtMonth(month) + ' · EN 15341 economic indicators', tiles, 1)}
      ${U.block('s7', 'Monthly cost vs budget', 'Bars: actual · line: budget', `<div class="chart">${ch}</div>`, 2)}
      ${U.block('s5', 'Year to date by category', 'Actual against budget', `<div class="scroll"><table class="tbl"><thead><tr><th>Category</th><th class="r">Actual</th><th class="r">Budget</th><th class="r">Variance</th></tr></thead><tbody>${grp('cat').map(([k, x]) => `<tr><td>${U.esc(k)}</td><td class="r">${U.money(x.a)}</td><td class="r">${U.money(x.b)}</td><td class="r">${vt(x.a, x.b)}</td></tr>`).join('')}</tbody></table></div>`, 3)}
      ${U.block('s7', 'Year to date by area', 'With maintenance cost per unit of production (12 months)', `<div class="scroll"><table class="tbl"><thead><tr><th>Area</th><th class="r">Actual</th><th class="r">Budget</th><th class="r">Variance</th><th class="r">Cost per unit</th></tr></thead><tbody>${grp('area').map(([k, x]) => `<tr><td>${U.esc(k)}</td><td class="r">${U.money(x.a)}</td><td class="r">${U.money(x.b)}</td><td class="r">${vt(x.a, x.b)}</td><td class="r">${unitRow(k)}</td></tr>`).join('')}</tbody></table></div>`, 4)}
      ${U.block('s5', 'Highest-cost assets', 'Work order cost, last 12 months', top.length ? top.map(([a, v]) => U.hbar((m.byId[a] || {}).tag || a, v, tmax, 'var(--f2)', U.money(v))).join('') : U.empty('No work order costs.'), 5)}
      ${U.block('s12', 'Five-year renewal forecast', 'Replacement value by year: from design life (install year + design life) and integrity remaining life', items.length ? years.map((y, i) => U.hbar(String(y), byY[i], ymax, i === 0 ? 'var(--danger)' : 'var(--f3)', U.money(byY[i]))).join('') +
        `<div class="scroll"><table class="tbl"><thead><tr><th>Year</th><th>Asset</th><th>Reason</th><th class="r">Replacement value</th></tr></thead><tbody>${items.sort((a, b) => a.y - b.y || b.v - a.v).map(i => `<tr data-asset="${U.esc(i.a.id)}"><td>${i.y}</td><td><b>${U.esc(i.a.tag)}</b> ${U.esc(i.a.name)}</td><td>${U.esc(i.why)}</td><td class="r">${i.v ? U.money(i.v) : '<span class="small">value not set</span>'}</td></tr>`).join('')}</tbody></table></div>` : U.empty('Add Install year, Design life and Replacement value in the Asset_Register to build the forecast.'), 6)}</div>`;
  };
})();
