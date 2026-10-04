/* AHIM dashboard configuration.
   Change dataUrl if the workbook lives elsewhere (for example a SharePoint or intranet path). */
window.AHIM = window.AHIM || {};
AHIM.config = {
  siteName: 'Lotus Africa Uranium Plant',
  unitName: 'Asset Health & Integrity Management',
  dataUrl: 'AHIM_Data.xlsx',
  refreshMinutes: 5,            // re-read the workbook automatically while the page is open
  headerRow: 4,                 // row holding column headers on every data sheet
  currency: 'USD',
  sheets: {
    register: 'Asset_Register', records: 'Records', lists: 'Lists', events: 'Events',
    schedule: 'Schedule', value: 'CM_Value', cost: 'Programme_Cost', decisions: 'Decisions', prestart: 'Prestart', commentary: 'Commentary'
  },
  fleetArea: 'Mobile fleet',
  integrity: {                  // remaining-life rules (API 570 / 653 practice)
    maxIntervalYears: 5,        // next thickness inspection: lesser of half remaining life and this
    dangerYears: 1, alertYears: 3,
    baselineRepeatYears: 1      // after a first (baseline) survey, re-measure within this time to get a corrosion rate
  },
  coverageDays: 90              // a critical asset counts as covered if inspected within this window
};
