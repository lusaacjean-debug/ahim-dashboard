# AHIM data dictionary

Every sheet has a title in rows 1–2 and **column headers in row 4**. Data starts in row 5. Do not rename headers: the dashboard finds columns by name.

## Asset_Register (required)
| Column | Required | Notes |
|---|---|---|
| Pronto asset no. | Yes | Unique key, exactly as in Pronto |
| Site tag | Yes | Field name, e.g. AP-P-101 |
| Description, Area, System / location, Asset class | Yes | Area and class from Lists |
| Manufacturer, Model, Serial no. | No | |
| Operating mode, Asset state | Yes | Decommissioned assets are hidden |
| 5 criticality factors (1–5) | Yes | Agree in a criticality workshop |
| Technique columns | Yes | Y where the technique applies |
| Statutory cert. required, Certificate expiry | If statutory | Expiry drives the statutory register |
| Responsible | Yes | Department |
Grey columns (ACI, Class, Current status, Open records, Days to expiry, Statutory status) are Excel formulas for use inside the workbook. The dashboard recalculates them itself.

## Records (required): one row per reading, defect or certificate check
| Column | Required | Notes |
|---|---|---|
| Date | Yes | Date of inspection |
| Pronto asset no. | Yes | Dropdown from the register |
| Source (input) | Yes | Which report or checklist (Lists) |
| Technique | Yes | Discipline (Lists) |
| Component / parameter / checklist item | Yes | Keep names identical month to month so trends join up |
| Value, Unit, Alert limit, Danger limit, Limit direction | Measured rows | Status calculated from these |
| Inspector status | Checklist rows | OK / Alert / Danger; overrides calculation if filled |
| Finding, Recommendation | Alert / Danger | |
| Pronto WO no. | When raised | |
| Record stage | Yes | No action, Raised, WO raised, Scheduled, Awaiting verification, Closed |
| Inspector | Yes | |
| Date closed, Verified by | When closed | Close only after a re-check confirms the fix |

## Events (Pronto history)
Date · Pronto asset no. · Event type (Failure, Repair, PM, Shutdown) · Description · Downtime (h) (Failure rows) · Pronto WO no. · RCA reference.

## Schedule
Month (first day of month) · Technique · Planned · Completed.

## CM_Value
Date · Pronto asset no. · Technique · Detection / failure avoided · Avoided failure cost (USD) · Planned repair cost (USD) · Approved by. Enter only approved estimates.

## Programme_Cost
Month · any cost columns (Labour, Lab & consumables, Contractors, Equipment…). All numeric columns are summed.

## Decisions
Date raised · Decision required · Reason · Owner · Status (Open, Approved, Rejected, Closed). Open and Approved items show on the Management page.

## Prestart
Month · Pronto asset no. · Shifts operated · Prestarts completed. Defects found on prestarts go to Records (source "LV/HV prestart checklist").

## Lists
Dropdown lists (columns A–J) and settings tables (column L onward): ACI factor weights, priority bands, severity factors, class limits, statutory window, condition scores, KPI targets. The dashboard finds each table by its header text.
