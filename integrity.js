/* Page 4: Integrity & statutory - certificates, thickness / remaining life, integrity findings. */
(function () {
  const U = AHIM.ui, C = AHIM.calc;
  const INTEG = ['Statutory', 'Tank & vessel', 'Piping', 'Structural', 'Ultrasonic thickness'];
  AHIM.pages.integrity = function (ctx) {
    const { m, D, assets } = ctx, s = m.settings, cfg = AHIM.config.integrity;
    const certs = assets.filter(a => a.certExpiry != null || a.statReq).map(a => {
      const days = a.certExpiry == null ? null : Math.round((a.certExpiry - D) / C.DAY);
      return { a, days, st: days == null ? 2 : days < 0 ? 2 : days <= s.statWindow ? 1 : 0 };
    }).sort((x, y) => (x.days ?? -1e9) - (y.days ?? -1e9));
    const cnt = k => certs.filter(c => c.st === k).length;
    const stat = U.block('s12', 'Statutory register', `Next statutory inspection or certificate due, as of ${U.fmt(D)}: overdue or missing = Danger, due within ${s.statWindow} days = Alert`,
      `<div class="kpis">${U.kpi(certs.length, 'Statutory items')}${U.kpi(cnt(0), 'In date', 'good')}${U.kpi(cnt(1), 'Due within ' + s.statWindow + ' days', cnt(1) ? 'warn' : '')}${U.kpi(cnt(2), 'Overdue or missing', cnt(2) ? 'bad' : '')}</div>
      ${certs.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Asset</th><th>Class</th><th>Next inspection / certificate due</th><th class="r">Days left</th><th>Status</th><th>Responsible</th></tr></thead><tbody>
      ${certs.map(c => `<tr data-asset="${U.esc(c.a.id)}" tabindex="0"><td><b>${U.esc(c.a.tag)}</b><div class="small">${U.esc(c.a.name)}</div></td><td>${U.esc(c.a.assetClass)}</td><td>${c.a.certExpiry ? U.fmt(c.a.certExpiry) : '<span class="late">Not recorded</span>'}</td><td class="r b">${c.days ?? '–'}</td><td>${U.pill(c.st)}</td><td>${U.esc(c.a.resp)}</td></tr>`).join('')}</tbody></table></div>` : U.empty('No statutory items in this area.')}`, 1);

    const thAll = assets.flatMap(a => C.thickness(a, D, cfg));
    const SV = { OK: 0, Alert: 1, Danger: 2 };
    // one line per asset: the governing band (worst status, then shortest remaining life, then smallest margin to the limit)
    const byA = {};
    thAll.forEach(t => { (byA[t.asset.id] = byA[t.asset.id] || []).push(t); });
    const th = Object.values(byA).map(list => {
      const key = t => [-SV[t.status], t.rl == null ? 1e9 : t.rl, t.tmin != null ? t.last.value - t.tmin : t.last.value];
      const gov = [...list].sort((x, y) => { const kx = key(x), ky = key(y); for (let i = 0; i < 3; i++) if (kx[i] !== ky[i]) return kx[i] - ky[i]; return 0; })[0];
      return { ...gov, bands: list.length, red: list.filter(t => t.status === 'Danger').length, yel: list.filter(t => t.status === 'Alert').length, anyBase: list.some(t => t.baseline) };
    }).sort((x, y) => SV[y.status] - SV[x.status] || (x.rl ?? 1e9) - (y.rl ?? 1e9) || (x.last.value - (x.tmin || 0)) - (y.last.value - (y.tmin || 0)));
    const yr = v => v == null ? '–' : v === 0 ? '0' : v > 50 ? '> 50' : v.toFixed(1);
    const nBase = th.filter(t => t.anyBase).length;
    const thick = U.block('s12', 'Thickness monitoring and remaining life', 'One line per asset: the governing measurement location. Corrosion rate = greater of long-term and short-term rate; remaining life = (actual − limit) ÷ rate',
      th.length ? `<div class="kpis">${U.kpi(th.length, 'Assets with thickness data')}${U.kpi(th.filter(t => t.status === 'Danger').length, 'Danger: below the minimum limit', th.some(t => t.status === 'Danger') ? 'bad' : 'good')}${U.kpi(th.filter(t => t.status === 'Alert').length, 'Alert: assessment needed', th.some(t => t.status === 'Alert') ? 'warn' : '')}${U.kpi(nBase, 'Baseline only: need a second survey for corrosion rate', nBase ? 'warn' : '')}</div>
      <div class="scroll tall"><table class="tbl"><thead><tr><th>Asset</th><th>Governing location</th><th class="r">Last (mm)</th><th class="r">Limit (mm)</th><th class="r">Bands red / alert</th><th class="r">Rate (mm/yr)</th><th class="r">Remaining life (yr)</th><th>Next UT due</th><th>Status</th></tr></thead><tbody>
      ${th.map(t => `<tr data-asset="${U.esc(t.asset.id)}" tabindex="0"><td><b>${U.esc(t.asset.tag)}</b><div class="small">${U.esc(t.asset.name)}</div></td><td>${U.esc(t.param)}<div class="small">${t.n} survey${t.n > 1 ? 's' : ''}, last ${U.fmt(t.last.date)}${t.last.remarks ? '' : ''}</div></td>
        <td class="r b">${t.last.value}</td><td class="r">${t.tmin ?? '–'}</td><td class="r">${t.red} / ${t.yel} <span class="small">of ${t.bands}</span></td>
        <td class="r ${t.st != null && t.lt != null && t.st > 1.5 * t.lt ? 'late' : ''}">${t.baseline ? '<span class="small">baseline</span>' : (t.rate ? t.rate.toFixed(2) : '–')}</td>
        <td class="r b">${t.baseline ? '<span class="small">after 2nd survey</span>' : t.rl === 0 ? '<span class="late">Below limit</span>' : yr(t.rl)}</td>
        <td class="${t.next < D ? 'late' : ''}">${!t.baseline && t.rl === 0 ? '<span class="late">Repair now</span>' : U.fmt(t.next)}</td><td>${U.pill(C.SEV[t.status])}</td></tr>`).join('')}</tbody></table></div>
      <div class="method">Limit = Danger limit of the measurement. For contractor UT surveys, until the API 653 minimum required thickness (t-min) is calculated per shell course: Alert = contractor red band (significant loss, assessment needed), Danger = 70% of the red band. After a single (baseline) survey the next UT is due within ${cfg.baselineRepeatYears || 1} year to establish the corrosion rate. A short-term rate in red is more than 1.5 × the long-term rate: corrosion is accelerating. Remaining life ≤ ${cfg.dangerYears} year = Danger, ≤ ${cfg.alertYears} years = Alert.</div>` : U.empty('No thickness readings in this area.'), 2);

    const ids = new Set(assets.map(a => a.id));
    const open = m.records.filter(r => ids.has(r.asset) && INTEG.includes(r.tech) && C.isOpenAt(r, D)).sort((a, b) => b.score - a.score);
    const find = U.block('s12', 'Open integrity findings', 'Statutory, tank and vessel, piping, structural and thickness',
      open.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Asset</th><th>Finding and action</th><th>Priority</th><th>Due</th><th>Stage</th></tr></thead><tbody>
      ${open.map(r => `<tr data-asset="${U.esc(r.asset)}" tabindex="0"><td><b>${U.esc(r.a.tag)}</b><div class="small">${U.esc(r.a.name)}</div>${U.sevTag(r.sev, r.tech)}</td><td>${U.esc(r.finding || r.param)}<div class="small">${U.esc(r.rec)}</div></td><td>${U.prio(r.prio)}</td><td class="${r.due < D ? 'late' : ''}">${U.fmt(r.due)}</td><td>${U.esc(r.stage)}${r.wo ? `<div class="small">WO ${U.esc(r.wo)}</div>` : '<div class="small late">No WO</div>'}</td></tr>`).join('')}</tbody></table></div>` : U.empty('No open integrity findings.'), 3);
    const scopeR = m.records.filter(r => ids.has(r.asset) && C.isOpenAt(r, D) && /isolation|shutdown/i.test(r.window || '')).sort((a, b) => (b.lik || 0) - (a.lik || 0) || b.score - a.score);
    const grp = {}; scopeR.forEach(r => { (grp[r.a.tag] = grp[r.a.tag] || { a: r.a, rs: [] }).rs.push(r); });
    const scope = U.block('s7', 'Isolation and shutdown scope', 'Open findings that need the unit isolated or the plant stopped: plan them into the next shutdown window',
      scopeR.length ? `<div class="kpis">${U.kpi(Object.keys(grp).length, 'Assets')}${U.kpi(scopeR.length, 'Findings')}${U.kpi(scopeR.filter(r => r.lik === 5).length, 'Active loss of containment / through-wall', scopeR.some(r => r.lik === 5) ? 'bad' : '')}${U.kpi(scopeR.filter(r => !r.wo).length, 'Without a work order', scopeR.some(r => !r.wo) ? 'bad' : 'good')}</div>
      <div class="scroll tall"><table class="tbl"><thead><tr><th>Asset</th><th>Findings</th><th>Window</th></tr></thead><tbody>${Object.values(grp).map(g => `<tr data-asset="${U.esc(g.a.id)}" tabindex="0"><td><b>${U.esc(g.a.tag)}</b><div class="small">${U.esc(g.a.name)}</div></td><td class="small">${g.rs.map(r => `${r.lik === 5 ? '<b class="late">●</b> ' : ''}${U.esc(r.finding || r.param)} ${U.prio(r.prio)}`).join('<br>')}</td><td class="small">${[...new Set(g.rs.map(r => r.window))].map(U.esc).join(', ')}</td></tr>`).join('')}</tbody></table></div>` : U.empty('No open findings needing isolation or shutdown.'), 4);
    const dmc = {}; m.records.filter(r => ids.has(r.asset) && C.isOpenAt(r, D) && r.dm).forEach(r => { dmc[r.dm] = (dmc[r.dm] || 0) + 1; });
    const dl = Object.entries(dmc).sort((a, b) => b[1] - a[1]), dmax = Math.max(1, ...dl.map(x => x[1]));
    const dmB = U.block('s5', 'Damage mechanisms (API 571)', 'Open integrity findings by damage mechanism: target the mechanism, not just the defect',
      dl.length ? dl.map(([k, n]) => U.hbar(k, n, dmax, 'var(--f2)')).join('') : U.empty('No coded damage mechanisms.'), 5);
    return `<div class="grid">${stat}${thick}${scope}${dmB}${find}</div>`;
  };
})();
