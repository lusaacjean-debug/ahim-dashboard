/* Reads the AHIM workbook (SheetJS) into a plain data model.
   Only INPUT columns are read: every calculated value is recomputed by calc.js,
   so the dashboard never depends on Excel formula results. */
(function () {
  const C = AHIM.config, DAY = 864e5;

  function toDate(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return Math.round(Date.UTC(1899, 11, 30) + v * DAY);
    if (v instanceof Date) return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate());
    const p = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (p) return Date.UTC(+p[1], +p[2] - 1, +p[3]);
    const d = new Date(v); return isNaN(d) ? null : Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
  const str = v => (v == null ? '' : String(v).trim());

  function grid(wb, name) {
    const ws = wb.Sheets[name];
    if (!ws) return null;
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  }
  function table(wb, name, keyHeader) {
    const g = grid(wb, name);
    if (!g) return { rows: [], missing: true };
    const hdr = (g[C.headerRow - 1] || []).map(str);
    const idx = {}; hdr.forEach((h, i) => { if (h) idx[h] = i; });
    const k = idx[keyHeader];
    const rows = g.slice(C.headerRow).filter(r => k != null && str(r[k]) !== '')
      .map(r => { const o = {}; for (const h in idx) o[h] = r[idx[h]]; return o; });
    return { rows, headers: hdr };
  }

  function parseLists(wb) {
    const g = grid(wb, C.sheets.lists) || [];
    const lists = {};
    const head = g[0] || [];
    head.forEach((h, c) => {
      if (!str(h) || c > 10) return;
      const items = []; for (let r = 1; r < g.length && str(g[r][c]) !== ''; r++) items.push(str(g[r][c]));
      lists[str(h)] = items;
    });
    const tab = (label, n) => {
      for (let r = 0; r < g.length; r++) if (str(g[r][11]) === label) return g.slice(r + 1, r + 1 + n).map(x => [str(x[11]), num(x[12]), num(x[13])]);
      return null;
    };
    const s = {
      weights: [0.30, 0.30, 0.15, 0.15, 0.10],
      prio: { P1: { min: 70, days: 7 }, P2: { min: 45, days: 30 }, P3: { min: 0, days: 60 } },
      sev: { Danger: 1, Alert: 0.6 }, classMin: { A: 70, B: 45 }, statWindow: 60,
      cond: { OK: 100, Alert: 60, Danger: 20, Unknown: 50 },
      interval: { A: 30, B: 60, C: 90 },
      targets: { ahi: 85, schedule: 95, onTime: 85, overdue: 2, roi: 4, coverage: 90, prestart: 95 },
      factorNames: ['Safety & environment', 'Production impact', 'Redundancy', 'Repair cost / MTTR', 'Failure history']
    };
    const w = tab('ACI factor', 5); if (w) { s.weights = w.map(x => x[1]); s.factorNames = w.map(x => x[0]); }
    const p = tab('Priority', 3); if (p) p.forEach(x => { s.prio[x[0]] = { min: x[1], days: x[2] }; });
    const sv = tab('Severity', 2); if (sv) sv.forEach(x => { s.sev[x[0]] = x[1]; });
    const cl = tab('Criticality class', 3); if (cl) cl.forEach(x => { s.classMin[x[0]] = x[1]; });
    const st = tab('Statutory rule', 1); if (st) s.statWindow = st[0][1];
    const cd = tab('Condition score (for AHI)', 4); if (cd) cd.forEach(x => { if (x[0] in s.cond && x[1] != null) s.cond[x[0]] = x[1]; });
    const iv = tab('Inspection interval', 3); if (iv) iv.forEach(x => { if (x[1] != null) s.interval[x[0]] = x[1]; });
    const tg = tab('KPI target', 7);
    if (tg) { const k = ['ahi', 'schedule', 'onTime', 'overdue', 'roi', 'coverage', 'prestart']; tg.forEach((x, i) => { if (x[1] != null) s.targets[k[i]] = x[1]; }); }
    return { lists, settings: s };
  }

  function parse(wb) {
    const S = C.sheets, warn = [];
    const { lists, settings } = parseLists(wb);
    const techs = lists['Techniques'] || [];
    const reg = table(wb, S.register, 'Pronto asset no.');
    if (reg.missing) throw new Error('Sheet "' + S.register + '" not found in the workbook.');
    const assets = reg.rows.map(r => ({
      id: str(r['Pronto asset no.']), tag: str(r['Site tag']), name: str(r['Description']), area: str(r['Area']),
      system: str(r['System / location']), assetClass: str(r['Asset class']), mode: str(r['Operating mode']), state: str(r['Asset state']),
      f: ['Safety & env. (1-5)', 'Production (1-5)', 'Redundancy (1-5)', 'Repair cost / MTTR (1-5)', 'Failure history (1-5)'].map(h => num(r[h])),
      techs: techs.filter(t => str(r[t]).toUpperCase() === 'Y'),
      statReq: str(r['Statutory cert. required']).toUpperCase() === 'Y', certExpiry: toDate(r['Certificate expiry']),
      resp: str(r['Responsible']), strategy: str(r['Strategy class']), cons: num(r['Consequence (1-5)']), service: str(r['Service']),
      bottleneck: str(r['Bottleneck (Y/N)']).toUpperCase() === 'Y', value: num(r['Replacement value (USD)']), consBasis: str(r['Consequence basis']), installYear: num(r['Install year']), life: num(r['Design life (years)'])
    })).filter(a => a.state !== 'Decommissioned');
    const rec = table(wb, S.records, 'Pronto asset no.');
    const records = rec.rows.map((r, i) => ({
      id: 'R' + String(i + 1).padStart(5, '0'), date: toDate(r['Date']), asset: str(r['Pronto asset no.']),
      source: str(r['Source (input)']), tech: str(r['Technique']), param: str(r['Component / parameter / checklist item']) || '(unspecified)',
      value: num(r['Value']), unit: str(r['Unit']), alert: num(r['Alert limit']), danger: num(r['Danger limit']),
      dir: str(r['Limit direction']), insp: str(r['Inspector status']), finding: str(r['Finding']), rec: str(r['Recommendation']),
      wo: str(r['Pronto WO no.']), stage: str(r['Record stage']), inspector: str(r['Inspector']),
      closed: toDate(r['Date closed']), verifiedBy: str(r['Verified by']), remarks: str(r['Remarks']),
      fm: str(r['Failure mode (ISO 14224)']), mech: str(r['Failure mechanism (ISO 14224)']), dm: str(r['Damage mechanism (API 571)']), window: str(r['Execution window']), lik: num(r['Likelihood override (1-5)'])
    })).filter(r => { if (r.date == null) { warn.push('Record without date ignored (asset ' + r.asset + ')'); return false; } return true; });
    const ev = table(wb, S.events, 'Pronto asset no.');
    const events = ev.rows.map(r => ({ date: toDate(r['Date']), asset: str(r['Pronto asset no.']), type: str(r['Event type']), desc: str(r['Description']), down: num(r['Downtime (h)']) || 0, wo: str(r['Pronto WO no.']), rca: str(r['RCA reference']) })).filter(e => e.date != null);
    const sc = table(wb, S.schedule, 'Technique');
    const schedule = sc.rows.map(r => ({ month: toDate(r['Month']), tech: str(r['Technique']), planned: num(r['Planned']) || 0, done: num(r['Completed']) || 0 }));
    const va = table(wb, S.value, 'Pronto asset no.');
    const value = va.rows.map(r => ({ date: toDate(r['Date']), asset: str(r['Pronto asset no.']), tech: str(r['Technique']), desc: str(r['Detection / failure avoided']), avoided: num(r['Avoided failure cost (USD)']) || 0, planned: num(r['Planned repair cost (USD)']) || 0, approvedBy: str(r['Approved by']) }));
    const co = table(wb, S.cost, 'Month');
    const cost = co.rows.map(r => { let t = 0; for (const h in r) if (h !== 'Month') t += num(r[h]) || 0; return { month: toDate(r['Month']), total: t }; });
    const de = table(wb, S.decisions, 'Decision required');
    const decisions = de.rows.map(r => ({ date: toDate(r['Date raised']), title: str(r['Decision required']), reason: str(r['Reason']), owner: str(r['Owner']), status: str(r['Status']) || 'Open' }));
    const pr = table(wb, S.prestart, 'Pronto asset no.');
    const prestart = pr.rows.map(r => ({ month: toDate(r['Month']), asset: str(r['Pronto asset no.']), shifts: num(r['Shifts operated']) || 0, done: num(r['Prestarts completed']) || 0 }));
    const sl = table(wb, 'Strategy_Library', 'Strategy class');
    const strategy = sl.rows.map(r => ({ cls: str(r['Strategy class']), fm: str(r['Failure mode (ISO 14224)']), mech: str(r['Mechanism / cause']), tech: str(r['Technique']), task: str(r['Task']),
      iv: { A: num(r['Interval A (days)']), B: num(r['Interval B (days)']), C: num(r['Interval C (days)']) }, crit: str(r['Alert / Danger criterion']), ref: str(r['Reference']), tracked: str(r['Tracked in AHIM']).toUpperCase() !== 'N' }));
    const rc = table(wb, 'Risk_Consequence', 'Level'), rl = table(wb, 'Risk_Likelihood', 'Level'), rr = table(wb, 'Risk_Rating', 'Rating');
    const risk = {
      cons: rc.rows.map(r => ({ level: num(r['Level']), name: str(r['Name']), safety: str(r['Safety']), health: str(r['Health and radiation']), env: str(r['Environment']), prod: str(r['Production']), fin: str(r['Financial']), reg: str(r['Regulatory and legal'] || r['Regulatory and reputation']), comm: str(r['Community and reputation']) })),
      lik: rl.rows.map(r => ({ level: num(r['Level']), name: str(r['Name']), desc: str(r['Description']), freq: str(r['Frequency guide']), map: str(r['AHIM mapping']) })),
      rating: rr.rows.map(r => ({ name: str(r['Rating']), min: num(r['Minimum score']), resp: str(r['Required response']), auth: str(r['Authority to accept the risk']) })).sort((a, b) => b.min - a.min)
    };
    if (!risk.rating.length) risk.rating = [{ name: 'Extreme', min: 20, resp: 'Act within 7 days' }, { name: 'High', min: 12, resp: 'Act within 30 days' }, { name: 'Medium', min: 5, resp: 'Plan within 90 days' }, { name: 'Low', min: 1, resp: 'Routine' }];
    const ws_ = table(wb, 'WO_Summary', 'Work type');
    const woSummary = ws_.rows.map(r => ({ month: toDate(r['Month']), type: str(r['Work type']), total: num(r['Total']) || 0, done: num(r['Complete']) || 0, wip: num(r['In progress']) || 0, notStarted: num(r['Not started']) || 0 }))
      .map(x => { const d = new Date(x.month); x.month = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); return x; });
    const mStart = t => { if (t == null) return null; const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); };
    const yn = v => str(v).toUpperCase() === 'Y';
    const wo = table(wb, 'Work_Orders', 'WO no.').rows.map(r => ({ wo: str(r['WO no.']), asset: str(r['Pronto asset no.']), desc: str(r['Description']), type: str(r['Work type']),
      prio: str(r['Priority']), status: str(r['Status']), trade: str(r['Trade']) || 'Unassigned', raised: toDate(r['Raised']), req: toDate(r['Required by']), sched: toDate(r['Scheduled start']),
      fin: toDate(r['Actual finish']), planH: num(r['Planned hours']) || 0, actH: num(r['Actual hours']), down: num(r['Downtime (h)']) || 0, fcode: str(r['Failure code']),
      cost: num(r['Actual cost (USD)']), ready: yn(r['Ready (Y/N)']), shut: yn(r['Needs shutdown (Y/N)']), ref: str(r['AHIM finding ref']) }));
    const production = table(wb, 'Production', 'Circuit').rows.map(r => ({ month: mStart(toDate(r['Month'])), circuit: str(r['Circuit']), unit: str(r['Production unit']),
      planned: num(r['Planned hours']) || 0, operating: num(r['Operating hours']) || 0, mDown: num(r['Maintenance downtime (h)']) || 0, pDown: num(r['Process downtime (h)']) || 0,
      oDown: num(r['Other downtime (h)']) || 0, prod: num(r['Production']) || 0, lost: num(r['Lost production value (USD)']) || 0 })).filter(x => x.month != null);
    const costs = table(wb, 'Maint_Costs', 'Area').rows.map(r => ({ month: mStart(toDate(r['Month'])), area: str(r['Area']), cat: str(r['Category']), budget: num(r['Budget (USD)']) || 0, actual: num(r['Actual (USD)']) || 0 })).filter(x => x.month != null);
    const labour = table(wb, 'Labour', 'Trade').rows.map(r => ({ month: mStart(toDate(r['Month'])), trade: str(r['Trade']), avail: num(r['Available hours']) || 0, worked: num(r['Worked hours']) || 0,
      planned: num(r['Planned-work hours']) || 0, emerg: num(r['Emergency hours']) || 0, ot: num(r['Overtime hours']) || 0 })).filter(x => x.month != null);
    const rca = table(wb, 'RCA', 'RCA no.').rows.map(r => ({ no: str(r['RCA no.']), asset: str(r['Pronto asset no.']), trigger: str(r['Trigger']), raised: toDate(r['Raised']), lead: str(r['Lead']),
      problem: str(r['Problem']), cause: str(r['Root cause']), status: str(r['Status']) || 'Open', due: toDate(r['Due']), closed: toDate(r['Closed']), effective: str(r['Effective (Y/N)']).toUpperCase(), saving: num(r['Annual saving (USD)']) || 0 }));
    const actions = table(wb, 'Actions', 'Action no.').rows.map(r => ({ no: str(r['Action no.']), source: str(r['Source']), ref: str(r['Reference']), action: str(r['Action']), owner: str(r['Owner']),
      raised: toDate(r['Raised']), due: toDate(r['Due']), status: str(r['Status']) || 'Open', closed: toDate(r['Closed']), evidence: str(r['Evidence']) }));
    const kpiTree = table(wb, 'KPI_Tree', 'KPI id').rows.map(r => ({ id: str(r['KPI id']), objective: str(r['Objective']), kpi: str(r['KPI']), tier: str(r['Tier']), owner: str(r['Owner']),
      target: num(r['Target']), dir: str(r['Direction']) || 'Higher is better', freq: str(r['Frequency']) }));
    const routes = table(wb, 'Routes', 'Route ID').rows.map(r => ({ id: str(r['Route ID']), name: str(r['Route']), area: str(r['Area']), tech: str(r['Technique']), person: str(r['Technician']),
      interval: num(r['Interval (days)']) || 30, last: toDate(r['Last completed']), assets: str(r['Assets']).split(/[,;\s]+/).filter(Boolean) }));
    const cm = table(wb, S.commentary, 'Month');
    const commentary = cm.rows.map(r => ({ month: toDate(r['Month']), changed: str(r['What changed']), why: str(r['Why']), doing: str(r['What we are doing']), author: str(r['Author']) })).filter(c => c.month != null)
      .map(c => { const d = new Date(c.month); c.month = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); return c; });
    [['events', ev], ['schedule', sc], ['value', va], ['cost', co], ['decisions', de], ['prestart', pr], ['commentary', cm]].forEach(([n, t]) => { if (t.missing) warn.push('Optional sheet "' + S[n] + '" not found: related panels stay empty.'); });
    return { assets, records, events, schedule, value, cost, decisions, prestart, commentary, strategy, risk, woSummary, wo, production, costs, labour, rca, actions, kpiTree, routes, lists, techs, settings, warnings: warn };
  }

  AHIM.data = {
    fromArrayBuffer(buf) { return parse(XLSX.read(buf, { type: 'array' })); },
    fromBase64(b64) { return parse(XLSX.read(b64, { type: 'base64' })); },
    toDate
  };
})();
