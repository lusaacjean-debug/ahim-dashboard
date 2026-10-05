/* KPI engine: one calculation per KPI id, used by the KPI tree, the pages and the reports. */
(function () {
  const C = AHIM.calc, U = AHIM.ui;
  const DONE = w => w.status === 'Complete', LIVE = w => w.status !== 'Cancelled';
  const openAt = (w, D) => LIVE(w) && w.raised != null && w.raised <= D && !(w.fin != null && w.fin <= D) && !(DONE(w) && w.fin == null);
  function work(m, month, D) {
    const me = C.monthEnd(month), inM = t => t != null && t >= month && t <= me;
    const pm = m.wo.filter(w => LIVE(w) && w.type === 'Preventive' && inM(w.req));
    const pmOk = pm.filter(w => DONE(w) && w.fin != null && w.fin <= w.req + C.DAY);
    const sc = m.wo.filter(w => LIVE(w) && inM(w.sched) && w.sched <= D);
    const scOk = sc.filter(w => w.fin != null && w.fin <= w.sched + 7 * C.DAY);
    const lab = m.labour.filter(l => l.month === month), sum = k => lab.reduce((t, l) => t + l[k], 0);
    const weekly = sum('avail') / 4.33;
    const open = m.wo.filter(w => openAt(w, D)), ready = open.filter(w => w.ready);
    return { pm, pmOk, sc, scOk, lab, weekly, open, ready, sum,
      pmPct: U.pct(pmOk.length, pm.length), scPct: U.pct(scOk.length, sc.length),
      plannedPct: U.pct(sum('planned'), sum('worked')), emergPct: U.pct(sum('emerg'), sum('worked')), otPct: U.pct(sum('ot'), sum('avail')),
      backlogW: weekly ? open.reduce((t, w) => t + w.planH, 0) / weekly : null, readyW: weekly ? ready.reduce((t, w) => t + w.planH, 0) / weekly : null };
  }
  function prod(m, month) {
    const P = m.production.filter(p => p.month === month), pl = P.reduce((t, p) => t + p.planned, 0);
    return { P, avail: pl ? (pl - P.reduce((t, p) => t + p.mDown, 0)) / pl * 100 : null, lost: P.reduce((t, p) => t + p.lost, 0), mDown: P.reduce((t, p) => t + p.mDown, 0) };
  }
  function cost(m, month, D) {
    const y0 = Date.UTC(new Date(month).getUTCFullYear(), 0, 1);
    const ytd = m.costs.filter(c => c.month >= y0 && c.month <= month);
    const last12 = m.costs.filter(c => c.month > C.addMonths(month, -12) && c.month <= month);
    const rav = m.assets.reduce((t, a) => t + (a.value || 0), 0);
    const a = ytd.reduce((t, c) => t + c.actual, 0), b = ytd.reduce((t, c) => t + c.budget, 0), a12 = last12.reduce((t, c) => t + c.actual, 0);
    const months12 = new Set(last12.map(c => c.month)).size;
    return { ytd, a, b, rav, a12, months12, pctBudget: b ? a / b * 100 : null, pctRav: rav && months12 ? (a12 / months12 * 12) / rav * 100 : null };
  }
  function badActors(m, D) { return m.assets.filter(a => C.reliability(a, D).failures >= 2); }
  function compute(ctx) {
    const { m, D, month } = ctx, s = m.settings, all = m.assets, V = {};
    const RK = all.map(a => C.riskAt(m, a, D));
    V.extreme_risks = RK.filter(r => r.rating === 'Extreme').length;
    const certs = all.filter(a => a.certExpiry != null); V.statutory = certs.length ? U.pct(certs.filter(a => a.certExpiry > D).length, certs.length) : null;
    const openR = m.records.filter(r => C.isOpenAt(r, D));
    V.p1_overdue = openR.filter(r => r.prio === 'P1' && r.due < D).length;
    const P = prod(m, month); V.availability = P.avail == null ? null : Math.round(P.avail * 10) / 10; V.downtime_cost = P.P.length ? P.lost : null;
    V.ahi = C.ahi(m, all, D);
    const ba = badActors(m, D); V.bad_actor_rca = ba.length ? U.pct(ba.filter(a => m.rca.some(r => r.asset === a.id)).length, ba.length) : null;
    if (m.wo.length) { const W = work(m, month, D); V.pm_compliance = W.pmPct; V.schedule_compliance = W.scPct; V.backlog_weeks = W.backlogW == null ? null : Math.round(W.backlogW * 10) / 10;
      if (W.lab.length) { V.planned_work = W.plannedPct; V.reactive_work = W.emergPct; } }
    V.findings_wo = openR.length ? U.pct(openR.filter(r => r.wo).length, openR.length) : null;
    const K = cost(m, month, D); if (K.ytd.length) { V.cost_budget = Math.round(K.pctBudget); if (K.pctRav != null) V.cost_rav = Math.round(K.pctRav * 10) / 10; }
    const y0 = Date.UTC(new Date(D).getUTCFullYear(), 0, 1);
    const net = m.value.filter(v => v.date >= y0 && v.date <= D).reduce((t, v) => t + v.avoided - v.planned, 0), cy = m.cost.filter(c => c.month >= y0 && c.month <= D).reduce((t, c) => t + c.total, 0);
    V.cm_roi = cy ? Math.round(net / cy * 10) / 10 : null;
    const conf = C.confidence(m, all, D); V.data_confidence = conf.pct;
    const SA = all.filter(a => a.cls === 'A').map(a => C.strategyAt(m, a, D)).filter(x => x && x.n);
    const sn = SA.reduce((t, x) => t + x.n, 0); V.strategy_compliance = sn ? U.pct(SA.reduce((t, x) => t + x.done, 0), sn) : null;
    V.actions_overdue = m.actions.length ? m.actions.filter(a => !/done|cancel/i.test(a.status) && a.due != null && a.due < D).length : null;
    return V;
  }
  function rag(k, v) {
    if (v == null || k.target == null) return '';
    const hi = !/lower/i.test(k.dir);
    if (hi) return v >= k.target ? 'g' : v >= k.target * 0.9 ? 'w' : 'r';
    return v <= k.target ? 'g' : v <= (k.target === 0 ? 2 : k.target * 1.25) ? 'w' : 'r';
  }
  AHIM.kpis = { compute, rag, work, prod, cost, badActors, openAt };
})();
