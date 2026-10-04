/* Dependency-free SVG charts. */
(function () {
  const { mon } = AHIM.ui, C = AHIM.calc;
  const VAR = s => ['var(--ok)', 'var(--alert)', 'var(--danger)'][s];

  /* Time series with Alert/Danger bands. o = {points:[{t,v}], xMin, xMax, alert, danger, low, target, bars:[{t,v}], lastStatus, yMin, yMax, unit} */
  function time(o) {
    const W = 680, H = o.h || 250, L = 46, R = 16, T = 16, B = 30;
    const vs = o.points.map(p => p.v).concat([o.alert, o.danger, o.target].filter(x => x != null));
    let lo = o.yMin != null ? o.yMin : Math.min(...vs), hi = o.yMax != null ? o.yMax : Math.max(...vs);
    if (o.yMin == null || o.yMax == null) { const pad = (hi - lo) * 0.12 || 1; if (o.yMin == null) lo -= pad; if (o.yMax == null) hi += pad; }
    if (!o.low && o.yMin == null && lo < 0 && Math.min(...vs) >= 0) lo = 0;
    const x = t => L + (t - o.xMin) / (o.xMax - o.xMin || 1) * (W - L - R);
    const y = v => T + (hi - v) / (hi - lo || 1) * (H - T - B);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label || 'trend'}">`;
    if (o.alert != null && o.danger != null) {
      const band = (a, b, c) => `<rect x="${L}" y="${Math.min(y(a), y(b))}" width="${W - L - R}" height="${Math.abs(y(a) - y(b))}" fill="${c}" opacity=".55"/>`;
      if (!o.low) s += band(lo, o.alert, 'var(--okbg)') + band(o.alert, o.danger, 'var(--alertbg)') + band(o.danger, hi, 'var(--dangerbg)');
      else s += band(hi, o.alert, 'var(--okbg)') + band(o.alert, o.danger, 'var(--alertbg)') + band(o.danger, lo, 'var(--dangerbg)');
      [[o.alert, 'Alert', 'var(--alert)'], [o.danger, 'Danger', 'var(--danger)']].forEach(([v, l, c]) => {
        s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${c}" stroke-dasharray="5 4"/><text x="${W - R - 4}" y="${y(v) - 4}" text-anchor="end" font-size="11" fill="${c}" font-weight="600">${l} ${v}</text>`;
      });
    }
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; s += `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${Math.abs(hi - lo) < 20 ? v.toFixed(1) : Math.round(v)}</text>`; if (!o.alert) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--rule)"/>`; }
    for (let t = C.monthStart(o.xMin) === o.xMin ? o.xMin : C.addMonths(o.xMin, 1); t <= o.xMax; t = C.addMonths(t, 1)) {
      const mid = Math.min(t + 14.5 * C.DAY, o.xMax);
      s += `<line x1="${x(t)}" x2="${x(t)}" y1="${H - B}" y2="${H - B + 4}" stroke="var(--muted)"/><text x="${o.monthly ? x(t) : x(mid)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="var(--muted)">${mon(t)}</text>`;
    }
    if (o.bars) {
      const bmax = Math.max(4, ...o.bars.map(b => b.v)), bw = 22;
      o.bars.forEach(b => { const h = b.v / bmax * (H - T - B) * 0.32; s += `<rect x="${x(b.t) - bw / 2}" y="${H - B - h}" width="${bw}" height="${h}" fill="var(--dangerbg)" stroke="var(--danger)" stroke-width=".8"/>${b.v ? `<text x="${x(b.t)}" y="${H - B - h - 4}" text-anchor="middle" font-size="11" fill="var(--danger)" font-weight="600">${b.v}</text>` : ''}`; });
    }
    if (o.target != null) s += `<line x1="${L}" x2="${W - R}" y1="${y(o.target)}" y2="${y(o.target)}" stroke="var(--ok)" stroke-dasharray="5 4"/><text x="${W - R - 4}" y="${y(o.target) - 5}" text-anchor="end" font-size="11" fill="var(--ok)" font-weight="600">Target ${o.target}</text>`;
    const pts = o.points.filter(p => p.v != null && p.t >= o.xMin && p.t <= o.xMax);
    if (pts.length) {
      s += `<polyline points="${pts.map(p => x(p.t) + ',' + y(p.v)).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2.2"/>`;
      pts.forEach((p, i) => {
        const last = i === pts.length - 1;
        s += `<circle cx="${x(p.t)}" cy="${y(p.v)}" r="${last ? 6 : 3.5}" fill="${last && o.lastStatus != null ? VAR(o.lastStatus) : 'var(--panel)'}" stroke="var(--ink)" stroke-width="1.5"><title>${p.label || ''}${p.v}</title></circle>`;
        if (o.labelEnds && (last || i === 0)) s += `<text x="${x(p.t)}" y="${y(p.v) - 11}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--ink)">${p.v}</text>`;
      });
    }
    return s + '</svg>';
  }
  AHIM.charts = { time };
})();
