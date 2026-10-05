/* AHIM printed reports: Monthly AHIM report (A4 portrait), Risk register and Weekly CM & planning pack (A4 landscape).
   Repeating header (thead), confidentiality footer and page numbers (@page margin boxes), grey-scale safe status
   symbols, printed filters, sign-off blocks, Save as PDF through the browser, Excel export of the tables. */
(function () {
  const U = AHIM.ui, C = AHIM.calc, CFG = AHIM.config;
  const NAMES = ['OK', 'Alert', 'Danger', 'Unknown'], GL = { OK: '●', Alert: '▲', Danger: '■', Unknown: '◌' };
  const e = U.esc;
  let getCtx = null, exportBook = null;
  const stat = s => { const n = typeof s === 'number' ? NAMES[s] : s; return n ? `<span class="rs rs-${n}">${GL[n] || ''} ${n}</span>` : '–'; };
  const rating = r => `<span class="rr rr-${e(r)}">${e(r)}</span>`;
  const today = () => { const d = new Date(); return U.fmt(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); };

  function header(title, ctx, filters, extra) {
    return `<div class="rh"><div class="rh-l"><b>${e(title)}</b><span>${e(CFG.siteName)} · ${e(CFG.unitName)}</span></div>
      <div class="rh-r"><span>Status as of <b>${U.fmt(ctx.D)}</b> · Data: ${e(ctx.state.source || '')}</span><span>${e(filters)}${extra ? ' · ' + extra : ''}</span></div></div>`;
  }
  const footer = () => `<div class="rf">Confidential: ${e(CFG.siteName)}. Printed ${today()}. Uncontrolled when printed unless signed below.</div>`;
  const sheet = (cls, head, body) => `<section class="sheet ${cls}"><table class="pg"><thead><tr><td>${head}</td></tr></thead><tbody><tr><td>${body}</td></tr></tbody><tfoot><tr><td>${footer()}</td></tr></tfoot></table></section>`;
  const signoff = roles => `<div class="sign"><h3>Approval</h3><table class="rt"><colgroup><col style="width:40%"><col style="width:25%"><col style="width:20%"><col style="width:15%"></colgroup><thead><tr><th>Role</th><th>Name</th><th>Signature</th><th>Date</th></tr></thead><tbody>${roles.map(r => `<tr><td>${e(r)}</td><td></td><td></td><td></td></tr>`).join('')}</tbody></table></div>`;
  const more = (n, lim) => n > lim ? `<p class="rn">… and ${n - lim} more: see the Excel export.</p>` : '';

  /* ---------- shared metrics (same rules as the Management page) ---------- */
  function metrics(ctx) {
    const { m, D, month } = ctx, s = m.settings, T = s.targets, all = m.assets;
    const cur = C.ahi(m, all, D), prev = C.ahi(m, all, C.monthEnd(C.addMonths(month, -1))), conf = C.confidence(m, all, D);
    const st = all.map(a => ({ a, ...C.assetAt(a, D, s) }));
    const RK = all.map(a => C.riskAt(m, a, D));
    const openAll = m.records.filter(r => C.isOpenAt(r, D)), od = openAll.filter(r => r.due < D);
    const withWo = U.pct(openAll.filter(r => r.wo).length, openAll.length);
    const closed12 = m.records.filter(r => r.isRec && r.closed != null && r.closed <= D && r.closed > D - 365 * C.DAY);
    const onT = U.pct(closed12.filter(r => r.closed <= r.due).length, closed12.length);
    const sch = m.schedule.filter(r => r.month === month), scp = U.pct(sch.reduce((t, r) => t + r.done, 0), sch.reduce((t, r) => t + r.planned, 0));
    const certs = all.filter(a => a.certExpiry != null), valid = certs.filter(a => a.certExpiry > D), soon = valid.filter(a => a.certExpiry - D <= s.statWindow * C.DAY);
    const SA = all.filter(a => a.cls === 'A').map(a => C.strategyAt(m, a, D)).filter(x => x && x.n);
    const stc = U.pct(SA.reduce((t, x) => t + x.done, 0), SA.reduce((t, x) => t + x.n, 0));
    const critD = st.filter(x => x.a.cls === 'A' && x.overall === 2).length;
    const ext = RK.filter(r => r.rating === 'Extreme'), hi = RK.filter(r => r.rating === 'High');
    const kpis = [
      ['Asset Health Index', cur, '≥ ' + T.ahi, cur >= T.ahi],
      ['Data confidence (assets inspected within interval)', conf.pct + '%', '≥ 85%', conf.pct >= 85],
      ['Extreme / High risks', ext.length + ' / ' + hi.length, '0 Extreme', ext.length === 0],
      ['Critical assets in Danger', critD, '0', critD === 0],
      ['Critical assets inspected within interval', conf.critPct + '%', '≥ ' + T.coverage + '%', conf.critPct >= T.coverage],
      ['Overdue recommendations', od.length + ' of ' + openAll.length, '≤ ' + T.overdue, od.length <= T.overdue],
      ['Open recommendations with a work order', withWo + '%', '100%', withWo === 100],
    ];
    if (stc != null) kpis.push(['Strategy compliance, critical assets', stc + '%', '≥ 90%', stc >= 90]);
    if (onT != null) kpis.push(['Recommendations closed on time (12 months)', onT + '%', '≥ ' + T.onTime + '%', onT >= T.onTime]);
    if (scp != null) kpis.push(['Inspection schedule compliance', scp + '%', '≥ ' + T.schedule + '%', scp >= T.schedule]);
    if (certs.length) kpis.push(['Statutory inspections in date', valid.length + ' / ' + certs.length, '100%', valid.length === certs.length]);
    return { cur, prev, conf, st, RK, ext, hi, openAll, od, withWo, critD, certs, soon, kpis, T };
  }

  function escalations(ctx, M) {
    const { m, D } = ctx, T = M.T, out = [];
    const decs = m.decisions.filter(d => !/closed|rejected/i.test(d.status));
    if (decs.length) return { title: 'Decisions required', items: decs.map(d => [d.title, d.reason, 'Owner: ' + d.owner + ' · ' + d.status]) };
    const p1 = M.od.filter(r => r.prio === 'P1' && D - r.due > 7 * C.DAY).sort((a, b) => a.due - b.due);
    if (p1.length) out.push([`${p1.length} P1 findings overdue by more than 7 days`, 'Oldest: ' + p1.slice(0, 3).map(r => `${r.a.tag} ${r.a.name} (due ${U.fmt(r.due)})`).join('; '), 'Ask: approve priority for these repairs']);
    const dn = M.st.filter(x => x.a.cls === 'A' && x.overall === 2 && !x.open.some(r => r.sev === 2 && r.wo));
    if (dn.length) out.push([`${dn.length} critical assets in Danger without a work order`, dn.slice(0, 4).map(x => x.a.tag + ' ' + x.a.name).join('; '), 'Ask: raise and schedule the WOs']);
    if (M.ext.length) out.push([`${M.ext.length} Extreme risks need General Manager attention`, M.ext.slice(0, 4).map(r => r.a.tag + ' ' + r.a.name).join('; '), 'Ask: act within 7 days or accept formally']);
    if (M.conf.critPct < T.coverage) out.push([`Only ${M.conf.critPct}% of critical assets inspected within interval`, `${M.conf.crit - M.conf.critCurrent} critical assets have no current inspection.`, 'Ask: route resources and access with Production']);
    M.soon.filter(a => a.certExpiry - D <= 30 * C.DAY).forEach(a => out.push([`Statutory inspection due: ${a.tag}`, `${a.name}: due ${U.fmt(a.certExpiry)}`, 'Ask: book the statutory inspection']));
    return { title: 'Needs management attention (automatic escalations)', items: out };
  }

  /* ---------- 1. Monthly AHIM report ---------- */
  function monthly(ctx) {
    const { m, D, month } = ctx, M = metrics(ctx), s = m.settings;
    const cm = m.commentary.find(c => c.month === month);
    const dl = M.cur != null && M.prev != null ? M.cur - M.prev : null;
    const hd = header('AHIM Monthly Report · ' + U.fmtMonth(month), ctx, 'Scope: whole site', `Data confidence <b>${M.conf.pct}%</b>`);
    const box = (v, l, sub) => `<div class="hb2"><div class="v">${v}</div><div class="l">${e(l)}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
    // trend
    const pts = [], bars = [];
    for (let i = 11; i >= 0; i--) { const ms = C.addMonths(month, -i), me = i === 0 ? D : C.monthEnd(ms); if (me < C.monthStart(m.minDate)) continue;
      pts.push({ t: ms + 14 * C.DAY, v: C.ahi(m, m.assets, me) }); bars.push({ t: ms + 14 * C.DAY, v: m.assets.filter(a => C.assetAt(a, me, s).overall === 2).length }); }
    const chart = AHIM.charts.time({ points: pts, bars, xMin: C.addMonths(month, -11), xMax: C.monthEnd(month), yMin: 0, yMax: 100, target: M.T.ahi, lastStatus: M.cur >= M.T.ahi ? 0 : M.cur >= 70 ? 1 : 2, labelEnds: true, h: 210, label: 'AHI trend' });
    const esc = escalations(ctx, M);
    const top = [...M.RK].filter(r => r.score >= 12).sort((a, b) => b.score - a.score).slice(0, 10);
    const th = m.assets.flatMap(a => C.thickness(a, D, CFG.integrity));
    const thD = new Set(th.filter(t => t.status === 'Danger').map(t => t.asset.id)).size, thA = new Set(th.filter(t => t.status === 'Alert').map(t => t.asset.id)).size;
    const scope = m.records.filter(r => C.isOpenAt(r, D) && /isolation|shutdown/i.test(r.window || ''));
    const body = `
      <div class="title"><h1>AHIM Monthly Report</h1><p>Asset Health &amp; Integrity Management · ${U.fmtMonth(month)}</p>
        <table class="meta"><tr><td>Site</td><td>${e(CFG.siteName)}</td><td>Status as of</td><td>${U.fmt(D)}</td></tr>
        <tr><td>Prepared by</td><td>${cm && !/draft/i.test(cm.author) ? e(cm.author) : 'RCM Specialist'}</td><td>Distribution</td><td>Engineering Manager, General Manager</td></tr></table></div>
      <h2>1. Summary</h2>
      ${cm ? `${/draft/i.test(cm.author) ? '<p class="warn">DRAFT commentary: review before issuing.</p>' : ''}<table class="cm"><tr><th>What changed</th><td>${e(cm.changed)}</td></tr><tr><th>Why</th><td>${e(cm.why)}</td></tr><tr><th>What we are doing</th><td>${e(cm.doing)}</td></tr></table>` : '<p class="warn">No commentary entered for this month.</p>'}
      <h2>2. Headline indicators</h2>
      <div class="hbs">${box(`${M.cur ?? '–'}<small>/100</small>`, 'Asset Health Index', `${dl == null ? '' : (dl < 0 ? '▼ ' : dl > 0 ? '▲ ' : '= ') + Math.abs(dl) + ' vs ' + U.mon(C.addMonths(month, -1))} · target ${M.T.ahi}<br>Data confidence ${M.conf.pct}% (critical ${M.conf.critPct}%)`)}
        ${box(`${M.ext.length}<small> / ${M.hi.length}</small>`, 'Extreme / High risks', 'Target 0 Extreme')}
        ${box(M.od.length, 'Overdue recommendations', `of ${M.openAll.length} open · ${M.withWo}% with a WO`)}
        ${box(M.critD, 'Critical assets in Danger', 'Target 0')}</div>
      <h2>3. Key performance indicators</h2>
      <table class="rt"><colgroup><col style="width:52%"><col style="width:16%"><col style="width:16%"><col style="width:16%"></colgroup><thead><tr><th>Indicator</th><th class="r">Value</th><th class="r">Target</th><th>Status</th></tr></thead><tbody>
      ${M.kpis.map(k => `<tr><td>${e(k[0])}</td><td class="r b">${e(k[1])}</td><td class="r">${e(k[2])}</td><td>${k[3] == null ? '–' : k[3] ? '<span class="ok">✓ Met</span>' : '<span class="nok">✗ Not met</span>'}</td></tr>`).join('')}</tbody></table>
      <div class="pb"></div>
      <h2>4. Asset Health Index trend</h2><div class="chart">${chart}</div><p class="rn">Line: AHI (unknown assets count as ${s.cond.Unknown}). Bars: assets in Danger.</p>
      <h2>5. ${e(esc.title)}</h2>
      ${esc.items.length ? `<ol class="dl">${esc.items.map(i => `<li><b>${e(i[0])}</b><br>${e(i[1])}<br><i>${e(i[2])}</i></li>`).join('')}</ol>` : '<p>Nothing requires escalation.</p>'}
      <h2>6. Highest risks</h2>
      ${top.length ? `<table class="rt"><colgroup><col style="width:28%"><col style="width:11%"><col style="width:11%"><col style="width:35%"><col style="width:15%"></colgroup><thead><tr><th>Asset</th><th class="r">C×L</th><th>Rating</th><th>Driver</th><th>Accept</th></tr></thead><tbody>
      ${top.map(r => `<tr><td><b>${e(r.a.tag)}</b> ${e(r.a.name)}</td><td class="r">${r.C}×${r.L}=${r.score}</td><td>${rating(r.rating)}</td><td>${e(r.driver ? (r.driver.finding || r.driver.param) : r.st.health === 3 ? 'Condition unknown' : '')}</td><td>${e(r.auth || '')}</td></tr>`).join('')}</tbody></table>` : '<p>No High or Extreme risks.</p>'}
      <h2>7. Integrity and compliance</h2>
      <ul class="bl"><li>Statutory: ${M.certs.length ? `${M.certs.length - M.soon.length - (M.certs.length - M.certs.filter(a => a.certExpiry > D).length)} in date beyond 60 days, ${M.soon.length} due within ${s.statWindow} days${M.soon.length ? ' (' + M.soon.map(a => e(a.tag) + ' ' + U.fmt(a.certExpiry)).join(', ') + ')' : ''}, ${M.certs.filter(a => a.certExpiry <= D).length} overdue.` : 'no statutory items recorded.'}</li>
        <li>Thickness monitoring: ${thD} assets below the minimum limit (Danger), ${thA} in the alert band.</li>
        <li>Isolation and shutdown scope: ${scope.length} open findings on ${new Set(scope.map(r => r.asset)).size} assets.</li></ul>
      ${signoff(['Prepared by: RCM Specialist', 'Reviewed by: Maintenance Superintendent', 'Approved by: Engineering Manager'])}
      <p class="rn">Definitions: AHI = criticality-weighted condition (OK ${s.cond.OK}, Alert ${s.cond.Alert}, Danger ${s.cond.Danger}, Unknown ${s.cond.Unknown}). Risk = consequence × likelihood on the site 5×5 matrix. Full definitions: AHIM KPI definitions.</p>`;
    exportBook = null;
    return sheet('port', hd, body);
  }

  /* ---------- 2. Risk register ---------- */
  function riskRegister(ctx, opt) {
    const { m, D, assets } = ctx;
    const R = assets.map(a => C.riskAt(m, a, D));
    const min = opt.medium ? 5 : 12;
    const rows = R.filter(r => r.score >= min).sort((a, b) => b.score - a.score || b.C - a.C);
    const cnt = n => R.filter(r => r.rating === n).length;
    let hm = '<table class="hm5"><tr><th>C \\ L</th>' + [1, 2, 3, 4, 5].map(l => `<th>${l}</th>`).join('') + '</tr>';
    [5, 4, 3, 2, 1].forEach(c => { hm += `<tr><th>${c}</th>` + [1, 2, 3, 4, 5].map(l => { const n = R.filter(r => r.C === c && r.L === l).length, sc = c * l; const rt = (m.risk.rating.find(x => sc >= x.min) || {}).name || 'Low'; return `<td class="h-${rt}">${n || ''}</td>`; }).join('') + '</tr>'; });
    hm += '</table>';
    const hd = header('AHIM Risk Register', ctx, `Area: ${ctx.area} · Ratings: ${opt.medium ? 'Medium and above' : 'High and Extreme'}`, `${rows.length} risks`);
    const line = r => { const d = r.driver; return [r.a.tag, r.a.name, r.a.area, r.a.service || '', r.C, r.L, r.score, r.rating, d ? (d.finding || d.param) : r.st.health === 3 ? 'Condition unknown: not inspected within interval' : '', r.resp, r.auth || '', r.a.resp || '', d ? (d.stage || 'Raised') + (d.wo ? ' / WO ' + d.wo : ' / no WO') : 'Inspect', d && d.due ? U.fmt(d.due) : '']; };
    const body = `<div class="rsum"><div><h2>Risk profile</h2><p>${m.risk.rating.map(x => `${rating(x.name)} ${cnt(x.name)}`).join(' &nbsp; ')}</p>
      <p class="rn">Consequence from the asset (worst credible of 7 categories, with service floors); likelihood from its condition and open findings. Response and acceptance authority per the site risk matrix.</p></div><div>${hm}</div></div>
      <table class="rt sm"><colgroup><col style="width:3%"><col style="width:14%"><col style="width:10%"><col style="width:3%"><col style="width:3%"><col style="width:7%"><col style="width:20%"><col style="width:13%"><col style="width:8%"><col style="width:6%"><col style="width:8%"><col style="width:5%"></colgroup><thead><tr><th>#</th><th>Asset</th><th>Area · service</th><th class="r">C</th><th class="r">L</th><th class="r">Risk</th><th>Driver</th><th>Required response</th><th>Accept</th><th>Owner</th><th>Action status</th><th>Due</th></tr></thead><tbody>
      ${rows.map((r, i) => { const x = line(r); return `<tr><td>${i + 1}</td><td><b>${e(x[0])}</b><br>${e(x[1])}</td><td>${e(x[2])}<br><span class="g">${e(x[3])}</span></td><td class="r">${x[4]}</td><td class="r">${x[5]}</td><td class="r"><b>${x[6]}</b><br>${rating(x[7])}</td><td>${e(x[8])}</td><td>${e(x[9])}</td><td>${e(x[10])}</td><td>${e(x[11])}</td><td>${e(x[12])}</td><td>${e(x[13])}</td></tr>`; }).join('') || '<tr><td colspan="12">No risks at this level.</td></tr>'}</tbody></table>
      ${signoff(['Prepared by: RCM Specialist', 'Reviewed by: Engineering Manager', 'Extreme risks reviewed by: General Manager'])}`;
    exportBook = { file: `AHIM_Risk_Register_${U.fmt(D).replace(/ /g, '')}.xlsx`, sheets: { 'Risk register': [['#', 'Asset', 'Description', 'Area', 'Service', 'Consequence', 'Likelihood', 'Score', 'Rating', 'Driver', 'Required response', 'Authority to accept', 'Owner', 'Action status', 'Due'], ...rows.map((r, i) => [i + 1, ...line(r)])] } };
    return sheet('land', hd, body);
  }

  /* ---------- 3. Weekly CM & planning pack ---------- */
  function weekly(ctx, opt) {
    const { m, assets } = ctx;
    const end = opt.weekEnd || ctx.D, start = end - 6 * C.DAY;
    const ids = new Set(assets.map(a => a.id)), recs = m.records.filter(r => ids.has(r.asset));
    const open = recs.filter(r => C.isOpenAt(r, end));
    const newF = recs.filter(r => r.isRec && r.date >= start && r.date <= end).sort((a, b) => b.sev - a.sev || b.score - a.score);
    const p1 = open.filter(r => r.prio === 'P1').sort((a, b) => a.due - b.due);
    const noWo = open.filter(r => !r.wo).sort((a, b) => b.score - a.score);
    const od = open.filter(r => r.due < end).sort((a, b) => a.due - b.due);
    const closed = recs.filter(r => r.isRec && r.closed != null && r.closed >= start && r.closed <= end);
    const LIM = 25;
    const row = (r, cols) => `<tr><td>${U.fmt(r.date)}</td><td><b>${e(r.a.tag)}</b><br>${e(r.a.name)}</td><td>${stat(r.status)}<br><span class="g">${e(r.tech)}</span></td><td>${e(r.finding || r.param)}<br><span class="g">${e(r.rec)}</span></td><td>${e(r.prio || '')}</td><td>${U.fmt(r.due)}${r.due < end ? ' <b>OVERDUE</b>' : ''}</td><td>${r.wo ? e(r.wo) : '<span class="box">☐ raise WO</span>'}</td>${cols || ''}</tr>`;
    const th = '<colgroup><col style="width:7%"><col style="width:15%"><col style="width:9%"><col style="width:46%"><col style="width:5%"><col style="width:9%"><col style="width:9%"></colgroup><thead><tr><th>Date</th><th>Asset</th><th>Status</th><th>Finding and recommendation</th><th>Prio</th><th>Due</th><th>WO</th></tr></thead>';
    const tbl = (list) => list.length ? `<table class="rt sm">${th}<tbody>${list.slice(0, LIM).map(r => row(r)).join('')}</tbody></table>${more(list.length, LIM)}` : '<p class="rn">None.</p>';
    const hd = header('AHIM Weekly CM & Planning Pack', ctx, `Area: ${ctx.area} · Week ${U.fmt(start)} to ${U.fmt(end)}`);
    const body = `<div class="wsum">${[['New findings this week', newF.length], ['P1 open', p1.length], ['Overdue', od.length], ['Open without a WO', noWo.length], ['Closed this week', closed.length]].map(x => `<div><b>${x[1]}</b><span>${x[0]}</span></div>`).join('')}</div>
      <h2>1. New Alert / Danger findings this week</h2>${tbl(newF)}
      <h2>2. P1 findings open</h2>${tbl(p1)}
      <h2>3. Open findings without a work order (highest priority first)</h2>${tbl(noWo)}
      <h2>4. Overdue findings (oldest first)</h2>${tbl(od)}
      <h2>5. Closed this week (check verification)</h2>${closed.length ? `<table class="rt sm"><colgroup><col style="width:9%"><col style="width:30%"><col style="width:39%"><col style="width:10%"><col style="width:12%"></colgroup><thead><tr><th>Closed</th><th>Asset</th><th>Finding</th><th>WO</th><th>Verified by</th></tr></thead><tbody>${closed.map(r => `<tr><td>${U.fmt(r.closed)}</td><td><b>${e(r.a.tag)}</b> ${e(r.a.name)}</td><td>${e(r.finding || r.param)}</td><td>${e(r.wo)}</td><td>${e(r.verifiedBy || '')}${r.verifiedBy ? '' : ' <b>not recorded</b>'}</td></tr>`).join('')}</tbody></table>` : '<p class="rn">None.</p>'}
      <h2>6. Actions agreed in the meeting</h2>
      <table class="rt blank"><thead><tr><th style="width:18%">Asset / item</th><th>Action</th><th style="width:16%">Owner</th><th style="width:12%">Due</th></tr></thead><tbody>${'<tr><td></td><td></td><td></td><td></td></tr>'.repeat(8)}</tbody></table>
      <p class="rn">Attendees: ______________________________________________ &nbsp; Next meeting: ____________</p>`;
    const flat = list => list.map(r => [U.fmt(r.date), r.a.tag, r.a.name, r.status, r.tech, r.finding || r.param, r.rec, r.prio || '', U.fmt(r.due), r.due < end ? 'Overdue' : '', r.wo || '', r.stage || '']);
    const H = ['Date', 'Asset', 'Description', 'Status', 'Technique', 'Finding', 'Recommendation', 'Priority', 'Due', 'Overdue', 'WO', 'Stage'];
    exportBook = { file: `AHIM_Weekly_Pack_${U.fmt(end).replace(/ /g, '')}.xlsx`, sheets: { 'New this week': [H, ...flat(newF)], 'P1 open': [H, ...flat(p1)], 'No WO': [H, ...flat(noWo)], 'Overdue': [H, ...flat(od)], 'Closed this week': [H, ...flat(closed)] } };
    return sheet('land', hd, body);
  }

  /* ---------- any dashboard page(s) as an A4 landscape pack ---------- */
  function pagePack(keys) {
    const st = AHIM.app.state, ctx = getCtx(st.area), names = Object.fromEntries(AHIM.app.PAGES.map(p => [p[0], p]));
    const conf = C.confidence(ctx.m, ctx.m.assets, ctx.D);
    return keys.map(k => { const p = names[k]; let body;
      try { body = AHIM.pages[k](ctx); } catch (er) { body = `<p class="warn">This page could not be drawn: ${e(er.message)}</p>`; }
      const hd = header(`AHIM · ${p[1]}`, ctx, `${p[2]} · Period ${U.fmtMonth(ctx.month)}${['risk', 'health', 'reliability', 'strategy', 'integrity', 'work', 'field'].includes(k) ? ' · Area: ' + ctx.area : ''}`, `Data confidence ${conf.pct}%`);
      return sheet('land dash', hd, body); }).join('');
  }
  function openPack(keys) {
    if (!keys.length) return;
    exportBook = null; $('repBody').innerHTML = pagePack(keys); pageCss();
    $('repXlsx').hidden = true; $('reportView').hidden = false; document.body.classList.add('rep-mode'); $('repDlg').close(); window.scrollTo(0, 0);
  }
  /* ---------- UI ---------- */
  const $ = id => document.getElementById(id);
  function pageCss() {
        const box = `@bottom-right{content:"Page " counter(page) " of " counter(pages);font:8pt Arial,sans-serif;color:#555}`;
    let st = $('repPageCss'); if (!st) { st = document.createElement('style'); st.id = 'repPageCss'; document.head.appendChild(st); }
    st.textContent = `@page{size:A4 portrait;margin:13mm 12mm 15mm;${box}}@page port{size:A4 portrait;margin:13mm 12mm 15mm;${box}}@page land{size:A4 landscape;margin:11mm 11mm 14mm;${box}}`;
  }
  function open(kind) {
    const area = $('repArea').value, ctx = getCtx(area);
    const opt = { medium: $('repMedium').checked, weekEnd: $('repWeek').value ? AHIM.data.toDate($('repWeek').value) : null };
    const html = kind === 'monthly' ? monthly(getCtx('All')) : kind === 'risk' ? riskRegister(ctx, opt) : weekly(ctx, opt);
    $('repBody').innerHTML = html; pageCss();
    $('repXlsx').hidden = !exportBook;
    $('reportView').hidden = false; document.body.classList.add('rep-mode'); $('repDlg').close(); window.scrollTo(0, 0);
  }
  function close() { $('reportView').hidden = true; document.body.classList.remove('rep-mode'); $('repBody').innerHTML = ''; }
  function download() {
    if (!exportBook) return;
    const wb = XLSX.utils.book_new();
    for (const [n, rows] of Object.entries(exportBook.sheets)) { const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = rows[0].map((_, i) => ({ wch: i === 5 || i === 6 || i === 9 ? 50 : 16 })); XLSX.utils.book_append_sheet(wb, ws, n.slice(0, 31)); }
    XLSX.writeFile(wb, exportBook.file);
  }
  function init(fn) {
    getCtx = fn;
    $('repBtn').onclick = () => {
      const ctx = getCtx('All');
      const areas = ['All', ...new Set(ctx.m.assets.map(a => a.area).filter(Boolean))];
      $('repArea').innerHTML = areas.map(a => `<option ${a === ctx.state.area ? 'selected' : ''}>${e(a)}</option>`).join('');
      const d = new Date(ctx.D); $('repWeek').value = d.toISOString().slice(0, 10);
      const pages = ctx.state.pages || AHIM.app.PAGES;
      $('repPages').innerHTML = pages.map(p => `<label><input type="checkbox" value="${p[0]}" ${p[0] === ctx.state.page ? 'checked' : ''}> ${e(p[1])}</label>`).join('');
      $('repDlg').showModal();
    };
    document.querySelectorAll('[data-report]').forEach(b => b.onclick = () => open(b.dataset.report));
    $('repPrintPage').onclick = () => openPack([AHIM.app.state.page]);
    $('repPrintSel').onclick = () => openPack([...document.querySelectorAll('#repPages input:checked')].map(i => i.value));
    $('repAll').onclick = () => document.querySelectorAll('#repPages input').forEach(i => { i.checked = true; });
    $('repCancel').onclick = () => $('repDlg').close();
    $('repPrint').onclick = () => window.print();
    $('repXlsx').onclick = download;
    $('repClose').onclick = close;
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('reportView').hidden) close(); });
  }
  AHIM.reports = { init, monthly, riskRegister, weekly, pagePack };
})();
