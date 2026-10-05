/* Page 1: Management dashboard (whole site, not filtered by area).
   Order: analyst commentary -> health with data confidence -> KPIs with data -> trend -> what needs management -> value and execution. */
(function () {
  const U = AHIM.ui, C = AHIM.calc;
  AHIM.pages = AHIM.pages || {};
  AHIM.pages.management = function (ctx) {
    const { m, D, month } = ctx, s = m.settings, T = s.targets, all = m.assets;
    const prevD = C.monthEnd(C.addMonths(month, -1));
    const cur = C.ahi(m, all, D), prev = C.ahi(m, all, prevD);
    const dl = cur != null && prev != null ? cur - prev : null;
    const ragA = U.rag(cur, T.ahi, true, 0.18);
    const conf = C.confidence(m, all, D);
    const st = all.map(a => ({ a, ...C.assetAt(a, D, s) }));
    const missing = [];

    // ---- 0. Analyst commentary
    const cm = m.commentary.find(c => c.month === month);
    const draft = cm && /draft/i.test(cm.author);
    const comm = `<div class="block s12 comment${cm ? '' : ' none'}">
      <div class="bh"><h3>Analyst commentary · ${U.fmtMonth(month)}</h3>${cm ? (draft ? '<p><b class="rag-w">Draft generated from the data: review and edit before presenting</b></p>' : `<p>${U.esc(cm.author)}</p>`) : ''}</div>
      ${cm ? `<div class="cgrid"><div><h4>What changed</h4><p>${U.esc(cm.changed)}</p></div><div><h4>Why</h4><p>${U.esc(cm.why)}</p></div><div><h4>What we are doing</h4><p>${U.esc(cm.doing)}</p></div></div>`
           : `<p class="empty">No commentary for ${U.fmtMonth(month)}. Add three short lines (what changed, why, what we are doing) in the <b>Commentary</b> sheet of the workbook.</p>`}</div>`;

    // ---- 1. Health with confidence
    const cRag = conf.pct == null ? '' : conf.pct >= 80 ? 'g' : conf.pct >= 60 ? 'w' : 'r';
    const unk = st.filter(x => x.health === 3).length;
    const hero = `<div class="block s4 hero"><div><h3>Asset Health Index</h3>
      <div class="big rag-${ragA}">${cur ?? '–'}<small> / 100</small></div>
      ${dl != null ? `<div class="delta ${dl < 0 ? 'rag-r' : 'rag-g'}">${dl < 0 ? '▼' : dl > 0 ? '▲' : '='} ${Math.abs(dl)} points vs ${U.mon(prevD)}</div>` : ''}</div>
      <div class="conf"><div class="conf-h"><span>Data confidence</span><b class="rag-${cRag}">${conf.pct ?? '–'}%</b></div>
        <div class="conf-bar"><i class="bg-${cRag}" style="width:${conf.pct || 0}%"></i></div>
        <p>${conf.current} of ${conf.n} assets inspected within their required interval; critical assets ${conf.critCurrent} of ${conf.crit} (${conf.critPct ?? '–'}%). ${unk} assets are <b>Unknown</b> and count as ${s.cond.Unknown} in the index.</p></div>
      <p class="small">Criticality-weighted condition: OK ${s.cond.OK}, Alert ${s.cond.Alert}, Danger ${s.cond.Danger}, Unknown ${s.cond.Unknown}. Target ${T.ahi}. Intervals: A ${s.interval.A} d, B ${s.interval.B} d, C ${s.interval.C} d.</p></div>`;

    // ---- 2. KPIs (only those with data)
    const critD = st.filter(x => x.a.cls === 'A' && x.overall === 2).length;
    const sch = m.schedule.filter(r => r.month === month);
    const pl = sch.reduce((t, r) => t + r.planned, 0), dn = sch.reduce((t, r) => t + r.done, 0), scp = U.pct(dn, pl);
    const closed12 = m.records.filter(r => r.isRec && r.closed != null && r.closed <= D && r.closed > D - 365 * C.DAY);
    const onT = U.pct(closed12.filter(r => r.closed <= r.due).length, closed12.length);
    const openAll = m.records.filter(r => C.isOpenAt(r, D)), od = openAll.filter(r => r.due < D);
    const withWo = U.pct(openAll.filter(r => r.wo).length, openAll.length);
    const certs = all.filter(a => a.certExpiry != null);
    const valid = certs.filter(a => a.certExpiry > D).length, soon = certs.filter(a => a.certExpiry > D && a.certExpiry - D <= s.statWindow * C.DAY).length;
    const y0 = Date.UTC(new Date(D).getUTCFullYear(), 0, 1);
    const vYtd = m.value.filter(v => v.date >= y0 && v.date <= D), net = vYtd.reduce((t, v) => t + v.avoided - v.planned, 0);
    const cYtd = m.cost.filter(c => c.month >= y0 && c.month <= D).reduce((t, c) => t + c.total, 0);
    const roi = cYtd ? net / cYtd : null;
    const fl = m.prestart.filter(p => p.month === month), psp = U.pct(fl.reduce((t, p) => t + p.done, 0), fl.reduce((t, p) => t + p.shifts, 0));
    const tiles = [
      [critD, 'Critical assets in Danger', 'Target 0', critD ? 'r' : 'g'],
      [conf.critPct + '%', 'Critical assets inspected within interval', 'Target ≥ ' + T.coverage + '%', U.rag(conf.critPct, T.coverage, true, 0.2)],
      [od.length, 'Overdue recommendations', 'of ' + openAll.length + ' open · target ≤ ' + T.overdue, U.rag(od.length, T.overdue, false)],
      [withWo + '%', 'Open recommendations with a work order', 'Target 100%', U.rag(withWo, 100, true, 0.2)],
    ];
    const RK = all.map(a => C.riskAt(m, a, D)), ext = RK.filter(r => r.rating === 'Extreme').length, hi = RK.filter(r => r.rating === 'High').length;
    tiles.splice(1, 0, [ext + ' / ' + hi, 'Extreme / High risks (5×5 matrix)', 'Target: 0 Extreme', ext ? 'r' : hi ? 'w' : 'g']);
    if (m.strategy.length) { const SA = all.filter(a => a.cls === 'A').map(a => C.strategyAt(m, a, D)).filter(x => x && x.n); const sn = SA.reduce((t, x) => t + x.n, 0), sd = SA.reduce((t, x) => t + x.done, 0);
      if (sn) tiles.push([U.pct(sd, sn) + '%', 'Strategy compliance, critical assets', 'Target ≥ 90%', U.rag(U.pct(sd, sn), 90, true, 0.3)]); }
    if (onT != null) tiles.push([onT + '%', 'Recommendations closed on time (12 months)', 'Target ≥ ' + T.onTime + '%', U.rag(onT, T.onTime, true, 0.18)]);
    if (scp != null) tiles.push([scp + '%', 'Inspection schedule compliance', 'Target ≥ ' + T.schedule + '%', U.rag(scp, T.schedule)]); else missing.push('inspection schedule');
    if (certs.length) tiles.push([valid + '/' + certs.length, 'Statutory inspections in date', soon ? soon + ' due within ' + s.statWindow + ' days' : 'Target 100%', valid < certs.length ? 'r' : soon ? 'w' : 'g']); else missing.push('statutory certificates');
    if (roi != null) tiles.push([roi.toFixed(1) + ' : 1', 'CM return on investment (YTD)', 'Target ≥ ' + T.roi + ' : 1', U.rag(roi, T.roi, true, 0.5)]); else missing.push('CM value and programme cost');
    if (psp != null) tiles.push([psp + '%', 'Fleet prestart compliance', 'Target ≥ ' + T.prestart + '%', U.rag(psp, T.prestart)]); else if (all.some(a => a.area === AHIM.config.fleetArea)) missing.push('fleet prestarts');
    if (m.kpiTree && m.kpiTree.length) {   // line of sight: strategic KPIs from the KPI tree
      const V = AHIM.kpis.compute(ctx), F = (id, v, k) => v == null ? '–' : id === 'downtime_cost' ? U.money(v) : id === 'cm_roi' ? v + ' : 1' : /%/.test(k) ? v + '%' : v;
      const strat = m.kpiTree.filter(k => k.tier === 'Strategic' && k.id !== 'ahi');
      tiles.length = 0; missing.length = 0;
      strat.forEach(k => { const v = V[k.id]; if (v == null) { missing.push(k.kpi.toLowerCase()); return; }
        tiles.push([F(k.id, v, k.kpi), k.kpi, 'Target ' + (/lower/i.test(k.dir) ? '≤ ' : '≥ ') + F(k.id, k.target, k.kpi) + ' · ' + k.owner, AHIM.kpis.rag(k, v)]); });
      tiles.push([critD, 'Critical assets in Danger', 'Target 0', critD ? 'r' : 'g']);
      const fw = V.findings_wo; if (fw != null) tiles.push([fw + '%', 'Open findings with a work order', 'Target 100%', U.rag(fw, 100, true, 0.2)]);
    }
    const kp = U.block('s8', 'Key performance indicators', U.fmtMonth(month) + ' against target',
      `<div class="mk-grid">${tiles.map(t => `<div class="mk ${t[3]}"><div class="v">${t[0]}</div><div class="l">${U.esc(t[1])}</div><div class="tg">${U.esc(t[2])}</div></div>`).join('')}</div>`);

    // ---- 3. Trend
    const pts = [], bars = [];
    for (let i = 11; i >= 0; i--) {
      const ms = C.addMonths(month, -i), me = i === 0 ? D : C.monthEnd(ms);
      if (me < C.monthStart(m.minDate)) continue;
      const mid = ms + 14 * C.DAY;
      pts.push({ t: mid, v: C.ahi(m, all, me) });
      bars.push({ t: mid, v: all.filter(a => C.assetAt(a, me, s).overall === 2).length });
    }
    const trend = U.block('s7', 'Asset Health Index trend', 'Line: AHI (Unknown assets included). Bars: assets in Danger',
      `<div class="chart">${AHIM.charts.time({ points: pts, bars, xMin: C.addMonths(month, -11), xMax: C.monthEnd(month), yMin: 0, yMax: 100, target: T.ahi, lastStatus: ragA === 'g' ? 0 : ragA === 'w' ? 1 : 2, labelEnds: true, label: 'Asset Health Index trend' })}</div>`);

    // ---- 4. Needs management attention: logged decisions, else automatic escalations
    const decs = m.decisions.filter(d => !/closed|rejected/i.test(d.status));
    let att;
    if (decs.length) {
      att = U.block('s5', 'Decisions required', 'Raised for management',
        `<ol class="dec">${decs.map(d => `<li><b>${U.esc(d.title)}</b>${U.esc(d.reason)}<div class="who">Owner: ${U.esc(d.owner)} · raised ${U.fmt(d.date)} · <span class="${d.status === 'Open' ? 'rag-r' : 'rag-g'}">${U.esc(d.status)}</span></div></li>`).join('')}</ol>`);
    } else {
      const esc = [];
      const p1late = od.filter(r => r.prio === 'P1' && D - r.due > 7 * C.DAY).sort((a, b) => a.due - b.due);
      if (p1late.length) esc.push([`${p1late.length} P1 finding${p1late.length > 1 ? 's' : ''} overdue by more than 7 days`, 'Oldest: ' + p1late.slice(0, 3).map(r => `${r.a.tag} (${r.a.name}), due ${U.fmt(r.due)}`).join('; '), 'Approve priority for these repairs']);
      const dNoWo = st.filter(x => x.a.cls === 'A' && x.overall === 2 && !x.open.some(r => r.sev === 2 && r.wo));
      if (dNoWo.length) esc.push([`${dNoWo.length} critical asset${dNoWo.length > 1 ? 's' : ''} in Danger without a work order`, dNoWo.slice(0, 4).map(x => `${x.a.tag} ${x.a.name}`).join('; '), 'Instruct planning to raise and schedule WOs']);
      if (conf.critPct != null && conf.critPct < T.coverage) esc.push([`Only ${conf.critPct}% of critical assets inspected within interval`, `${conf.crit - conf.critCurrent} critical assets have no current inspection: their condition is unknown.`, 'Agree route resources and access with Production']);
      if (od.length > T.overdue * 5) esc.push([`Backlog: ${od.length} recommendations overdue`, `${U.pct(od.filter(r => D - r.date > 90 * C.DAY).length, od.length)}% are older than 90 days.`, 'Support a backlog clean-up: close fixed items, re-plan the rest']);
      certs.filter(a => a.certExpiry > D && a.certExpiry - D <= 30 * C.DAY).forEach(a => esc.push([`Statutory inspection due: ${a.tag}`, `${a.name}: due ${U.fmt(a.certExpiry)}`, 'Book the statutory inspection']));
      att = U.block('s5', 'Needs management attention', 'Automatic escalations: no decisions logged for this month',
        esc.length ? `<ol class="dec">${esc.map(e => `<li><b>${U.esc(e[0])}</b>${U.esc(e[1])}<div class="who">Ask: ${U.esc(e[2])}</div></li>`).join('')}</ol>` : U.empty('Nothing requires escalation.'));
    }

    // ---- 5. Value and execution (only with data)
    const extra = [];
    if (vYtd.length || cYtd) {
      const top = [...vYtd].sort((a, b) => (b.avoided - b.planned) - (a.avoided - a.planned)).slice(0, 5);
      extra.push(['Condition monitoring value', new Date(D).getUTCFullYear() + ' year to date',
        `<div class="vrow">${U.kpi(U.money(net), 'Net cost avoided (' + vYtd.length + ' early detections)', 'good')}${U.kpi(U.money(cYtd), 'CM programme cost')}${U.kpi(roi == null ? '–' : roi.toFixed(1) + ' : 1', 'Return on investment', roi >= T.roi ? 'good' : 'bad')}</div>
        ${top.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Asset</th><th>Detection</th><th class="r">Net avoided</th></tr></thead><tbody>${top.map(v => { const a = m.byId[v.asset]; return `<tr data-asset="${U.esc(v.asset)}"><td><b>${U.esc(a ? a.tag : v.asset)}</b><div class="small">${U.esc(v.tech)}, ${U.fmt(v.date)}</div></td><td>${U.esc(v.desc)}</td><td class="r b">${U.money(v.avoided - v.planned)}</td></tr>`; }).join('')}</tbody></table></div>` : ''}`]);
    }
    if (sch.length) {
      const techs = m.techs.filter(t => sch.some(r => r.tech === t));
      extra.push(['Inspection schedule compliance', U.fmtMonth(month) + ': completed vs planned',
        techs.map(t => { const r = sch.find(x => x.tech === t), p = U.pct(r.done, r.planned); return U.hbar(t, p, 100, p >= T.schedule ? 'var(--ok)' : p >= T.schedule * 0.9 ? 'var(--alert)' : 'var(--danger)', `${r.done}/${r.planned}`); }).join('') + `<div class="method">Overall ${dn} of ${pl} planned inspections completed (${scp}%).</div>`]);
    }
    const sizes = extra.length === 2 ? ['s7', 's5'] : ['s12'];
    const extraHtml = extra.map((e, i) => U.block(sizes[i], e[0], e[1], e[2])).join('');
    const foot = missing.length ? `<div class="s12 nottracked">Not yet tracked: ${missing.map(U.esc).join(', ')}. Fill the related workbook sheets to activate these indicators.</div>` : '';

    return `<div class="grid">${comm}${hero}${kp}${trend}${att}${extraHtml}${foot}</div>`;
  };
})();
