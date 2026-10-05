# AHIM input standard

Every number on the dashboard comes from one of these inputs. Each has one owner, one format and one key, and is merged automatically by `RUN_MONTHLY_UPDATE.bat` (rows with the same key are updated, never duplicated).

## Automatic inputs (no retyping)

| Input | Format | Feeds |
|---|---|---|
| CM Monthly Report workbook: **Data entry**, **Oil Analysis**, **Vibration Analysis**, **Criticality** | The existing workbook (repaired version, with *Date Closed* and *Verified By*) | Plant health, Risk, Reliability, Strategy, findings |
| CM Monthly Report workbook: **WO Data** (paste of the Pronto export) | Pronto saved report pasted into columns A:BK | **Work_Orders** → Work management, Outcomes (downtime), Finance (WO cost), Events |
| **UT_Register.xlsx** | Register maintained from contractor UT reports | Integrity: thickness, remaining life, UT findings |
| **Vessels…Inspection_Summary.xlsx** | Statutory external inspection summary | Integrity: statutory register, vessel findings |

### Pronto saved report "AHIM WO export" (ask the Pronto administrator to build it once)
Columns already used: Work Order, Work Description, Plant Item, Status, Work Type, Priority, Responsibility / Section, Est. Start Date, Required, Latest, Scheduled, Actual Finish Date, Estimated Hours, Actual Hours, Actual Down Time, Actual Cost, Fault Code 1.
**Add if possible:** WO *creation date* (gives true finding-to-WO time), *Plant item number* as a separate column (exact asset link: today only 15% of WOs link to an asset because Plant Item holds a name), *ISO 14224 failure code*, *Ready* flag.
**Data rule:** downtime hours and failure code are mandatory on every Breakdown and Corrective WO.

## Manual inputs: `AHIM_Inputs.xlsx` (template provided)

| Sheet | One row per | Owner | Frequency | Feeds |
|---|---|---|---|---|
| Production | month × circuit | Metallurgy / production report | Monthly | Outcomes: availability, downtime, lost production; Finance: cost per unit |
| Maint_Costs | month × area × category | Finance | Monthly | Finance: cost vs budget, cost / RAV |
| Labour | month × trade | Maintenance supervisors | Monthly | Work management: planned %, emergency %, overtime, crew-weeks |
| RCA | RCA | Reliability engineer | When raised, weekly update | Actions & RCA, bad actors, KPI tree |
| Actions | action | Action owners (reviewed in the CM meeting) | Weekly | Actions & RCA, overdue actions |
| Routes | route | RCM Specialist | Each route completion | Field: routes due, route sheets |
| KPI_Tree | KPI | Engineering Manager (approves) | Annual | KPI tree, Overview tiles |
| Work_Orders | work order | Planner | Only for flags | Ready / Needs shutdown flags, WOs not in Pronto |

Rules: do not rename sheets or headers; real Excel dates (Month = 1st of month); asset numbers must exist in the Asset_Register; Circuit/Area names must match the register areas; dropdown columns accept listed values only.

## In AHIM_Data.xlsx (kept on every import)
Asset_Register (criticality factors, consequence and basis, strategy class, service, **replacement value, install year, design life**), Commentary, Decisions, CM_Value, Programme_Cost, Lists (targets), risk matrix sheets, Strategy_Library.

## Path to full automation
1. Pronto saved report scheduled to e-mail or drop the export weekly into a SharePoint folder.
2. Production and cost figures from their existing monthly reports, copied into AHIM_Inputs (or linked).
3. Later: Microsoft 365 (SharePoint lists + Power Automate) replaces the Excel inputs and runs the import on a schedule.
