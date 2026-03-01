
const STORAGE_KEY = "cronograma_premium_state_v1";
const MAX_ACTIVITY = 4000;

const STAGES = [
  { id: "study", label: "Estudo Inicial", short: "Estudo", type: "study", offsetDays: 0 },
  { id: "rev1w", label: "Revisão 1 Semana", short: "R+1S", type: "review", offsetDays: 7 },
  { id: "rev1m", label: "Revisão 1 Mês", short: "R+1M", type: "review", offsetDays: 30 },
  { id: "rev3m", label: "Revisão 3 Meses", short: "R+3M", type: "review", offsetDays: 90 },
  { id: "rev6m", label: "Revisão 6 Meses", short: "R+6M", type: "review", offsetDays: 180 },
];

const STAGE_BY_ID = Object.fromEntries(STAGES.map((item) => [item.id, item]));
const STATUS_META = {
  done: { label: "Concluído", cls: "done-text" },
  pending: { label: "Pendente", cls: "pending-text" },
  overdue: { label: "Atrasado", cls: "overdue-text" },
  partial: { label: "Parcial", cls: "partial-text" },
  waiting: { label: "Aguardando", cls: "pending-text" },
};

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const SECTION_IDS = ["overview", "today", "calendar", "list", "reviews", "pendencias", "stats", "priority", "timeline", "settings"];

const dom = {};
let baseData = null;
let state = null;
let currentSection = "calendar";
let calendarCursor = new Date();
let charts = {};
let topicsById = new Map();
let shiftedBlockStartById = new Map();
let shiftedPlannedByTopicId = new Map();
const renderedSections = new Set();

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheDom();
  bindBaseEvents();

  try {
    await loadScheduleData();
    initializeState();
    fillFilters();
    calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    setSectionVisibility();
    renderCurrentSection({ force: true });
  } catch (error) {
    console.error(error);
    const msg = `<div class="empty-state">Falha ao carregar <code>data/schedule.json</code>.</div>`;
    dom.overviewWrap.innerHTML = msg;
  }
}

function cacheDom() {
  const ids = [
    "menuNav", "sourceMeta", "globalSearch", "filterArea", "filterWeek", "filterStatus", "filterType", "clearFiltersBtn",
    "quickSyncBtn", "quickBackupBtn", "overviewWrap", "todayWrap", "calendarWrap", "listTableWrap", "reviewsWrap", "pendenciasWrap",
    "statsKpis", "priorityWrap", "heatmapLegend", "heatmapGrid", "activityLogWrap", "calendarPrevBtn", "calendarNextBtn", "calendarMonthLabel",
    "goalTopicsInput", "goalQuestionsInput", "goalRevisionsInput", "saveGoalsBtn", "syncUrlInput", "syncKeyInput", "syncTableInput",
    "syncProfileInput", "syncAutoInput", "syncTestBtn", "syncUploadBtn", "syncDownloadBtn", "syncStatus", "exportBtn", "importBtn", "resetBtn",
    "importFileInput",
  ];
  for (const id of ids) {
    dom[id] = document.getElementById(id);
  }
}

function bindBaseEvents() {
  dom.menuNav.addEventListener("click", (event) => {
    const btn = event.target.closest(".menu-btn");
    if (!btn) return;
    currentSection = btn.dataset.section;
    setSectionVisibility();
    renderCurrentSection({ force: true });
  });

  const debounced = debounce(() => renderCurrentSection({ force: true }), 180);
  dom.globalSearch.addEventListener("input", debounced);
  dom.filterArea.addEventListener("change", debounced);
  dom.filterWeek.addEventListener("change", debounced);
  dom.filterStatus.addEventListener("change", debounced);
  dom.filterType.addEventListener("change", debounced);

  dom.clearFiltersBtn.addEventListener("click", () => {
    dom.globalSearch.value = "";
    dom.filterArea.value = "all";
    dom.filterWeek.value = "all";
    dom.filterStatus.value = "all";
    dom.filterType.value = "all";
    renderCurrentSection({ force: true });
  });

  dom.calendarPrevBtn.addEventListener("click", () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
    renderCalendar();
  });

  dom.calendarNextBtn.addEventListener("click", () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
    renderCalendar();
  });

  dom.listTableWrap.addEventListener("change", handleListChange);

  dom.listTableWrap.addEventListener("click", handleActionClick);
  dom.todayWrap.addEventListener("change", handleQuickTaskChange);
  dom.todayWrap.addEventListener("click", handleActionClick);
  dom.reviewsWrap.addEventListener("click", handleActionClick);
  dom.pendenciasWrap.addEventListener("click", handleActionClick);
  dom.priorityWrap.addEventListener("click", handleActionClick);

  dom.quickSyncBtn.addEventListener("click", async () => { saveSyncInputs(); await syncUpload(); });
  dom.quickBackupBtn.addEventListener("click", exportBackup);

  dom.saveGoalsBtn.addEventListener("click", saveGoals);
  dom.syncTestBtn.addEventListener("click", async () => { saveSyncInputs(); await syncTest(); });
  dom.syncUploadBtn.addEventListener("click", async () => { saveSyncInputs(); await syncUpload(); });
  dom.syncDownloadBtn.addEventListener("click", async () => { saveSyncInputs(); await syncDownload(); });

  dom.exportBtn.addEventListener("click", exportBackup);
  dom.importBtn.addEventListener("click", () => dom.importFileInput.click());
  dom.importFileInput.addEventListener("change", importBackup);

  dom.resetBtn.addEventListener("click", () => {
    if (!window.confirm("Deseja realmente resetar os dados locais?")) return;
    state = createEmptyState();
    ensureAllTopicStates();
    persist("reset_local", { source: "settings" });
  });
}

async function loadScheduleData() {
  const response = await fetch("./data/schedule.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Erro ao carregar JSON: ${response.status}`);

  baseData = await response.json();
  topicsById = new Map(baseData.topics.map((topic) => [topic.id, topic]));
  buildShiftedSchedule();
  dom.sourceMeta.textContent = `${baseData.meta.sourceSheet} | ${baseData.meta.topicCount} assuntos`;
}

function buildShiftedSchedule() {
  shiftedBlockStartById = new Map();
  shiftedPlannedByTopicId = new Map();

  const blockTopics = new Map();
  for (const topic of baseData.topics) {
    if (!blockTopics.has(topic.blockId)) {
      blockTopics.set(topic.blockId, []);
    }
    blockTopics.get(topic.blockId).push(topic);
  }

  const anchor = getMonday(new Date());
  anchor.setDate(anchor.getDate() - 7);

  for (let idx = 0; idx < baseData.blocks.length; idx += 1) {
    const block = baseData.blocks[idx];
    const start = new Date(anchor);
    start.setDate(anchor.getDate() + idx * 7);
    const startIso = isoDate(start);
    shiftedBlockStartById.set(block.id, startIso);

    const topics = (blockTopics.get(block.id) || [])
      .slice()
      .sort((a, b) => (a.priorityRank - b.priorityRank) || (a.sourceRow - b.sourceRow));

    const total = topics.length || 1;
    for (let position = 0; position < topics.length; position += 1) {
      const offset = Math.min(6, Math.floor((position * 7) / total));
      shiftedPlannedByTopicId.set(topics[position].id, addDays(startIso, offset));
    }
  }
}

function createEmptyState() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    goals: { topicsPerWeek: 14, questionsPerWeek: 220, revisionsPerWeek: 40 },
    sync: { url: "", anonKey: "", table: "study_state", profileId: "arthur", autoSync: false, lastSyncAt: null },
    topics: {},
    activity: [],
  };
}

function initializeState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      state = normalizeState(JSON.parse(raw));
    } catch {
      state = createEmptyState();
    }
  } else {
    state = createEmptyState();
  }

  ensureAllTopicStates();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeState(candidate) {
  const blank = createEmptyState();
  const merged = { ...blank, ...(candidate && typeof candidate === "object" ? candidate : {}) };

  merged.goals = { ...blank.goals, ...(candidate?.goals || {}) };
  merged.sync = { ...blank.sync, ...(candidate?.sync || {}) };
  merged.topics = candidate?.topics && typeof candidate.topics === "object" ? candidate.topics : {};
  merged.activity = Array.isArray(candidate?.activity) ? candidate.activity : [];
  return merged;
}

function ensureAllTopicStates() {
  for (const topic of baseData.topics) ensureTopicState(topic);
}

function ensureTopicState(topic) {
  const existing = state.topics[topic.id];
  if (!existing) {
    state.topics[topic.id] = buildTopicStateFromSeed(topic);
    return;
  }

  existing.notes = typeof existing.notes === "string" ? existing.notes : "";
  existing.studyDueOverride = existing.studyDueOverride || null;
  existing.stages = existing.stages && typeof existing.stages === "object" ? existing.stages : {};

  for (const stage of STAGES) {
    const value = existing.stages[stage.id] || emptyStage();
    value.done = Boolean(value.done);
    value.date = value.date || null;
    value.total = numberOrZero(value.total);
    value.correct = Math.min(numberOrZero(value.correct), value.total);
    value.dueOverride = value.dueOverride || null;
    existing.stages[stage.id] = value;
  }
}

function buildTopicStateFromSeed(topic) {
  const seed = topic.seed || {};

  const stageFromSeed = (stageId) => {
    const s = seed[stageId] || {};
    const done = Boolean(s.done);
    const total = numberOrZero(s.total);
    const correct = Math.min(numberOrZero(s.correct), total);

    let date = null;
    if (done) {
      const baseDate = getTopicPlannedDate(topic) || todayISO();
      date = stageId === "study" ? baseDate : addDays(baseDate, STAGE_BY_ID[stageId].offsetDays);
    }

    return { done, date, total, correct, dueOverride: null };
  };

  return {
    notes: "",
    studyDueOverride: null,
    stages: {
      study: stageFromSeed("study"),
      rev1w: stageFromSeed("rev1w"),
      rev1m: stageFromSeed("rev1m"),
      rev3m: stageFromSeed("rev3m"),
      rev6m: stageFromSeed("rev6m"),
    },
  };
}

function emptyStage() {
  return { done: false, date: null, total: 0, correct: 0, dueOverride: null };
}

function persist(action = null, detail = null, options = {}) {
  if (action) logActivity(action, detail || {});

  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (!options.skipRender) renderCurrentSection({ force: true });

  if (!options.skipAutoSync && state.sync.autoSync && state.sync.url && state.sync.anonKey && state.sync.profileId) {
    syncUpload(true).catch((error) => {
      console.warn("Auto-sync falhou", error);
      updateSyncStatus("Auto-sync falhou.", true);
    });
  }
}

function logActivity(action, detail) {
  state.activity.unshift({ ts: new Date().toISOString(), action, detail });
  if (state.activity.length > MAX_ACTIVITY) state.activity.length = MAX_ACTIVITY;
}

function readFilters() {
  return {
    search: normalizeText(dom.globalSearch.value || ""),
    area: dom.filterArea.value,
    week: dom.filterWeek.value,
    status: dom.filterStatus.value,
    type: dom.filterType.value,
  };
}

function getFilteredTopics() {
  const filters = readFilters();

  const list = baseData.topics.filter((topic) => {
    const topicState = state.topics[topic.id];
    const topicStatus = getTopicStatus(topic, topicState);

    if (filters.area !== "all" && topic.area !== filters.area) return false;
    if (filters.week !== "all" && topic.blockId !== filters.week) return false;
    if (filters.status !== "all" && topicStatus !== filters.status) return false;

    if (filters.type === "review") {
      const hasReview = STAGES.filter((stage) => stage.id !== "study").some((stage) => Boolean(getStageDueDate(topic, stage.id, topicState)));
      if (!hasReview) return false;
    }

    if (filters.search) {
      const text = normalizeText(`${topic.rawTitle} ${topic.area} ${topic.topic} ${topic.weekLabel} ${topic.blockLabel} ${topic.priorityLabel}`);
      if (!text.includes(filters.search)) return false;
    }

    return true;
  });

  list.sort((a, b) => {
    const n1 = blockSortValue(a.blockNumber);
    const n2 = blockSortValue(b.blockNumber);
    if (n1 !== n2) return n1 - n2;
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
    return a.sourceRow - b.sourceRow;
  });

  return list;
}

function renderAll() {
  setSectionVisibility();
  renderCurrentSection({ force: true });
}

function renderCurrentSection(options = {}) {
  const force = Boolean(options.force);

  if (!force && renderedSections.has(currentSection)) {
    return;
  }

  switch (currentSection) {
    case "overview":
      renderOverview();
      break;
    case "today":
      renderToday();
      break;
    case "calendar":
      renderCalendar();
      break;
    case "list":
      renderList();
      break;
    case "reviews":
      renderReviews();
      break;
    case "pendencias":
      renderPendencias();
      break;
    case "stats":
      renderStats();
      break;
    case "priority":
      renderPriorityPanel();
      break;
    case "timeline":
      renderTimeline();
      break;
    case "settings":
      renderSettings();
      break;
    default:
      renderCalendar();
      break;
  }

  renderedSections.add(currentSection);
}

function setSectionVisibility() {
  for (const sectionId of SECTION_IDS) {
    const node = document.getElementById(`${sectionId}Section`);
    if (!node) continue;
    node.hidden = sectionId !== currentSection;
  }

  dom.menuNav.querySelectorAll(".menu-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === currentSection);
  });
}
function renderOverview() {
  const topics = getFilteredTopics();
  const totals = computeTotals(topics);
  const issues = collectAllIssues(topics);
  const consistency = computeConsistency();
  const goals = computeGoalProgress(topics);

  const areaBars = computeAreaProgress(topics)
    .slice(0, 10)
    .map((entry) => progressBarTemplate(entry.area, entry.progress, `${entry.done}/${entry.total}`))
    .join("");

  const weekBars = computeWeekProgress(topics)
    .slice(0, 10)
    .map((entry) => progressBarTemplate(entry.weekLabel, entry.progress, `${entry.done}/${entry.total}`))
    .join("");

  dom.overviewWrap.innerHTML = `
    <div class="kpi-grid">
      ${metricCard("Total de Assuntos", totals.totalTopics, `${totals.doneStudyTopics} estudados`)}
      ${metricCard("Revisões Feitas", totals.doneRevisions, `${totals.pendingRevisions} pendentes`)}
      ${metricCard("Pendências", issues.length, `${totals.overdueTasks} atrasos`)}
      ${metricCard("Questões Feitas", totals.questionsTotal, `${totals.questionsCorrect} acertos`)}
      ${metricCard("Taxa de Acerto", `${toPercent(totals.accuracy)}%`, `${totals.questionsWrong} erros`)}
      ${metricCard("Consistência", `${consistency.studyStreak}d estudo`, `${consistency.reviewStreak}d revisão`)}
    </div>

    <article class="panel-card">
      <h3>Barra de Progresso</h3>
      <div class="progress-stack">
        ${progressBarTemplate("Progresso geral", totals.overallProgress, `${totals.doneTasks}/${totals.expectedTasks}`)}
        ${progressBarTemplate("Progresso de revisões", totals.reviewProgress, `${totals.doneRevisions}/${totals.expectedRevisions}`)}
      </div>
    </article>

    <article class="panel-card">
      <h3>Metas da Semana</h3>
      <div class="progress-stack">
        ${progressBarTemplate("Assuntos", goals.topicsPct, `${goals.topicsDone}/${goals.goals.topicsPerWeek}`)}
        ${progressBarTemplate("Questões", goals.questionsPct, `${goals.questionsDone}/${goals.goals.questionsPerWeek}`)}
        ${progressBarTemplate("Revisões", goals.revisionsPct, `${goals.revisionsDone}/${goals.goals.revisionsPerWeek}`)}
      </div>
    </article>

    <article class="panel-card">
      <h3>Progresso por Área</h3>
      <div class="progress-stack">${areaBars || `<div class="empty-state">Sem dados.</div>`}</div>
    </article>

    <article class="panel-card">
      <h3>Progresso por Semana</h3>
      <div class="progress-stack">${weekBars || `<div class="empty-state">Sem dados.</div>`}</div>
    </article>

    <article class="panel-card">
      <h3>Controle de Consistência</h3>
      <div class="pill-row">
        <span class="pill pending">Streak estudo: ${consistency.studyStreak} dia(s)</span>
        <span class="pill pending">Streak revisão: ${consistency.reviewStreak} dia(s)</span>
        <span class="pill partial">Semanas consistentes: ${consistency.consistentWeeks}</span>
      </div>
    </article>
  `;
}

function renderToday() {
  const topics = getFilteredTopics();
  const tasks = buildTasks(topics, { includeDone: true });
  const { start, end } = weekBounds(new Date());

  const weekTasks = tasks
    .filter((task) => task.dueDate >= start && task.dueDate <= end)
    .sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
      if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return a.topic.sourceRow - b.topic.sourceRow;
    });

  const studies = weekTasks.filter((task) => task.stageId === "study");
  const reviews = weekTasks.filter((task) => task.stageId !== "study");

  dom.todayWrap.innerHTML = `
    <div class="collapse-stack">
      <details class="collapse-card">
        <summary>Estudos da Semana <span>(${studies.length})</span></summary>
        <div class="task-list">${studies.length ? studies.map((task) => weeklyTaskEditorCard(task)).join("") : `<div class="empty-state">Sem estudos nesta semana.</div>`}</div>
      </details>
      <details class="collapse-card">
        <summary>Revisões da Semana <span>(${reviews.length})</span></summary>
        <div class="task-list">${reviews.length ? reviews.map((task) => weeklyTaskEditorCard(task)).join("") : `<div class="empty-state">Sem revisões nesta semana.</div>`}</div>
      </details>
    </div>
  `;
}

function renderCalendar() {
  const topics = getFilteredTopics();
  const tasks = buildTasks(topics, { includeDone: true });
  const byDate = groupTasksByDate(tasks);

  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);

  dom.calendarMonthLabel.textContent = first.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const iso = isoDate(date);
    const dayTasks = (byDate.get(iso) || []).sort(sortTaskByPriorityThenDate);

    const current = date.getMonth() === month;
    const today = iso === todayISO();
    const items = dayTasks.map((task) => `
      <div class="day-mini priority-${task.priority} ${task.status}">
        <strong>${escapeHtml(stageShort(task.stageId))}</strong> ${escapeHtml(task.area)}
      </div>
    `).join("");

    cells.push(`
      <div class="day-cell ${current ? "" : "outside"} ${today ? "today" : ""}">
        <div class="day-head"><span>${date.getDate()}</span><span class="day-count">${dayTasks.length ? `${dayTasks.length} tarefa(s)` : ""}</span></div>
        <div class="day-tasks">${items}</div>
      </div>
    `);
  }

  dom.calendarWrap.innerHTML = `
    <div class="priority-legend">
      <span class="priority-chip priority-blue">Azul</span>
      <span class="priority-chip priority-green">Verde</span>
      <span class="priority-chip priority-yellow">Amarelo</span>
      <span class="priority-chip priority-red">Vermelho</span>
    </div>
    <div class="calendar-head">${WEEKDAY_LABELS.map((label) => `<span>${label}</span>`).join("")}</div>
    <div class="calendar-grid">${cells.join("")}</div>
  `;
}

function renderList() {
  const topics = getFilteredTopics();
  if (!topics.length) {
    dom.listTableWrap.innerHTML = `<div class="empty-state">Nenhum assunto para os filtros atuais.</div>`;
    return;
  }

  const grouped = groupTopicsByBlock(topics);
  const rows = [];

  for (const block of baseData.blocks) {
    const blockTopics = grouped.get(block.id);
    if (!blockTopics?.length) continue;

    rows.push(`<tr class="week-row"><td colspan="8">${escapeHtml(block.weekLabel)} | Início ${formatDate(getBlockStartDate(block.id))}</td></tr>`);

    for (const topic of blockTopics) {
      rows.push(`
        <tr id="row-${topic.id}" data-topic-id="${topic.id}">
          <td class="sheet-area">${escapeHtml(topic.area)}</td>
          <td class="sheet-topic"><strong>${escapeHtml(topic.topic)}</strong></td>
          <td class="sheet-priority priority-bg-${topic.priority}"></td>
          <td>${stageCellTemplate(topic, "study")}</td>
          <td>${stageCellTemplate(topic, "rev1w")}</td>
          <td>${stageCellTemplate(topic, "rev1m")}</td>
          <td>${stageCellTemplate(topic, "rev3m")}</td>
          <td>${stageCellTemplate(topic, "rev6m")}</td>
        </tr>
      `);
    }
  }

  dom.listTableWrap.innerHTML = `
    <table class="study-table">
      <thead>
        <tr>
          <th>Área</th>
          <th>Assunto</th>
          <th>Prioridade</th>
          <th>Estudo</th>
          <th>R+1S</th>
          <th>R+1M</th>
          <th>R+3M</th>
          <th>R+6M</th>
        </tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;
}

function stageCellTemplate(topic, stageId) {
  const topicState = state.topics[topic.id];
  const stageState = topicState.stages[stageId];
  const status = getStageStatus(topic, stageId, topicState);

  return `
    <div class="stage-cell stage-compact stage-${status}">
      <div class="stage-top">
        <label><input class="stage-done" data-topic-id="${topic.id}" data-stage-id="${stageId}" type="checkbox" ${stageState.done ? "checked" : ""}></label>
      </div>
      <div class="ratio-input ratio-compact">
        <input class="stage-correct" data-topic-id="${topic.id}" data-stage-id="${stageId}" data-field="correct" type="number" min="0" value="${stageState.correct || ""}" placeholder="Acertos" />
        <span>/</span>
        <input class="stage-total" data-topic-id="${topic.id}" data-stage-id="${stageId}" data-field="total" type="number" min="0" value="${stageState.total || ""}" placeholder="Questões" />
      </div>
    </div>
  `;
}

function renderReviews() {
  const topics = getFilteredTopics();
  const tasks = buildTasks(topics, { includeDone: false }).filter((task) => task.stageId !== "study");

  const groups = [
    { key: "rev1w", label: "Revisão 1 Semana" },
    { key: "rev1m", label: "Revisão 1 Mês" },
    { key: "rev3m", label: "Revisão 3 Meses" },
    { key: "rev6m", label: "Revisão 6 Meses" },
  ];

  const detailsHtml = groups.map((group) => {
    const items = tasks.filter((task) => task.stageId === group.key).sort(sortTaskByPriorityAndDelay);
    return `
      <details class="collapse-card">
        <summary>${escapeHtml(group.label)} <span>(${items.length})</span></summary>
        <div class="task-list">
          ${items.length ? items.map((task) => taskCardTemplate(task)).join("") : `<div class="empty-state">Sem itens.</div>`}
        </div>
      </details>
    `;
  }).join("");

  dom.reviewsWrap.innerHTML = `
    <div class="collapse-stack">
      ${detailsHtml}
    </div>
  `;
}

function renderPendencias() {
  const topics = getFilteredTopics();
  const issues = collectAllIssues(topics);

  if (!issues.length) {
    dom.pendenciasWrap.innerHTML = `<div class="empty-state">Nenhuma pendência para os filtros atuais.</div>`;
    return;
  }

  const sorted = issues.sort((a, b) => {
    if (a.topic.priorityRank !== b.topic.priorityRank) return a.topic.priorityRank - b.topic.priorityRank;
    return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
  }).slice(0, 260);

  const studyIssues = sorted.filter((item) => item.stageId === "study");
  const reviewIssues = sorted.filter((item) => item.stageId !== "study");

  const issueCard = (item) => `
    <div class="task-card priority-${item.topic.priority} ${item.status}">
      <div class="line-1">
        <span class="pill ${item.status}">${STATUS_META[item.status].label}</span>
        <span>${escapeHtml(stageShort(item.stageId))}</span>
      </div>
      <div class="topic">${escapeHtml(item.topic.topic)}</div>
      <small>${escapeHtml(item.topic.area)}${item.daysOverdue ? ` | atraso ${item.daysOverdue}d` : ""}</small>
      <small>${escapeHtml(item.message)}</small>
      <div class="task-actions">
        <button class="mini-btn action-open-list" data-topic-id="${item.topic.id}">Abrir</button>
        <button class="mini-btn action-done" data-topic-id="${item.topic.id}" data-stage-id="${item.stageId}">Marcar feito</button>
      </div>
    </div>
  `;

  dom.pendenciasWrap.innerHTML = `
    <div class="today-grid today-grid-2">
      <article class="task-column">
        <h3>Pendências de Estudo <small>(${studyIssues.length})</small></h3>
        <div class="task-list">${studyIssues.length ? studyIssues.map(issueCard).join("") : `<div class="empty-state">Sem pendências de estudo.</div>`}</div>
      </article>
      <article class="task-column">
        <h3>Pendências de Revisão <small>(${reviewIssues.length})</small></h3>
        <div class="task-list">${reviewIssues.length ? reviewIssues.map(issueCard).join("") : `<div class="empty-state">Sem pendências de revisão.</div>`}</div>
      </article>
    </div>
  `;
}
function renderStats() {
  const topics = getFilteredTopics();
  const analytics = computeAnalytics(topics);

  dom.statsKpis.innerHTML = `
    ${metricCard("Questões Feitas", analytics.questionsTotal, `${analytics.correctTotal} acertos`)}
    ${metricCard("Questões Erradas", analytics.wrongTotal, `${toPercent(percentNum(analytics.wrongTotal, analytics.questionsTotal))}%`)}
    ${metricCard("Taxa Geral", `${toPercent(analytics.accuracy)}%`, `${analytics.attemptedTopics} assuntos com questões`)}
    ${metricCard("Falsa sensação de domínio", analytics.falseMastery.length, "queda após revisão")}
    ${metricCard("Melhora após revisão", analytics.improvedAfterReview.length, "evolução positiva")}
    ${metricCard("Baixo desempenho persistente", analytics.persistentLow.length, "continuidade de erro")}
  `;

  renderRankList("rankErrorRate", analytics.rankErrorRate, rankItemTemplate);
  renderRankList("rankWorstTotal", analytics.rankWorstTotal, rankItemTemplate);
  renderRankList("rankRev1w", analytics.rankRev1w, rankItemTemplate);
  renderRankList("rankRev1m", analytics.rankRev1m, rankItemTemplate);
  renderRankList("rankRev3m", analytics.rankRev3m, rankItemTemplate);
  renderRankList("rankRev6m", analytics.rankRev6m, rankItemTemplate);
  renderRankList("rankFragile", analytics.rankFragile, rankItemTemplate);

  if (!window.Chart) return;

  drawChart("overallDoughnutChart", {
    type: "doughnut",
    data: { labels: ["Acertos", "Erros"], datasets: [{ data: [analytics.correctTotal, analytics.wrongTotal], backgroundColor: ["#2f8f58", "#c84e4e"], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false },
  });

  const labels = analytics.areaRows.map((item) => item.area);
  const acc = analytics.areaRows.map((item) => Number((item.accuracy * 100).toFixed(2)));
  const qs = analytics.areaRows.map((item) => item.questions);

  drawChart("areaAccuracyChart", {
    type: "bar",
    data: { labels, datasets: [{ label: "% Acerto", data: acc, backgroundColor: "#4387b7", borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } },
  });

  drawChart("areaVolumeChart", {
    type: "bar",
    data: { labels, datasets: [{ label: "Questões", data: qs, backgroundColor: "#cf6f2e", borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
  });

  drawChart("retentionLineChart", {
    type: "line",
    data: { labels: STAGES.map((stage) => stage.short), datasets: [{ label: "% médio por etapa", data: STAGES.map((stage) => Number((analytics.stageAverage[stage.id] * 100).toFixed(2))), borderColor: "#2b7d8e", tension: 0.25 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } },
  });

  drawChart("areaCompareChart", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { type: "bar", label: "Estudos", data: analytics.areaRows.map((item) => item.studied), backgroundColor: "#669d5a", borderRadius: 5, yAxisID: "y" },
        { type: "bar", label: "Revisões", data: analytics.areaRows.map((item) => item.reviews), backgroundColor: "#7c9fd2", borderRadius: 5, yAxisID: "y" },
        { type: "line", label: "% acerto", data: acc, borderColor: "#c1491b", yAxisID: "y1", tension: 0.2 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }, y1: { beginAtZero: true, max: 100, position: "right", grid: { drawOnChartArea: false } } } },
  });
}

function renderPriorityPanel() {
  const topics = getFilteredTopics();
  const tasks = buildTasks(topics, { includeDone: false });
  const today = todayISO();

  const dueToday = tasks.filter((item) => item.dueDate === today).sort(sortTaskByPriorityThenDate);
  const overdue = tasks.filter((item) => item.dueDate < today).sort(sortTaskByPriorityAndDelay).slice(0, 20);
  const fragile = topics.map((topic) => ({ topic, score: computeDomainScore(topic, state.topics[topic.id]) })).sort((a, b) => a.score.score - b.score.score).slice(0, 16);
  const neglected = computeNeglectedAreas(topics).slice(0, 8);
  const week = computeWeeklyExecutive(topics);

  dom.priorityWrap.innerHTML = `
    <div class="priority-grid">
      <article class="panel-card"><h3>Hoje</h3><div class="task-list">${dueToday.length ? dueToday.map((item) => taskCardTemplate(item)).join("") : `<div class="empty-state">Sem tarefas hoje.</div>`}</div></article>
      <article class="panel-card"><h3>Mais Atrasados</h3><div class="task-list">${overdue.length ? overdue.map((item) => taskCardTemplate(item)).join("") : `<div class="empty-state">Sem atrasos.</div>`}</div></article>
      <article class="panel-card"><h3>Ranking Frágil</h3><ol class="ranking-list">${fragile.map((item) => `<li><strong>${escapeHtml(item.topic.topic)}</strong> <small>${escapeHtml(item.topic.area)} | ${item.score.label} (${item.score.score})</small></li>`).join("")}</ol></article>
      <article class="panel-card"><h3>Áreas Negligenciadas</h3><ol class="ranking-list">${neglected.map((item) => `<li><strong>${escapeHtml(item.area)}</strong> <small>${item.pending}/${item.total} pendências | ${toPercent(item.ratio)}%</small></li>`).join("")}</ol></article>
      <article class="panel-card full"><h3>Visão Semanal Executiva</h3><div class="kpi-grid">${metricCard("Tarefas", week.total, `${week.done} feitas`)}${metricCard("Atrasadas", week.overdue, `${week.pending} pendentes`)}${metricCard("Prioridade alta", week.highPriority, "itens azuis")}${metricCard("Revisões críticas", week.criticalReviews, "atraso > 14d")}${metricCard("Execução", `${toPercent(percentNum(week.done, week.total))}%`, "na semana")}${metricCard("Questões", week.questions, `${week.correct} acertos`)}</div></article>
    </div>
  `;
}

function renderTimeline() {
  const events = collectCompletionEvents();
  const series = buildDailySeries(90, events);

  if (window.Chart) {
    drawChart("timelineLineChart", {
      type: "line",
      data: {
        labels: series.labels,
        datasets: [
          { label: "Estudos", data: series.study, borderColor: "#2f7db0", tension: 0.25 },
          { label: "Revisões", data: series.review, borderColor: "#5aa074", tension: 0.25 },
          { label: "Questões", data: series.questions, borderColor: "#c96834", tension: 0.25, yAxisID: "y1" },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }, y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false } } } },
    });
  }

  const heat = buildHeatmapData(180);
  dom.heatmapLegend.textContent = "Mais escuro = mais atividade no dia.";
  dom.heatmapGrid.innerHTML = heat.map((item) => `<div class="heat-cell heat-l${item.level}" title="${escapeHtml(formatDate(item.date))}: ${item.count} evento(s)"></div>`).join("");

  dom.activityLogWrap.innerHTML = state.activity.slice(0, 280).map((entry) => {
    const when = new Date(entry.ts).toLocaleString("pt-BR");
    return `<div class="activity-row"><time>${when}</time><div><strong>${escapeHtml(entry.action)}</strong> <small>${escapeHtml(JSON.stringify(entry.detail || {}))}</small></div></div>`;
  }).join("") || `<div class="empty-state">Sem histórico ainda.</div>`;
}

function renderSettings() {
  dom.goalTopicsInput.value = state.goals.topicsPerWeek;
  dom.goalQuestionsInput.value = state.goals.questionsPerWeek;
  dom.goalRevisionsInput.value = state.goals.revisionsPerWeek;

  dom.syncUrlInput.value = state.sync.url;
  dom.syncKeyInput.value = state.sync.anonKey;
  dom.syncTableInput.value = state.sync.table;
  dom.syncProfileInput.value = state.sync.profileId;
  dom.syncAutoInput.checked = Boolean(state.sync.autoSync);

  if (state.sync.lastSyncAt) {
    updateSyncStatus(`Última sync: ${new Date(state.sync.lastSyncAt).toLocaleString("pt-BR")}`, false);
  } else {
    updateSyncStatus("Sincronização não configurada.", false);
  }
}

function handleListChange(event) {
  const target = event.target;

  if (target.classList.contains("stage-done")) {
    const topicId = target.dataset.topicId;
    const stageId = target.dataset.stageId;
    const stage = state.topics[topicId].stages[stageId];

    stage.done = target.checked;
    stage.date = target.checked ? stage.date || todayISO() : null;

    persist("toggle_done", { topicId, stageId, done: stage.done });
    return;
  }

  if (target.classList.contains("stage-correct") || target.classList.contains("stage-total")) {
    const topicId = target.dataset.topicId;
    const stageId = target.dataset.stageId;
    const field = target.dataset.field;

    const stage = state.topics[topicId].stages[stageId];
    stage[field] = numberOrZero(target.value);
    if (stage.correct > stage.total) stage.correct = stage.total;

    persist("update_questions", { topicId, stageId, field, value: stage[field] });
  }
}

function handleQuickTaskChange(event) {
  const target = event.target;
  const topicId = target.dataset.topicId;
  const stageId = target.dataset.stageId;

  if (!topicId || !stageId || !state.topics[topicId]) return;

  const stage = state.topics[topicId].stages[stageId];
  if (!stage) return;

  if (target.classList.contains("quick-stage-done")) {
    stage.done = Boolean(target.checked);
    stage.date = stage.done ? stage.date || todayISO() : null;
    persist("quick_week_done", { topicId, stageId, done: stage.done });
    return;
  }

  if (target.classList.contains("quick-stage-correct") || target.classList.contains("quick-stage-total")) {
    const field = target.dataset.field;
    stage[field] = numberOrZero(target.value);
    if (stage.correct > stage.total) stage.correct = stage.total;
    persist("quick_week_questions", { topicId, stageId, field, value: stage[field] });
  }
}

function handleActionClick(event) {
  const done = event.target.closest(".action-done");
  if (done) {
    markStageDone(done.dataset.topicId, done.dataset.stageId);
    return;
  }

  const open = event.target.closest(".action-open-list");
  if (open) {
    currentSection = "list";
    setSectionVisibility();
    renderCurrentSection({ force: true });
    const row = document.getElementById(`row-${open.dataset.topicId}`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
}

function markStageDone(topicId, stageId) {
  const stage = state.topics[topicId].stages[stageId];
  stage.done = true;
  stage.date = stage.date || todayISO();
  persist("quick_done", { topicId, stageId, date: stage.date });
}

function saveGoals() {
  state.goals.topicsPerWeek = numberOrZero(dom.goalTopicsInput.value);
  state.goals.questionsPerWeek = numberOrZero(dom.goalQuestionsInput.value);
  state.goals.revisionsPerWeek = numberOrZero(dom.goalRevisionsInput.value);
  persist("save_goals", { ...state.goals });
}

function saveSyncInputs() {
  state.sync.url = (dom.syncUrlInput.value || "").trim();
  state.sync.anonKey = (dom.syncKeyInput.value || "").trim();
  state.sync.table = (dom.syncTableInput.value || "study_state").trim() || "study_state";
  state.sync.profileId = (dom.syncProfileInput.value || "arthur").trim() || "arthur";
  state.sync.autoSync = Boolean(dom.syncAutoInput.checked);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function syncTest() {
  try {
    const cfg = syncConfigOrThrow();
    const url = `${cfg.baseUrl}/rest/v1/${encodeURIComponent(cfg.table)}?select=id&limit=1`;
    const response = await fetch(url, { method: "GET", headers: buildSyncHeaders(cfg) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    updateSyncStatus("Conexão de sincronização OK.", false);
  } catch (error) {
    updateSyncStatus(`Teste falhou: ${error.message}`, true);
  }
}

async function syncUpload(isAuto = false) {
  try {
    const cfg = syncConfigOrThrow();
    const url = `${cfg.baseUrl}/rest/v1/${encodeURIComponent(cfg.table)}?on_conflict=id`;

    const body = JSON.stringify([{ id: cfg.profileId, payload: state, updated_at: new Date().toISOString() }]);
    const response = await fetch(url, {
      method: "POST",
      headers: { ...buildSyncHeaders(cfg), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    state.sync.lastSyncAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!isAuto) renderSettings();
    updateSyncStatus(`Sync enviada (${new Date(state.sync.lastSyncAt).toLocaleString("pt-BR")}).`, false);
  } catch (error) {
    if (!isAuto) updateSyncStatus(`Upload falhou: ${error.message}`, true);
    throw error;
  }
}

async function syncDownload() {
  try {
    const cfg = syncConfigOrThrow();
    const profile = encodeURIComponent(cfg.profileId);
    const url = `${cfg.baseUrl}/rest/v1/${encodeURIComponent(cfg.table)}?id=eq.${profile}&select=payload,updated_at&limit=1`;

    const response = await fetch(url, { method: "GET", headers: buildSyncHeaders(cfg) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length || !rows[0].payload) throw new Error("Nenhum payload encontrado.");

    state = normalizeState(rows[0].payload);
    ensureAllTopicStates();
    state.sync = { ...state.sync, url: cfg.baseUrl, anonKey: cfg.anonKey, table: cfg.table, profileId: cfg.profileId, autoSync: cfg.autoSync, lastSyncAt: rows[0].updated_at || new Date().toISOString() };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSectionVisibility();
    renderCurrentSection({ force: true });
    updateSyncStatus("Payload baixado com sucesso.", false);
  } catch (error) {
    updateSyncStatus(`Download falhou: ${error.message}`, true);
  }
}

function syncConfigOrThrow() {
  const baseUrl = (state.sync.url || "").replace(/\/+$/, "");
  const anonKey = (state.sync.anonKey || "").trim();
  const table = (state.sync.table || "study_state").trim();
  const profileId = (state.sync.profileId || "arthur").trim();

  if (!baseUrl || !anonKey || !table || !profileId) throw new Error("Preencha URL, key, tabela e profile ID.");
  return { baseUrl, anonKey, table, profileId, autoSync: Boolean(state.sync.autoSync) };
}

function buildSyncHeaders(cfg) {
  return { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` };
}

function updateSyncStatus(message, isError) {
  dom.syncStatus.textContent = message;
  dom.syncStatus.style.color = isError ? "#9b2f2f" : "#415c73";
}

function exportBackup() {
  downloadText(`cronograma-backup-${todayISO()}.json`, JSON.stringify(state, null, 2));
  logActivity("export_backup", { date: todayISO() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    state = normalizeState(parsed);
    ensureAllTopicStates();
    persist("import_backup", { file: file.name });
  } catch (error) {
    window.alert(`Falha ao importar JSON: ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

function fillFilters() {
  dom.filterArea.insertAdjacentHTML("beforeend", baseData.areas.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join(""));
  dom.filterWeek.insertAdjacentHTML(
    "beforeend",
    baseData.blocks.map((block) => `<option value="${block.id}">${escapeHtml(block.weekLabel)} (${formatDate(getBlockStartDate(block.id))})</option>`).join(""),
  );
}

function metricCard(title, value, subtitle = "") {
  return `<article class="kpi-card"><h4>${escapeHtml(title)}</h4><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(subtitle)}</small></article>`;
}

function progressBarTemplate(label, value, detail) {
  const pct = clamp(Number(value) || 0, 0, 100);
  return `<div class="progress-item"><div class="head"><span>${escapeHtml(label)}</span><strong>${pct.toFixed(0)}%</strong></div><div class="progress-bar"><span style="width:${pct}%"></span></div><small>${escapeHtml(detail)}</small></div>`;
}

function taskColumnTemplate(title, tasks) {
  const html = tasks.length ? tasks.map((task) => taskCardTemplate(task)).join("") : `<div class="empty-state">Sem itens.</div>`;
  return `<article class="task-column"><h3>${escapeHtml(title)} <small>(${tasks.length})</small></h3><div class="task-list">${html}</div></article>`;
}

function taskCardTemplate(task) {
  return `
    <div class="task-card priority-${task.priority} ${task.status} ${task.isCritical ? "critical" : ""}">
      <div class="line-1"><span class="pill ${task.status}">${STATUS_META[task.status].label}</span><span>${escapeHtml(stageShort(task.stageId))}</span></div>
      <div class="topic">${escapeHtml(task.topic.topic)}</div>
      <small><span class="icon-chip"><i class="${areaIcon(task.area)}"></i></span> ${escapeHtml(task.area)} <span class="priority-chip priority-${task.priority}">${escapeHtml(task.topic.priorityLabel)}</span></small>
      <small>${task.daysOverdue > 0 ? `Atraso: ${task.daysOverdue}d` : "No prazo"}</small>
      <div class="task-actions"><button class="mini-btn action-open-list" data-topic-id="${task.topicId}">Abrir</button><button class="mini-btn action-done" data-topic-id="${task.topicId}" data-stage-id="${task.stageId}">Marcar feito</button></div>
    </div>
  `;
}

function weeklyTaskEditorCard(task) {
  const stage = state.topics[task.topicId].stages[task.stageId];
  const status = getStageStatus(task.topic, task.stageId, state.topics[task.topicId]);

  return `
    <div class="task-card priority-${task.priority} ${status}">
      <div class="line-1">
        <span class="pill ${status}">${STATUS_META[status].label}</span>
        <span>${escapeHtml(stageShort(task.stageId))}</span>
      </div>
      <div class="topic">${escapeHtml(task.topic.topic)}</div>
      <small>${escapeHtml(task.topic.area)}</small>
      <div class="quick-edit-row">
        <label class="quick-check">
          <input class="quick-stage-done" data-topic-id="${task.topicId}" data-stage-id="${task.stageId}" type="checkbox" ${stage.done ? "checked" : ""}>
          Feito
        </label>
        <div class="ratio-input ratio-compact">
          <input class="quick-stage-correct" data-topic-id="${task.topicId}" data-stage-id="${task.stageId}" data-field="correct" type="number" min="0" value="${stage.correct || ""}" placeholder="Ac" />
          <span>/</span>
          <input class="quick-stage-total" data-topic-id="${task.topicId}" data-stage-id="${task.stageId}" data-field="total" type="number" min="0" value="${stage.total || ""}" placeholder="Q" />
        </div>
      </div>
    </div>
  `;
}

function rankItemTemplate(item) {
  const rate = Number.isFinite(item.rate) ? `${toPercent(item.rate)}%` : "-";
  return `<strong>${escapeHtml(item.topic.topic)}</strong> <small>${escapeHtml(item.topic.area)} | ${rate} | ${item.total}q</small>`;
}

function renderRankList(id, items, template) {
  const node = document.getElementById(id);
  if (!node) return;
  node.innerHTML = items?.length ? items.slice(0, 12).map((item) => `<li>${template(item)}</li>`).join("") : `<li>Sem dados suficientes.</li>`;
}

function groupTopicsByBlock(topics) {
  const map = new Map();
  for (const topic of topics) {
    if (!map.has(topic.blockId)) map.set(topic.blockId, []);
    map.get(topic.blockId).push(topic);
  }

  for (const arr of map.values()) {
    arr.sort((a, b) => (a.priorityRank - b.priorityRank) || (a.sourceRow - b.sourceRow));
  }

  return map;
}

function buildTasks(topics, options = {}) {
  const includeDone = options.includeDone ?? true;
  const tasks = [];

  for (const topic of topics) {
    const topicState = state.topics[topic.id];

    for (const stage of STAGES) {
      const dueDate = getStageDueDate(topic, stage.id, topicState);
      if (!dueDate) continue;

      const status = getStageStatus(topic, stage.id, topicState);
      if (!includeDone && status === "done") continue;

      const s = topicState.stages[stage.id];
      const days = dueDate < todayISO() ? diffDays(todayISO(), dueDate) : 0;
      const rate = s.total > 0 ? s.correct / s.total : null;

      tasks.push({
        id: `${topic.id}:${stage.id}`,
        topicId: topic.id,
        stageId: stage.id,
        dueDate,
        status,
        daysOverdue: days,
        isCritical: days >= 14 || (rate !== null && s.total >= 10 && rate < 0.45),
        priority: topic.priority,
        priorityRank: topic.priorityRank,
        area: topic.area,
        topic,
      });
    }
  }

  return tasks;
}

function groupTasksByDate(tasks) {
  const map = new Map();
  for (const task of tasks) {
    if (!map.has(task.dueDate)) map.set(task.dueDate, []);
    map.get(task.dueDate).push(task);
  }
  return map;
}

function getBlockStartDate(blockId) {
  return shiftedBlockStartById.get(blockId) || null;
}

function getTopicPlannedDate(topic) {
  return shiftedPlannedByTopicId.get(topic.id) || topic.plannedDate || topic.weekStartDate || null;
}

function getStudyDueDate(topic, topicState) {
  return topicState.studyDueOverride || getTopicPlannedDate(topic) || getBlockStartDate(topic.blockId) || topic.weekStartDate || null;
}

function getStudyAnchorDate(topic, topicState) {
  const study = topicState.stages.study;
  if (study.date) return study.date;
  if (study.done) return getStudyDueDate(topic, topicState);
  return null;
}

function getStageDueDate(topic, stageId, topicState) {
  if (stageId === "study") return getStudyDueDate(topic, topicState);

  const stage = topicState.stages[stageId];
  if (stage?.dueOverride) return stage.dueOverride;

  const anchor = getStudyAnchorDate(topic, topicState);
  if (!anchor) return null;
  return addDays(anchor, STAGE_BY_ID[stageId].offsetDays);
}

function getStageStatus(topic, stageId, topicState) {
  const stage = topicState.stages[stageId];
  const due = getStageDueDate(topic, stageId, topicState);

  const total = numberOrZero(stage.total);
  const correct = Math.min(numberOrZero(stage.correct), total);
  const hasQuestions = total > 0;

  if (stage.done && hasQuestions) return "done";
  if (stage.done && !hasQuestions) return "partial";
  if (!stage.done && hasQuestions) return "partial";
  if (!due) return "waiting";
  if (due < todayISO()) return "overdue";
  return "pending";
}

function getTopicStatus(topic, topicState) {
  const statuses = STAGES.map((stage) => getStageStatus(topic, stage.id, topicState));
  if (statuses.includes("overdue")) return "overdue";
  if (statuses.includes("partial")) return "partial";
  if (statuses.every((status) => status === "done" || status === "waiting")) return "done";
  return "pending";
}

function computeDomainScore(topic, topicState) {
  let done = 0;
  let totalQ = 0;
  let correctQ = 0;
  const rates = [];

  for (const stage of STAGES) {
    const s = topicState.stages[stage.id];
    if (s.done) done += 1;

    const total = numberOrZero(s.total);
    const correct = Math.min(numberOrZero(s.correct), total);
    if (total > 0) {
      totalQ += total;
      correctQ += correct;
      rates.push(correct / total);
    }
  }

  const coverage = done / STAGES.length;
  const accuracy = totalQ > 0 ? correctQ / totalQ : 0;

  let trend = 0.5;
  if (rates.length >= 2) trend = clamp((rates[rates.length - 1] - rates[0] + 0.3) / 0.6, 0, 1);

  const score = Math.round(coverage * 40 + accuracy * 45 + trend * 15);

  if (score >= 80) return { score, label: "Dominado", cls: "score-dominado" };
  if (score >= 60) return { score, label: "Intermediário", cls: "score-intermediario" };
  if (score >= 40) return { score, label: "Frágil", cls: "score-fragil" };
  return { score, label: "Crítico", cls: "score-critico" };
}

function computeTotals(topics) {
  let doneStudyTopics = 0;
  let doneRevisions = 0;
  let pendingRevisions = 0;
  let overdueTasks = 0;
  let questionsTotal = 0;
  let questionsCorrect = 0;
  let attemptedStages = 0;
  let doneTasks = 0;
  let expectedTasks = 0;
  let expectedRevisions = 0;

  for (const topic of topics) {
    const topicState = state.topics[topic.id];

    for (const stage of STAGES) {
      const due = getStageDueDate(topic, stage.id, topicState);
      const status = getStageStatus(topic, stage.id, topicState);
      const st = topicState.stages[stage.id];

      if (stage.id === "study") expectedTasks += 1;
      else if (due) {
        expectedTasks += 1;
        expectedRevisions += 1;
      }

      if (status === "done") doneTasks += 1;
      if (status === "overdue") overdueTasks += 1;

      if (stage.id !== "study") {
        if (status === "done") doneRevisions += 1;
        if (status === "pending" || status === "overdue" || status === "partial") pendingRevisions += 1;
      }

      const total = numberOrZero(st.total);
      const correct = Math.min(numberOrZero(st.correct), total);
      if (total > 0) {
        attemptedStages += 1;
        questionsTotal += total;
        questionsCorrect += correct;
      }
    }

    if (topicState.stages.study.done) doneStudyTopics += 1;
  }

  return {
    totalTopics: topics.length,
    doneStudyTopics,
    doneRevisions,
    pendingRevisions,
    overdueTasks,
    questionsTotal,
    questionsCorrect,
    questionsWrong: Math.max(questionsTotal - questionsCorrect, 0),
    attemptedStages,
    accuracy: percentNum(questionsCorrect, questionsTotal),
    doneTasks,
    expectedTasks,
    expectedRevisions,
    overallProgress: percentNum(doneTasks, expectedTasks) * 100,
    reviewProgress: percentNum(doneRevisions, expectedRevisions) * 100,
  };
}

function computeAreaProgress(topics) {
  const map = new Map();
  for (const topic of topics) {
    if (!map.has(topic.area)) map.set(topic.area, { area: topic.area, done: 0, total: 0 });
    const row = map.get(topic.area);
    const topicState = state.topics[topic.id];

    for (const stage of STAGES) {
      const due = getStageDueDate(topic, stage.id, topicState);
      if (stage.id === "study" || due) {
        row.total += 1;
        if (getStageStatus(topic, stage.id, topicState) === "done") row.done += 1;
      }
    }
  }

  return Array.from(map.values()).map((row) => ({ ...row, progress: percentNum(row.done, row.total) * 100 })).sort((a, b) => b.progress - a.progress);
}

function computeWeekProgress(topics) {
  const map = new Map();
  for (const topic of topics) {
    if (!map.has(topic.blockId)) map.set(topic.blockId, { weekLabel: topic.weekLabel, done: 0, total: 0 });
    const row = map.get(topic.blockId);
    const topicState = state.topics[topic.id];

    for (const stage of STAGES) {
      const due = getStageDueDate(topic, stage.id, topicState);
      if (stage.id === "study" || due) {
        row.total += 1;
        if (getStageStatus(topic, stage.id, topicState) === "done") row.done += 1;
      }
    }
  }

  return Array.from(map.values()).map((row) => ({ ...row, progress: percentNum(row.done, row.total) * 100 })).sort((a, b) => b.progress - a.progress);
}

function collectAllIssues(topics) {
  const today = todayISO();
  const issues = [];

  for (const topic of topics) {
    const topicState = state.topics[topic.id];

    for (const stage of STAGES) {
      const st = topicState.stages[stage.id];
      const due = getStageDueDate(topic, stage.id, topicState);
      const status = getStageStatus(topic, stage.id, topicState);

      const total = numberOrZero(st.total);
      const done = Boolean(st.done);

      if (due && due <= today && (status === "pending" || status === "overdue")) {
        issues.push({ topic, stageId: stage.id, status, dueDate: due, daysOverdue: due < today ? diffDays(today, due) : 0, message: stage.id === "study" ? "Assunto não estudado no prazo." : "Revisão vencida não concluída." });
      }

      if (done && total === 0) issues.push({ topic, stageId: stage.id, status: "partial", dueDate: due, daysOverdue: 0, message: "Feito sem questões registradas." });
      if (!done && total > 0) issues.push({ topic, stageId: stage.id, status: "partial", dueDate: due, daysOverdue: due && due < today ? diffDays(today, due) : 0, message: "Questões registradas sem marcar conclusão." });
    }
  }

  return issues;
}

function computeAnalytics(topics) {
  let questionsTotal = 0;
  let correctTotal = 0;

  const areaMap = new Map();
  const topicRows = [];
  const stageAverage = { study: [], rev1w: [], rev1m: [], rev3m: [], rev6m: [] };

  const falseMastery = [];
  const improvedAfterReview = [];
  const persistentLow = [];

  for (const topic of topics) {
    const topicState = state.topics[topic.id];
    let topicTotal = 0;
    let topicCorrect = 0;
    const perStage = {};

    if (!areaMap.has(topic.area)) areaMap.set(topic.area, { area: topic.area, questions: 0, correct: 0, studied: 0, reviews: 0 });
    const area = areaMap.get(topic.area);

    if (topicState.stages.study.done) area.studied += 1;

    for (const stage of STAGES) {
      const st = topicState.stages[stage.id];
      const total = numberOrZero(st.total);
      const correct = Math.min(numberOrZero(st.correct), total);

      if (stage.id !== "study" && st.done) area.reviews += 1;

      if (total > 0) {
        const rate = correct / total;
        perStage[stage.id] = { rate, total };
        stageAverage[stage.id].push(rate);

        topicTotal += total;
        topicCorrect += correct;
        questionsTotal += total;
        correctTotal += correct;

        area.questions += total;
        area.correct += correct;
      }
    }

    if (topicTotal > 0) topicRows.push({ topic, total: topicTotal, correct: topicCorrect, rate: topicCorrect / topicTotal, perStage });

    const s0 = perStage.study?.rate;
    const later = ["rev1w", "rev1m", "rev3m", "rev6m"].map((id) => perStage[id]?.rate).filter((v) => v != null);
    if (s0 != null && later.length) {
      const minLater = Math.min(...later);
      const lastLater = later[later.length - 1];
      if (s0 >= 0.7 && minLater <= 0.5) falseMastery.push({ topic, rate: minLater, total: topicTotal });
      if (s0 <= 0.5 && lastLater >= 0.7) improvedAfterReview.push({ topic, rate: lastLater, total: topicTotal });
      if ([s0, ...later].every((v) => v <= 0.6)) persistentLow.push({ topic, rate: lastLater, total: topicTotal });
    }
  }

  const areaRows = Array.from(areaMap.values()).map((item) => ({ ...item, accuracy: percentNum(item.correct, item.questions) })).sort((a, b) => b.questions - a.questions).slice(0, 12);
  const rankErrorRate = [...topicRows].filter((x) => x.total >= 10).sort((a, b) => a.rate - b.rate || b.total - a.total).slice(0, 20);
  const rankWorstTotal = [...topicRows].filter((x) => x.total >= 12).sort((a, b) => a.rate - b.rate || b.total - a.total).slice(0, 20);

  const stageRank = (stageId) => topicRows.filter((x) => x.perStage[stageId] && x.perStage[stageId].total >= 5).map((x) => ({ topic: x.topic, total: x.perStage[stageId].total, rate: x.perStage[stageId].rate })).sort((a, b) => a.rate - b.rate || b.total - a.total).slice(0, 20);

  const rankFragile = topics.map((topic) => ({ topic, total: 0, rate: computeDomainScore(topic, state.topics[topic.id]).score / 100 })).sort((a, b) => a.rate - b.rate).slice(0, 20);

  const avgStage = {};
  for (const stage of STAGES) {
    const arr = stageAverage[stage.id];
    avgStage[stage.id] = arr.length ? arr.reduce((sum, val) => sum + val, 0) / arr.length : 0;
  }

  return {
    questionsTotal,
    correctTotal,
    wrongTotal: Math.max(questionsTotal - correctTotal, 0),
    accuracy: percentNum(correctTotal, questionsTotal),
    attemptedTopics: topicRows.length,
    areaRows,
    stageAverage: avgStage,
    rankErrorRate,
    rankWorstTotal,
    rankRev1w: stageRank("rev1w"),
    rankRev1m: stageRank("rev1m"),
    rankRev3m: stageRank("rev3m"),
    rankRev6m: stageRank("rev6m"),
    rankFragile,
    falseMastery,
    improvedAfterReview,
    persistentLow,
  };
}
function computeNeglectedAreas(topics) {
  const map = new Map();

  for (const topic of topics) {
    if (!map.has(topic.area)) map.set(topic.area, { area: topic.area, pending: 0, total: 0 });
    const row = map.get(topic.area);
    const topicState = state.topics[topic.id];

    for (const stage of STAGES) {
      const due = getStageDueDate(topic, stage.id, topicState);
      if (stage.id === "study" || due) {
        row.total += 1;
        const status = getStageStatus(topic, stage.id, topicState);
        if (status === "pending" || status === "overdue" || status === "partial") row.pending += 1;
      }
    }
  }

  return Array.from(map.values()).map((x) => ({ ...x, ratio: percentNum(x.pending, x.total) })).sort((a, b) => b.ratio - a.ratio);
}

function computeWeeklyExecutive(topics) {
  const { start, end } = weekBounds(new Date());
  const tasks = buildTasks(topics, { includeDone: true });

  let total = 0;
  let done = 0;
  let overdue = 0;
  let pending = 0;
  let highPriority = 0;
  let criticalReviews = 0;
  let questions = 0;
  let correct = 0;

  for (const task of tasks) {
    if (task.dueDate < start || task.dueDate > end) continue;

    total += 1;
    if (task.priorityRank === 1) highPriority += 1;
    if (task.status === "done") done += 1;
    if (task.status === "overdue") overdue += 1;
    if (task.status === "pending" || task.status === "partial") pending += 1;
    if (task.stageId !== "study" && task.daysOverdue >= 14) criticalReviews += 1;

    const stage = state.topics[task.topicId].stages[task.stageId];
    if (stage.date && stage.date >= start && stage.date <= end) {
      questions += numberOrZero(stage.total);
      correct += Math.min(numberOrZero(stage.correct), numberOrZero(stage.total));
    }
  }

  return { total, done, overdue, pending, highPriority, criticalReviews, questions, correct };
}

function computeGoalProgress(topics) {
  const { start, end } = weekBounds(new Date());
  let topicsDone = 0;
  let revisionsDone = 0;
  let questionsDone = 0;

  for (const topic of topics) {
    const topicState = state.topics[topic.id];
    const study = topicState.stages.study;

    if (study.done && study.date && study.date >= start && study.date <= end) topicsDone += 1;

    for (const stage of STAGES.filter((item) => item.id !== "study")) {
      const s = topicState.stages[stage.id];
      if (s.done && s.date && s.date >= start && s.date <= end) revisionsDone += 1;
    }

    for (const stage of STAGES) {
      const s = topicState.stages[stage.id];
      if (s.date && s.date >= start && s.date <= end) questionsDone += numberOrZero(s.total);
    }
  }

  return {
    goals: state.goals,
    topicsDone,
    revisionsDone,
    questionsDone,
    topicsPct: percentNum(topicsDone, state.goals.topicsPerWeek) * 100,
    revisionsPct: percentNum(revisionsDone, state.goals.revisionsPerWeek) * 100,
    questionsPct: percentNum(questionsDone, state.goals.questionsPerWeek) * 100,
  };
}

function computeConsistency() {
  const events = collectCompletionEvents();
  const studyDates = new Set(events.filter((entry) => entry.type === "study").map((entry) => entry.date));
  const reviewDates = new Set(events.filter((entry) => entry.type === "review").map((entry) => entry.date));

  return {
    studyStreak: computeStreak(studyDates),
    reviewStreak: computeStreak(reviewDates),
    consistentWeeks: computeConsistentWeeks(events),
  };
}

function collectCompletionEvents() {
  const events = [];
  for (const topic of baseData.topics) {
    const topicState = state.topics[topic.id];
    for (const stage of STAGES) {
      const s = topicState.stages[stage.id];
      if (!s.done || !s.date) continue;
      events.push({ date: s.date, type: stage.id === "study" ? "study" : "review", questions: numberOrZero(s.total) });
    }
  }
  return events;
}

function computeStreak(dateSet) {
  let streak = 0;
  const date = new Date();
  while (dateSet.has(isoDate(date))) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

function computeConsistentWeeks(events) {
  const weeks = new Map();

  for (const entry of events) {
    const date = parseISODate(entry.date);
    if (!date) continue;

    const { start } = weekBounds(date);
    if (!weeks.has(start)) weeks.set(start, { study: new Set(), review: new Set() });

    const row = weeks.get(start);
    if (entry.type === "study") row.study.add(entry.date);
    else row.review.add(entry.date);
  }

  let count = 0;
  for (const row of weeks.values()) {
    if (row.study.size >= 2 && row.review.size >= 2) count += 1;
  }
  return count;
}

function buildDailySeries(days, events) {
  const map = new Map();
  for (const event of events) {
    if (!map.has(event.date)) map.set(event.date, { study: 0, review: 0, questions: 0 });
    const row = map.get(event.date);
    if (event.type === "study") row.study += 1;
    else row.review += 1;
    row.questions += event.questions;
  }

  const labels = [];
  const study = [];
  const review = [];
  const questions = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const iso = isoDate(date);
    const row = map.get(iso) || { study: 0, review: 0, questions: 0 };

    labels.push(new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
    study.push(row.study);
    review.push(row.review);
    questions.push(row.questions);
  }

  return { labels, study, review, questions };
}

function buildHeatmapData(days) {
  const map = new Map();
  for (const item of state.activity) {
    const date = item.ts.slice(0, 10);
    map.set(date, (map.get(date) || 0) + 1);
  }

  const values = [];
  let max = 0;

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const iso = isoDate(date);
    const count = map.get(iso) || 0;
    values.push({ date: iso, count });
    if (count > max) max = count;
  }

  return values.map((entry) => ({ ...entry, level: max === 0 ? 0 : Math.min(5, Math.ceil((entry.count / max) * 5)) }));
}

function drawChart(canvasId, config) {
  if (charts[canvasId]) charts[canvasId].destroy();
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  charts[canvasId] = new window.Chart(canvas, config);
}

function sortTaskByPriorityThenDate(a, b) {
  if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
  if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  return a.topic.sourceRow - b.topic.sourceRow;
}

function sortTaskByPriorityAndDelay(a, b) {
  if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
  if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
  return a.dueDate.localeCompare(b.dueDate);
}

function stageShort(stageId) {
  return STAGE_BY_ID[stageId]?.short || stageId;
}

function areaIcon(area) {
  const value = normalizeText(area);
  if (value.includes("cardio")) return "fa-solid fa-heart-pulse";
  if (value.includes("cirurgia")) return "fa-solid fa-scalpel";
  if (value.includes("pedi") || value.includes("neo")) return "fa-solid fa-baby";
  if (value.includes("gine") || value.includes("obst")) return "fa-solid fa-venus";
  if (value.includes("neurolog")) return "fa-solid fa-brain";
  if (value.includes("infect")) return "fa-solid fa-bacteria";
  if (value.includes("endocr")) return "fa-solid fa-vials";
  if (value.includes("prevent") || value.includes("coletiva")) return "fa-solid fa-shield-heart";
  if (value.includes("hemat")) return "fa-solid fa-droplet";
  if (value.includes("nefro")) return "fa-solid fa-kidneys";
  if (value.includes("pneumo")) return "fa-solid fa-lungs";
  return "fa-solid fa-user-doctor";
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function blockSortValue(value) {
  const n = Number.parseInt(String(value || "0").split("-")[0], 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function numberOrZero(value) {
  const n = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function percentNum(num, den) {
  if (!den || den <= 0) return 0;
  return num / den;
}

function toPercent(rate) {
  return (Number(rate) * 100).toFixed(1);
}

function todayISO() {
  return isoDate(new Date());
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(iso) {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(iso, days) {
  const date = parseISODate(iso);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function formatDate(iso) {
  const date = parseISODate(iso);
  if (!date) return "-";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function diffDays(laterIso, earlierIso) {
  const a = parseISODate(laterIso);
  const b = parseISODate(earlierIso);
  if (!a || !b) return 0;
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

function weekBounds(dateRef) {
  const date = new Date(dateRef);
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  const start = isoDate(date);
  return { start, end: addDays(start, 6) };
}

function getMonday(dateRef) {
  const date = new Date(dateRef);
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  date.setHours(0, 0, 0, 0);
  return date;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function debounce(fn, wait) {
  let id = null;
  return (...args) => {
    if (id) clearTimeout(id);
    id = setTimeout(() => fn(...args), wait);
  };
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


