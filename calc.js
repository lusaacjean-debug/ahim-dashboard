/* AHIM calculation engine. All rules are documented in docs/kpi-definitions.md. */
(function () {
  const DAY = 864e5, SEV = { OK: 0, Alert: 1, Danger: 2 }, SL = ['OK', 'Alert', 'Danger'];

  function recordStatus(r) {
    if (r.insp in SEV) return r.insp;                                   // inspector status overrides
    if ([r.value, r.alert, r.danger].every(x => typeof x === 'number')) {
      if (r.dir === 'Lower is worse') return r.value <= r.danger ? 'Danger' : r.value <= r.alert ? 'Alert' : 'OK';
      return r.value >= r.danger ? 'Danger' : r.value >= r.alert ? 'Alert' : 'OK';
    }
    return 'Not set';
  }

  function prepare(m) {
    const s = m.settings; m.byId = {};
    m.assets.forEach(a => {
      const ok = a.f.every(x => typeof x === 'number' && x >= 1 && x <= 5);
      a.aci = ok ? Math.round(a.f.reduce((t, x, i) => t + x * s.weights[i], 0) / 5 * 100) : null;
      a.contrib = ok ? a.f.map((x, i) => x * s.weights[i] / 5 * 100) : [];
      a.cls = a.aci == null ? '–' : a.aci >= s.classMin.A ? 'A' : a.aci >= s.classMin.B ? 'B' : 'C';
      a.records = []; a.events = []; m.byId[a.id] = a;
    });
    m.records.forEach(r => {
      r.a = m.byId[r.asset] || null;
      r.status = recordStatus(r);
      r.sev = r.status in SEV ? SEV[r.status] : null;
      r.isRec = r.sev > 0 && r.stage !== 'No action';
      if (r.isRec) {
        const aci = r.a && r.a.aci != null ? r.a.aci : 50;
        r.score = Math.round(aci * (r.sev === 2 ? s.sev.Danger : s.sev.Alert));
        r.prio = (r.sev === 2 || r.score >= s.prio.P1.min) ? 'P1' : r.score >= s.prio.P2.min ? 'P2' : 'P3';
        r.due = r.date + s.prio[r.prio].days * DAY;
      }
      if (r.a) r.a.records.push(r);
    });
    m.unknownAssets = [...new Set(m.records.filter(r => !r.a).map(r => r.asset))];
    m.events.forEach(e => { const a = m.byId[e.asset]; if (a) a.events.push(e); });
    m.assets.forEach(a => { a.records.sort((x, y) => x.date - y.date); a.events.sort((x, y) => x.date - y.date); });
    const ds = m.records.map(r => r.date);
    m.minDate = Math.min(...ds); m.maxDate = Math.max(...ds);
    return m;
  }

  const closedBy = (r, D) => (r.closed != null && r.closed <= D) || (r.stage === 'Closed' && r.closed == null);
  const isOpenAt = (r, D) => r.isRec && r.date <= D && !closedBy(r, D);
  const isOverdueAt = (r, D) => isOpenAt(r, D) && r.due < D;

  /* Condition of one asset on day D: latest reading per technique+parameter, plus every open recommendation. */
  /* Required inspection interval for an asset, from its criticality class (Lists: "Inspection interval"). */
  const intervalOf = (a, s) => s.interval[a.cls] || s.interval.C || 90;

  /* health: 0 OK, 1 Alert, 2 Danger, 3 Unknown (never inspected, or last inspection older than the interval while OK).
     A known Alert/Danger stays Alert/Danger even when stale: the problem is still there until closed. */
  function assetAt(a, D, s) {
    const all = a.records.filter(r => r.date <= D);
    const last = all.length ? all[all.length - 1].date : null;
    const interval = s ? intervalOf(a, s) : 90;
    const stale = last == null || (D - last) > interval * DAY;
    const rs = all.filter(r => r.sev != null);
    if (!rs.length) return { overall: null, byTech: {}, open: [], last, stale: true, interval, health: 3 };
    const latest = {}; rs.forEach(r => { latest[r.tech + '|' + r.param] = r; });
    const byTech = {}; const bump = (t, v) => { if (byTech[t] == null || v > byTech[t]) byTech[t] = v; };
    Object.values(latest).forEach(r => bump(r.tech, r.isRec && closedBy(r, D) ? 0 : r.sev));
    const open = rs.filter(r => isOpenAt(r, D));
    open.forEach(r => bump(r.tech, r.sev));
    const overall = Math.max(...Object.values(byTech));
    return { overall, byTech, open, last, stale, interval, health: stale && overall === 0 ? 3 : overall };
  }

  /* Asset Health Index: every active asset counts. Unknown assets score the "Unknown" condition score,
     so missing inspections pull the index down instead of being ignored. */
  const active = assets => assets.filter(a => a.aci != null && !/out of service/i.test(a.state));
  function ahi(m, assets, D) {
    let n = 0, d = 0; const c = m.settings.cond;
    active(assets).forEach(a => { const h = assetAt(a, D, m.settings).health; n += a.aci * (h === 3 ? c.Unknown : c[SL[h]]); d += a.aci; });
    return d ? Math.round(n / d) : null;
  }
  /* Data confidence: share of assets (and of class A assets) inspected within their required interval. */
  function confidence(m, assets, D) {
    const act = active(assets), cur = act.filter(a => !assetAt(a, D, m.settings).stale);
    const crit = act.filter(a => a.cls === 'A'), critCur = crit.filter(a => !assetAt(a, D, m.settings).stale);
    const pct = (x, y) => y ? Math.round(x / y * 100) : null;
    return { n: act.length, current: cur.length, pct: pct(cur.length, act.length), crit: crit.length, critCurrent: critCur.length, critPct: pct(critCur.length, crit.length) };
  }

  function reliability(a, D, days = 365) {
    const f = a.events.filter(e => e.type === 'Failure' && e.date <= D && e.date > D - days * DAY);
    const down = f.reduce((t, e) => t + e.down, 0), hrs = days * 24, up = hrs - down;
    return { failures: f.length, down, mtbf: f.length ? up / f.length : null, mttr: f.length ? down / f.length : null, avail: up / hrs };
  }

  /* Thickness monitoring: corrosion rate and remaining life (API 570 / 653 method). */
  function thickness(a, D, cfg) {
    const g = {};
    a.records.filter(r => r.tech === 'Ultrasonic thickness' && r.value != null && r.date <= D).forEach(r => { (g[r.param] = g[r.param] || []).push(r); });
    return Object.entries(g).map(([param, rs]) => {
      const last = rs[rs.length - 1], prev = rs[rs.length - 2], first = rs[0];
      const tmin = last.dir === 'Lower is worse' ? last.danger : null;
      const yrs = (x, y) => (y.date - x.date) / (365.25 * DAY);
      const lt = rs.length > 1 && yrs(first, last) > 0 ? (first.value - last.value) / yrs(first, last) : null;
      const st = prev && yrs(prev, last) > 0 ? (prev.value - last.value) / yrs(prev, last) : null;
      const rate = Math.max(lt || 0, st || 0);
      let rl = null, status = 'OK';
      if (tmin != null) {
        if (last.value <= tmin) { rl = 0; status = 'Danger'; }
        else if (rate > 0) { rl = (last.value - tmin) / rate; status = rl <= cfg.dangerYears ? 'Danger' : rl <= cfg.alertYears ? 'Alert' : 'OK'; }
      }
      const baseline = rs.length === 1;
      if (baseline) status = SL[last.sev] || 'OK';   // single survey: no rate yet, status from the limits
      const interval = baseline ? (cfg.baselineRepeatYears || 1) : rl == null ? cfg.maxIntervalYears : Math.min(rl / 2, cfg.maxIntervalYears);
      const next = last.date + interval * 365.25 * DAY;
      return { asset: a, param, last, n: rs.length, tmin, lt, st, rate, rl: baseline ? null : rl, status, next, series: rs, baseline };
    });
  }

  /* ---- Risk (ISO 31000 5x5): consequence from the asset, likelihood from its condition on day D ---- */
  const consequenceOf = a => a.cons || (a.f && a.f.every(x => typeof x === 'number') ? Math.max(a.f[0], a.f[1]) : 3);
  function riskAt(m, a, D) {
    const st = assetAt(a, D, m.settings);
    let L = st.health === 3 ? 2 : st.health === 0 ? 1 : st.health === 1 ? 3 : 4;
    st.open.forEach(r => { if (r.lik && r.lik > L) L = r.lik; });
    const C = consequenceOf(a), score = C * L;
    const rating = (m.risk.rating.find(x => score >= x.min) || { name: 'Low', resp: '', auth: '' });
    const driver = [...st.open].sort((x, y) => (y.lik || 0) - (x.lik || 0) || y.sev - x.sev || y.score - x.score)[0] || null;
    return { a, C, L, score, rating: rating.name, resp: rating.resp, auth: rating.auth, driver, st };
  }
  /* ---- Strategy compliance (ISO 17359): required tasks from the library vs records within interval ---- */
  function strategyAt(m, a, D) {
    if (!a.strategy) return null;
    const cls = ['A', 'B', 'C'].includes(a.cls) ? a.cls : 'C';
    const req = m.strategy.filter(t => t.cls === a.strategy && t.tracked && t.iv[cls]);
    const tasks = req.map(t => {
      const last = [...a.records].reverse().find(r => r.tech === t.tech && r.date <= D);
      const ok = !!last && (D - last.date) <= t.iv[cls] * DAY;
      return { t, interval: t.iv[cls], last: last ? last.date : null, ok };
    });
    return { tasks, done: tasks.filter(x => x.ok).length, n: tasks.length };
  }
  const monthStart = t => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
  const monthEnd = t => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0); };
  const addMonths = (t, n) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1); };

  AHIM.calc = { riskAt, strategyAt, consequenceOf, prepare, recordStatus, assetAt, intervalOf, confidence, active, isOpenAt, isOverdueAt, closedBy, ahi, reliability, thickness, monthStart, monthEnd, addMonths, SEV, SL, HL: ['OK', 'Alert', 'Danger', 'Unknown'], DAY };
})();
