/* KPI tree (ISO 55001 cl. 6.2 line of sight): objectives -> KPIs -> owner, target, actual, status. */
(function () {
  const U = AHIM.ui;
  const fmt = (id, v, kpi) => v == null ? '–' : id === 'downtime_cost' ? U.money(v) : id === 'cm_roi' ? v + ' : 1' : id === 'backlog_weeks' ? v + ' wk' : /%/.test(kpi) ? v + '%' : v;
  AHIM.pages.kpitree = function (ctx) {
    const { m } = ctx, V = AHIM.kpis.compute(ctx);
    const objs = [...new Set(m.kpiTree.map(k => k.objective))];
    const rows = m.kpiTree.map(k => ({ k, v: V[k.id], r: AHIM.kpis.rag(k, V[k.id]) }));
    const n = c => rows.filter(x => x.r === c).length;
    const sum = `<div class="kpis">${U.kpi(n('g'), 'On target', 'good')}${U.kpi(n('w'), 'Close to target', 'warn')}${U.kpi(n('r'), 'Off target', 'bad')}${U.kpi(rows.filter(x => x.v == null).length, 'No data yet')}</div>`;
    const lab = { g: 'On target', w: 'Close', r: 'Off target', '': 'No data' };
    return `<div class="grid">${U.block('s12', 'KPI tree', 'Objectives → KPIs → owners → targets, ' + U.fmtMonth(ctx.month) + '. Edit owners and targets in the KPI_Tree sheet.', sum, 1)}
      ${objs.map((o, i) => U.block('s12', o, '', `<div class="scroll"><table class="tbl"><thead><tr><th>KPI</th><th>Tier</th><th>Owner</th><th>Frequency</th><th class="r">Target</th><th class="r">Actual</th><th>Status</th></tr></thead><tbody>
        ${rows.filter(x => x.k.objective === o).map(({ k, v, r }) => `<tr><td class="b">${U.esc(k.kpi)}</td><td>${U.esc(k.tier)}</td><td>${U.esc(k.owner)}</td><td>${U.esc(k.freq)}</td><td class="r">${/lower/i.test(k.dir) ? '≤ ' : '≥ '}${fmt(k.id, k.target, k.kpi)}</td><td class="r b">${fmt(k.id, v, k.kpi)}</td><td><span class="kt kt-${r || 'n'}">${lab[r]}</span></td></tr>`).join('')}</tbody></table></div>`, i + 2)).join('')}</div>`;
  };
})();
