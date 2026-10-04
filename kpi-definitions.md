# AHIM KPI and calculation definitions

All rules below are implemented in `assets/js/calc.js` and the page files. Values in *italics* are settings on the workbook's **Lists** sheet.

## Record status
| Record type | Status rule |
|---|---|
| Measured (value + Alert + Danger limits) | *Higher is worse*: value ≥ Danger → Danger; ≥ Alert → Alert; else OK. *Lower is worse* (wall thickness, oil pressure, insulation resistance): value ≤ Danger → Danger; ≤ Alert → Alert; else OK |
| Checklist, visual, statutory | Inspector status (OK / Alert / Danger) using the severity rules in the workbook Guide |
| Override | An Inspector status on a measured row overrides the calculated status (analyst judgement) |

## Asset status (on day D)
Worst of: the **latest reading** for each technique + parameter, and every **open recommendation**.
A recommendation is open from its date until *Date closed*. A reading whose own recommendation is closed counts as OK.
Rows with stage **No action** are readings only: they update trends and status but are not counted as recommendations.
**Unknown:** an asset never inspected, or whose last inspection is older than its required interval (*Inspection interval*: class A 30 days, B 60, C 90) while its last known condition was OK. Absence of evidence is not evidence of health. A known Alert or Danger stays Alert or Danger until closed, even when stale.
"?" in the matrix = technique applicable but never recorded (a coverage gap).

## Data confidence
Share of active assets (and of class A assets) inspected within their required interval. Shown under the AHI so a good-looking index built on old data cannot be mistaken for a healthy plant.

## Asset Criticality Index (ACI)
ACI = Σ (factor score 1–5 × *weight*) ÷ 5 × 100. Factors: safety and environment 30%, production 30%, redundancy 15%, repair cost/MTTR 15%, failure history 10%.
Class A ≥ *70*, B ≥ *45*, C below.

## Priority
Priority score = ACI × severity factor (*Danger 1.0, Alert 0.6*).
**Any Danger is P1.** Otherwise P1 ≥ *70*, P2 ≥ *45*, P3 below.
Due date = record date + response time (*P1 7 days, P2 30, P3 60*). Overdue = open after due date.

## Management KPIs
| KPI | Definition | Target (Lists) |
|---|---|---|
| Asset Health Index (AHI) | Σ(ACI × condition score) ÷ Σ ACI over all active assets. Condition score *OK 100, Alert 60, Danger 20, Unknown 50* | ≥ 85 |
| Critical assets in Danger | Class A assets with status Danger | 0 |
| Inspection schedule compliance | Completed ÷ planned inspections in the month (Schedule sheet) | ≥ 95% |
| Recommendations closed on time | Closed on or before due date ÷ all closed, last 12 months | ≥ 85% |
| Overdue recommendations | Open recommendations past due date | ≤ 2 |
| Statutory certificates valid | Certificates not expired; Alert if expiring within *60 days* | 100% |
| CM return on investment | Net cost avoided YTD ÷ programme cost YTD. Net avoided = avoided failure cost − planned repair cost (CM_Value sheet, approved entries only) | ≥ 4 : 1 |
| Critical assets inspected within interval | Class A assets whose last inspection is within the class A interval | ≥ 90% |
| Open recommendations with a work order | Open recommendations carrying a Pronto WO number | 100% |
| Prestart compliance | Prestarts completed ÷ shifts operated (Prestart sheet) | ≥ 95% |

## Reliability
* **Failures, MTBF, MTTR, availability:** from Events rows of type *Failure* in the 12 months to D. MTBF = (8,760 h − downtime) ÷ failures; MTTR = downtime ÷ failures; availability = (8,760 − downtime) ÷ 8,760.
* **Bad actor:** 2 or more failures in 12 months. Each should carry an RCA reference.

## Integrity (thickness)
* Minimum thickness = the Danger limit of the latest reading.
* Long-term rate = (first − last) ÷ years between them. Short-term rate = (previous − last) ÷ years. Governing rate = the greater (API 570 / 653 practice).
* Remaining life = (last − minimum) ÷ governing rate. Below minimum = Danger.
* Remaining life ≤ 1 year = Danger, ≤ 3 years = Alert (`config.js`).
* Next UT inspection = last date + lesser of half remaining life and 5 years.
* A short-term rate above 1.5 × the long-term rate is flagged: corrosion is accelerating.

## Fleet
* **Tagged out:** a unit with any open Danger record (prestart, fleet inspection or oil). It stays tagged out until the record is closed and verified.
* **Fleet availability:** units not tagged out ÷ fleet size.

## Reference thresholds used in the sample data
Vibration ISO 20816-3 zone boundaries 4.5 / 7.1 mm/s RMS. Electrical IR ΔT per NETA MTS similar-component comparison (> 4 °C deficiency, > 15 °C major). Oil analysis limits per laboratory and OEM. Site-specific limits should replace these where agreed.

## Management page logic
* **Analyst commentary** (Commentary sheet): what changed, why, what we are doing. The import drafts it from the data; the analyst edits it before presenting.
* **KPI tiles** appear only when their data exists. Missing sources are listed as "Not yet tracked".
* **Needs management attention:** when no decision is logged for the month, escalations are generated automatically: P1 findings overdue by more than 7 days; critical assets in Danger without a WO; critical inspection coverage below target; backlog above 5 × the overdue target; statutory certificates expiring within 30 days.
* **Integrity** and **Fleet** tabs are hidden until the workbook contains data for them.

## Risk (ISO 31000, site 5x5 matrix)
* **Consequence (1-5)** per asset, worst credible across seven categories (Risk_Consequence): safety, health and radiation (ICRP 103 / IAEA GSR Part 3 dose criteria, chemical exposure), environment, production, financial, regulatory and legal (incl. nuclear security and safeguards of uranium concentrate), community and reputation.
* Default = higher of the Safety & environment and Production criticality factors, raised to the **service floor** (Consequence_Floors) for equipment that holds or moves the fluid: 4 sulphuric acid, hydrogen peroxide and all dry uranium product handling; 3 eluate, uranium precipitate, acidic leach slurry, caustic; 2 other slurries and reagents.
* **Consequence basis** records why. A basis that does not start with "Default" (e.g. "Criticality workshop 2026-11") is kept on every import; defaults are recalculated.
* **Likelihood (1-5)** from condition: OK = 1, Unknown = 2, Alert = 3, Danger = 4; an open finding's *Likelihood override* raises it (5 = active loss of containment or through-wall).
* **Rating** (Risk_Rating): Extreme >= 20, High >= 12, Medium >= 5, Low < 5, each with its required response and the **authority to accept** the risk (General Manager, Engineering Manager, Area Superintendent, Supervisor).
* Likelihood levels carry a frequency guide (Risk_Likelihood) for manual risk assessments.

## Strategy compliance (ISO 17359 / RCM)
* Each asset has a **Strategy class**; the Strategy_Library lists its tasks (technique, interval by criticality class A/B/C).
* A task is compliant when a record of that technique exists within its interval. Tasks marked *Tracked in AHIM = N* (operator rounds) are excluded.
* Compliance = compliant tasks / required tasks, by asset, class, technique and criticality.

## Maintenance performance (SMRP)
* From the WO_Summary sheet (Pronto export, per month and work type).
* PM completion = completed / total Preventative Maintenance WOs in the month (target >= 90%).
* Reactive work = Breakdown WOs / all WOs (target < 10%). Corrective work raised from CM findings is planned work.

## Coding of findings
* ISO 14224 failure mode and mechanism on every Alert/Danger finding (site failure-mode text is mapped in Failure_Codes).
* API 571 damage mechanism on static-equipment findings and UT readings.
* Execution window: Online, Unit isolation or Plant shutdown; isolation and shutdown items form the shutdown scope on the Integrity page.
