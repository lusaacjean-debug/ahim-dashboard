/* Risk page (ISO 31000): 5x5 heat map, risk register, risk by area. Consequence from the asset (Asset_Register),
   likelihood from its condition and open findings (Risk_Likelihood sheet explains the mapping). */
(function () {
  const U = AHIM.ui, C = AHIM.calc;
  const RCLS = n => 'rt-' + String(n || 'Low').replace(/\s/g, '');
  AHIM.pages.risk = function (ctx) {
    const { m, D, assets } = ctx;
    const R = assets.map(a => C.riskAt(m, a, D));
    const by = n => R.filter(r => r.rating === n).length;
    const names = m.risk.rating.map(r => r.name);
    const kp = `<div class="kpis">${names.map(n => U.kpi(by(n), n + ' risk', n === 'Extreme' && by(n) ? 'bad' : n === 'High' && by(n) ? 'warn' : '')).join('')}</div>`;
    // heat map
    const cname = l => (m.risk.cons.find(c => c.level === l) || {}).name || l, lname = l => (m.risk.lik.find(c => c.level === l) || {}).name || l;
    const ratingOf = sc => (m.risk.rating.find(x => sc >= x.min) || { name: 'Low' }).name;
    let hm = `<div class="hm"><div class="hm-y">Consequence</div><div class="hm-grid"><div></div>${[1, 2, 3, 4, 5].map(l => `<div class="hm-h">${l}<small>${U.esc(lname(l))}</small></div>`).join('')}`;
    [5, 4, 3, 2, 1].forEach(c => {
      hm += `<div class="hm-r">${c}<small>${U.esc(cname(c))}</small></div>`;
      [1, 2, 3, 4, 5].forEach(l => { const n = R.filter(r => r.C === c && r.L === l).length; hm += `<div class="hm-c ${RCLS(ratingOf(c * l))}" title="C${c} x L${l} = ${c * l}">${n || ''}<small>${c * l}</small></div>`; });
    });
    hm += `</div><div class="hm-x">Likelihood</div></div>`;
    const heat = U.block('s5', 'Risk heat map', 'Assets by consequence × likelihood (count; small figure = risk score)', hm, 1);
    // by area
    const areas = [...new Set(assets.map(a => a.area))].sort();
    const amax = Math.max(1, ...areas.map(ar => R.filter(r => r.a.area === ar && ['Extreme', 'High'].includes(r.rating)).length));
    const byArea = U.block('s7', 'High and extreme risks by area', 'Where management attention is needed',
      areas.map(ar => { const e = R.filter(r => r.a.area === ar && r.rating === 'Extreme').length, h = R.filter(r => r.a.area === ar && r.rating === 'High').length;
        return `<div class="hb"><span>${U.esc(ar)}</span><div class="t" style="display:flex"><i style="width:${e / amax * 100}%;background:var(--danger)"></i><i style="width:${h / amax * 100}%;background:var(--alert)"></i></div><span class="n">${e} / ${h}</span></div>`; }).join('') +
      `<div class="legend"><span><i class="sw" style="background:var(--danger)"></i>Extreme</span><span><i class="sw" style="background:var(--alert)"></i>High</span></div>`, 2);
    // register
    const top = R.filter(r => r.score >= 5).sort((x, y) => y.score - x.score || y.C - x.C || (y.driver ? y.driver.score : 0) - (x.driver ? x.driver.score : 0)).slice(0, 40);
    const reg = U.block('s12', 'Risk register', `Top ${top.length} assets with Medium risk or above, highest first. Response and acceptance authority per Risk_Rating; hover C for the consequence basis; owner = Responsible in the register`,
      top.length ? `<div class="scroll tall"><table class="tbl"><thead><tr><th>Asset</th><th>Service</th><th class="r">C</th><th class="r">L</th><th>Risk</th><th>Driver</th><th>Required response and acceptance</th><th>Owner</th><th>Action status</th></tr></thead><tbody>
      ${top.map(r => { const d = r.driver; return `<tr data-asset="${U.esc(r.a.id)}" tabindex="0"><td><b>${U.esc(r.a.tag)}</b><div class="small">${U.esc(r.a.name)}</div></td><td class="small">${U.esc(r.a.service || '–')}</td>
        <td class="r b" title="${U.esc(r.a.consBasis || '')}">${r.C}</td><td class="r b">${r.L}</td><td><span class="rt ${RCLS(r.rating)}">${r.score} ${U.esc(r.rating)}</span></td>
        <td>${d ? `${U.esc(d.finding || d.param)}<div class="small">${U.esc(d.tech)}${d.fm ? ' · ' + U.esc(d.fm) : ''}${d.dm ? ' · ' + U.esc(d.dm) : ''}</div>` : r.st.health === 3 ? '<span class="small">Condition unknown: not inspected within interval</span>' : `<span class="small">Latest reading: ${U.SL[r.st.overall] || '–'}</span>`}</td>
        <td class="small">${U.esc(r.resp)}${r.auth ? `<div><b>Accept: ${U.esc(r.auth)}</b></div>` : ''}</td><td class="small">${U.esc(r.a.resp || '–')}</td>
        <td>${d ? `${U.esc(d.stage || 'Raised')}${d.wo ? `<div class="small">WO ${U.esc(d.wo)}</div>` : '<div class="small late">No WO</div>'}${d.due < D ? '<div class="small late">Overdue</div>' : ''}` : '<span class="small">Inspect</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : U.empty('No asset at Medium risk or above.'), 3);
    // definitions
    const defs = `<details class="defs"><summary>Risk matrix definitions (edit in the workbook: Risk_Consequence, Risk_Likelihood, Risk_Rating)</summary>
      <div class="scroll"><table class="tbl"><thead><tr><th>C</th><th>Safety</th><th>Health and radiation</th><th>Environment</th><th>Production</th><th>Financial</th><th>Regulatory and legal</th><th>Community and reputation</th></tr></thead><tbody>
      ${m.risk.cons.map(c => `<tr><td class="b">${c.level} ${U.esc(c.name)}</td><td>${U.esc(c.safety)}</td><td>${U.esc(c.health)}</td><td>${U.esc(c.env)}</td><td>${U.esc(c.prod)}</td><td>${U.esc(c.fin)}</td><td>${U.esc(c.reg)}</td><td>${U.esc(c.comm || '')}</td></tr>`).join('')}</tbody></table></div>
      <div class="scroll"><table class="tbl"><thead><tr><th>L</th><th>Description</th><th>Frequency guide</th><th>How AHIM sets it</th></tr></thead><tbody>${m.risk.lik.map(l => `<tr><td class="b">${l.level} ${U.esc(l.name)}</td><td>${U.esc(l.desc)}</td><td>${U.esc(l.freq || '')}</td><td>${U.esc(l.map)}</td></tr>`).join('')}</tbody></table></div>
      <div class="scroll"><table class="tbl"><thead><tr><th>Rating</th><th>Score</th><th>Response</th><th>Authority to accept</th></tr></thead><tbody>${m.risk.rating.map(r => `<tr><td><span class="rt ${RCLS(r.name)}">${U.esc(r.name)}</span></td><td>≥ ${r.min}</td><td>${U.esc(r.resp)}</td><td>${U.esc(r.auth || '')}</td></tr>`).join('')}</tbody></table></div></details>`;
    return `<div class="grid">${U.block('s12', 'Plant risk profile', 'Consequence (asset) × likelihood (condition) on ' + U.fmt(D) + ', per the site 5×5 risk matrix', kp + defs)}${heat}${byArea}${reg}</div>`;
  };
})();
