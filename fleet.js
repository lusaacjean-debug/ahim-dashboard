/* Page 5: Mobile fleet - availability, prestart compliance, defects. */
(function () {
  const U = AHIM.ui, C = AHIM.calc;
  AHIM.pages.fleet = function (ctx) {
    const { m, D, month } = ctx, T = m.settings.targets;
    const fleet = m.assets.filter(a => a.area === AHIM.config.fleetArea);
    if (!fleet.length) return `<div class="grid">${U.block('s12', 'Mobile fleet', '', U.empty('No assets with area "' + AHIM.config.fleetArea + '" in the register.'))}</div>`;
    const st = fleet.map(a => ({ a, ...C.assetAt(a, D, m.settings) }));
    const tagged = st.filter(x => x.open.some(r => r.sev === 2));
    const avail = U.pct(fleet.length - tagged.length, fleet.length);
    const pm = m.prestart.filter(p => p.month === month && fleet.some(a => a.id === p.asset));
    const psp = U.pct(pm.reduce((t, p) => t + p.done, 0), pm.reduce((t, p) => t + p.shifts, 0));
    const openAll = st.flatMap(x => x.open);
    const top = `<div class="kpis">${U.kpi(fleet.length, 'Vehicles and machines')}${U.kpi(avail + '%', 'Available (not tagged out)', tagged.length ? 'bad' : 'good')}${U.kpi(psp == null ? '–' : psp + '%', 'Prestart compliance, ' + U.mon(month) + ' (target ' + T.prestart + '%)', psp >= T.prestart ? 'good' : 'bad')}${U.kpi(openAll.length, 'Open defects')}</div>
      ${tagged.length ? `<div class="alertbox"><b>Tagged out:</b> ${tagged.map(x => `${U.esc(x.a.tag)} ${U.esc(x.a.name)} (${U.esc(x.open.filter(r => r.sev === 2).map(r => r.param).join(', '))})`).join('; ')}</div>` : ''}`;
    const techs = m.techs.filter(t => fleet.some(a => a.techs.includes(t)));
    const matrix = `<div class="scroll"><table class="matrix"><thead><tr><th class="l">Unit</th><th class="l">Description</th><th>Crit.</th>${techs.map(t => `<th class="rot"><span>${U.esc(t)}</span></th>`).join('')}<th>Overall</th><th>Prestart ${U.mon(month)}</th></tr></thead><tbody>
      ${st.sort((x, y) => (y.overall ?? -1) - (x.overall ?? -1)).map(x => { const p = pm.find(q => q.asset === x.a.id), pc = p ? U.pct(p.done, p.shifts) : null;
        return `<tr data-asset="${U.esc(x.a.id)}" tabindex="0"><td class="l b">${U.esc(x.a.tag)}</td><td class="l">${U.esc(x.a.name)}</td><td>${U.crit(x.a.cls)}</td>${techs.map(t => `<td>${x.a.techs.includes(t) ? U.cell(x.byTech[t] ?? null, t) : U.cell(undefined)}</td>`).join('')}<td>${U.pill(x.overall)}</td><td class="${pc != null && pc < T.prestart ? 'late' : ''}">${pc == null ? '–' : pc + '% <span class="small">(' + p.done + '/' + p.shifts + ')</span>'}</td></tr>`; }).join('')}</tbody></table></div>`;
    const pts = [];
    for (let i = 11; i >= 0; i--) { const ms = C.addMonths(month, -i), rows = m.prestart.filter(p => p.month === ms && fleet.some(a => a.id === p.asset)); if (rows.length) pts.push({ t: ms + 14 * C.DAY, v: U.pct(rows.reduce((t, p) => t + p.done, 0), rows.reduce((t, p) => t + p.shifts, 0)), label: U.fmtMonth(ms) + ': ' }); }
    const chart = pts.length ? AHIM.charts.time({ points: pts, xMin: C.addMonths(month, -11), xMax: C.monthEnd(month), yMin: 70, yMax: 100, target: T.prestart, lastStatus: psp >= T.prestart ? 0 : 1, labelEnds: true, label: 'Prestart compliance' }) : U.empty('No prestart data.');
    const defects = openAll.sort((a, b) => b.sev - a.sev || b.score - a.score);
    const def = defects.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Unit</th><th>Defect</th><th>Source</th><th>Priority</th><th>Due</th><th>Stage</th></tr></thead><tbody>
      ${defects.map(r => `<tr data-asset="${U.esc(r.asset)}" tabindex="0"><td><b>${U.esc(r.a.tag)}</b></td><td>${U.sevTag(r.sev, r.param)}<div class="small">${U.esc(r.finding)}</div></td><td>${U.esc(r.source)}</td><td>${U.prio(r.prio)}</td><td class="${r.due < D ? 'late' : ''}">${U.fmt(r.due)}</td><td>${U.esc(r.stage)}${r.wo ? `<div class="small">WO ${U.esc(r.wo)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>` : U.empty('No open fleet defects.');
    return `<div class="grid">${U.block('s12', 'Fleet status', 'Danger defects from prestart or inspection tag the unit out until verified', top + matrix, 1)}
      ${U.block('s5', 'Prestart compliance trend', 'Prestarts completed ÷ shifts operated', `<div class="chart">${chart}</div>`, 2)}
      ${U.block('s7', 'Open fleet defects', 'From prestarts, fleet inspections and oil analysis', def, 3)}</div>`;
  };
})();
