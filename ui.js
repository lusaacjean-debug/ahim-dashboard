/* Small shared helpers for rendering. */
(function () {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const d = t => new Date(t);
  const fmt = t => t == null ? '–' : d(t).getUTCDate() + ' ' + MON[d(t).getUTCMonth()] + ' ' + String(d(t).getUTCFullYear()).slice(2);
  const fmtMonth = t => MON[d(t).getUTCMonth()] + ' ' + d(t).getUTCFullYear();
  const mon = t => MON[d(t).getUTCMonth()];
  const pct = (a, b) => b ? Math.round(a / b * 100) : null;
  const money = n => { const a = Math.abs(n); return (n < 0 ? '-' : '') + '$' + (a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? Math.round(a / 1e3) + 'k' : Math.round(a)); };
  const SL = ['OK', 'Alert', 'Danger'], GL = ['●', '▲', '■'];
  const pill = (s, title) => s == null ? '<span class="pill p-none">No data</span>' : s === 3 ? `<span class="pill p-Unknown" title="${esc(title || 'No inspection within the required interval')}">Unknown</span>` : `<span class="pill p-${SL[s]}"${title ? ` title="${esc(title)}"` : ''}>${SL[s]}</span>`;
  const cell = (s, title) => s === undefined ? '<span class="cell c-na" title="Not applicable">–</span>'
    : s === null ? `<span class="cell c-none" title="${esc(title)}: no data">?</span>`
    : `<span class="cell c-${SL[s]}" title="${esc(title)}: ${SL[s]}">${GL[s]}</span>`;
  const crit = c => `<span class="crit k-${c === '–' ? 'n' : c}" title="Criticality class">${c}</span>`;
  const prio = p => p ? `<span class="prio pr-${p}">${p}</span>` : '';
  const sevTag = (s, label) => `<span class="cell c-${SL[s]} wide">${GL[s]} ${esc(label)}</span>`;
  const empty = msg => `<p class="empty">${esc(msg)}</p>`;
  const block = (cls, title, sub, body, n) => `<div class="block ${cls}"><div class="bh"><h3>${n ? `<span class="n">${n}</span>` : ''}${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${body}</div>`;
  const kpi = (v, l, cls = '', t = '') => `<div class="kpi ${cls}"><div class="v">${v}</div><div class="l">${esc(l)}</div>${t ? `<div class="tg">${esc(t)}</div>` : ''}</div>`;
  const rag = (v, target, higherIsBetter = true, warnBand = 0.1) => {
    if (v == null) return '';
    if (higherIsBetter) return v >= target ? 'g' : v >= target * (1 - warnBand) ? 'w' : 'r';
    return v <= target ? 'g' : v <= target * 2 + 1 ? 'w' : 'r';
  };
  const hbar = (label, value, max, color, right) => `<div class="hb"><span title="${esc(label)}">${esc(label)}</span><div class="t"><i style="width:${max ? value / max * 100 : 0}%;background:${color}"></i></div><span class="n">${right != null ? right : value}</span></div>`;
  AHIM.ui = { esc, fmt, fmtMonth, mon, pct, money, pill, cell, crit, prio, sevTag, empty, block, kpi, rag, hbar, SL, GL };
})();
