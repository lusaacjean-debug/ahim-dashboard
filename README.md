# AHIM Dashboard: Asset Health & Integrity Management

Live condition monitoring and integrity dashboard for the Lotus Africa Uranium Plant.
It reads one Excel workbook (`data/AHIM_Data.xlsx`) and turns every inspection input into five pages:

| Page | Audience | Shows |
|---|---|---|
| 1 · Management | Engineering Manager, site leadership | Commentary, Asset Health Index with data confidence, KPIs against target (risk, coverage, WOs, strategy, compliance), escalations, CM value |
| 2 · Risk | Management, reliability | 5x5 heat map (ISO 31000), risk register with response and owner, risk by area |
| 3 · Plant health | Reliability, maintenance planners | OK / Alert / Danger per asset and technique, criticality matrix, top 10 priorities |
| 4 · Reliability | Reliability engineer | Asset Criticality Index, open record status, SMRP maintenance performance, ISO 14224 failure-mode Pareto, bad actors, machine history |
| 5 · Strategy | Reliability, planning | Strategy compliance by technique and class, gaps on critical assets, strategy library (82 tasks, 24 classes, uranium and acid plant) |
| 6 · Integrity | Integrity, statutory compliance | Statutory register, thickness and remaining life (API 653 / 570), isolation and shutdown scope, API 571 damage mechanisms, open integrity findings |
| 7 · Fleet | Fleet supervisor | Light vehicle and heavy equipment availability, tag-outs, prestart compliance, open defects |

Inputs covered: vibration and visual routes, IR surveys, substation inspections, statutory inspections, ultrasonic reports (thickness and airborne), oil analysis, diesel generator checklists, LV/HV inspection checklists, LV/HV prestart checklists, and Pronto work-order history.

## How it works

```
 Inspectors / contractors ──► AHIM_Data.xlsx ──► validate_data.py ──► Dashboard (browser)
   (Records sheet rows)         (one workbook)     (blocks bad data)     reads the workbook directly
                                     ▲
 Pronto WO export ──► Events ────────┘
```

* **No server, no database.** The dashboard is static HTML and JavaScript. It reads the workbook in the browser with SheetJS and recalculates every status, score and KPI itself, so it never depends on Excel formula results.
* **Live.** While the page is open it re-reads the workbook every 5 minutes (`assets/js/config.js`). Update the workbook and the dashboard follows.
* **Period selector.** Any past month can be viewed. Statuses are rebuilt as they were at the end of that month.
* **Offline snapshot.** `scripts/build_standalone.py` produces a single HTML file with the data embedded, for emailing to management.

## Repository layout

```
index.html                     page shell
assets/css/ahim.css            styles (light and dark)
assets/js/config.js            settings: data path, refresh interval, integrity rules
assets/js/data.js              reads the workbook into a data model
assets/js/calc.js              calculation engine (status, ACI, priority, AHI, MTBF, remaining life)
assets/js/ui.js, charts.js     shared rendering helpers and SVG charts
assets/js/pages/*.js           one file per page
scripts/ahim_reference.py      risk matrix, ISO 14224 codes, API 571 mechanisms, strategy library, standards map
scripts/ahim_sheets.py         writes the reference sheets and professional fields
assets/js/app.js               navigation, filters, auto-refresh
data/AHIM_Data.xlsx            the workbook (sample data until replaced)
scripts/validate_data.py       data quality gate
scripts/build_standalone.py    offline single-file build
scripts/make_sample_data.py    regenerates the sample workbook and template
docs/                          data dictionary, KPI definitions, monthly workflow
.github/workflows/             validate on every push, deploy to GitHub Pages
```

## Getting started

1. **Create the repository.** On GitHub: *New repository* → name it `ahim-dashboard` → **Private**. Upload the contents of this folder (or `git push`).
2. **Run it locally.** From the folder: `python -m http.server 8000`, then open <http://localhost:8000>. Opening `index.html` by double-click also works: use **Open workbook** to load the file.
3. **Replace the sample data.** Fill `data/AHIM_Data.xlsx` with the Pronto asset list and real records (see `docs/data-dictionary.md`). Delete the blue italic sample rows.
4. **Check the data.** `pip install openpyxl` then `python scripts/validate_data.py`. Fix every ERROR.
5. **Publish.** Commit the workbook. GitHub Actions validates it and, if clean, deploys the dashboard.

## Hosting and confidentiality ⚠️

Plant condition data is company-confidential. Choose one:

| Option | Who can see it | Notes |
|---|---|---|
| **Internal web server or SharePoint** (recommended) | Company network only | Copy the folder to any web server or SharePoint document library; set `dataUrl` in `config.js` to the workbook's location. |
| **GitHub Pages from a private repo** | Organisation members | Requires GitHub Enterprise Cloud with private Pages. On free/Team plans, Pages sites are **public**: do not use them with real data. |
| **Offline snapshot** | Whoever receives the file | `python scripts/build_standalone.py` → `dist/AHIM_Dashboard.html`. Also produced by every Actions run as a downloadable artifact. |

The **Open workbook** button reads a local file inside the browser: nothing is uploaded anywhere.

## Importing from the CM Monthly Report workbook

The site's existing `CM_Monthly_Report` workbook can be converted directly:

```
pip install openpyxl pandas
python scripts/import_cm_workbook.py CM_Monthly_Report.xlsx data/AHIM_Data.xlsx [UT_Register.xlsx] [Vessels_Tanks_Inspection_Summary.xlsx ...]
python scripts/validate_data.py data/AHIM_Data.xlsx
```

It reads **Data entry** (visual inspections), **Criticality**, **Oil Analysis** (WearCheck), **Vibration Analysis** and **WO Data** (Pronto export), plus any vessel & tank statutory inspection summaries given after the output file (Vessel Register and Action Register sheets: next inspection due dates feed the statutory register, actions become integrity findings), and writes every conversion rule, assumption and item to check to the **Import_Review** sheet. Re-run it every month on the updated CM workbook.

Main rules: Offline inspections are excluded (no condition assessed). Ok rows are readings. Alert/Danger rows with record status Open become open recommendations, Closed rows are closed on the next inspection date, and rows with blank or Observation status are kept as readings only. Criticality comes from the Criticality sheet first. ACI factors are derived from C1–C4 plus the number of findings in the last 12 months.

### UT thickness surveys

Contractor UT reports are kept in a **UT Register** workbook (UT_Tanks, UT_Readings, UT_Findings):

```
python scripts/parse_ut_reports.py "UT reports folder" parsed.json      # PDF reports -> JSON
python scripts/build_ut_register.py parsed.json UT_Register.xlsx [observations.json]
```

Add each new survey round to the same register: AHIM then calculates corrosion rate and remaining life per elevation band. Update WO, status and closure of UT findings in the UT_Findings sheet. Until the API 653 minimum thickness (t-min) is calculated per shell course, the contractor red band is the Alert limit and 70% of it the Danger limit.

## Monthly routine

See `docs/monthly-workflow.md`. In short: input owners add rows to **Records** during the month, the RCM Specialist reviews and raises Pronto WOs, Pronto history is pasted into **Events**, then the workbook is committed and the Management page is presented.

## Changing the rules

All thresholds live in the workbook's **Lists** sheet (ACI weights, class limits, priority bands, response times, KPI targets) or in `assets/js/config.js` (refresh interval, remaining-life rules). Definitions are in `docs/kpi-definitions.md`. Get changes approved by the Engineering Manager so numbers stay comparable month to month.

## Requirements

Any modern browser. Python 3.9+ with `openpyxl` for the scripts. Internet access for the SheetJS script and fonts (cdnjs, Google Fonts). To run fully offline, download `xlsx.full.min.js` into `assets/js/vendor/` and change the script tag in `index.html`.
