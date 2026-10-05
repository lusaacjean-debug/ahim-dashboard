/* App shell: loading, navigation, filters, auto-refresh. */
(function () {
  const U = AHIM.ui, C = AHIM.calc, CFG = AHIM.config;
  const PAGES = [['management', 'Overview', 'Strategic'], ['outcomes', 'Outcomes', 'Strategic'], ['finance', 'Finance', 'Strategic'], ['risk', 'Risk', 'Strategic'],
    ['work', 'Work management', 'Tactical'], ['reliability', 'Reliability', 'Tactical'], ['strategy', 'Strategy', 'Tactical'], ['integrity', 'Integrity', 'Tactical'], ['health', 'Plant health', 'Tactical'],
    ['field', 'Field', 'Operational'], ['fleet', 'Fleet', 'Operational'], ['governance', 'Actions & RCA', 'Governance'], ['kpitree', 'KPI tree', 'Governance']];
  const AREA_PAGES = ['risk', 'health', 'reliability', 'strategy', 'integrity', 'work', 'field'];
  const state = { page: (location.hash || '#management').slice(1), area: 'All', month: null, asset: null, param: null, source: '', loadedAt: null };
  let model = null;
  const $ = id => document.getElementById(id);

  function setStatus(msg, bad) { const el = $('loadStatus'); el.textContent = msg; el.className = 'loadstatus' + (bad ? ' bad' : ''); }

  function use(m, sourceLabel) {
    model = C.prepare(m); state.source = sourceLabel; state.loadedAt = new Date();
    const months = []; for (let t = C.monthStart(model.minDate); t <= C.monthStart(model.maxDate); t = C.addMonths(t, 1)) months.push(t);
    if (!months.includes(state.month)) state.month = months[months.length - 1];
    $('period').innerHTML = months.map(t => `<option value="${t}" ${t === state.month ? 'selected' : ''}>${U.fmtMonth(t)}</option>`).join('');
    const areas = ['All', ...new Set(model.assets.map(a => a.area).filter(a => a && a !== CFG.fleetArea))];
    if (model.assets.some(a => a.area === CFG.fleetArea)) areas.push(CFG.fleetArea);
    if (!areas.includes(state.area)) state.area = 'All';
    $('areas').innerHTML = '<span>Area</span>' + areas.map(a => `<button class="chip" aria-pressed="${a === state.area}" data-area="${U.esc(a)}">${U.esc(a)}</button>`).join('');
    const INTEG = ['Statutory', 'Tank & vessel', 'Piping', 'Structural', 'Ultrasonic thickness'];
    const has = {
      integrity: model.assets.some(a => a.certExpiry != null || a.statReq) || model.records.some(r => INTEG.includes(r.tech)),
      fleet: model.assets.some(a => a.area === CFG.fleetArea),
      strategy: model.strategy.length > 0,
      outcomes: model.production.length > 0, finance: model.costs.length > 0, work: model.wo.length > 0,
      field: model.routes.length > 0, governance: (model.actions.length + model.rca.length + model.decisions.length) > 0, kpitree: model.kpiTree.length > 0
    };
    state.pages = PAGES.filter(([k]) => has[k] !== false);
    const groups = [...new Set(state.pages.map(p => p[2]))];
    $('tabs').innerHTML = groups.map(g => `<div class="tgroup"><span class="tg-l">${g}</span>${state.pages.filter(p => p[2] === g).map(([k, l]) => `<button class="tab" role="tab" id="tab-${k}" data-page="${k}">${l}</button>`).join('')}</div>`).join('');
    const w = [...model.warnings, ...(model.unknownAssets.length ? ['Records reference assets not in the register: ' + model.unknownAssets.join(', ')] : [])];
    $('warnings').innerHTML = w.length ? `<div class="warnbox"><b>Data check:</b> ${w.map(U.esc).join(' · ')}</div>` : '';
    setStatus(`Data: ${sourceLabel} · read ${state.loadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    render();
  }

  function getCtx(area) {
    const today = Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const D = Math.min(C.monthEnd(state.month), Math.max(today, model.maxDate));
    const ar = area || state.area;
    const assets = ar === 'All' ? model.assets.filter(a => a.area !== CFG.fleetArea) : model.assets.filter(a => a.area === ar);
    return { m: model, D, month: state.month, area: ar, assets, state };
  }
  function render() {
    if (!model) return;
    const ctx = getCtx(state.area), D = ctx.D, assets = ctx.assets;
    const pages = state.pages || PAGES;
    if (!pages.some(p => p[0] === state.page)) state.page = 'management';
    pages.forEach(([k]) => { const t = $('tab-' + k); if (t) t.setAttribute('aria-selected', k === state.page); });
    $('areas').style.visibility = AREA_PAGES.includes(state.page) ? 'visible' : 'hidden';
    $('asof').textContent = 'Status as of ' + U.fmt(D);
    const title = PAGES.find(p => p[0] === state.page)[1];
    try {
      $('page').innerHTML = `<div class="page-title"><h2>${title}</h2>${state.area !== 'All' && AREA_PAGES.includes(state.page) ? `<p>${U.esc(state.area)}</p>` : ''}</div>` + AHIM.pages[state.page](ctx);
    } catch (e) { console.error(e); $('page').innerHTML = `<div class="warnbox"><b>This page could not be drawn:</b> ${U.esc(e.message)}</div>`; }
    const as = $('assetSel'); if (as) as.onchange = e => { state.asset = e.target.value; state.param = null; render(); };
    const rs = $('routeSel'); if (rs) rs.onchange = e => { state.route = e.target.value; render(); };
    const sc = $('stClassSel'); if (sc) sc.onchange = e => { state.stClass = e.target.value; render(); };
    const at = $('aciToggle'); if (at) at.onclick = () => { state.aciAll = !state.aciAll; render(); };
    const ps = $('paramSel'); if (ps) ps.onchange = e => { state.param = e.target.value; render(); };
  }

  function openAsset(id) {
    state.asset = id; state.param = null;
    const a = model.byId[id];
    if (a) { const inView = state.area === 'All' ? a.area !== CFG.fleetArea : a.area === state.area; if (!inView) state.area = a.area === CFG.fleetArea ? CFG.fleetArea : 'All'; syncChips(); }
    go('reliability'); setTimeout(() => { const h = $('history'); if (h) h.scrollIntoView({ behavior: 'smooth' }); }, 30);
  }
  function syncChips() { document.querySelectorAll('#areas .chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.area === state.area)); }
  function go(p) { state.page = p; history.replaceState(null, '', '#' + p); render(); window.scrollTo(0, 0); }

  async function fetchData(quiet) {
    try {
      if (!quiet) setStatus('Reading workbook…');
      const r = await fetch(CFG.dataUrl + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      use(AHIM.data.fromArrayBuffer(await r.arrayBuffer()), CFG.dataUrl);
      return true;
    } catch (e) {
      if (!quiet) { setStatus('Could not read ' + CFG.dataUrl + '. Use "Open workbook" to load it from your computer.', true); $('page').innerHTML = `<div class="block s12 empty-state"><h3>No data loaded</h3><p>The dashboard reads <b>${U.esc(CFG.dataUrl)}</b>. If you opened this file directly from disk, or the workbook is elsewhere, choose <b>Open workbook</b> above and select your AHIM_Data.xlsx. Nothing is uploaded: the file is read inside your browser.</p></div>`; }
      return false;
    }
  }

  function init() {
    $('tabs').onclick = e => { const b = e.target.closest('[data-page]'); if (b) go(b.dataset.page); };
    $('areas').onclick = e => { const b = e.target.closest('[data-area]'); if (b) { state.area = b.dataset.area; $('areas').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.area === state.area)); render(); } };
    $('period').onchange = e => { state.month = +e.target.value; render(); };
    $('fileIn').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { use(AHIM.data.fromArrayBuffer(await f.arrayBuffer()), f.name + ' (local file)'); state.local = true; } catch (err) { setStatus('Could not read ' + f.name + ': ' + err.message, true); } };
    document.addEventListener('click', e => { const r = e.target.closest('[data-asset]'); if (r && !e.target.closest('select')) openAsset(r.dataset.asset); });
    document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.asset) openAsset(e.target.dataset.asset); });
    if (AHIM.reports) AHIM.reports.init(area => getCtx(area));
    window.addEventListener('hashchange', () => { state.page = location.hash.slice(1) || 'management'; render(); });
    if (window.AHIM_EMBEDDED_DATA) { use(AHIM.data.fromBase64(window.AHIM_EMBEDDED_DATA), 'embedded snapshot ' + (window.AHIM_EMBEDDED_DATE || '')); return; }
    fetchData(false);
    if (CFG.refreshMinutes > 0) setInterval(() => { if (!state.local) fetchData(true); }, CFG.refreshMinutes * 60000);
  }
  AHIM.app = { init, state, render, getCtx, PAGES };
  document.addEventListener('DOMContentLoaded', init);
})();
