/* Page 3: Reliability - ACI, open records, bad actors, machine history. */
(function () {
  const U = AHIM.ui, C = AHIM.calc;
  const FC = ['var(--f1)', 'var(--f2)', 'var(--f3)', 'var(--f4)', 'var(--f5)'];
  AHIM.pages.reliability = function (ctx) {
    const { m, D, assets, state } = ctx, s = m.settings;

    // 1. ACI
    const rankedAll = assets.filter(a => a.aci != null).sort((a, b) => b.aci - a.aci), LIM = 40;
    const ranked = state.aciAll ? rankedAll : rankedAll.slice(0, LIM);
    const aci = U.block('s12', 'Asset criticality index', `Weighted score 0–100; dashed lines mark class limits (${s.classMin.B} and ${s.classMin.A})`,
      ranked.map(a => `<div class="aci-row" data-asset="${U.esc(a.id)}"><div class="nm" title="${U.esc(a.tag + ' ' + a.name)}"><b>${U.esc(a.tag)}</b>${U.esc(a.name)}</div>
        <div class="aci-track"><div class="aci-fill" style="width:${a.aci}%">${a.contrib.map((c, i) => `<i style="width:${c / a.aci * 100}%;background:${FC[i]}" title="${U.esc(s.factorNames[i])}: ${a.f[i]}/5"></i>`).join('')}</div>
        <span class="aci-line" style="left:${s.classMin.B}%"></span><span class="aci-line" style="left:${s.classMin.A}%"></span></div>
        <div class="aci-val">${a.aci}</div>${U.crit(a.cls)}</div>`).join('') +
      (rankedAll.length > LIM ? `<button class="linkbtn" id="aciToggle" type="button">${state.aciAll ? 'Show top ' + LIM + ' only' : 'Show all ' + rankedAll.length + ' assets'}</button>` : '') +
      `<div class="legend">${s.factorNames.map((f, i) => `<span><i class="sw" style="background:${FC[i]}"></i>${U.esc(f)} (${Math.round(s.weights[i] * 100)}%)</span>`).join('')}</div>`, 1);

    // 2. Open records
    const ids = new Set(assets.map(a => a.id));
    const open = m.records.filter(r => ids.has(r.asset) && C.isOpenAt(r, D));
    const od = open.filter(r => r.due < D);
    const closed12 = m.records.filter(r => ids.has(r.asset) && r.isRec && r.closed != null && r.closed <= D && r.closed > D - 365 * C.DAY);
    const onT = U.pct(closed12.filter(r => r.closed <= r.due).length, closed12.length);
    const closedM = closed12.filter(r => r.closed >= ctx.month).length;
    const STG = ['Raised', 'WO raised', 'Scheduled', 'Awaiting verification'];
    const stageOf = r => STG.includes(r.stage) ? r.stage : 'Raised';
    const BK = [['0–30 days', 0, 30, 'var(--f3)'], ['31–60 days', 31, 60, 'var(--alert)'], ['61–90 days', 61, 90, 'var(--alert)'], ['Over 90 days', 91, 1e9, 'var(--danger)']];
    const age = r => Math.round((D - r.date) / C.DAY);
    const bk = BK.map(b => [b, open.filter(r => age(r) >= b[1] && age(r) <= b[2]).length]), bmax = Math.max(1, ...bk.map(x => x[1]));
    const bt = m.techs.map(t => ({ t, n: open.filter(r => r.tech === t).length, o: od.filter(r => r.tech === t).length })).filter(x => x.n).sort((a, b) => b.n - a.n), tmax = Math.max(1, ...bt.map(x => x.n));
    const recs = U.block('s12', 'Open record status', 'Recommendations raised and their progress to closure',
      `<div class="kpis">${U.kpi(open.length, 'Open recommendations')}${U.kpi(od.length, 'Overdue', od.length > s.targets.overdue ? 'bad' : 'good')}${U.kpi(closedM, 'Closed in ' + U.mon(ctx.month))}${U.kpi(onT == null ? '–' : onT + '%', 'Closed on time, last 12 months (target ' + s.targets.onTime + '%)', onT >= s.targets.onTime ? 'good' : 'bad')}</div>
      <h4 class="sub">Open records by stage</h4><div class="stages">${STG.map(g => { const x = open.filter(r => stageOf(r) === g), o = x.filter(r => r.due < D).length; return `<div class="stage"><div class="v">${x.length}</div><div class="l">${g}</div><div class="o">${o ? o + ' overdue' : '&nbsp;'}</div></div>`; }).join('')}</div>
      <div class="two"><div><h4 class="sub">Age of open records</h4>${bk.map(([b, n]) => U.hbar(b[0], n, bmax, b[3])).join('')}</div>
      <div><h4 class="sub">Open records by technique</h4>${bt.map(x => `<div class="hb"><span>${U.esc(x.t)}</span><div class="t" style="display:flex"><i style="width:${x.o / tmax * 100}%;background:var(--danger)"></i><i style="width:${(x.n - x.o) / tmax * 100}%;background:var(--f3)"></i></div><span class="n">${x.n}</span></div>`).join('') || U.empty('None open.')}
      <div class="legend"><span><i class="sw" style="background:var(--danger)"></i>Overdue</span><span><i class="sw" style="background:var(--f3)"></i>Within response time</span></div></div></div>`, 2);

    // 3. Bad actors
    const ba = assets.map(a => ({ a, r: C.reliability(a, D) })).filter(x => x.r.failures >= 2).sort((x, y) => y.r.failures - x.r.failures || y.r.down - x.r.down);
    const bad = U.block('s12', 'Bad actors', 'Two or more failures in the last 12 months: candidates for root cause analysis',
      ba.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Asset</th><th>Crit.</th><th class="r">Failures</th><th class="r">Downtime</th><th class="r">MTBF</th><th>Failure modes</th><th>RCA</th></tr></thead><tbody>
      ${ba.map(x => { const ev = x.a.events.filter(e => e.type === 'Failure' && e.date <= D && e.date > D - 365 * C.DAY); const rca = [...new Set(ev.map(e => e.rca).filter(Boolean))];
        return `<tr data-asset="${U.esc(x.a.id)}" tabindex="0"><td><b>${U.esc(x.a.tag)}</b><div class="small">${U.esc(x.a.name)}</div></td><td>${U.crit(x.a.cls)}</td><td class="r b">${x.r.failures}</td><td class="r">${x.r.down} h</td><td class="r">${Math.round(x.r.mtbf).toLocaleString('en-GB')} h</td>
        <td>${ev.map(e => `<div>${U.fmt(e.date)}: ${U.esc(e.desc)}</div>`).join('')}</td><td>${rca.length ? rca.map(U.esc).join('<br>') : '<span class="late">No RCA</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : U.empty('No asset with two or more failures in the last 12 months.'), 3);

    // 3b. Maintenance performance (SMRP) and failure-mode Pareto (ISO 14224)
    const wsM = m.woSummary.filter(w => w.month <= ctx.month);
    const lastM = wsM.length ? Math.max(...wsM.map(w => w.month)) : null;
    let smrp = U.empty('No Pronto work-order summary for this period (WO_Summary sheet).');
    if (lastM != null) {
      const W = wsM.filter(w => w.month === lastM), tot = W.reduce((t, w) => t + w.total, 0);
      const g = re => W.filter(w => re.test(w.type)), sum = (a, k) => a.reduce((t, w) => t + w[k], 0);
      const pm = g(/prevent/i), bd = g(/breakdown|emergency/i), cor = g(/corrective/i);
      const pmc = U.pct(sum(pm, 'done'), sum(pm, 'total')), react = U.pct(sum(bd, 'total'), tot), corr = U.pct(sum(cor, 'total'), tot), comp = U.pct(sum(W, 'done'), tot);
      const wmax = Math.max(1, ...W.map(w => w.total));
      smrp = `<div class="kpis">${U.kpi((pmc ?? '–') + '%', 'PM work orders completed (target ≥ 90%)', pmc >= 90 ? 'good' : 'bad')}${U.kpi((react ?? '–') + '%', 'Reactive (breakdown) work (target < 10%)', react < 10 ? 'good' : 'bad')}${U.kpi((corr ?? '–') + '%', 'Corrective share of all work orders')}${U.kpi((comp ?? '–') + '%', 'All work orders completed, ' + U.fmtMonth(lastM))}</div>
        ${W.sort((a, b) => b.total - a.total).map(w => `<div class="hb" style="grid-template-columns:190px 1fr 90px"><span>${U.esc(w.type)}</span><div class="t" style="display:flex"><i style="width:${w.done / wmax * 100}%;background:var(--ok)"></i><i style="width:${w.wip / wmax * 100}%;background:var(--alert)"></i><i style="width:${w.notStarted / wmax * 100}%;background:var(--f4)"></i></div><span class="n">${w.done}/${w.total}</span></div>`).join('')}
        <div class="legend"><span><i class="sw" style="background:var(--ok)"></i>Complete</span><span><i class="sw" style="background:var(--alert)"></i>In progress</span><span><i class="sw" style="background:var(--f4)"></i>Not started</span></div>
        <div class="method">SMRP Best Practice Metrics. Reactive work counts Breakdown work orders only: corrective work raised from condition monitoring is planned work. The split is only as good as the Pronto work-type coding: emergency jobs coded as corrective will hide reactive work.</div>`;
    }
    const FMN = { AIR: 'Abnormal instrument reading', BRD: 'Breakdown', ELP: 'External leakage, process', ELU: 'External leakage, utility', ERO: 'Erratic output', FTS: 'Fail to start', HIO: 'High output', INL: 'Internal leakage', LOO: 'Low output', NOI: 'Noise', OHE: 'Overheating', PDE: 'Parameter deviation', PLU: 'Plugged / choked', SER: 'Minor in-service problem', STD: 'Structural deficiency', UST: 'Spurious stop', VIB: 'Vibration', OTH: 'Other', UNK: 'Unknown' };
    const f12 = m.records.filter(r => ids.has(r.asset) && r.sev > 0 && r.fm && r.date <= D && r.date > D - 365 * C.DAY);
    const fc = {}; f12.forEach(r => { fc[r.fm] = (fc[r.fm] || 0) + 1; });
    const fl = Object.entries(fc).sort((a, b) => b[1] - a[1]), fmax = Math.max(1, ...fl.map(x => x[1]));
    const pareto = fl.length ? fl.map(([k, n]) => U.hbar(k + ' · ' + (FMN[k] || k), n, fmax, k === 'OTH' ? 'var(--f4)' : 'var(--f2)')).join('') + `<div class="method">${f12.length} Alert/Danger findings in 12 months, coded to ISO 14224. ${fc.OTH ? `"Other" = ${Math.round(fc.OTH / f12.length * 100)}%: use specific failure modes in the CM workbook to make this Pareto useful for RCA.` : ''}</div>` : U.empty('No coded findings.');
    const perf = U.block('s7', 'Maintenance performance (SMRP)', 'From the Pronto work-order export', smrp) + U.block('s5', 'Failure modes (ISO 14224), last 12 months', 'Pareto of Alert / Danger findings: start RCA from the top', pareto);

    // 4. Machine history
    if (!assets.find(a => a.id === state.asset)) state.asset = (assets.find(a => a.records.length) || assets[0] || {}).id;
    const a = m.byId[state.asset];
    let hist = U.empty('No assets in this area.');
    if (a) {
      const st = C.assetAt(a, D, s), rl = C.reliability(a, D);
      const params = [...new Set(a.records.filter(r => r.value != null && r.date <= D).map(r => r.tech + ' · ' + r.param))];
      if (!params.includes(state.param)) {
        const lastRec = [...a.records].reverse().find(r => r.value != null && r.date <= D && r.sev > 0) || [...a.records].reverse().find(r => r.value != null && r.date <= D);
        state.param = lastRec ? lastRec.tech + ' · ' + lastRec.param : params[0];
      }
      const series = a.records.filter(r => r.value != null && r.date <= D && r.tech + ' · ' + r.param === state.param);
      const last = series[series.length - 1];
      const chart = last ? AHIM.charts.time({ points: series.map(r => ({ t: r.date, v: r.value, label: U.fmt(r.date) + ': ' })), xMin: C.addMonths(ctx.month, -11), xMax: C.monthEnd(ctx.month), alert: last.alert, danger: last.danger, low: last.dir === 'Lower is worse', lastStatus: last.sev, label: state.param }) : U.empty('No measured values for this asset.');
      const tl = [...a.events.filter(e => e.date <= D).map(e => ({ t: e.date, ty: e.type, x: e.desc + (e.down ? ` (${e.down} h down)` : '') + (e.rca ? ` · ${e.rca}` : '') })),
        ...a.records.filter(r => r.date <= D && (r.isRec || (r.sev > 0 && r.finding))).map(r => ({ t: r.date, ty: r.sev === 2 ? 'Danger' : 'Alert', x: `${r.tech}: ${r.finding || r.param}${r.value != null ? ` (${r.value} ${r.unit})` : ''}${r.closed && r.closed <= D ? ` · closed ${U.fmt(r.closed)}` : ''}` }))].sort((x, y) => y.t - x.t);
      const optsA = [...assets].sort((x, y) => x.tag.localeCompare(y.tag)).map(x => `<option value="${U.esc(x.id)}" ${x.id === a.id ? 'selected' : ''}>${U.esc(x.tag)}: ${U.esc(x.name)}</option>`).join('');
      hist = `<div class="hist-top"><select id="assetSel" aria-label="Asset">${optsA}</select>
        ${params.length ? `<select id="paramSel" aria-label="Parameter">${params.map(p => `<option ${p === state.param ? 'selected' : ''}>${U.esc(p)}</option>`).join('')}</select>` : ''}
        <span>${U.pill(st.health)} ${U.crit(a.cls)} <span class="small">ACI ${a.aci ?? '–'} · ${U.esc(a.area)} · ${U.esc(a.assetClass)} · last inspected <span class="${st.stale ? 'late' : ''}">${st.last ? U.fmt(st.last) : 'never'}</span> (every ${st.interval} d)</span>${rl.failures >= 2 ? ' <span class="badge">Bad actor</span>' : ''}</span></div>
        <div class="kpis">${U.kpi(rl.failures, 'Failures, 12 months', rl.failures >= 2 ? 'bad' : '')}${U.kpi(rl.mtbf ? Math.round(rl.mtbf).toLocaleString('en-GB') + ' h' : 'No failures', 'MTBF')}${U.kpi(rl.mttr ? rl.mttr.toFixed(1) + ' h' : '–', 'MTTR')}${U.kpi((rl.avail * 100).toFixed(2) + '%', 'Availability (' + rl.down + ' h downtime)')}</div>
        <div class="hist-grid"><div class="chart"><h4 class="sub">${U.esc(state.param || 'Trend')}${last ? ` (${U.esc(last.unit)})` : ''}</h4>${chart}</div>
        <div><h4 class="sub">Event log</h4><ul class="tl">${tl.map(e => `<li><span class="d">${U.fmt(e.t)}</span><span><span class="ty ty-${e.ty}">${e.ty}</span>${U.esc(e.x)}</span></li>`).join('') || '<li class="small">No events.</li>'}</ul>
        <h4 class="sub" style="margin-top:14px">Open recommendations</h4>${st.open.length ? st.open.map(r => `<div class="ofr">${U.sevTag(r.sev, r.tech)} ${U.esc(r.finding || r.param)} ${U.prio(r.prio)} <span class="${r.due < D ? 'late' : 'small'}">due ${U.fmt(r.due)}</span></div>`).join('') : '<div class="small">None.</div>'}</div></div>`;
    }
    const histB = U.block('s12', 'Machine history', 'Last 12 months to ' + U.fmt(D), hist, 4);
    return `<div class="grid">${aci}${recs}${perf}${bad}<div id="history" class="s12" style="grid-column:span 12">${histB}</div></div>`;
  };
})();
