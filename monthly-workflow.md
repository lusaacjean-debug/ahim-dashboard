# AHIM monthly workflow

| When | Who | What |
|---|---|---|
| During the month | Input owners (RCM Specialist, electricians, DG operators, fleet mechanics, UT and statutory contractors) | Add a row to **Records** for every reading and every defect. Repeat readings of an issue already raised: stage *No action* |
| Daily (DG), per shift (prestart) | DG operators, supervisors | Enter only exceedances or defects in Records; prestart counts monthly in **Prestart** |
| Weekly | RCM Specialist | Review new Alert/Danger rows, raise Pronto WOs, update stages, chase overdue items (Reliability page) |
| Month end, day 1–2 | RCM Specialist | Paste the Pronto WO history into **Events**; update **Schedule**, **CM_Value**, **Programme_Cost**, **Decisions** |
| Month end, day 2 | RCM Specialist | Run `python scripts/validate_data.py`, fix errors, commit the workbook. Actions deploys and produces the offline snapshot |
| Month end, day 3 | Engineering Manager meeting | Present page 1 (Management). Agree decisions; record outcomes in **Decisions** |
| Quarterly | Reliability team | Review ACI factors, alarm limits and inspection frequencies; review bad actors and RCA progress |

Golden rules
1. One asset list (Pronto numbers), one record format, whatever the source.
2. Every Alert or Danger gets a recommendation, a WO and a due date.
3. Close only after verification: a re-check reading or a signed inspection.
4. Never overwrite history. New reading = new row.
