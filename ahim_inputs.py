"""AHIM input schemas: one definition per input, shared by the builders, the import (upsert by key),
the validator and the Excel input templates. Also generates the fictitious demo data."""
import random, datetime as dt

LISTS = {
 'work_type': ['Preventive', 'Condition-based', 'Corrective', 'Breakdown', 'Emergency', 'Improvement', 'Shutdown'],
 'wo_status': ['Open', 'Ready', 'Scheduled', 'In progress', 'Complete', 'Cancelled'],
 'cost_cat': ['Labour', 'Parts and materials', 'Contractors', 'Other'],
 'rca_status': ['Open', 'Analysis', 'Actions in progress', 'Effectiveness check', 'Closed'],
 'act_status': ['Open', 'In progress', 'Done', 'Cancelled'],
 'act_source': ['Management decision', 'RCA', 'CM and planning meeting', 'Risk treatment', 'Audit', 'Management review'],
 'tier': ['Strategic', 'Tactical', 'Operational'], 'direction': ['Higher is better', 'Lower is better'], 'yn': ['Y', 'N'],
 'trigger': ['Bad actor', 'Breakdown', 'Danger finding', 'Incident', 'Audit finding'],
}
# name: (title, description, [(column, width, kind, list)], key columns, owner / source, frequency)
SCHEMAS = {
 'Work_Orders': ('Work orders (from Pronto)', 'One row per work order. Filled automatically from the Pronto WO export in the CM workbook (WO Data) at each import; rows added here manually are kept.',
  [('WO no.', 11, 'text', None), ('Pronto asset no.', 14, 'text', None), ('Description', 40, 'text', None), ('Work type', 15, 'list', 'work_type'),
   ('Priority', 8, 'text', None), ('Status', 12, 'list', 'wo_status'), ('Trade', 14, 'text', None), ('Raised', 11, 'date', None), ('Required by', 11, 'date', None),
   ('Scheduled start', 11, 'date', None), ('Actual finish', 11, 'date', None), ('Planned hours', 9, 'num', None), ('Actual hours', 9, 'num', None),
   ('Downtime (h)', 9, 'num', None), ('Failure code', 11, 'text', None), ('Actual cost (USD)', 11, 'num', None), ('Ready (Y/N)', 8, 'list', 'yn'),
   ('Needs shutdown (Y/N)', 9, 'list', 'yn'), ('AHIM finding ref', 14, 'text', None)], ['WO no.'], 'Planner (Pronto saved report)', 'Weekly or monthly'),
 'Production': ('Production and availability by circuit', 'One row per month and circuit. Circuit names must match the Area names in the Asset_Register.',
  [('Month', 10, 'date', None), ('Circuit', 22, 'text', None), ('Production unit', 12, 'text', None), ('Planned hours', 10, 'num', None),
   ('Operating hours', 10, 'num', None), ('Maintenance downtime (h)', 12, 'num', None), ('Process downtime (h)', 11, 'num', None),
   ('Other downtime (h)', 10, 'num', None), ('Production', 11, 'num', None), ('Lost production value (USD)', 13, 'num', None)], ['Month', 'Circuit'], 'Metallurgy / production report', 'Monthly'),
 'Maint_Costs': ('Maintenance cost against budget', 'One row per month, area and category (USD).',
  [('Month', 10, 'date', None), ('Area', 22, 'text', None), ('Category', 18, 'list', 'cost_cat'), ('Budget (USD)', 12, 'num', None), ('Actual (USD)', 12, 'num', None)],
  ['Month', 'Area', 'Category'], 'Finance / maintenance cost report', 'Monthly'),
 'Labour': ('Maintenance labour hours', 'One row per month and trade: hours available, worked, on planned work, on emergency work, overtime.',
  [('Month', 10, 'date', None), ('Trade', 16, 'text', None), ('Available hours', 11, 'num', None), ('Worked hours', 11, 'num', None),
   ('Planned-work hours', 11, 'num', None), ('Emergency hours', 11, 'num', None), ('Overtime hours', 11, 'num', None)], ['Month', 'Trade'], 'Maintenance supervisors / timesheets', 'Monthly'),
 'RCA': ('Root cause analysis tracker', 'One row per RCA. Status moves Open > Analysis > Actions in progress > Effectiveness check > Closed.',
  [('RCA no.', 12, 'text', None), ('Pronto asset no.', 14, 'text', None), ('Trigger', 14, 'list', 'trigger'), ('Raised', 11, 'date', None), ('Lead', 16, 'text', None),
   ('Problem', 40, 'text', None), ('Root cause', 40, 'text', None), ('Status', 18, 'list', 'rca_status'), ('Due', 11, 'date', None), ('Closed', 11, 'date', None),
   ('Effective (Y/N)', 9, 'list', 'yn'), ('Annual saving (USD)', 12, 'num', None)], ['RCA no.'], 'Reliability engineer', 'When raised, updated weekly'),
 'Actions': ('Action tracker', 'All actions from management decisions, RCAs, CM meetings, risk treatment and audits, with evidence of closure.',
  [('Action no.', 11, 'text', None), ('Source', 20, 'list', 'act_source'), ('Reference', 14, 'text', None), ('Action', 50, 'text', None), ('Owner', 18, 'text', None),
   ('Raised', 11, 'date', None), ('Due', 11, 'date', None), ('Status', 12, 'list', 'act_status'), ('Closed', 11, 'date', None), ('Evidence', 30, 'text', None)],
  ['Action no.'], 'Action owners, reviewed in the CM meeting', 'Weekly'),
 'KPI_Tree': ('KPI tree: objectives, KPIs, owners and targets', 'Line of sight from asset management objectives to KPIs. KPI id links to the calculation in the dashboard: do not change ids.',
  [('KPI id', 14, 'text', None), ('Objective', 30, 'text', None), ('KPI', 36, 'text', None), ('Tier', 11, 'list', 'tier'), ('Owner', 20, 'text', None),
   ('Target', 9, 'num', None), ('Direction', 14, 'list', 'direction'), ('Frequency', 11, 'text', None)], ['KPI id'], 'Engineering Manager (approves)', 'Annual review'),
 'Routes': ('Inspection routes', 'One row per route: interval and last completion drive the Field page. Assets = Pronto asset numbers separated by commas.',
  [('Route ID', 11, 'text', None), ('Route', 30, 'text', None), ('Area', 18, 'text', None), ('Technique', 18, 'text', None), ('Technician', 16, 'text', None),
   ('Interval (days)', 9, 'num', None), ('Last completed', 11, 'date', None), ('Assets', 60, 'text', None)], ['Route ID'], 'RCM Specialist', 'Each route completion'),
}

KPI_TREE = [  # id, objective, KPI, tier, owner, target, direction, frequency
 ('extreme_risks', '1. Safe and compliant operation', 'Extreme risks', 'Strategic', 'General Manager', 0, 'Lower is better', 'Monthly'),
 ('statutory', '1. Safe and compliant operation', 'Statutory inspections in date (%)', 'Strategic', 'Engineering Manager', 100, 'Higher is better', 'Monthly'),
 ('p1_overdue', '1. Safe and compliant operation', 'P1 findings overdue', 'Tactical', 'Maintenance Superintendent', 0, 'Lower is better', 'Weekly'),
 ('availability', '2. Reliable production', 'Availability of critical circuits (%)', 'Strategic', 'Engineering Manager', 95, 'Higher is better', 'Monthly'),
 ('downtime_cost', '2. Reliable production', 'Maintenance downtime cost, month (USD)', 'Strategic', 'Engineering Manager', 100000, 'Lower is better', 'Monthly'),
 ('ahi', '2. Reliable production', 'Asset Health Index', 'Strategic', 'RCM Specialist', 85, 'Higher is better', 'Monthly'),
 ('bad_actor_rca', '2. Reliable production', 'Bad actors with an RCA (%)', 'Tactical', 'Reliability Engineer', 100, 'Higher is better', 'Monthly'),
 ('pm_compliance', '3. Effective maintenance execution', 'PM compliance (%)', 'Tactical', 'Planner', 90, 'Higher is better', 'Weekly'),
 ('schedule_compliance', '3. Effective maintenance execution', 'Schedule compliance (%)', 'Tactical', 'Planner', 85, 'Higher is better', 'Weekly'),
 ('planned_work', '3. Effective maintenance execution', 'Planned work, % of hours', 'Tactical', 'Maintenance Superintendent', 85, 'Higher is better', 'Monthly'),
 ('reactive_work', '3. Effective maintenance execution', 'Emergency work, % of hours', 'Tactical', 'Maintenance Superintendent', 10, 'Lower is better', 'Monthly'),
 ('backlog_weeks', '3. Effective maintenance execution', 'Backlog (crew-weeks)', 'Tactical', 'Planner', 4, 'Lower is better', 'Weekly'),
 ('findings_wo', '3. Effective maintenance execution', 'Open findings with a work order (%)', 'Operational', 'Planner', 100, 'Higher is better', 'Weekly'),
 ('cost_budget', '4. Cost-effective maintenance', 'Maintenance cost vs budget, YTD (%)', 'Strategic', 'Engineering Manager', 100, 'Lower is better', 'Monthly'),
 ('cost_rav', '4. Cost-effective maintenance', 'Maintenance cost, % of replacement asset value', 'Strategic', 'Engineering Manager', 3.5, 'Lower is better', 'Annual'),
 ('cm_roi', '4. Cost-effective maintenance', 'CM return on investment (x : 1)', 'Strategic', 'RCM Specialist', 4, 'Higher is better', 'Monthly'),
 ('data_confidence', '5. Known and controlled asset condition', 'Data confidence (%)', 'Tactical', 'RCM Specialist', 85, 'Higher is better', 'Monthly'),
 ('strategy_compliance', '5. Known and controlled asset condition', 'Strategy compliance, critical assets (%)', 'Tactical', 'RCM Specialist', 90, 'Higher is better', 'Monthly'),
 ('actions_overdue', '6. Governance and improvement', 'Overdue actions', 'Tactical', 'Engineering Manager', 0, 'Lower is better', 'Weekly'),
]

# ---------------- fictitious demo data (consistent with the sample assets) ----------------
def demo_rows(assets, recs, ev, months):
    R = random.Random(11)
    D = lambda y, m, d: dt.datetime(y, m, d)
    tag = {a[0]: a[1] for a in assets}; area = {a[0]: a[3] for a in assets}
    trade_of = lambda t: 'Electrical' if t.startswith(('SS-',)) else 'Fleet' if t.startswith(('LV-', 'HV-')) else 'Boilermaker' if any(k in t for k in ('TK', 'PL', 'WHB', 'AR', 'CV', 'SF')) else 'Mechanical'
    rows = {k: [] for k in SCHEMAS}
    wo_no = [700000]
    def nwo(): wo_no[0] += 1; return str(wo_no[0])
    last = dt.datetime(2026, 9, 30)
    # preventive maintenance: one PM per asset per month
    for (y, m) in months:
        for a in assets:
            raised = D(y, m, 1); req = D(y, m, 28); sched = D(y, m, R.randint(3, 24))
            done = R.random() < (0.80 + 0.012 * months.index((y, m)))
            fin = sched + dt.timedelta(days=R.choice([0, 1, 2, 3, 6, 9])) if done else None
            if fin and fin > last: fin, done = None, False
            ph = R.choice([2, 3, 4, 6, 8]); ah = round(ph * R.uniform(0.8, 1.3), 1) if done else None
            st = 'Complete' if done else ('Scheduled' if (y, m) == months[-1] else 'Open')
            rows['Work_Orders'].append([nwo(), a[0], f'Monthly PM {tag[a[0]]}', 'Preventive', 'P3', st, trade_of(a[1]), raised, req, sched, fin, ph, ah, 0, '',
                                        round((ah or 0) * 45 + R.choice([0, 0, 80, 150, 300]), 0) if done else None, 'Y' if st != 'Complete' else '', 'N', ''])
    # condition-based WOs from the sample findings that carry a WO number
    for x in recs:
        if not x[13]: continue
        d0 = dt.datetime.strptime(x[0], '%Y-%m-%d'); raised = d0 + dt.timedelta(days=R.randint(1, 6))
        st = {'Closed': 'Complete', 'Scheduled': 'Scheduled', 'WO raised': 'Ready', 'Awaiting verification': 'Complete'}.get(x[14], 'Open')
        fin = dt.datetime.strptime(x[16], '%Y-%m-%d') if x[16] else (raised + dt.timedelta(days=5) if st == 'Complete' else None)
        if fin and fin > last: fin = last
        ph = R.choice([4, 6, 8, 12, 16])
        rows['Work_Orders'].append([x[13], x[1], (x[12] or x[11] or x[4])[:80], 'Condition-based', 'P2', st, trade_of(tag.get(x[1], '')), raised, raised + dt.timedelta(days=30),
                                    raised + dt.timedelta(days=R.randint(3, 14)), fin, ph, round(ph * R.uniform(0.9, 1.4), 1) if fin else None, 0, '',
                                    round(ph * 55 + R.randint(200, 3000), 0) if fin else None, 'Y' if st in ('Ready', 'Scheduled') else '', 'Y' if R.random() < 0.3 else 'N', x[4][:20]])
    # breakdowns from the sample events
    for d0, t, ty, desc, down, wo, rca in ev:
        if ty != 'Failure': continue
        d1 = dt.datetime.strptime(d0, '%Y-%m-%d'); no = TAG = None
        rows['Work_Orders'].append([wo, t, desc[:80], 'Breakdown', 'P1', 'Complete', trade_of(tag.get(t, '')), d1, d1, d1, d1 + dt.timedelta(hours=max(down, 2)),
                                    max(down, 4), max(down, 4) * 1.6, down, R.choice(['BRD', 'ELP', 'OHE', 'VIB']), round(max(down, 4) * 160 + R.randint(2000, 15000), 0), '', 'N', ''])
    # corrective, emergency, improvement and shutdown work
    for (y, m) in months:
        k = months.index((y, m))
        for _ in range(R.randint(15, 21)):
            a = R.choice(assets); raised = D(y, m, R.randint(1, 26)); ty = R.choices(['Corrective', 'Emergency', 'Improvement', 'Shutdown'], [10, max(1, 4 - k // 4), 1, 1 if m in (2, 8) else 0.2])[0]
            done = R.random() < (0.45 if (y, m) == months[-1] else 0.80 - 0.012 * (11 - k))
            fin = raised + dt.timedelta(days=R.randint(1, 25)) if done else None
            if fin and fin > last: fin, done = None, False
            ph = R.choice([4, 8, 12, 16, 24, 32, 40]) if ty != 'Shutdown' else R.choice([24, 48, 72])
            st = 'Complete' if done else R.choice(['Open', 'Open', 'Ready', 'Scheduled'])
            rows['Work_Orders'].append([nwo(), a[0], f'{ty} work on {tag[a[0]]}', ty, 'P1' if ty == 'Emergency' else R.choice(['P2', 'P3']), st, trade_of(a[1]), raised,
                                        raised + dt.timedelta(days=7 if ty == 'Emergency' else 30), raised + dt.timedelta(days=R.randint(1, 14)), fin, ph,
                                        round(ph * R.uniform(0.8, 1.5), 1) if done else None, R.choice([0, 0, 0, 2, 4]) if ty == 'Emergency' else 0, '',
                                        round(ph * 50 + R.randint(100, 6000), 0) if done else None, 'Y' if st in ('Ready', 'Scheduled') else '', 'Y' if ty == 'Shutdown' else 'N', ''])
    # production and availability
    circ = {'Acid plant': ('t H2SO4', 600 / 24, 900), 'Calciner': ('kg U3O8', 95, 2500), 'Power plant': ('MWh', 9.5, 400)}
    for (y, m) in months:
        days = (dt.date(y + (m == 12), m % 12 + 1, 1) - dt.date(y, m, 1)).days; k = months.index((y, m))
        for c, (unit, rate, val) in circ.items():
            planned = days * 24 - (72 if (m == 2 and c == 'Acid plant') else 0)
            md = round(R.uniform(8, 36) * (1.4 if k in (3, 4, 10, 11) else 1) * (1.6 if c == 'Calciner' and k == 2 else 1), 1)
            pd_ = round(R.uniform(4, 20), 1); od = round(R.uniform(0, 8), 1); op = round(planned - md - pd_ - od, 1)
            rows['Production'].append([D(y, m, 1), c, unit, planned, op, md, pd_, od, round(op * rate * R.uniform(0.93, 1.03), 0), round(md * val, 0)])
    # maintenance cost against budget
    bud = {('Acid plant', 'Labour'): 52000, ('Acid plant', 'Parts and materials'): 38000, ('Acid plant', 'Contractors'): 22000, ('Acid plant', 'Other'): 5000,
           ('Calciner', 'Labour'): 18000, ('Calciner', 'Parts and materials'): 14000, ('Calciner', 'Contractors'): 9000, ('Calciner', 'Other'): 2000,
           ('Power plant', 'Labour'): 16000, ('Power plant', 'Parts and materials'): 21000, ('Power plant', 'Contractors'): 8000, ('Power plant', 'Other'): 2000,
           ('Substation', 'Labour'): 6000, ('Substation', 'Parts and materials'): 3000, ('Substation', 'Contractors'): 4000, ('Substation', 'Other'): 500,
           ('Mobile fleet', 'Labour'): 9000, ('Mobile fleet', 'Parts and materials'): 16000, ('Mobile fleet', 'Contractors'): 3000, ('Mobile fleet', 'Other'): 1000}
    for (y, m) in months:
        for (a, c), b in bud.items():
            spike = 1.9 if (m == 2 and c == 'Contractors' and a == 'Acid plant') else 1.0
            b = b * 0.5
            rows['Maint_Costs'].append([D(y, m, 1), a, c, b * (1.6 if m == 2 and a == 'Acid plant' and c != 'Labour' else 1), round(b * R.uniform(0.85, 1.18) * spike, 0)])
    # labour hours
    crew = {'Mechanical': 8, 'Electrical': 4, 'Instrumentation': 2, 'Boilermaker': 3, 'Fleet': 3}
    for (y, m) in months:
        k = months.index((y, m))
        for t, n in crew.items():
            av = n * 176; wk = round(av * R.uniform(0.9, 0.97)); pl = round(wk * min(0.9, 0.68 + 0.015 * k + R.uniform(-0.03, 0.03)))
            em = round(wk * max(0.05, 0.18 - 0.009 * k + R.uniform(-0.02, 0.02))); ot = round(av * R.uniform(0.05, 0.13))
            rows['Labour'].append([D(y, m, 1), t, av, wk, pl, em, ot])
    no = {a[1]: a[0] for a in assets}
    rows['RCA'] = [
     ['RCA-2025-07', no['PP-GEN-04'], 'Breakdown', D(2025, 12, 8), 'Reliability Engineer', 'Fuel injector failure, unit offline 10 h', 'Contaminated fuel: day-tank filter bypassed', 'Closed', D(2026, 1, 31), D(2026, 1, 20), 'Y', 18000],
     ['RCA-2026-02', no['AP-WHB-01'], 'Breakdown', D(2026, 2, 18), 'Integrity Engineer', 'Economiser tube leak, 36 h plant stop', 'Oxygen pitting: deaerator control out of range', 'Closed', D(2026, 4, 30), D(2026, 4, 22), 'Y', 95000],
     ['RCA-2026-03', no['PP-GEN-01'], 'Breakdown', D(2026, 3, 14), 'Reliability Engineer', 'Turbo oil feed line leak, unit stopped', 'Line chafing on bracket: clamp missing after overhaul', 'Actions in progress', D(2026, 6, 30), None, '', 0],
     ['RCA-2026-04', no['AP-P-101'], 'Bad actor', D(2026, 4, 25), 'RCM Specialist', 'Repeat DE bearing failures on drying tower pump', 'Soft foot and pipe strain after each repair', 'Effectiveness check', D(2026, 7, 31), None, '', 40000],
     ['RCA-2026-07', no['AP-PL-01'], 'Breakdown', D(2026, 7, 8), 'Integrity Engineer', 'Pinhole leak at elbow E-04', 'Velocity above limit for carbon steel in acid service', 'Analysis', D(2026, 9, 15), None, '', 0],
     ['RCA-2026-09', no['AP-CT-01'], 'Danger finding', D(2026, 9, 12), 'RCM Specialist', 'Cooling tower gearbox gear-mesh deterioration', '', 'Open', D(2026, 10, 31), None, '', 0]]
    acts = [('Management decision', 'DEC-01', 'Approve and plan the October 36-hour stop', 'Engineering Manager', D(2026, 9, 25), D(2026, 10, 5), 'In progress', None, ''),
            ('Management decision', 'DEC-02', 'Book statutory inspector for the waste heat boiler', 'Engineering Manager', D(2026, 9, 2), D(2026, 9, 30), 'Open', None, ''),
            ('RCA', 'RCA-2026-04', 'Install pipe supports on P-101 suction and discharge', 'Mechanical Supervisor', D(2026, 5, 10), D(2026, 6, 30), 'Done', D(2026, 6, 20), 'WO 243700 closed, photos'),
            ('RCA', 'RCA-2026-04', 'Soft-foot check added to pump alignment procedure', 'RCM Specialist', D(2026, 5, 10), D(2026, 6, 15), 'Done', D(2026, 6, 12), 'Procedure rev 3'),
            ('RCA', 'RCA-2026-03', 'Add clamp check to generator overhaul checklist', 'Power Plant Supervisor', D(2026, 4, 2), D(2026, 5, 15), 'Open', None, ''),
            ('RCA', 'RCA-2026-07', 'Velocity survey of acid lines; resize where above limit', 'Integrity Engineer', D(2026, 8, 1), D(2026, 10, 15), 'In progress', None, ''),
            ('CM and planning meeting', 'CM-W36', 'Raise WOs for all P1 findings without a WO', 'Planner', D(2026, 9, 4), D(2026, 9, 8), 'Done', D(2026, 9, 8), 'WO list in meeting minutes'),
            ('CM and planning meeting', 'CM-W38', 'Re-plan vibration route around production schedule', 'RCM Specialist', D(2026, 9, 18), D(2026, 9, 30), 'In progress', None, ''),
            ('CM and planning meeting', 'CM-W39', 'Clear backlog items older than 90 days', 'Maintenance Superintendent', D(2026, 9, 25), D(2026, 10, 31), 'Open', None, ''),
            ('Risk treatment', 'RISK-SS-MCC-01', 'Thermal camera check of MCC after re-termination', 'Electrical Supervisor', D(2026, 9, 25), D(2026, 10, 2), 'Open', None, ''),
            ('Risk treatment', 'RISK-AP-PL-01', 'Isolate acid line E-07 section until spool replaced', 'Area Superintendent', D(2026, 9, 19), D(2026, 9, 22), 'Done', D(2026, 9, 21), 'Isolation certificate'),
            ('Audit', 'AUD-2026-1', 'Document criticality method and approve', 'RCM Specialist', D(2026, 3, 1), D(2026, 6, 30), 'In progress', None, ''),
            ('Management review', 'MR-Q3', 'Approve KPI targets and risk matrix', 'Engineering Manager', D(2026, 7, 15), D(2026, 8, 31), 'Done', D(2026, 8, 28), 'Signed framework'),
            ('Management review', 'MR-Q3', 'Fund online vibration monitoring for main blower', 'General Manager', D(2026, 7, 15), D(2026, 12, 15), 'Open', None, '')]
    rows['Actions'] = [[f'ACT-{i + 1:03d}', *a] for i, a in enumerate(acts)]
    rows['KPI_Tree'] = [list(x) for x in KPI_TREE]
    rows['Routes'] = [
     ['R-AP-VIB', 'Acid plant vibration route', 'Acid plant', 'Vibration', 'CM Technician 1', 30, D(2026, 9, 22), ','.join(no[t] for t in ['AP-BL-01', 'AP-P-101', 'AP-P-102', 'AP-P-103', 'AP-P-201', 'AP-P-202', 'AP-P-301', 'AP-AG-01', 'AP-CT-01'])],
     ['R-AP-VIS', 'Acid plant sensitive inspection', 'Acid plant', 'Visual', 'CM Technician 2', 7, D(2026, 9, 21), ','.join(no[t] for t in ['AP-SF-01', 'AP-WHB-01', 'AP-CV-01', 'AP-TK-01', 'AP-PL-01', 'AP-AR-01', 'AP-P-101', 'AP-P-102'])],
     ['R-AP-IR', 'Acid plant IR survey', 'Acid plant', 'Infrared', 'RCM Specialist', 30, D(2026, 9, 8), ','.join(no[t] for t in ['AP-SF-01', 'AP-CV-01', 'AP-WHB-01'])],
     ['R-SS-IR', 'Substation IR and ultrasound', 'Substation', 'Infrared', 'RCM Specialist', 30, D(2026, 8, 24), ','.join(no[t] for t in ['SS-TX-01', 'SS-MCC-01'])],
     ['R-CK-IR', 'Calciner shell scan', 'Calciner', 'Infrared', 'RCM Specialist', 30, D(2026, 9, 26), no['CK-1080']],
     ['R-PP-DG', 'Power plant daily DG log', 'Power plant', 'DG checks', 'DG Operator', 1, D(2026, 9, 28), ','.join(no[t] for t in ['PP-GEN-01', 'PP-GEN-02', 'PP-GEN-03', 'PP-GEN-04'])],
     ['R-OIL', 'Oil sampling route', 'Acid plant', 'Lubrication / oil', 'CM Technician 1', 30, D(2026, 9, 5), ','.join(no[t] for t in ['AP-P-101', 'AP-P-201', 'AP-CT-01', 'CK-1080'])],
     ['R-FL-PS', 'Fleet prestart audit', 'Mobile fleet', 'Prestart', 'Fleet Supervisor', 7, D(2026, 9, 18), ','.join(no[t] for t in ['LV-01', 'LV-02', 'HV-01', 'HV-02', 'HV-03'])]]
    return rows

DEMO_ASSET_VALUES = {  # tag: (replacement value USD, install year, design life years)
 'AP-SF-01': (6000000, 2008, 30), 'AP-WHB-01': (4500000, 2008, 25), 'AP-BL-01': (2200000, 2008, 25), 'AP-CV-01': (5000000, 2008, 30),
 'AP-P-101': (180000, 2012, 15), 'AP-P-102': (180000, 2012, 15), 'AP-P-103': (160000, 2009, 15), 'AP-P-201': (140000, 2010, 20), 'AP-P-202': (140000, 2010, 20),
 'AP-P-301': (120000, 2008, 20), 'AP-AG-01': (90000, 2008, 20), 'AP-CT-01': (350000, 2008, 20), 'AP-TK-01': (1200000, 2008, 25), 'AP-PL-01': (300000, 2011, 15),
 'AP-AR-01': (80000, 2008, 30), 'CK-1080': (12000000, 2009, 30), 'SS-TX-01': (1500000, 2008, 35), 'SS-MCC-01': (600000, 2008, 25),
 'PP-GEN-01': (1800000, 2010, 20), 'PP-GEN-02': (1800000, 2010, 20), 'PP-GEN-03': (1800000, 2010, 20), 'PP-GEN-04': (1800000, 2010, 20),
 'LV-01': (60000, 2021, 6), 'LV-02': (60000, 2022, 6), 'HV-01': (900000, 2015, 12), 'HV-02': (450000, 2016, 12), 'HV-03': (700000, 2017, 12)}
