(() => {
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const summary = document.getElementById('summary');
  const validation = document.getElementById('validation');
  const timetable = document.getElementById('timetable');
  const timetableGrid = document.getElementById('timetableGrid');
  const stageFilter = document.getElementById('stageFilter');
  const searchInput = document.getElementById('searchInput');
  const resetChecksBtn = document.getElementById('resetChecks');

  let currentData = null;
  // In-memory state for this session (no persistence)
  const checkedListSet = new Set();  // List-only checks
  const checkedGridSet = new Set();  // Grid-only checks
  const ngSet = new Set();
  let ajv = null;

  function init() {
    // AJV init if available
    if (window.Ajv) {
      ajv = new Ajv({ allErrors: true, strict: false });
    }

    // File input
    fileInput.addEventListener('change', async (e) => {
      if (!e.target.files?.length) return;
      const file = e.target.files[0];
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        await handleData(json, file.name);
      } catch (err) {
        showValidation(false, `JSONの読み込みに失敗: ${err}`);
      }
    });

    // Drag & drop
    ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add('active');
    }));
    ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove('active');
    }));
    dropZone.addEventListener('drop', async (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        await handleData(json, file.name);
      } catch (err) {
        showValidation(false, `JSONの読み込みに失敗: ${err}`);
      }
    });

    // Filters
    stageFilter.addEventListener('change', () => renderTimetable());
    searchInput.addEventListener('input', () => renderTimetable());
    stageFilter.addEventListener('change', () => renderTimetableGrid());
    searchInput.addEventListener('input', () => renderTimetableGrid());


    // Reset checks (OK & NG)
    resetChecksBtn.addEventListener('click', () => {
      checkedListSet.clear();
      checkedGridSet.clear();
      ngSet.clear();
      renderTimetable();
      renderTimetableGrid();
    });
  }

  async function handleData(json, sourceName = '') {
    currentData = json;
  // Clear previous state when new data loads
  checkedListSet.clear();
  checkedGridSet.clear();
  ngSet.clear();

    // Schema validation
    if (ajv) {
      try {
        const schemaRes = await fetch('../schemas/event.schema.json');
        const schema = await schemaRes.json();
        const validate = ajv.compile(schema);
        const valid = validate(json);
        if (!valid) {
          const msg = validate.errors?.map(e => `• ${e.instancePath || '(root)'}: ${e.message}`).join('\n') || '不明なエラー';
          showValidation(false, `スキーマ検証NG:\n${msg}`);
        } else {
          showValidation(true, `スキーマ検証OK (${sourceName})`);
        }
      } catch (err) {
        showValidation(false, `スキーマ取得/検証に失敗: ${err}`);
      }
    }

    // Summary
    showSummary(json);

    // Filters setup
    setupStageFilter(json);

    // Render both; default: grid visible and list below
    renderTimetable();
    renderTimetableGrid();
    timetable.classList.remove('hidden');
    timetableGrid.classList.remove('hidden');
  }

  function showValidation(ok, message) {
    validation.classList.remove('hidden');
    validation.style.borderColor = ok ? '#8bc34a' : '#e53935';
    validation.textContent = message;
  }

  function showSummary(data) {
    const title = data.title || data.event_name || '(タイトル不明)';
    const date = data.date || data.event_date || data.start_date || '';
    const venue = data.venue || data.location || '';
    const stages = (data.stages || data.stage_list || []).length;
    const slots = countSlots(data);

    summary.classList.remove('hidden');
    summary.innerHTML = `
      <strong>${escapeHtml(title)}</strong><br/>
      日付: ${escapeHtml(date)} / 会場: ${escapeHtml(venue)}<br/>
      ステージ数: ${stages} / 枠数: ${slots}
    `;
  }

  function countSlots(data) {
    const stages = normalizeStages(data);
    return stages.reduce((acc, s) => acc + (s.slots?.length || 0), 0);
  }

  function setupStageFilter(data) {
    const stages = normalizeStages(data);
    stageFilter.innerHTML = '<option value="">(すべて)</option>' + stages.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
    document.getElementById('filters').classList.remove('hidden');
  }

  function renderTimetable() {
    timetable.innerHTML = '';
    if (!currentData) return;
    const stages = normalizeStages(currentData);
  // use in-memory sets
    const filter = stageFilter.value || '';
    const query = (searchInput.value || '').toLowerCase();

    const filteredStages = stages.filter(s => !filter || s.name === filter);

    filteredStages.forEach(stage => {
      const stageEl = document.createElement('div');
      stageEl.className = 'stage';

      const header = document.createElement('div');
      header.className = 'stage-header';
      header.textContent = stage.name || '(Stage)';
      stageEl.appendChild(header);

      (stage.slots || []).filter(slotMatchesQuery(query)).sort(sortByStartTime).forEach((slot, idx) => {
        const slotEl = document.createElement('div');
        slotEl.className = 'slot';
        const key = slotKey(stage.name, slot);
        const inList = checkedListSet.has(key);
        const inGrid = checkedGridSet.has(key);
        if (inList && inGrid) {
          slotEl.classList.add('checked-both');
        } else if (inList) {
          slotEl.classList.add('checked-list');
        }
        if (ngSet.has(key)) slotEl.classList.add('ng');

        const left = document.createElement('div');
        left.className = 'left';
        const performer = slot.performer || slot.artist || slot.name || '';
        const notes = slot.note || slot.notes || '';
        const start = formatTime(slot.start || slot.start_time);
        const end = formatTime(slot.end || slot.end_time);
        left.innerHTML = `
          <div class="time-row">${escapeHtml(start)} - ${escapeHtml(end)}</div>
          <div><span class="tag">${escapeHtml(slot.type || '出演')}</span> ${escapeHtml(performer)}</div>
          ${notes ? `<small>${escapeHtml(notes)}</small>` : ''}
        `;

        const right = document.createElement('div');
        right.className = 'right';
        
        // Grid OK badge
        if (checkedGridSet.has(key)) {
          const gridBadge = document.createElement('span');
          gridBadge.className = 'check-badge grid-ok';
          gridBadge.textContent = 'グリッドOK';
          right.appendChild(gridBadge);
        }
        
        // List OK badge
        if (checkedListSet.has(key)) {
          const listBadge = document.createElement('span');
          listBadge.className = 'check-badge list-ok';
          listBadge.textContent = 'リストOK';
          right.appendChild(listBadge);
        }
        
        const ngPill = document.createElement('span');
        ngPill.className = 'ng-pill' + (ngSet.has(key) ? ' active' : '');
        ngPill.title = 'NGチェック（クリックで切替）';
        ngPill.textContent = ngSet.has(key) ? 'NG ✓' : 'NG';
        ngPill.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const nowNg = !ngSet.has(key);
          toggleNg(key, nowNg);
          slotEl.classList.toggle('ng', nowNg);
          ngPill.classList.toggle('active', nowNg);
          ngPill.textContent = nowNg ? 'NG ✓' : 'NG';
        });
        right.appendChild(ngPill);

        slotEl.appendChild(left);
        slotEl.appendChild(right);
        slotEl.addEventListener('click', () => {
          const nowChecked = !checkedListSet.has(key);
          toggleCheckedList(key, nowChecked);
          // Re-render to update badges
          renderTimetable();
          renderTimetableGrid();
        });
        stageEl.appendChild(slotEl);
      });

      timetable.appendChild(stageEl);
    });
  }

  function renderTimetableGrid() {
  timetableGrid.innerHTML = '';
  timetableGrid.classList.remove('empty');
  if (!currentData) { timetableGrid.classList.add('empty'); timetableGrid.textContent = 'データがありません'; return; }
    const stages = normalizeStages(currentData);
    const filter = stageFilter.value || '';
    const filteredStages = stages.filter(s => !filter || s.name === filter);
  if (!filteredStages.length) { timetableGrid.classList.add('empty'); timetableGrid.textContent = '表示可能なステージがありません'; return; }
  // use in-memory sets

    // Compute global min/max minutes
    const allSlots = filteredStages.flatMap(s => s.slots || []);
    const times = allSlots.map(s => [parseTimeToMinutes(s.start), parseTimeToMinutes(s.end)]).flat().filter(v => Number.isFinite(v));
    if (!times.length) {
      timetableGrid.classList.add('empty');
      timetableGrid.textContent = '開始・終了時刻のある枠がありません（グリッドは時刻付きの枠のみ表示）';
      return;
    }
    let min = Math.min(...times);
    let max = Math.max(...times);
    // Snap to hour boundaries
    const snapDown = (m) => Math.floor(m / 60) * 60;
    const snapUp = (m) => Math.ceil(m / 60) * 60;
    min = snapDown(min);
    max = snapUp(max);
    const span = Math.max(60, max - min);

    // Header with hour stripes and labels
    const header = document.createElement('div');
    header.className = 'grid-header';
    const leftPad = document.createElement('div');
    leftPad.style.height = '32px';
    const hours = document.createElement('div');
    hours.className = 'grid-hours';
    const labels = document.createElement('div');
    labels.className = 'grid-hour-labels';
    for (let m = min; m <= max; m += 60) {
      const pct = ((m - min) / span) * 100;
      const lab = document.createElement('span');
      lab.style.left = pct + '%';
      lab.textContent = pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
      labels.appendChild(lab);
    }
    const hoursWrap = document.createElement('div');
    hoursWrap.style.position = 'relative';
    hoursWrap.appendChild(hours);
    hoursWrap.appendChild(labels);
    header.appendChild(leftPad);
    header.appendChild(hoursWrap);

    timetableGrid.appendChild(header);

    // Body rows per stage
    const body = document.createElement('div');
    body.className = 'grid-body';
    filteredStages.forEach(stage => {
      const nameCell = document.createElement('div');
      nameCell.className = 'grid-stage-name';
      nameCell.textContent = stage.name || '(Stage)';
      const row = document.createElement('div');
      row.className = 'grid-stage-row';

      (stage.slots || []).sort(sortByStartTime).forEach(slot => {
        const sMin = parseTimeToMinutes(slot.start);
        const eMin = parseTimeToMinutes(slot.end);
        if (!Number.isFinite(sMin) || !Number.isFinite(eMin)) return;
        const leftPct = ((sMin - min) / span) * 100;
        const widthPct = Math.max(2, ((eMin - sMin) / span) * 100); // min visible width
        const bar = document.createElement('div');
        bar.className = 'slot-bar';
        const key = slotKey(stage.name, slot);
        const inList = checkedListSet.has(key);
        const inGrid = checkedGridSet.has(key);
        if (inList && inGrid) {
          bar.classList.add('checked-both');
        } else if (inGrid) {
          bar.classList.add('checked-grid');
        }
        if (ngSet.has(key)) bar.classList.add('ng');
        bar.style.left = leftPct + '%';
        bar.style.width = widthPct + '%';
        const time = document.createElement('span');
        time.className = 'time';
        time.textContent = `${formatTime(slot.start)}-${formatTime(slot.end)}`;
        const name = document.createElement('span');
        name.className = 'name';
        const performer = slot.performer || slot.artist || slot.name || '';
        name.textContent = performer;
        const check = document.createElement('span');
        check.className = 'check';
        check.title = 'チェック';
        check.textContent = checkedGridSet.has(key) ? '✓' : '';
        bar.addEventListener('click', (e) => {
          // Toggle NG with Shift, otherwise toggle Grid check
          if (e.shiftKey) {
            const nowNg = !ngSet.has(key);
            toggleNg(key, nowNg);
          } else {
            const nowChecked = !checkedGridSet.has(key);
            toggleCheckedGrid(key, nowChecked);
          }
          renderTimetable();
          renderTimetableGrid();
        });
        bar.appendChild(time);
        bar.appendChild(check);
        bar.appendChild(name);
        row.appendChild(bar);
      });

      body.appendChild(nameCell);
      body.appendChild(row);
    });

    timetableGrid.appendChild(body);
    timetableGrid.classList.remove('hidden');
  }

  // --- Check state helpers (in-memory only) ---
  function slotKey(stageName, slot) {
    const s = stageName || '';
    const start = formatTime(slot.start || '');
    const end = formatTime(slot.end || '');
    const name = slot.performer || slot.artist || slot.name || '';
    return `${s}::${start}-${end}::${name}`;
  }
  function toggleCheckedList(key, checked) {
    if (checked) checkedListSet.add(key); else checkedListSet.delete(key);
  }
  function toggleCheckedGrid(key, checked) {
    if (checked) checkedGridSet.add(key); else checkedGridSet.delete(key);
  }

  // --- NG state helpers (in-memory only) ---
  function toggleNg(key, active) {
    if (active) ngSet.add(key); else ngSet.delete(key);
  }

  function slotMatchesQuery(query) {
    if (!query) return () => true;
    return (slot) => {
      const text = [slot.performer, slot.artist, slot.name, slot.note, slot.notes].filter(Boolean).join(' ').toLowerCase();
      return text.includes(query);
    };
  }

  function sortByStartTime(a, b) {
    const ta = parseTimeToMinutes(a.start || a.start_time);
    const tb = parseTimeToMinutes(b.start || b.start_time);
    return ta - tb;
  }

  function normalizeStages(data) {
    // Primary schema: stages[] + timetable[] flat entries with stage_id
    const stages = (data.stages || []).map(s => ({
      id: s.stage_id || s.id || s.name || s.stage_name || '',
      name: s.stage_name || s.name || s.id || 'Stage',
    }));
    const timetable = (data.timetable || data.slots || data.schedule || []).map(x => ({
      stage_id: x.stage_id || x.stage || x.stageId || '',
      type: x.type || x.kind || '',
      performer: x.act || x.performer || x.artist || x.name || '',
      start: x.start || x.start_time || x.time?.start || '',
      end: x.end || x.end_time || x.time?.end || '',
      note: x.description || x.note || x.notes || '',
    }));

    // Group timetable by stage_id using stages order; include stages even if empty
    const byStage = new Map();
    stages.forEach(s => byStage.set(s.id, []));
    timetable.forEach(item => {
      if (!byStage.has(item.stage_id)) byStage.set(item.stage_id, []);
      byStage.get(item.stage_id).push(item);
    });

    return stages.map(s => ({ name: s.name, slots: byStage.get(s.id) || [] }));
  }

  function formatTime(t) {
    if (!t) return '';
    // if numeric minutes
    if (typeof t === 'number') {
      const h = Math.floor(t / 60);
      const m = t % 60;
      return `${pad2(h)}:${pad2(m)}`;
    }
    // If "HH:MM" or "HH:MM:SS"
    const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m) return `${pad2(Number(m[1]))}:${m[2]}`;
    // Else try parse int
    const n = parseInt(t, 10);
    if (!Number.isNaN(n)) return formatTime(n);
    return String(t);
  }

  function parseTimeToMinutes(t) {
    if (!t && t !== 0) return Number.POSITIVE_INFINITY;
    if (typeof t === 'number') return t;
    const m = String(t).match(/^(\d{1,2}):(\d{2})/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    const n = parseInt(t, 10);
    return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
