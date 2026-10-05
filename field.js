/* Field (operational tier): routes due, printable route sheet, today's priorities, ready work this week, what to inspect next. */
(function () {
  const U = AHIM.ui, C = AHIM.calc;
  AHIM.pages.field = function (ctx) {
    const { m, D, area, assets, state } = ctx, s = m.settings;
    const ids = new Set(assets.map(a => a.id));
    const routes = m.routes.filter(r => area === 'All' || r.area === area).map(r => ({ ...r, next: r.last != null ? r.last + r.interval * C.DAY : null }));
    const st = r => r.next == null ? ['Never done', 'late'] : r.next < D ? ['Overdue ' + Math.round((D - r.next) / C.DAY) + ' d', 'late'] : r.next - D <= 7 * C.DAY ? ['Due ' + U.fmt(r.next), 'rag-w'] : ['OK, next ' + U.fmt(r.next), 'small'];
    if (!routes.some(r => r.id === state.route)) state.route = (routes.find(r => st(r)[1] === 'late') || routes[0] || {}).id;
    const R = routes.find(r => r.id === state.route);
    const sheet = R ? R.assets.map(id => m.byId[id]).filter(Boolean).map(a => ({ a, x: C.assetAt(a, D, s) })) : [];
    const sel = routes.length ? `<div class="hist-top"><select id="routeSel" aria-label="Route">${routes.map(r => `<option value="${U.esc(r.id)}" ${r.id === state.route ? 'selected' : ''}>${U.esc(r.id)}: ${U.esc(r.name)}</option>`).join('')}</select>
      <span class="small">${R ? `${U.esc(R.tech)} · every ${R.interval} d · ${U.esc(R.person)} · last ${U.fmt(R.last)}` : ''}</span></div>` : '';
    const routeSheet = R ? `${sel}<div class="scroll"><table class="tbl route"><thead><tr><th>Asset</th><th>Crit.</th><th>Last inspected</th><th>Current</th><th>Open findings</th><th>Condition today</th><th style="width:28%">Notes / reading</th></tr></thead><tbody>
      ${sheet.map(({ a, x }) => `<tr data-asset="${U.esc(a.id)}"><td><b>${U.esc(a.tag)}</b><div class="small">${U.esc(a.name)}</div></td><td>${U.crit(a.cls)}</td><td class="${x.stale ? 'late' : ''}">${x.last ? U.fmt(x.last) : 'never'}</td><td>${U.pill(x.health)}</td><td class="small">${x.open.map(r => U.esc(r.finding || r.param)).join('<br>') || '–'}</td><td class="boxes">☐ OK &nbsp; ☐ Alert &nbsp; ☐ Danger</td><td></td></tr>`).join('')}</tbody></table></div>
      <p class="small">Inspector: ________________ &nbsp; Date: __________ &nbsp; Signature: ______________ · Enter results in the CM workbook Data entry the same day.</p>` : U.empty('No routes defined: add them in the Routes sheet.');
    const pri = m.records.filter(r => ids.has(r.asset) && C.isOpenAt(r, D) && (r.sev === 2 || r.prio === 'P1')).sort((a, b) => a.due - b.due).slice(0, 15);
    const wk0 = D - 6 * C.DAY, wk1 = D + 7 * C.DAY;
    const ready = m.wo.filter(w => (area === 'All' || ids.has(w.asset)) && /Ready|Scheduled/.test(w.status) && w.sched != null && w.sched >= wk0 && w.sched <= wk1).sort((a, b) => a.sched - b.sched);
    const next = assets.map(a => ({ a, x: C.assetAt(a, D, s) })).filter(o => o.x.health === 3).sort((p, q) => 'ABC'.indexOf(p.a.cls) - 'ABC'.indexOf(q.a.cls) || (q.a.aci || 0) - (p.a.aci || 0)).slice(0, 15);
    return `<div class="grid">${U.block('s12', 'Routes', 'Route status from the Routes sheet: interval and last completion', routes.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Route</th><th>Area</th><th>Technique</th><th>Technician</th><th class="r">Assets</th><th>Status</th></tr></thead><tbody>
      ${routes.sort((a, b) => (a.next || 0) - (b.next || 0)).map(r => { const x = st(r); return `<tr><td><b>${U.esc(r.id)}</b> ${U.esc(r.name)}</td><td>${U.esc(r.area)}</td><td>${U.esc(r.tech)}</td><td>${U.esc(r.person)}</td><td class="r">${r.assets.length}</td><td class="${x[1]}">${x[0]}</td></tr>`; }).join('')}</tbody></table></div>` : U.empty('No routes defined.'), 1)}
      ${U.block('s12', 'Route sheet', 'Printable field sheet: tick the condition and note readings', routeSheet, 2)}
      ${U.block('s7', "Today's priorities", 'Open Danger and P1 findings, earliest due first', pri.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Asset</th><th>Finding</th><th>Due</th><th>WO</th></tr></thead><tbody>${pri.map(r => `<tr data-asset="${U.esc(r.asset)}"><td><b>${U.esc(r.a.tag)}</b><div class="small">${U.esc(r.a.name)}</div></td><td>${U.sevTag(r.sev, r.tech)} ${U.esc(r.finding || r.param)}</td><td class="${r.due < D ? 'late' : ''}">${U.fmt(r.due)}</td><td>${r.wo ? U.esc(r.wo) : '<span class="late">none</span>'}</td></tr>`).join('')}</tbody></table></div>` : U.empty('No Danger or P1 findings open.'), 3)}
      ${U.block('s5', 'Ready work this week', 'Ready or scheduled work orders, this week and next', ready.length ? ready.slice(0, 15).map(w => `<div class="ofr"><b>${U.esc(w.wo)}</b> ${U.esc((m.byId[w.asset] || {}).tag || '')} · ${U.esc(w.desc)} <span class="small">${U.fmt(w.sched)} · ${U.esc(w.trade)} · ${w.planH} h</span></div>`).join('') : U.empty('No ready work scheduled.'), 4)}
      ${U.block('s12', 'Inspect next', 'Assets with no inspection within their interval, critical first', next.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Asset</th><th>Crit.</th><th>Last inspected</th><th>Required every</th></tr></thead><tbody>${next.map(({ a, x }) => `<tr data-asset="${U.esc(a.id)}"><td><b>${U.esc(a.tag)}</b> ${U.esc(a.name)}</td><td>${U.crit(a.cls)}</td><td class="late">${x.last ? U.fmt(x.last) : 'never'}</td><td>${x.interval} days</td></tr>`).join('')}</tbody></table></div>` : U.empty('All assets inspected within interval.'), 5)}</div>`;
  };
})();
