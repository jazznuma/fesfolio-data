// グローバル変数
let stageCount = 0;
let timetableCount = 0;
let defaultStageId = '';
let defaultType = 'live';

// 初期化
document.addEventListener('DOMContentLoaded', function() {
  // 初期ステージを追加
  addStage();
  addTimetableEntry();
  
  // 日付のデフォルト値を今日に設定
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('eventDate').value = today;
});

// ステージ追加
function addStage() {
  stageCount++;
  const container = document.getElementById('stagesContainer');
  const stageDiv = document.createElement('div');
  stageDiv.className = 'stage-entry';
  stageDiv.id = `stage-${stageCount}`;
  
  stageDiv.innerHTML = `
    <div class="entry-header">
      <span class="entry-number">ステージ ${stageCount}</span>
      <button type="button" class="btn-remove" onclick="removeStage(${stageCount})">削除</button>
    </div>
    <div class="form-group">
      <label>ステージID *</label>
      <input type="text" class="stage-id" placeholder="例: main, sub1, goods_a" required>
    </div>
    <div class="form-group">
      <label>ステージ名 *</label>
      <input type="text" class="stage-name" placeholder="例: メインステージ" required>
    </div>
    <div class="form-group">
      <label>説明</label>
      <input type="text" class="stage-description" placeholder="ステージの説明（任意）">
    </div>
  `;
  
  container.appendChild(stageDiv);
  updateStageSelects();
}

// ステージ削除
function removeStage(id) {
  const element = document.getElementById(`stage-${id}`);
  if (element) {
    element.remove();
    updateStageSelects();
  }
}

// ステージセレクトボックスを更新
function updateStageSelects() {
  const stages = getStages();
  const selects = [
    document.getElementById('defaultStage'),
    document.getElementById('bulkStageId')
  ];
  
  selects.forEach(select => {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- 選択 --</option>';
    stages.forEach(stage => {
      const option = document.createElement('option');
      option.value = stage.stage_id;
      option.textContent = stage.stage_name;
      select.appendChild(option);
    });
    select.value = currentValue;
  });
  
  // 最初のステージをデフォルトに設定
  if (stages.length > 0 && !defaultStageId) {
    defaultStageId = stages[0].stage_id;
    const defaultSelect = document.getElementById('defaultStage');
    if (defaultSelect) {
      defaultSelect.value = defaultStageId;
    }
  }
}

// デフォルト値を更新
function updateDefaultValues() {
  defaultStageId = document.getElementById('defaultStage').value;
  defaultType = document.getElementById('defaultType').value;
}

// タイムテーブルエントリー追加
function addTimetableEntry(data = {}) {
  timetableCount++;
  const container = document.getElementById('timetableContainer');
  const entryDiv = document.createElement('div');
  entryDiv.className = 'timetable-entry';
  entryDiv.id = `timetable-${timetableCount}`;
  
  // デフォルト値を使用（データがない場合）
  const stageId = data.stage_id || defaultStageId;
  const type = data.type || defaultType;
  
  entryDiv.innerHTML = `
    <input type="hidden" class="tt-stage" value="${stageId}">
    <input type="hidden" class="tt-type" value="${type}">
    <div class="entry-row">
      <span class="entry-num">${timetableCount}</span>
      <input type="time" class="tt-start" value="${data.start || ''}" step="300" required>
      <span class="time-separator">〜</span>
      <input type="time" class="tt-end" value="${data.end || ''}" step="300" required>
      <input type="text" class="tt-act" value="${data.act || ''}" placeholder="出演者名" required>
      <input type="text" class="tt-description" value="${data.description || ''}" placeholder="説明">
      <input type="text" class="tt-emoji" value="${data.emoji || ''}" placeholder="🎤" maxlength="2">
      <button type="button" class="btn-remove-icon" onclick="removeTimetable(${timetableCount})" title="削除">×</button>
    </div>
  `;
  
  container.appendChild(entryDiv);
}

// タイムテーブル削除
function removeTimetable(id) {
  const element = document.getElementById(`timetable-${id}`);
  if (element) {
    element.remove();
  }
}

// タブ切り替え
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  if (tab === 'manual') {
    document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
    document.getElementById('manualTab').classList.add('active');
  } else {
    document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
    document.getElementById('bulkTab').classList.add('active');
  }
}

// 一括入力をパース
function parseBulkInput() {
  const text = document.getElementById('bulkInput').value;
  const stageId = document.getElementById('bulkStageId').value;
  const type = document.getElementById('bulkType').value;
  
  if (!stageId) {
    alert('ステージを選択してください');
    return;
  }
  
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  let addedCount = 0;
  
  lines.forEach(line => {
    // パターン: "10:10〜10:30　セレインノート"
    const match = line.match(/(\d{1,2}):(\d{2})[〜~-]+(\d{1,2}):(\d{2})[\s　]+(.+)/);
    if (match) {
      const start = `${match[1].padStart(2, '0')}:${match[2]}`;
      const end = `${match[3].padStart(2, '0')}:${match[4]}`;
      const act = match[5].trim();
      
      addTimetableEntry({
        start: start,
        end: end,
        act: act,
        stage_id: stageId,
        type: type
      });
      addedCount++;
    }
  });
  
  if (addedCount > 0) {
    alert(`${addedCount}件のエントリーを追加しました`);
    document.getElementById('bulkInput').value = '';
    switchTab('manual');
  } else {
    alert('解析できる行がありませんでした。\n形式: "10:10〜10:30　アーティスト名"');
  }
}

// ステージ情報取得
function getStages() {
  const stages = [];
  document.querySelectorAll('.stage-entry').forEach(entry => {
    const stageId = entry.querySelector('.stage-id').value.trim();
    const stageName = entry.querySelector('.stage-name').value.trim();
    const stageDescription = entry.querySelector('.stage-description').value.trim();
    
    if (stageId && stageName) {
      const stage = {
        stage_id: stageId,
        stage_name: stageName
      };
      if (stageDescription) {
        stage.stage_description = stageDescription;
      }
      stages.push(stage);
    }
  });
  return stages;
}

// タイムテーブル情報取得
function getTimetable() {
  const timetable = [];
  document.querySelectorAll('.timetable-entry').forEach(entry => {
    const start = entry.querySelector('.tt-start').value.trim();
    const end = entry.querySelector('.tt-end').value.trim();
    const act = entry.querySelector('.tt-act').value.trim();
    const stageId = entry.querySelector('.tt-stage').value;
    const type = entry.querySelector('.tt-type').value;
    const description = entry.querySelector('.tt-description').value.trim();
    const emoji = entry.querySelector('.tt-emoji').value.trim();
    
    if (start && end && act && stageId && type) {
      // HH:MM形式に正規化
      const normalizeTime = (time) => {
        const match = time.match(/^(\d{1,2}):(\d{2})$/);
        if (match) {
          return `${match[1].padStart(2, '0')}:${match[2]}`;
        }
        return time;
      };
      
      const item = {
        type: type,
        stage_id: stageId,
        start: normalizeTime(start),
        end: normalizeTime(end),
        act: act
      };
      if (description) item.description = description;
      if (emoji) item.emoji = emoji;
      timetable.push(item);
    }
  });
  return timetable;
}

// JSON生成
function generateJSON() {
  const eventName = document.getElementById('eventName').value.trim();
  const eventDate = document.getElementById('eventDate').value;
  const venue = document.getElementById('venue').value.trim();
  const openTime = document.getElementById('openTime').value;
  const startTime = document.getElementById('startTime').value;
  const officialUrl = document.getElementById('officialUrl').value.trim();
  const ticketUrl = document.getElementById('ticketUrl').value.trim();
  const description = document.getElementById('description').value.trim();
  
  // バリデーション
  if (!eventName || !eventDate || !venue) {
    alert('必須項目を入力してください（イベント名、開催日、会場名）');
    return;
  }
  
  const stages = getStages();
  if (stages.length === 0) {
    alert('少なくとも1つのステージを追加してください');
    return;
  }
  
  const timetable = getTimetable();
  if (timetable.length === 0) {
    alert('少なくとも1つのタイムテーブルエントリーを追加してください');
    return;
  }
  
  // event_id生成（カテゴリは"i"固定、スラッグは自動生成）
  const slug = eventName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  const eventId = `${eventDate}_i_${slug}`;
  
  // JSONオブジェクト構築
  const eventData = {
    event_id: eventId,
    event_name: eventName,
    date: eventDate,
    venue: venue
  };
  
  if (openTime) eventData.open_time = openTime;
  if (startTime) eventData.start_time = startTime;
  if (ticketUrl) eventData.ticket_url = ticketUrl;
  
  eventData.stages = stages;
  eventData.timetable = timetable;
  
  if (description) eventData.description = description;
  if (officialUrl) eventData.official_url = officialUrl;
  
  // プレビュー表示
  const jsonString = JSON.stringify(eventData, null, 2);
  document.getElementById('jsonOutput').textContent = jsonString;
  document.getElementById('downloadBtn').style.display = 'inline-block';
  
  // プレビュー位置までスクロール
  document.getElementById('jsonOutput').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// JSONダウンロード
function downloadJSON() {
  const jsonText = document.getElementById('jsonOutput').textContent;
  if (!jsonText) {
    alert('先にJSONを生成してください');
    return;
  }
  
  const eventData = JSON.parse(jsonText);
  const filename = `${eventData.event_id}.json`;
  
  const blob = new Blob([jsonText], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  alert(`${filename} をダウンロードしました`);
}
