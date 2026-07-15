(() => {
  'use strict';

  const ENTRY_KEY = 'bobmoney.entries.v1';
  const SETTINGS_KEY = 'bobmoney.settings.v1';
  const CATEGORIES = {
    '식사': '🍚',
    '배달·외식': '🥡',
    '카페·간식': '☕',
    '기타': '➕'
  };
  const $ = (selector) => document.querySelector(selector);
  const el = {
    monthPicker: $('#monthPicker'), previousMonthButton: $('#previousMonthButton'), nextMonthButton: $('#nextMonthButton'),
    monthSpent: $('#monthSpent'), monthlyBudget: $('#monthlyBudget'), monthRemaining: $('#monthRemaining'),
    monthProgress: $('#monthProgress'), progressTrack: $('.progress-track'), monthProgressCaption: $('#monthProgressCaption'),
    dailyAverage: $('#dailyAverage'), dailyAllowance: $('#dailyAllowance'), entryCount: $('#entryCount'),
    lastWeekSpent: $('#lastWeekSpent'), lastWeekGuide: $('#lastWeekGuide'), thisWeekSpent: $('#thisWeekSpent'),
    thisWeekGuide: $('#thisWeekGuide'), weeklyStatus: $('#weeklyStatus'), weeklyFeedbackMessage: $('#weeklyFeedbackMessage'),
    weeklyBars: $('#weeklyBars'), expenseForm: $('#expenseForm'), editingId: $('#editingId'), expenseDate: $('#expenseDate'),
    expenseAmount: $('#expenseAmount'), submitExpenseButton: $('#submitExpenseButton'), cancelEditButton: $('#cancelEditButton'),
    categoryFilter: $('#categoryFilter'), categorySummary: $('#categorySummary'), recordList: $('#recordList'), emptyState: $('#emptyState'),
    settingsDialog: $('#settingsDialog'), settingsForm: $('#settingsForm'), openSettingsButton: $('#openSettingsButton'),
    closeSettingsButton: $('#closeSettingsButton'), editBudgetButton: $('#editBudgetButton'), budgetInput: $('#budgetInput'),
    exportButton: $('#exportButton'), importInput: $('#importInput'), clearDataButton: $('#clearDataButton'), toast: $('#toast')
  };

  const load = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  let entries = load(ENTRY_KEY, []);
  let settings = { monthlyBudget: 600000, ...load(SETTINGS_KEY, {}) };
  let selectedMonth = monthValue(new Date());
  let toastTimer;

  function save() {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(entries));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  function won(value) { return `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`; }
  function dateValue(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function monthValue(date) { return dateValue(date).slice(0, 7); }
  function parseDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
  function weekStart(date) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
    return result;
  }
  function weekEnd(date) { return addDays(weekStart(date), 6); }
  function monthBounds(value) {
    const [year, month] = value.split('-').map(Number);
    return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0), days: new Date(year, month, 0).getDate() };
  }
  function monthEntries() { return entries.filter((entry) => entry.date.startsWith(selectedMonth)); }
  function sum(list) { return list.reduce((total, entry) => total + Number(entry.amount || 0), 0); }
  function between(start, end) {
    const from = dateValue(start), to = dateValue(end);
    return entries.filter((entry) => entry.date >= from && entry.date <= to && entry.date.startsWith(selectedMonth));
  }
  function overlapDays(aStart, aEnd, bStart, bEnd) {
    const start = aStart > bStart ? aStart : bStart;
    const end = aEnd < bEnd ? aEnd : bEnd;
    return start > end ? 0 : Math.floor((end - start) / 86400000) + 1;
  }
  function guide(start, bounds) {
    return settings.monthlyBudget * overlapDays(start, weekEnd(start), bounds.start, bounds.end) / bounds.days;
  }
  function referenceDate() {
    const today = new Date();
    return monthValue(today) === selectedMonth ? today : monthBounds(selectedMonth).end;
  }
  function normalize(entry) {
    return {
      id: String(entry.id), date: entry.date, amount: Math.round(Number(entry.amount)),
      category: CATEGORIES[entry.category] ? entry.category : '기타', createdAt: entry.createdAt || new Date().toISOString()
    };
  }
  function valid(entry) {
    return entry && entry.id != null && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number(entry.amount) > 0;
  }

  function render() {
    el.monthPicker.value = selectedMonth;
    renderSummary();
    renderFeedback();
    renderRecords();
  }
  function renderSummary() {
    const list = monthEntries(), spent = sum(list), remaining = settings.monthlyBudget - spent;
    const usage = settings.monthlyBudget ? spent / settings.monthlyBudget * 100 : 0;
    const bounds = monthBounds(selectedMonth), today = new Date(), current = selectedMonth === monthValue(today);
    const elapsed = current ? Math.max(1, today.getDate()) : bounds.days;
    const daysLeft = current ? Math.max(1, bounds.days - today.getDate() + 1) : bounds.days;

    el.monthSpent.textContent = won(spent);
    el.monthlyBudget.textContent = won(settings.monthlyBudget);
    el.monthRemaining.textContent = remaining >= 0 ? won(remaining) : `${won(-remaining)} 초과`;
    el.dailyAverage.textContent = won(spent / elapsed);
    el.dailyAllowance.textContent = won(Math.max(0, remaining) / daysLeft);
    el.entryCount.textContent = `${list.length}건`;
    el.monthProgress.style.width = `${Math.min(100, Math.max(0, usage))}%`;
    el.monthProgress.classList.toggle('warning', usage >= 85 && usage <= 100);
    el.monthProgress.classList.toggle('over', usage > 100);
    el.progressTrack.setAttribute('aria-valuenow', String(Math.round(Math.min(100, usage))));
    el.monthProgressCaption.textContent = usage > 100 ? `예산을 ${won(spent - settings.monthlyBudget)} 초과했어요.` : `예산의 ${Math.round(usage)}%를 사용했어요.`;
  }
  function renderFeedback() {
    const bounds = monthBounds(selectedMonth), currentStart = weekStart(referenceDate()), lastStart = addDays(currentStart, -7);
    const currentSpent = sum(between(currentStart, weekEnd(currentStart))), lastSpent = sum(between(lastStart, weekEnd(lastStart)));
    const currentGuide = guide(currentStart, bounds), lastGuide = guide(lastStart, bounds), ratio = currentGuide ? currentSpent / currentGuide : 0;

    el.thisWeekSpent.textContent = won(currentSpent); el.thisWeekGuide.textContent = `가이드 ${won(currentGuide)}`;
    el.lastWeekSpent.textContent = won(lastSpent); el.lastWeekGuide.textContent = `가이드 ${won(lastGuide)}`;
    el.weeklyStatus.className = 'status-chip';

    if (!monthEntries().length) {
      el.weeklyStatus.textContent = '기록 대기';
      el.weeklyFeedbackMessage.textContent = '식비를 기록하면 지난주와 이번 주를 비교해 조절할 포인트를 알려드려요.';
    } else if (ratio > 1.1) {
      el.weeklyStatus.textContent = '조절 필요'; el.weeklyStatus.classList.add('over');
      el.weeklyFeedbackMessage.textContent = `이번 주 가이드보다 ${won(currentSpent - currentGuide)} 많이 썼어요. 다음 주에는 배달·외식이나 카페·간식 지출을 한 번만 줄여보세요.`;
    } else if (ratio >= 0.85) {
      el.weeklyStatus.textContent = '계획대로'; el.weeklyStatus.classList.add('warning');
      el.weeklyFeedbackMessage.textContent = '이번 주는 계획 범위에 있어요. 남은 기간에도 지금 속도를 유지하면 됩니다.';
    } else {
      el.weeklyStatus.textContent = '여유 있음';
      el.weeklyFeedbackMessage.textContent = `이번 주는 가이드보다 ${won(Math.max(0, currentGuide - currentSpent))} 적게 쓰고 있어요. 무리해서 더 아끼기보다 지금 흐름을 유지하세요.`;
    }
    if (lastGuide > 0 && lastSpent > lastGuide && currentSpent <= currentGuide) {
      el.weeklyFeedbackMessage.textContent = `지난주 초과분을 이번 주에 잘 조절하고 있어요. 현재까지 가이드 안에서 ${won(currentGuide - currentSpent)}의 여유가 있습니다.`;
    }
    renderBars(bounds);
  }
  function renderBars(bounds) {
    const weeks = [];
    for (let cursor = weekStart(bounds.start); cursor <= bounds.end; cursor = addDays(cursor, 7)) {
      weeks.push({ spent: sum(between(cursor, weekEnd(cursor))), guide: guide(cursor, bounds) });
    }
    const maximum = Math.max(settings.monthlyBudget / 4, ...weeks.flatMap((week) => [week.spent, week.guide]), 1);
    el.weeklyBars.innerHTML = '';
    weeks.forEach((week, index) => {
      const column = document.createElement('div'), track = document.createElement('div'), fill = document.createElement('div'), label = document.createElement('span');
      column.className = 'week-bar-column'; column.title = `${index + 1}주차: ${won(week.spent)} / 가이드 ${won(week.guide)}`;
      track.className = 'week-bar-track'; fill.className = 'week-bar-fill'; label.className = 'week-bar-label';
      if (week.spent > week.guide * 1.1) fill.classList.add('over');
      fill.style.height = `${Math.max(3, week.spent / maximum * 100)}%`; label.textContent = `${index + 1}주`;
      track.append(fill); column.append(track, label); el.weeklyBars.append(column);
    });
  }
  function renderRecords() {
    const list = monthEntries(), filter = el.categoryFilter.value;
    const visible = list.filter((entry) => filter === '전체' || entry.category === filter)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    el.categorySummary.innerHTML = Object.keys(CATEGORIES).map((category) =>
      `<span class="category-pill">${CATEGORIES[category]} ${category} <strong>${won(sum(list.filter((entry) => entry.category === category)))}</strong></span>`
    ).join('');
    el.recordList.innerHTML = ''; el.emptyState.classList.toggle('hidden', visible.length > 0);
    visible.forEach((entry) => {
      const item = document.createElement('article'); item.className = 'record-item';
      const icon = document.createElement('div'); icon.className = 'record-icon'; icon.textContent = CATEGORIES[entry.category] || '➕';
      const main = document.createElement('div'); main.className = 'record-main';
      const title = document.createElement('strong'); title.textContent = entry.category;
      const details = document.createElement('span'); details.textContent = new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }).format(parseDate(entry.date));
      main.append(title, details);
      const amount = document.createElement('div'); amount.className = 'record-amount';
      const amountText = document.createElement('strong'); amountText.textContent = won(entry.amount);
      const actions = document.createElement('div'); actions.className = 'record-actions';
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = '수정'; edit.onclick = () => startEdit(entry.id);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete'; remove.textContent = '삭제'; remove.onclick = () => deleteEntry(entry.id);
      actions.append(edit, remove); amount.append(amountText, actions); item.append(icon, main, amount); el.recordList.append(item);
    });
  }

  function radio(name, value) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((input) => { input.checked = input.value === value; });
  }
  function resetForm() {
    el.expenseForm.reset(); el.editingId.value = ''; el.expenseDate.value = dateValue(new Date()); radio('category', '식사');
    el.submitExpenseButton.textContent = '식비 기록하기'; el.cancelEditButton.classList.add('hidden');
  }
  function submitExpense(event) {
    event.preventDefault();
    const data = new FormData(el.expenseForm), amount = Number(data.get('amount'));
    if (!Number.isFinite(amount) || amount <= 0) return toast('금액을 확인해주세요.');
    const id = el.editingId.value, old = entries.find((entry) => entry.id === id);
    const entry = normalize({ id: id || globalThis.crypto?.randomUUID?.() || `entry-${Date.now()}`, date: String(data.get('date')), amount, category: String(data.get('category')), createdAt: old?.createdAt });
    entries = id ? entries.map((item) => item.id === id ? entry : item) : [...entries, entry];
    selectedMonth = entry.date.slice(0, 7); save(); resetForm(); render(); toast(id ? '기록을 수정했어요.' : '식비를 기록했어요.');
  }
  function startEdit(id) {
    const entry = entries.find((item) => item.id === id); if (!entry) return;
    el.editingId.value = entry.id; el.expenseDate.value = entry.date; el.expenseAmount.value = entry.amount; radio('category', entry.category);
    el.submitExpenseButton.textContent = '수정 내용 저장'; el.cancelEditButton.classList.remove('hidden');
    $('.entry-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function deleteEntry(id) {
    const entry = entries.find((item) => item.id === id);
    if (!entry || !confirm(`${won(entry.amount)} 기록을 삭제할까요?`)) return;
    entries = entries.filter((item) => item.id !== id); save(); render(); toast('기록을 삭제했어요.');
  }
  function openSettings() { el.budgetInput.value = settings.monthlyBudget; el.settingsDialog.showModal(); }
  function saveSettings(event) {
    event.preventDefault(); const budget = Number(el.budgetInput.value);
    if (!Number.isFinite(budget) || budget < 10000) return toast('월 예산을 1만 원 이상 입력해주세요.');
    settings.monthlyBudget = Math.round(budget); save(); el.settingsDialog.close(); render(); toast('월 예산을 저장했어요.');
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'bobmoney', version: 2, exportedAt: new Date().toISOString(), settings, entries }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `bobmoney-backup-${dateValue(new Date())}.json`; link.click(); URL.revokeObjectURL(url); toast('백업 파일을 저장했어요.');
  }
  async function importData(event) {
    const file = event.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.entries) || !data.settings || !confirm('현재 기록을 백업 파일의 내용으로 바꿀까요?')) return;
      entries = data.entries.filter(valid).map(normalize); settings = { monthlyBudget: 600000, ...data.settings }; save(); el.settingsDialog.close(); render(); toast('백업을 불러왔어요.');
    } catch { toast('올바른 백업 파일이 아니에요.'); }
    finally { event.target.value = ''; }
  }
  function toast(message) {
    clearTimeout(toastTimer); el.toast.textContent = message; el.toast.classList.add('show');
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
  }

  el.expenseForm.addEventListener('submit', submitExpense); el.cancelEditButton.onclick = resetForm;
  el.previousMonthButton.onclick = () => { const [y, m] = selectedMonth.split('-').map(Number); selectedMonth = monthValue(new Date(y, m - 2, 1)); render(); };
  el.nextMonthButton.onclick = () => { const [y, m] = selectedMonth.split('-').map(Number); selectedMonth = monthValue(new Date(y, m, 1)); render(); };
  el.monthPicker.onchange = (event) => { if (event.target.value) { selectedMonth = event.target.value; render(); } };
  el.categoryFilter.onchange = renderRecords; el.openSettingsButton.onclick = openSettings; el.editBudgetButton.onclick = openSettings;
  el.closeSettingsButton.onclick = () => el.settingsDialog.close(); el.settingsForm.addEventListener('submit', saveSettings);
  el.exportButton.onclick = exportData; el.importInput.onchange = importData;
  el.clearDataButton.onclick = () => { if (confirm('모든 식비 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) { entries = []; save(); resetForm(); render(); el.settingsDialog.close(); toast('모든 기록을 삭제했어요.'); } };

  entries = Array.isArray(entries) ? entries.filter(valid).map(normalize) : [];
  save(); resetForm(); el.budgetInput.value = settings.monthlyBudget; render();
})();
