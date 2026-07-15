(() => {
  'use strict';

  const STORAGE_KEYS = {
    entries: 'bobmoney.entries.v1',
    settings: 'bobmoney.settings.v1'
  };

  const DEFAULT_SETTINGS = { monthlyBudget: 600000 };
  const CATEGORY_META = {
    '식사': { icon: '🍚' },
    '배달·외식': { icon: '🥡' },
    '카페·간식': { icon: '☕' },
    '기타': { icon: '➕' }
  };

  const elements = {
    monthPicker: document.querySelector('#monthPicker'),
    previousMonthButton: document.querySelector('#previousMonthButton'),
    nextMonthButton: document.querySelector('#nextMonthButton'),
    monthSpent: document.querySelector('#monthSpent'),
    monthlyBudget: document.querySelector('#monthlyBudget'),
    monthRemaining: document.querySelector('#monthRemaining'),
    monthProgress: document.querySelector('#monthProgress'),
    progressTrack: document.querySelector('.progress-track'),
    monthProgressCaption: document.querySelector('#monthProgressCaption'),
    dailyAverage: document.querySelector('#dailyAverage'),
    dailyAllowance: document.querySelector('#dailyAllowance'),
    entryCount: document.querySelector('#entryCount'),
    lastWeekSpent: document.querySelector('#lastWeekSpent'),
    lastWeekGuide: document.querySelector('#lastWeekGuide'),
    thisWeekSpent: document.querySelector('#thisWeekSpent'),
    thisWeekGuide: document.querySelector('#thisWeekGuide'),
    weeklyStatus: document.querySelector('#weeklyStatus'),
    weeklyFeedbackMessage: document.querySelector('#weeklyFeedbackMessage'),
    weeklyBars: document.querySelector('#weeklyBars'),
    expenseForm: document.querySelector('#expenseForm'),
    editingId: document.querySelector('#editingId'),
    expenseDate: document.querySelector('#expenseDate'),
    expenseAmount: document.querySelector('#expenseAmount'),
    expenseMemo: document.querySelector('#expenseMemo'),
    submitExpenseButton: document.querySelector('#submitExpenseButton'),
    cancelEditButton: document.querySelector('#cancelEditButton'),
    categoryFilter: document.querySelector('#categoryFilter'),
    categorySummary: document.querySelector('#categorySummary'),
    recordList: document.querySelector('#recordList'),
    emptyState: document.querySelector('#emptyState'),
    settingsDialog: document.querySelector('#settingsDialog'),
    settingsForm: document.querySelector('#settingsForm'),
    openSettingsButton: document.querySelector('#openSettingsButton'),
    closeSettingsButton: document.querySelector('#closeSettingsButton'),
    editBudgetButton: document.querySelector('#editBudgetButton'),
    budgetInput: document.querySelector('#budgetInput'),
    saveSettingsButton: document.querySelector('#saveSettingsButton'),
    exportButton: document.querySelector('#exportButton'),
    importInput: document.querySelector('#importInput'),
    clearDataButton: document.querySelector('#clearDataButton'),
    toast: document.querySelector('#toast')
  };

  let entries = loadJson(STORAGE_KEYS.entries, []);
  let settings = { ...DEFAULT_SETTINGS, ...loadJson(STORAGE_KEYS.settings, {}) };
  let selectedMonth = toMonthValue(new Date());
  let toastTimer = null;

  function loadJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn(`저장된 ${key} 데이터를 읽지 못했습니다.`, error);
      return fallback;
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(entries));
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }

  function formatWon(value) {
    return `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`;
  }

  function toDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function toMonthValue(date) {
    return toDateValue(date).slice(0, 7);
  }

  function parseLocalDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function dateKey(date) {
    return toDateValue(date);
  }

  function startOfWeek(date) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const mondayOffset = (result.getDay() + 6) % 7;
    result.setDate(result.getDate() - mondayOffset);
    return result;
  }

  function endOfWeek(date) {
    const result = startOfWeek(date);
    result.setDate(result.getDate() + 6);
    return result;
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function getMonthBounds(monthValue) {
    const [year, month] = monthValue.split('-').map(Number);
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 0),
      days: new Date(year, month, 0).getDate()
    };
  }

  function getEntriesForMonth(monthValue) {
    return entries.filter((entry) => entry.date.startsWith(monthValue));
  }

  function sumEntries(list) {
    return list.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }

  function entriesBetween(start, end) {
    const startKey = dateKey(start);
    const endKey = dateKey(end);
    return entries.filter((entry) => entry.date >= startKey && entry.date <= endKey);
  }

  function overlapDays(startA, endA, startB, endB) {
    const start = startA > startB ? startA : startB;
    const end = endA < endB ? endA : endB;
    if (start > end) return 0;
    return Math.floor((end - start) / 86400000) + 1;
  }

  function weekGuide(weekStart, monthBounds) {
    const daysInMonthWeek = overlapDays(weekStart, endOfWeek(weekStart), monthBounds.start, monthBounds.end);
    return settings.monthlyBudget * (daysInMonthWeek / monthBounds.days);
  }

  function getReferenceDate() {
    const now = new Date();
    if (toMonthValue(now) === selectedMonth) return now;
    const { end } = getMonthBounds(selectedMonth);
    return end;
  }

  function render() {
    elements.monthPicker.value = selectedMonth;
    renderMonthlySummary();
    renderWeeklyFeedback();
    renderRecords();
  }

  function renderMonthlySummary() {
    const monthEntries = getEntriesForMonth(selectedMonth);
    const spent = sumEntries(monthEntries);
    const remaining = settings.monthlyBudget - spent;
    const usage = settings.monthlyBudget > 0 ? (spent / settings.monthlyBudget) * 100 : 0;
    const bounds = getMonthBounds(selectedMonth);
    const now = new Date();
    const isCurrentMonth = selectedMonth === toMonthValue(now);
    const elapsedDays = isCurrentMonth ? Math.max(1, now.getDate()) : bounds.days;
    const remainingDays = isCurrentMonth ? Math.max(1, bounds.days - now.getDate() + 1) : bounds.days;

    elements.monthSpent.textContent = formatWon(spent);
    elements.monthlyBudget.textContent = formatWon(settings.monthlyBudget);
    elements.monthRemaining.textContent = remaining >= 0 ? formatWon(remaining) : `${formatWon(Math.abs(remaining))} 초과`;
    elements.dailyAverage.textContent = formatWon(spent / elapsedDays);
    elements.dailyAllowance.textContent = formatWon(Math.max(0, remaining) / remainingDays);
    elements.entryCount.textContent = `${monthEntries.length}건`;

    const visualUsage = Math.min(100, Math.max(0, usage));
    elements.monthProgress.style.width = `${visualUsage}%`;
    elements.monthProgress.classList.toggle('warning', usage >= 85 && usage <= 100);
    elements.monthProgress.classList.toggle('over', usage > 100);
    elements.progressTrack.setAttribute('aria-valuenow', String(Math.round(Math.min(100, usage))));

    if (usage > 100) {
      elements.monthProgressCaption.textContent = `예산을 ${formatWon(spent - settings.monthlyBudget)} 초과했어요.`;
    } else {
      elements.monthProgressCaption.textContent = `예산의 ${Math.round(usage)}%를 사용했어요.`;
    }
  }

  function renderWeeklyFeedback() {
    const bounds = getMonthBounds(selectedMonth);
    const referenceDate = getReferenceDate();
    const currentWeekStart = startOfWeek(referenceDate);
    const lastWeekStart = addDays(currentWeekStart, -7);
    const currentWeekEnd = endOfWeek(currentWeekStart);
    const lastWeekEnd = endOfWeek(lastWeekStart);

    const currentSpent = sumEntries(entriesBetween(currentWeekStart, currentWeekEnd).filter((entry) => entry.date.startsWith(selectedMonth)));
    const lastSpent = sumEntries(entriesBetween(lastWeekStart, lastWeekEnd).filter((entry) => entry.date.startsWith(selectedMonth)));
    const currentGuide = weekGuide(currentWeekStart, bounds);
    const lastGuide = weekGuide(lastWeekStart, bounds);

    elements.thisWeekSpent.textContent = formatWon(currentSpent);
    elements.thisWeekGuide.textContent = `가이드 ${formatWon(currentGuide)}`;
    elements.lastWeekSpent.textContent = formatWon(lastSpent);
    elements.lastWeekGuide.textContent = `가이드 ${formatWon(lastGuide)}`;

    const ratio = currentGuide > 0 ? currentSpent / currentGuide : 0;
    elements.weeklyStatus.className = 'status-chip';

    const monthEntries = getEntriesForMonth(selectedMonth);
    if (monthEntries.length === 0) {
      elements.weeklyStatus.textContent = '기록 대기';
      elements.weeklyFeedbackMessage.textContent = '식비를 기록하면 지난주와 이번 주를 비교해 조절할 포인트를 알려드려요.';
    } else if (ratio > 1.1) {
      elements.weeklyStatus.textContent = '조절 필요';
      elements.weeklyStatus.classList.add('over');
      const over = Math.max(0, currentSpent - currentGuide);
      elements.weeklyFeedbackMessage.textContent = `이번 주 가이드보다 ${formatWon(over)} 많이 썼어요. 다음 식사부터 배달·간식 중 만족도가 낮았던 소비 하나만 줄여보세요.`;
    } else if (ratio >= 0.85) {
      elements.weeklyStatus.textContent = '계획대로';
      elements.weeklyStatus.classList.add('warning');
      elements.weeklyFeedbackMessage.textContent = '이번 주는 계획 범위에 있어요. 남은 기간에도 지금 속도를 유지하면 됩니다.';
    } else {
      elements.weeklyStatus.textContent = '여유 있음';
      elements.weeklyFeedbackMessage.textContent = buildLowSpendMessage(monthEntries, currentGuide - currentSpent);
    }

    if (lastGuide > 0 && lastSpent > lastGuide && currentSpent <= currentGuide) {
      elements.weeklyFeedbackMessage.textContent = `지난주 초과분을 이번 주에 잘 조절하고 있어요. 현재까지 가이드 안에서 ${formatWon(currentGuide - currentSpent)}의 여유가 있습니다.`;
    }

    renderWeeklyBars(bounds);
  }

  function buildLowSpendMessage(monthEntries, room) {
    const lowSatisfaction = monthEntries
      .filter((entry) => entry.satisfaction === '아쉬움')
      .sort((a, b) => b.amount - a.amount)[0];

    if (lowSatisfaction) {
      return `이번 주는 ${formatWon(Math.max(0, room))} 정도 여유가 있어요. 다음에는 만족도가 아쉬웠던 ‘${lowSatisfaction.memo || lowSatisfaction.category}’ 같은 소비를 먼저 줄이면 됩니다.`;
    }
    return `이번 주는 가이드보다 ${formatWon(Math.max(0, room))} 적게 쓰고 있어요. 무리해서 더 아끼기보다 지금 흐름을 유지하세요.`;
  }

  function renderWeeklyBars(bounds) {
    const weeks = [];
    let cursor = startOfWeek(bounds.start);
    while (cursor <= bounds.end) {
      const weekStart = new Date(cursor);
      const weekEnd = endOfWeek(weekStart);
      const spent = sumEntries(entriesBetween(weekStart, weekEnd).filter((entry) => entry.date.startsWith(selectedMonth)));
      const guide = weekGuide(weekStart, bounds);
      weeks.push({ weekStart, spent, guide });
      cursor = addDays(cursor, 7);
    }

    const maxValue = Math.max(settings.monthlyBudget / 4, ...weeks.map((week) => Math.max(week.spent, week.guide)), 1);
    elements.weeklyBars.innerHTML = '';

    weeks.forEach((week, index) => {
      const column = document.createElement('div');
      column.className = 'week-bar-column';
      column.title = `${index + 1}주차: ${formatWon(week.spent)} / 가이드 ${formatWon(week.guide)}`;

      const track = document.createElement('div');
      track.className = 'week-bar-track';
      const fill = document.createElement('div');
      fill.className = 'week-bar-fill';
      if (week.spent > week.guide * 1.1) fill.classList.add('over');
      fill.style.height = `${Math.max(3, (week.spent / maxValue) * 100)}%`;
      track.appendChild(fill);

      const label = document.createElement('span');
      label.className = 'week-bar-label';
      label.textContent = `${index + 1}주`;
      column.append(track, label);
      elements.weeklyBars.appendChild(column);
    });
  }

  function renderRecords() {
    const monthEntries = getEntriesForMonth(selectedMonth);
    const filter = elements.categoryFilter.value;
    const filtered = monthEntries
      .filter((entry) => filter === '전체' || entry.category === filter)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

    renderCategorySummary(monthEntries);
    elements.recordList.innerHTML = '';
    elements.emptyState.classList.toggle('hidden', filtered.length > 0);

    filtered.forEach((entry) => {
      const item = document.createElement('article');
      item.className = 'record-item';

      const icon = document.createElement('div');
      icon.className = 'record-icon';
      icon.textContent = CATEGORY_META[entry.category]?.icon || '➕';

      const main = document.createElement('div');
      main.className = 'record-main';
      const title = document.createElement('strong');
      title.textContent = entry.memo || entry.category;
      const details = document.createElement('span');
      const satisfaction = entry.satisfaction ? ` · ${entry.satisfaction}` : '';
      details.textContent = `${formatDisplayDate(entry.date)} · ${entry.category}${satisfaction}`;
      main.append(title, details);

      const amount = document.createElement('div');
      amount.className = 'record-amount';
      const amountText = document.createElement('strong');
      amountText.textContent = formatWon(entry.amount);
      const actions = document.createElement('div');
      actions.className = 'record-actions';
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.textContent = '수정';
      editButton.addEventListener('click', () => startEdit(entry.id));
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'delete';
      deleteButton.textContent = '삭제';
      deleteButton.addEventListener('click', () => deleteEntry(entry.id));
      actions.append(editButton, deleteButton);
      amount.append(amountText, actions);

      item.append(icon, main, amount);
      elements.recordList.appendChild(item);
    });
  }

  function renderCategorySummary(monthEntries) {
    elements.categorySummary.innerHTML = '';
    Object.keys(CATEGORY_META).forEach((category) => {
      const amount = sumEntries(monthEntries.filter((entry) => entry.category === category));
      const pill = document.createElement('span');
      pill.className = 'category-pill';
      pill.innerHTML = `${CATEGORY_META[category].icon} ${category} <strong>${formatWon(amount)}</strong>`;
      elements.categorySummary.appendChild(pill);
    });
  }

  function formatDisplayDate(value) {
    return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }).format(parseLocalDate(value));
  }

  function createId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function submitExpense(event) {
    event.preventDefault();
    const formData = new FormData(elements.expenseForm);
    const amount = Number(formData.get('amount'));
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('금액을 확인해주세요.');
      return;
    }

    const existingId = elements.editingId.value;
    const entry = {
      id: existingId || createId(),
      date: String(formData.get('date')),
      amount: Math.round(amount),
      category: String(formData.get('category')),
      satisfaction: String(formData.get('satisfaction') || ''),
      memo: String(formData.get('memo') || '').trim(),
      createdAt: existingId ? (entries.find((item) => item.id === existingId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    if (existingId) {
      entries = entries.map((item) => item.id === existingId ? entry : item);
      showToast('기록을 수정했어요.');
    } else {
      entries.push(entry);
      showToast('식비를 기록했어요.');
    }

    selectedMonth = entry.date.slice(0, 7);
    saveState();
    resetForm();
    render();
  }

  function startEdit(id) {
    const entry = entries.find((item) => item.id === id);
    if (!entry) return;
    elements.editingId.value = entry.id;
    elements.expenseDate.value = entry.date;
    elements.expenseAmount.value = entry.amount;
    elements.expenseMemo.value = entry.memo;
    setRadioValue('category', entry.category);
    setRadioValue('satisfaction', entry.satisfaction);
    elements.submitExpenseButton.textContent = '수정 내용 저장';
    elements.cancelEditButton.classList.remove('hidden');
    document.querySelector('.entry-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setRadioValue(name, value) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.checked = input.value === value;
    });
  }

  function resetForm() {
    elements.expenseForm.reset();
    elements.editingId.value = '';
    elements.expenseDate.value = toDateValue(new Date());
    setRadioValue('category', '식사');
    elements.submitExpenseButton.textContent = '식비 기록하기';
    elements.cancelEditButton.classList.add('hidden');
  }

  function deleteEntry(id) {
    const entry = entries.find((item) => item.id === id);
    if (!entry) return;
    if (!window.confirm(`${formatWon(entry.amount)} 기록을 삭제할까요?`)) return;
    entries = entries.filter((item) => item.id !== id);
    saveState();
    render();
    showToast('기록을 삭제했어요.');
  }

  function shiftMonth(offset) {
    const [year, month] = selectedMonth.split('-').map(Number);
    selectedMonth = toMonthValue(new Date(year, month - 1 + offset, 1));
    render();
  }

  function openSettings() {
    elements.budgetInput.value = settings.monthlyBudget;
    if (typeof elements.settingsDialog.showModal === 'function') {
      elements.settingsDialog.showModal();
    } else {
      elements.settingsDialog.setAttribute('open', '');
    }
  }

  function saveSettings(event) {
    event.preventDefault();
    const monthlyBudget = Number(elements.budgetInput.value);
    if (!Number.isFinite(monthlyBudget) || monthlyBudget < 10000) {
      showToast('월 예산을 1만 원 이상 입력해주세요.');
      return;
    }
    settings.monthlyBudget = Math.round(monthlyBudget);
    saveState();
    elements.settingsDialog.close();
    render();
    showToast('월 예산을 저장했어요.');
  }

  function exportData() {
    const payload = {
      app: 'bobmoney',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      entries
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bobmoney-backup-${toDateValue(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('백업 파일을 저장했어요.');
  }

  async function importData(event) {
    const [file] = event.target.files;
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!Array.isArray(payload.entries) || !payload.settings) throw new Error('invalid backup');
      if (!window.confirm('현재 기록을 백업 파일의 내용으로 바꿀까요?')) return;
      entries = payload.entries.filter(isValidEntry);
      settings = { ...DEFAULT_SETTINGS, ...payload.settings };
      saveState();
      elements.settingsDialog.close();
      render();
      showToast('백업을 불러왔어요.');
    } catch (error) {
      console.error(error);
      showToast('올바른 백업 파일이 아니에요.');
    } finally {
      event.target.value = '';
    }
  }

  function isValidEntry(entry) {
    return entry && typeof entry.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number(entry.amount) > 0;
  }

  function clearData() {
    if (!window.confirm('모든 식비 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    entries = [];
    saveState();
    resetForm();
    render();
    elements.settingsDialog.close();
    showToast('모든 기록을 삭제했어요.');
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2200);
  }

  function bindEvents() {
    elements.expenseForm.addEventListener('submit', submitExpense);
    elements.cancelEditButton.addEventListener('click', resetForm);
    elements.previousMonthButton.addEventListener('click', () => shiftMonth(-1));
    elements.nextMonthButton.addEventListener('click', () => shiftMonth(1));
    elements.monthPicker.addEventListener('change', (event) => {
      if (event.target.value) {
        selectedMonth = event.target.value;
        render();
      }
    });
    elements.categoryFilter.addEventListener('change', renderRecords);
    elements.openSettingsButton.addEventListener('click', openSettings);
    elements.closeSettingsButton.addEventListener('click', () => elements.settingsDialog.close());
    elements.editBudgetButton.addEventListener('click', openSettings);
    elements.settingsForm.addEventListener('submit', saveSettings);
    elements.exportButton.addEventListener('click', exportData);
    elements.importInput.addEventListener('change', importData);
    elements.clearDataButton.addEventListener('click', clearData);
  }

  function init() {
    entries = Array.isArray(entries) ? entries.filter(isValidEntry) : [];
    elements.expenseDate.value = toDateValue(new Date());
    elements.budgetInput.value = settings.monthlyBudget;
    bindEvents();
    render();
  }

  init();
})();
