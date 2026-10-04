/* Page 2: Plant health - asset status (with Unknown), criticality, top 10 priority. */
(function () {
  const U = AHIM.ui, C = AHIM.calc;
  AHIM.pages.health = function (ctx) {
    const { m, D, assets } = ctx, s = m.settings;
    const st = assets.map(a => ({ a, ...C.assetAt(a, D, s) }));
    const c = [0, 0, 0, 0]; st.forEach(x => c[x.health]++);
    const n = st.length || 1, conf = C.confidence(m, assets, D);
    const tiles = `<div class="tiles t5">
      <div class="tile t-OK"><div class="v">${c[0]}</div><div class="l">OK</div></div>
      <div class="tile t-Alert"><div class="v">${c[1]}</div><div class="l">Alert</div></div>
      <div class="tile t-Danger"><div class="v">${c[2]}</div><div class="l">Danger</div></div>
      <div class="tile t-Unknown"><div class="v">${c[3]}</div><div class="l">Unknown: not inspected within interval</div></div>
      <div class="tile t-H"><div class="v">${conf.pct ?? '–'}%</div><div class="l">Data confidence (inspected within interval)</div></div></div>
      <div class="stack"><i style="width:${c[0] / n * 100}%;background:var(--ok)"></i><i style="width:${c[1] / n * 100}%;background:var(--alert)"></i><i style="width:${c[2] / n * 100}%;background:var(--danger)"></i><i style="width:${c[3] / n * 100}%;background:var(--unk)"></i></div>`;
    const techs = m.techs.filter(t => assets.some(a => a.techs.includes(t)));
    const ORD = [0, 2, 3, 1];  // sort: Danger, Alert, Unknown, OK
    const rows = [...st].sort((x, y) => ORD[y.health] - ORD[x.health] || (y.a.aci || 0) - (x.a.aci || 0));
    const lastCell = x => x.last == null ? '<span class="late">Never</span>' : `<span class="${x.stale ? 'late' : ''}" title="Required every ${x.interval} days">${U.fmt(x.last)}</span>`;
    const matrix = `<div class="scroll tall"><table class="matrix"><thead><tr><th class="l">Asset</th><th class="l">Description</th><th>Crit.</th>${techs.map(t => `<th class="rot"><span>${U.esc(t)}</span></th>`).join('')}<th>Last inspected</th><th>Status</th></tr></thead><tbody>
      ${rows.map(x => `<tr data-asset="${U.esc(x.a.id)}" tabindex="0"><td class="l b">${U.esc(x.a.tag || x.a.id)}</td><td class="l">${U.esc(x.a.name)}</td><td>${U.crit(x.a.cls)}</td>
        ${techs.map(t => `<td>${x.a.techs.includes(t) ? U.cell(x.byTech[t] ?? null, t) : U.cell(undefined)}</td>`).join('')}<td>${lastCell(x)}</td><td>${U.pill(x.health, x.health === 3 ? (x.last ? 'Last inspected ' + U.fmt(x.last) + ', required every ' + x.interval + ' days' : 'Never inspected') : '')}</td></tr>`).join('') || `<tr><td colspan="${techs.length + 5}" class="l small">No assets in this area.</td></tr>`}
      </tbody></table></div>
      <div class="legend"><span>${U.pill(0)} within limits</span><span>${U.pill(1)} plan corrective action</span><span>${U.pill(2)} act now</span><span>${U.pill(3)} no inspection within interval (A ${s.interval.A} d, B ${s.interval.B} d, C ${s.interval.C} d): condition not known</span><span>${U.cell(null, '')} technique applicable, never recorded</span></div>`;

    const CR = [['A', 'Critical'], ['B', 'Essential'], ['C', 'General']];
    let rm = `<div></div><div class="h">OK</div><div class="h">Alert</div><div class="h">Danger</div><div class="h">Unknown</div>`;
    CR.forEach(([k, l], ri) => {
      rm += `<div class="r">${U.crit(k)}${l}</div>`;
      [0, 1, 2, 3].forEach(h => { const cnt = st.filter(x => x.a.cls === k && x.health === h).length; rm += `<div class="x ${h === 3 ? 'rkU' : 'rk' + ((2 - ri) + h)}">${cnt}<small>${cnt === 1 ? 'asset' : 'assets'}</small></div>`; });
    });
    const hot = st.filter(x => x.a.cls === 'A' && (x.health === 1 || x.health === 2));
    const unkA = st.filter(x => x.a.cls === 'A' && x.health === 3).length;
    const cnt = k => assets.filter(a => a.cls === k).length;
    const critBlock = U.block('s5', 'Asset criticality', 'Criticality class against current condition',
      `<div class="rm rm4">${rm}</div><div class="critnote">Asset base: ${cnt('A')} critical, ${cnt('B')} essential, ${cnt('C')} general.${unkA ? ` <b class="rag-w">${unkA} critical assets have no current inspection.</b>` : ''}${hot.length ? ` <b>${hot.length} critical assets are in Alert or Danger:</b><ul>${hot.sort((a, b) => b.health - a.health).slice(0, 12).map(x => `<li>${U.esc(x.a.tag)} ${U.esc(x.a.name)}: ${U.SL[x.health]}</li>`).join('')}${hot.length > 12 ? `<li>… and ${hot.length - 12} more</li>` : ''}</ul>` : ''}</div>`, 2);

    const open = st.flatMap(x => x.open).sort((a, b) => b.score - a.score || a.date - b.date).slice(0, 10);
    const top = U.block('s7', 'Top 10 priority', 'Open recommendations ranked by priority score = ACI × severity, then age',
      open.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>#</th><th>Asset</th><th>Finding and action</th><th>Score</th><th>Due</th><th>Status</th></tr></thead><tbody>
      ${open.map((r, i) => { const od = r.due < D; return `<tr data-asset="${U.esc(r.asset)}" tabindex="0"><td class="rank">${i + 1}</td>
        <td><b>${U.esc(r.a.tag)}</b><div class="small">${U.esc(r.a.name)}</div>${U.sevTag(r.sev, r.tech)}</td>
        <td>${U.esc(r.finding || r.param)}<div class="small">${U.esc(r.rec)}</div></td>
        <td><span class="score">${r.score}</span><br>${U.prio(r.prio)}</td>
        <td class="${od ? 'late' : ''}">${U.fmt(r.due)}${od ? `<div class="small late">Overdue ${Math.round((D - r.due) / C.DAY)} d</div>` : ''}</td>
        <td>${U.esc(r.stage || 'Raised')}${r.wo ? `<div class="small">WO ${U.esc(r.wo)}</div>` : '<div class="small late">No WO</div>'}</td></tr>`; }).join('')}</tbody></table></div>` : U.empty('No open recommendations in this area.'), 3);

    return `<div class="grid">${U.block('s12', 'Asset status', 'Worst condition across all techniques; Unknown when not inspected within the required interval. Click an asset to open its history.', tiles + matrix, 1)}${critBlock}${top}</div>`;
  };
})();
