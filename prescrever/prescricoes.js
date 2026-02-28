const STORAGE_FAVORITES_KEY = "prescrever:favoritos:v1";

const dom = {
  areaFilters: document.getElementById("areaFilters"),
  searchInput: document.getElementById("searchInput"),
  loadingState: document.getElementById("loadingState"),
  errorState: document.getElementById("errorState"),
  emptyState: document.getElementById("emptyState"),
  protocolList: document.getElementById("protocolList")
};

const areaIconSourceCache = new Map();
const areaIconMissingCache = new Set();

const state = {
  areas: [],
  protocols: [],
  activeFilter: "favorites",
  search: "",
  favorites: new Set(loadFavorites()),
  selectedItems: new Set(),
  expandedId: "",
  expandedSections: new Map(),
  loading: true,
  error: ""
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asString(value) {
  return typeof value === "string" ? value : "";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeIconStem(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function areaIconFileCandidates(areaName, areaSlug) {
  const stems = [asString(areaSlug).trim(), normalizeIconStem(areaName), asString(areaName).trim(), asString(areaName).trim().toLowerCase()]
    .filter((value) => isNonEmptyString(value));
  const unique = [...new Set(stems)];
  return unique.map((stem) => `./data/${encodeURIComponent(stem)}.png`);
}

function createAreaIconNode(areaName, areaSlug, className) {
  const wrap = document.createElement("span");
  wrap.className = className;

  const img = document.createElement("img");
  img.className = "area-icon-img";
  img.alt = "";
  img.loading = "lazy";
  wrap.appendChild(img);

  const fallback = document.createElement("span");
  fallback.className = "area-icon-fallback";
  fallback.textContent = "◻";
  wrap.appendChild(fallback);

  const cacheKey =
    (isNonEmptyString(areaSlug) ? asString(areaSlug).trim().toLowerCase() : "") ||
    normalizeIconStem(areaName) ||
    asString(areaName).trim().toLowerCase();

  if (areaIconMissingCache.has(cacheKey)) {
    img.remove();
    wrap.classList.add("no-img");
    return wrap;
  }

  const candidates = areaIconFileCandidates(areaName, areaSlug);
  const cachedSrc = areaIconSourceCache.get(cacheKey);
  if (cachedSrc) {
    wrap.classList.add("has-img");
    const cachedIndex = candidates.indexOf(cachedSrc);
    if (cachedIndex > 0) {
      candidates.splice(cachedIndex, 1);
      candidates.unshift(cachedSrc);
    } else if (cachedIndex === -1) {
      candidates.unshift(cachedSrc);
    }
  }
  let index = 0;

  function tryNext() {
    if (index >= candidates.length) {
      areaIconSourceCache.delete(cacheKey);
      areaIconMissingCache.add(cacheKey);
      img.remove();
      wrap.classList.remove("has-img");
      wrap.classList.add("no-img");
      return;
    }
    img.src = candidates[index];
    index += 1;
  }

  img.addEventListener("load", () => {
    wrap.classList.add("has-img");
    areaIconSourceCache.set(cacheKey, img.currentSrc || img.src);
    areaIconMissingCache.delete(cacheKey);
  });
  img.addEventListener("error", () => {
    wrap.classList.remove("has-img");
    tryNext();
  });

  tryNext();
  return wrap;
}

function createSusNode(variant = "or") {
  const wrap = document.createElement("span");
  wrap.className = `sus-pill ${variant === "add" ? "is-add" : "is-or"}`;
  wrap.title = "Disponível no SUS";
  wrap.textContent = "Disponível no SUS";
  return wrap;
}

function normalizeMeta(meta) {
  return {
    orientacoes: asString(meta?.orientacoes).trim(),
    alertas: asString(meta?.alertas).trim(),
    notas: asString(meta?.notas).trim()
  };
}

function normalizeItemMeta(meta) {
  return {
    contraindicacoes: asString(meta?.contraindicacoes).trim(),
    orientacoes: asString(meta?.orientacoes).trim(),
    alertas: asString(meta?.alertas).trim()
  };
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_FAVORITES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch (_error) {
    return [];
  }
}

function saveFavorites() {
  localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify([...state.favorites]));
}

function itemHasPrescriptionContent(item) {
  return isNonEmptyString(item?.nome) || isNonEmptyString(item?.apresentacao) || isNonEmptyString(item?.posologia);
}

function buildItemKey(protocolId, sectionIndex, groupIndex, itemIndex) {
  return `${protocolId}::${sectionIndex}:${groupIndex}:${itemIndex}`;
}

function buildDashSeparator() {
  return "-".repeat(20);
}

function buildVisualDashSeparator() {
  return "-".repeat(420);
}

function splitTopicLines(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[•·]/g, "\n")
    .split(/\n|;/)
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function buildPrescriptionEntryLines(item, number) {
  const name = isNonEmptyString(item.nome) ? item.nome : "Medicamento";
  const presentation = isNonEmptyString(item.apresentacao) ? item.apresentacao : "sem apresentação";
  const usage = isNonEmptyString(item.posologia) ? item.posologia : "-";
  const lines = [];
  lines.push(`${number}. ${name} ${buildDashSeparator()} ${presentation}`);
  lines.push(`Uso : ${usage}`);

  if (isNonEmptyString(item.meta.contraindicacoes)) {
    lines.push(`Contraindicações: ${item.meta.contraindicacoes}`);
  }
  if (isNonEmptyString(item.meta.orientacoes)) {
    lines.push(`Orientações ao profissional: ${item.meta.orientacoes}`);
  }
  if (isNonEmptyString(item.meta.alertas)) {
    lines.push(`Alertas: ${item.meta.alertas}`);
  }

  return lines;
}

function entriesToPrescriptionText(entries) {
  const lines = [];
  entries.forEach((entry, index) => {
    lines.push(...buildPrescriptionEntryLines(entry.item, index + 1));
    lines.push("");
  });
  return lines.join("\n").trim();
}

function collectStructuredEntries(protocol) {
  const entries = [];

  protocol.sections.forEach((section, sectionIndex) => {
    if (section.mode !== "structured") {
      return;
    }

    section.groups.forEach((group, groupIndex) => {
      group.items.forEach((item, itemIndex) => {
        if (!itemHasPrescriptionContent(item)) {
          return;
        }
        entries.push({
          key: buildItemKey(protocol.id, sectionIndex, groupIndex, itemIndex),
          protocolId: protocol.id,
          sectionIndex,
          groupIndex,
          itemIndex,
          section,
          group,
          item
        });
      });
    });
  });

  return entries;
}

async function copyTextWithButtonFeedback(button, text, defaultLabel, copiedLabel = "Copiado") {
  if (!isNonEmptyString(text)) {
    button.textContent = "Nada para copiar";
    setTimeout(() => {
      button.textContent = defaultLabel;
    }, 1200);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    button.textContent = copiedLabel;
    setTimeout(() => {
      button.textContent = defaultLabel;
    }, 1200);
  } catch (_error) {
    button.textContent = "Erro ao copiar";
    setTimeout(() => {
      button.textContent = defaultLabel;
    }, 1200);
  }
}

function normalizeStructuredItem(item, index = 0) {
  return {
    id: isNonEmptyString(item?.id) ? item.id : `item-${index + 1}`,
    nome: asString(item?.nome).trim(),
    apresentacao: asString(item?.apresentacao).trim(),
    posologia: asString(item?.posologia).trim(),
    sus: Boolean(item?.sus),
    meta: normalizeItemMeta(item?.meta)
  };
}

function normalizeStructuredGroup(group, index = 0) {
  const items = Array.isArray(group?.items)
    ? group.items.map((item, itemIndex) => normalizeStructuredItem(item, itemIndex))
    : [];

  const type = group?.type === "add" ? "add" : "or";

  return {
    id: isNonEmptyString(group?.id) ? group.id : `group-${index + 1}`,
    type,
    rotulo: isNonEmptyString(group?.rotulo)
      ? group.rotulo.trim()
      : isNonEmptyString(group?.label)
        ? group.label.trim()
        : type === "add"
          ? "ASSOCIAR"
          : "OU",
    titulo: isNonEmptyString(group?.titulo)
      ? group.titulo.trim()
      : type === "or"
        ? "Escolha uma das opções abaixo:"
        : "Associar / adicionar",
    items
  };
}

function normalizeSection(tab, index = 0) {
  const title = isNonEmptyString(tab?.titulo) ? tab.titulo.trim() : `Seção ${index + 1}`;
  const slug = isNonEmptyString(tab?.slug) ? tab.slug : `secao-${index + 1}`;

  const groupsRaw = Array.isArray(tab?.structured?.groups)
    ? tab.structured.groups
    : Array.isArray(tab?.structured)
      ? tab.structured
      : [];

  const groups = groupsRaw.map((group, groupIndex) => normalizeStructuredGroup(group, groupIndex));
  const hasStructured = groups.some((group) => group.items.length > 0);

  const mode = tab?.mode === "free" ? "free" : hasStructured ? "structured" : "free";

  return {
    id: `${slug}-${index}`,
    title,
    slug,
    mode,
    meta: normalizeMeta(tab?.meta),
    groups,
    blocks: Array.isArray(tab?.blocks) ? tab.blocks : []
  };
}

function getMedicationCount(sections) {
  return sections.reduce((total, section) => {
    if (section.mode !== "structured") {
      return total;
    }

    const sectionCount = section.groups.reduce((acc, group) => acc + group.items.filter((item) => isNonEmptyString(item.nome)).length, 0);
    return total + sectionCount;
  }, 0);
}

function getSectionMedicationCount(section) {
  if (section.mode !== "structured") {
    return 0;
  }
  return section.groups.reduce(
    (acc, group) => acc + group.items.filter((item) => isNonEmptyString(item.nome)).length,
    0
  );
}

function getSectionInitial(title) {
  const text = asString(title).trim();
  return text ? text[0].toLocaleUpperCase("pt-BR") : "S";
}

function isSectionExpanded(protocolId, sectionId, totalSections) {
  const expanded = state.expandedSections.get(protocolId);
  if (!expanded) {
    return totalSections <= 1;
  }
  return expanded.has(sectionId);
}

function setSectionExpanded(protocolId, sectionId, expanded) {
  let protocolSections = state.expandedSections.get(protocolId);
  if (!protocolSections) {
    protocolSections = new Set();
    state.expandedSections.set(protocolId, protocolSections);
  }
  if (expanded) {
    protocolSections.add(sectionId);
  } else {
    protocolSections.delete(sectionId);
  }
  if (!protocolSections.size) {
    state.expandedSections.delete(protocolId);
  }
}

function buildProtocol(area, subject) {
  const areaName = isNonEmptyString(area?.area) ? area.area.trim() : "Area";
  const areaSlug = isNonEmptyString(area?.slug) ? area.slug : areaName.toLowerCase().replace(/\s+/g, "-");

  const title = isNonEmptyString(subject?.titulo) ? subject.titulo.trim() : "Sem título";
  const subjectSlug = isNonEmptyString(subject?.slug) ? subject.slug : title.toLowerCase().replace(/\s+/g, "-");

  const sections = Array.isArray(subject?.tabs)
    ? subject.tabs.map((tab, index) => normalizeSection(tab, index))
    : [];

  const tags = [];
  const slugParts = subjectSlug.split("-").filter(Boolean);
  for (const part of slugParts.slice(0, 3)) {
    tags.push(part.toUpperCase());
  }

  const protocol = {
    id: `${areaSlug}::${subjectSlug}`,
    areaName,
    areaSlug,
    title,
    slug: subjectSlug,
    descricao: asString(subject?.descricaoCurta).trim(),
    meta: normalizeMeta(subject?.meta),
    sections,
    medications: getMedicationCount(sections),
    tags
  };

  const searchable = [
    protocol.title,
    protocol.areaName,
    protocol.descricao,
    protocol.meta.orientacoes,
    protocol.meta.alertas,
    protocol.meta.notas,
    ...protocol.sections.flatMap((section) => [
      section.title,
      section.meta.orientacoes,
      section.meta.alertas,
      section.meta.notas,
      ...section.groups.flatMap((group) => [
        group.rotulo,
        group.titulo,
        ...group.items.flatMap((item) => [
          item.nome,
          item.apresentacao,
          item.posologia,
          item.meta.contraindicacoes,
          item.meta.orientacoes,
          item.meta.alertas
        ])
      ])
    ])
  ]
    .join(" ")
    .toLowerCase();

  protocol.searchable = searchable;

  return protocol;
}

function normalizeInlineContent(content) {
  if (!Array.isArray(content)) {
    return [];
  }
  return content
    .filter((span) => span && typeof span === "object" && typeof span.text === "string")
    .map((span) => ({
      text: span.text,
      marks: Array.isArray(span.marks) ? span.marks : []
    }));
}

function appendInline(container, content) {
  const spans = normalizeInlineContent(content);
  if (!spans.length) {
    return;
  }

  spans.forEach((span) => {
    let node = document.createTextNode(span.text);

    if (span.marks.includes("bold")) {
      const strong = document.createElement("strong");
      strong.appendChild(node);
      node = strong;
    }

    if (span.marks.includes("italic")) {
      const em = document.createElement("em");
      em.appendChild(node);
      node = em;
    }

    if (span.marks.includes("underline")) {
      const under = document.createElement("u");
      under.appendChild(node);
      node = under;
    }

    container.appendChild(node);
  });
}

function renderFreeBlocks(blocks) {
  const wrap = document.createElement("div");
  wrap.className = "free-blocks";

  if (!Array.isArray(blocks) || !blocks.length) {
    return wrap;
  }

  blocks.forEach((block) => {
    if (!block || typeof block !== "object") {
      return;
    }

    if (block.type === "heading") {
      const heading = document.createElement(block.level === 3 ? "h5" : "h4");
      appendInline(heading, block.content);
      wrap.appendChild(heading);
      return;
    }

    if (block.type === "paragraph") {
      const p = document.createElement("p");
      appendInline(p, block.content);
      wrap.appendChild(p);
      return;
    }

    if (block.type === "list") {
      const list = document.createElement(block.style === "ordered" ? "ol" : "ul");
      const items = Array.isArray(block.items) ? block.items : [];
      items.forEach((item) => {
        const li = document.createElement("li");
        appendInline(li, item?.content);
        list.appendChild(li);
      });
      wrap.appendChild(list);
      return;
    }

    if (block.type === "divider") {
      wrap.appendChild(document.createElement("hr"));
      return;
    }

    if (block.type === "callout") {
      const callout = document.createElement("div");
      callout.className = `free-callout ${block.tone === "warning" ? "warn" : block.tone === "danger" ? "danger" : block.tone === "success" ? "success" : ""}`;

      const title = document.createElement("div");
      title.className = "free-callout-title";
      title.textContent = isNonEmptyString(block.title) ? block.title : "Observação";
      callout.appendChild(title);

      const nested = renderFreeBlocks(block.blocks);
      callout.appendChild(nested);
      wrap.appendChild(callout);
      return;
    }

    if (block.type === "table") {
      const table = document.createElement("table");
      table.className = "free-table";

      const headers = Array.isArray(block.headers) ? block.headers : [];
      const rows = Array.isArray(block.rows) ? block.rows : [];
      const headerBackgrounds = Array.isArray(block.headerBackgrounds) ? block.headerBackgrounds : [];
      const rowBackgrounds = Array.isArray(block.rowBackgrounds) ? block.rowBackgrounds : [];

      if (headers.length) {
        const thead = document.createElement("thead");
        const tr = document.createElement("tr");
        headers.forEach((header, headerIndex) => {
          const th = document.createElement("th");
          th.textContent = String(header || "");
          const bg = headerBackgrounds[headerIndex];
          if (isNonEmptyString(bg)) {
            th.style.backgroundColor = bg;
          }
          tr.appendChild(th);
        });
        thead.appendChild(tr);
        table.appendChild(thead);
      }

      if (rows.length) {
        const tbody = document.createElement("tbody");
        rows.forEach((row, rowIndex) => {
          const tr = document.createElement("tr");
          const bgRow = Array.isArray(rowBackgrounds[rowIndex]) ? rowBackgrounds[rowIndex] : [];
          if (Array.isArray(row)) {
            row.forEach((cell, cellIndex) => {
              const td = document.createElement("td");
              td.textContent = String(cell || "");
              const bg = bgRow[cellIndex];
              if (isNonEmptyString(bg)) {
                td.style.backgroundColor = bg;
              }
              tr.appendChild(td);
            });
          }
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
      }

      wrap.appendChild(table);
    }
  });

  return wrap;
}

function renderMetaBox(title, text, cls = "soft", asTopics = false) {
  const box = document.createElement("div");
  box.className = `meta-box ${cls}`;

  const h4 = document.createElement("h4");
  const titleText = String(title || "");
  if (titleText.startsWith("⚠")) {
    const icon = document.createElement("span");
    icon.className = "meta-title-icon";
    icon.textContent = "⚠";
    h4.appendChild(icon);

    const label = document.createElement("span");
    label.className = "meta-title-text";
    label.textContent = titleText.replace(/^⚠\s*/, "");
    h4.appendChild(label);
  } else {
    h4.textContent = titleText;
  }
  box.appendChild(h4);

  if (asTopics) {
    const topics = splitTopicLines(text);
    const list = document.createElement("ul");
    list.className = "meta-topic-list";
    (topics.length ? topics : [text]).forEach((topic) => {
      const li = document.createElement("li");
      li.textContent = topic;
      list.appendChild(li);
    });
    box.appendChild(list);
  } else {
    const p = document.createElement("p");
    p.textContent = text;
    box.appendChild(p);
  }

  return box;
}

function medicationMetaEntries(item) {
  const out = [];
  if (isNonEmptyString(item.meta.contraindicacoes)) {
    out.push({ label: "Contraindicações", value: item.meta.contraindicacoes });
  }
  if (isNonEmptyString(item.meta.orientacoes)) {
    out.push({ label: "⚠ Orientações ao profissional", value: item.meta.orientacoes });
  }
  if (isNonEmptyString(item.meta.alertas)) {
    out.push({ label: "Alertas", value: item.meta.alertas });
  }
  return out;
}

function renderProtocolDetail(protocol) {
  const detail = document.createElement("div");
  detail.className = "protocol-detail";
  const protocolEntries = collectStructuredEntries(protocol);
  const protocolEntryKeys = protocolEntries.map((entry) => entry.key);

  const head = document.createElement("div");
  head.className = "detail-head";

  const meta = document.createElement("small");
  meta.textContent = `${protocol.areaName} · ${protocol.sections.length} seção(ões)`;
  head.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "detail-actions";

  const selectAllLabel = document.createElement("label");
  selectAllLabel.className = "copy-check";
  const selectAll = document.createElement("input");
  selectAll.type = "checkbox";
  selectAll.checked = protocolEntryKeys.length > 0 && protocolEntryKeys.every((key) => state.selectedItems.has(key));
  selectAll.disabled = !protocolEntryKeys.length;
  selectAll.addEventListener("change", () => {
    if (selectAll.checked) {
      protocolEntryKeys.forEach((key) => state.selectedItems.add(key));
    } else {
      protocolEntryKeys.forEach((key) => state.selectedItems.delete(key));
    }
    renderProtocols();
  });
  const selectAllText = document.createElement("span");
  selectAllText.textContent = "Marcar todos";
  selectAllLabel.appendChild(selectAll);
  selectAllLabel.appendChild(selectAllText);
  actions.appendChild(selectAllLabel);

  const copySelectedBtn = document.createElement("button");
  copySelectedBtn.type = "button";
  copySelectedBtn.className = "copy-btn";
  copySelectedBtn.textContent = "Copiar selecionados";
  copySelectedBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    const selected = protocolEntries.filter((entry) => state.selectedItems.has(entry.key));
    await copyTextWithButtonFeedback(copySelectedBtn, entriesToPrescriptionText(selected), "Copiar selecionados");
  });
  actions.appendChild(copySelectedBtn);

  const copyAllItemsBtn = document.createElement("button");
  copyAllItemsBtn.type = "button";
  copyAllItemsBtn.className = "copy-btn";
  copyAllItemsBtn.textContent = "Copiar todos os itens";
  copyAllItemsBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    await copyTextWithButtonFeedback(copyAllItemsBtn, entriesToPrescriptionText(protocolEntries), "Copiar todos os itens");
  });
  actions.appendChild(copyAllItemsBtn);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "copy-btn";
  copyBtn.textContent = "Copiar resumo";
  copyBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    const text = protocolToText(protocol);
    await copyTextWithButtonFeedback(copyBtn, text, "Copiar resumo");
  });

  actions.appendChild(copyBtn);
  head.appendChild(actions);
  detail.appendChild(head);

  if (isNonEmptyString(protocol.meta.orientacoes)) {
    detail.appendChild(renderMetaBox("⚠ Orientações ao profissional", protocol.meta.orientacoes, "orient", true));
  }
  if (isNonEmptyString(protocol.meta.alertas)) {
    detail.appendChild(renderMetaBox("Alertas gerais", protocol.meta.alertas, "warn"));
  }
  if (isNonEmptyString(protocol.meta.notas)) {
    detail.appendChild(renderMetaBox("Notas gerais", protocol.meta.notas, "soft"));
  }

  const sectionList = document.createElement("div");
  sectionList.className = "section-list";

  protocol.sections.forEach((section, sectionIndex) => {
    const sectionItem = document.createElement("details");
    sectionItem.className = "section-item";
    sectionItem.open = isSectionExpanded(protocol.id, section.id, protocol.sections.length);
    sectionItem.addEventListener("toggle", () => {
      setSectionExpanded(protocol.id, section.id, sectionItem.open);
    });

    const sectionSummary = document.createElement("summary");
    sectionSummary.className = "section-summary";

    const sectionAvatar = document.createElement("span");
    sectionAvatar.className = "section-avatar";
    sectionAvatar.textContent = getSectionInitial(section.title);

    const sectionMain = document.createElement("div");
    sectionMain.className = "section-main";

    const sectionTitle = document.createElement("h4");
    sectionTitle.className = "section-main-title";
    sectionTitle.textContent = section.title;
    sectionMain.appendChild(sectionTitle);

    const sectionSub = document.createElement("div");
    sectionSub.className = "section-main-sub";
    const sectionMeds = getSectionMedicationCount(section);
    const medsLabel = sectionMeds === 1 ? "1 medicamento" : `${sectionMeds} medicamentos`;
    sectionSub.textContent = `${protocol.areaName} · ${medsLabel}`;
    sectionMain.appendChild(sectionSub);

    const sectionArrow = document.createElement("span");
    sectionArrow.className = "section-arrow";
    sectionArrow.textContent = "▾";

    sectionSummary.appendChild(sectionAvatar);
    sectionSummary.appendChild(sectionMain);
    sectionSummary.appendChild(sectionArrow);
    sectionItem.appendChild(sectionSummary);

    const sectionBody = document.createElement("div");
    sectionBody.className = "section-body";

    const sectionCard = document.createElement("article");
    sectionCard.className = "section-card";

    if (isNonEmptyString(section.meta.orientacoes)) {
      sectionCard.appendChild(renderMetaBox("⚠ Orientações ao profissional", section.meta.orientacoes, "orient", true));
    }
    if (isNonEmptyString(section.meta.alertas)) {
      sectionCard.appendChild(renderMetaBox("Alertas da seção", section.meta.alertas, "warn"));
    }
    if (isNonEmptyString(section.meta.notas)) {
      sectionCard.appendChild(renderMetaBox("Notas da seção", section.meta.notas, "soft"));
    }

    if (section.mode === "structured" && section.groups.some((group) => group.items.some((item) => itemHasPrescriptionContent(item)))) {
      section.groups.forEach((group, groupIndex) => {
        const visibleItems = group.items
          .map((item, itemIndex) => ({ item, itemIndex }))
          .filter(({ item }) => itemHasPrescriptionContent(item));

        if (!visibleItems.length) {
          return;
        }

        const groupWrap = document.createElement("div");
        groupWrap.className = `group-block ${group.type === "add" ? "group-add" : "group-or"}`;

        const groupHead = document.createElement("div");
        groupHead.className = "group-head";

        const groupMain = document.createElement("div");
        groupMain.className = "group-main";

        const badge = document.createElement("span");
        badge.className = `group-kind ${group.type === "add" ? "add" : ""}`;
        badge.textContent = isNonEmptyString(group.rotulo)
          ? group.rotulo
          : group.type === "add"
            ? "ASSOCIAR"
            : "OU";

        const title = document.createElement("h5");
        title.className = "group-title";
        title.textContent = group.titulo;

        groupMain.appendChild(badge);
        groupMain.appendChild(title);
        groupHead.appendChild(groupMain);

        const groupActions = document.createElement("div");
        groupActions.className = "group-actions";
        const hasSusInGroup = visibleItems.some(({ item }) => item.sus);
        if (hasSusInGroup) {
          groupActions.appendChild(createSusNode(group.type));
        }

        const copyGroupBtn = document.createElement("button");
        copyGroupBtn.type = "button";
        copyGroupBtn.className = "copy-btn copy-btn-mini";
        copyGroupBtn.textContent = "Copiar bloco";
        copyGroupBtn.addEventListener("click", async (event) => {
          event.stopPropagation();
          const groupEntries = visibleItems.map(({ item }) => ({ item }));
          await copyTextWithButtonFeedback(copyGroupBtn, entriesToPrescriptionText(groupEntries), "Copiar bloco");
        });
        groupActions.appendChild(copyGroupBtn);
        groupHead.appendChild(groupActions);

        groupWrap.appendChild(groupHead);

        const medList = document.createElement("div");
        medList.className = "med-list";

        visibleItems.forEach(({ item, itemIndex }) => {
          const itemKey = buildItemKey(protocol.id, sectionIndex, groupIndex, itemIndex);
          const medCard = document.createElement("article");
          medCard.className = "med-card";
          if (item.sus) {
            medCard.classList.add("sus-item", group.type === "add" ? "sus-item-add" : "sus-item-or");
          }

          const line = document.createElement("div");
          line.className = "med-line";

          const itemSelector = document.createElement("label");
          itemSelector.className = "copy-check item-check";
          const itemCheck = document.createElement("input");
          itemCheck.type = "checkbox";
          itemCheck.checked = state.selectedItems.has(itemKey);
          itemCheck.addEventListener("change", () => {
            if (itemCheck.checked) {
              state.selectedItems.add(itemKey);
            } else {
              state.selectedItems.delete(itemKey);
            }
          });
          const itemCheckText = document.createElement("span");
          itemCheckText.textContent = "";
          itemSelector.appendChild(itemCheck);
          itemSelector.appendChild(itemCheckText);
          line.appendChild(itemSelector);

          const presLine = document.createElement("div");
          presLine.className = "med-prescription-line";

          const medName = document.createElement("span");
          medName.className = "med-name";
          medName.textContent = isNonEmptyString(item.nome) ? item.nome : "Medicamento";
          presLine.appendChild(medName);

          const medDashes = document.createElement("span");
          medDashes.className = "med-dashes";
          medDashes.textContent = buildVisualDashSeparator();
          presLine.appendChild(medDashes);

          const medPresentation = document.createElement("span");
          medPresentation.className = "med-pres-inline";
          medPresentation.textContent = isNonEmptyString(item.apresentacao) ? item.apresentacao : "sem apresentação";
          presLine.appendChild(medPresentation);
          line.appendChild(presLine);

          const copyItemBtn = document.createElement("button");
          copyItemBtn.type = "button";
          copyItemBtn.className = "copy-btn copy-btn-mini";
          copyItemBtn.textContent = "⧉";
          copyItemBtn.title = "Copiar item";
          copyItemBtn.setAttribute("aria-label", "Copiar item");
          copyItemBtn.addEventListener("click", async (event) => {
            event.stopPropagation();
            const text = buildPrescriptionEntryLines(item, 1).join("\n");
            await copyTextWithButtonFeedback(copyItemBtn, text, "⧉", "✓");
          });
          line.appendChild(copyItemBtn);

          medCard.appendChild(line);

          const use = document.createElement("p");
          use.className = "med-use";
          const useStrong = document.createElement("strong");
          useStrong.textContent = "Uso : ";
          use.appendChild(useStrong);
          use.appendChild(document.createTextNode(isNonEmptyString(item.posologia) ? item.posologia : "-"));
          medCard.appendChild(use);

          const metaEntries = medicationMetaEntries(item);
          if (metaEntries.length) {
            const ul = document.createElement("ul");
            ul.className = "med-meta";
            metaEntries.forEach((entry) => {
              const li = document.createElement("li");
              if (entry.label.startsWith("⚠")) {
                const icon = document.createElement("span");
                icon.className = "meta-attention-icon";
                icon.textContent = "⚠";
                li.appendChild(icon);
              }
              const strong = document.createElement("strong");
              strong.textContent = `${entry.label.replace(/^⚠\s*/, "")}:`;
              li.appendChild(strong);

              if (entry.label.includes("Orientações ao profissional")) {
                const topics = splitTopicLines(entry.value);
                const topicList = document.createElement("ul");
                topicList.className = "med-meta-topics";
                (topics.length ? topics : [entry.value]).forEach((topic) => {
                  const topicLi = document.createElement("li");
                  topicLi.textContent = topic;
                  topicList.appendChild(topicLi);
                });
                li.appendChild(topicList);
              } else {
                li.appendChild(document.createTextNode(` ${entry.value}`));
              }
              ul.appendChild(li);
            });
            medCard.appendChild(ul);
          }

          medList.appendChild(medCard);
        });

        groupWrap.appendChild(medList);
        sectionCard.appendChild(groupWrap);
      });
    } else {
      sectionCard.appendChild(renderFreeBlocks(section.blocks));
    }

    sectionBody.appendChild(sectionCard);
    sectionItem.appendChild(sectionBody);
    sectionList.appendChild(sectionItem);
  });

  detail.appendChild(sectionList);

  return detail;
}

function protocolToText(protocol) {
  const lines = [];
  lines.push(`${protocol.title} (${protocol.areaName})`);

  if (isNonEmptyString(protocol.meta.orientacoes)) {
    lines.push(`Orientações ao profissional: ${protocol.meta.orientacoes}`);
  }
  if (isNonEmptyString(protocol.meta.alertas)) {
    lines.push(`Alertas gerais: ${protocol.meta.alertas}`);
  }
  if (isNonEmptyString(protocol.meta.notas)) {
    lines.push(`Notas gerais: ${protocol.meta.notas}`);
  }

  protocol.sections.forEach((section) => {
    lines.push(`\n[Seção] ${section.title}`);

    if (isNonEmptyString(section.meta.orientacoes)) {
      lines.push(`- Orientações ao profissional: ${section.meta.orientacoes}`);
    }
    if (isNonEmptyString(section.meta.alertas)) {
      lines.push(`- Alertas da seção: ${section.meta.alertas}`);
    }
    if (isNonEmptyString(section.meta.notas)) {
      lines.push(`- Notas da seção: ${section.meta.notas}`);
    }

    if (section.mode === "structured") {
      let itemNumber = 1;
      section.groups.forEach((group) => {
        const groupLabel = isNonEmptyString(group.rotulo)
          ? group.rotulo
          : group.type === "add"
            ? "ASSOCIAR"
            : "OU";
        lines.push(`  (${groupLabel}) ${group.titulo}`);
        group.items.forEach((item) => {
          if (!itemHasPrescriptionContent(item)) {
            return;
          }
          const entryLines = buildPrescriptionEntryLines(item, itemNumber);
          entryLines.forEach((line) => {
            lines.push(`     ${line}`);
          });
          itemNumber += 1;
        });
      });
    }
  });

  return lines.join("\n");
}

function getVisibleProtocols() {
  const q = state.search.trim().toLowerCase();

  let list = state.protocols.filter((protocol) => {
    if (state.activeFilter === "favorites") {
      return state.favorites.has(protocol.id);
    }

    if (state.activeFilter === "all") {
      return true;
    }

    return protocol.areaSlug === state.activeFilter;
  });

  if (q) {
    list = list.filter((protocol) => protocol.searchable.includes(q));
  }

  return list.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

function renderAreaFilters() {
  const areas = state.areas.slice().sort((a, b) => a.area.localeCompare(b.area, "pt-BR"));
  dom.areaFilters.innerHTML = "";

  areas.forEach((area) => {
    const count = state.protocols.filter((protocol) => protocol.areaSlug === area.slug).length;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-btn${state.activeFilter === area.slug ? " active" : ""}`;
    button.dataset.filter = area.slug;

    const label = document.createElement("span");
    label.className = "filter-label";
    label.appendChild(createAreaIconNode(area.area, area.slug, "area-icon area-icon-filter"));

    const labelText = document.createElement("span");
    labelText.textContent = area.area;
    label.appendChild(labelText);

    const badge = document.createElement("span");
    badge.className = "count";
    badge.textContent = String(count);

    button.appendChild(label);
    button.appendChild(badge);
    dom.areaFilters.appendChild(button);
  });

  document.querySelectorAll(".filter-btn[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.activeFilter);
  });
}

function renderProtocols() {
  const visible = getVisibleProtocols();

  dom.loadingState.hidden = true;
  dom.errorState.hidden = true;

  if (!visible.length) {
    dom.protocolList.hidden = true;
    dom.emptyState.hidden = false;
    return;
  }

  dom.emptyState.hidden = true;
  dom.protocolList.hidden = false;
  dom.protocolList.innerHTML = "";

  visible.forEach((protocol) => {
    const card = document.createElement("article");
    card.className = "protocol-card";

    const summary = document.createElement("div");
    summary.className = "protocol-summary";
    summary.setAttribute("role", "button");
    summary.tabIndex = 0;
    summary.addEventListener("click", () => {
      state.expandedId = state.expandedId === protocol.id ? "" : protocol.id;
      renderProtocols();
    });
    summary.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        state.expandedId = state.expandedId === protocol.id ? "" : protocol.id;
        renderProtocols();
      }
    });

    const avatar = createAreaIconNode(protocol.areaName, protocol.areaSlug, "protocol-avatar");

    const main = document.createElement("div");
    main.className = "protocol-main";

    const h3 = document.createElement("h3");
    h3.textContent = protocol.title;
    main.appendChild(h3);

    const sub = document.createElement("div");
    const medLabel = protocol.medications === 1 ? "1 medicamento" : `${protocol.medications} medicamentos`;
    sub.className = "protocol-sub";
    sub.textContent = `${protocol.areaName} · ${medLabel}`;
    main.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "protocol-actions";

    const favoriteBtn = document.createElement("button");
    favoriteBtn.type = "button";
    favoriteBtn.className = `icon-btn${state.favorites.has(protocol.id) ? " active" : ""}`;
    favoriteBtn.title = "Favoritar";
    favoriteBtn.textContent = state.favorites.has(protocol.id) ? "★" : "☆";
    favoriteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.favorites.has(protocol.id)) {
        state.favorites.delete(protocol.id);
      } else {
        state.favorites.add(protocol.id);
      }
      saveFavorites();
      renderAreaFilters();
      renderProtocols();
    });

    const arrow = document.createElement("span");
    arrow.className = "icon-btn";
    arrow.textContent = state.expandedId === protocol.id ? "▴" : "▾";

    actions.appendChild(favoriteBtn);
    actions.appendChild(arrow);

    summary.appendChild(avatar);
    summary.appendChild(main);
    summary.appendChild(actions);

    card.appendChild(summary);

    if (state.expandedId === protocol.id) {
      card.appendChild(renderProtocolDetail(protocol));
    }

    dom.protocolList.appendChild(card);
  });
}

function renderError(message) {
  dom.loadingState.hidden = true;
  dom.protocolList.hidden = true;
  dom.emptyState.hidden = true;
  dom.errorState.hidden = false;
  dom.errorState.innerHTML = `
    <h3>Erro ao carregar protocolos</h3>
    <p>${escapeHtml(message)}</p>
    <p>Use servidor local (por exemplo: <code>python -m http.server 8080</code> na pasta Prescrever).</p>
  `;
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${path} (${response.status})`);
  }
  return response.json();
}

async function fetchText(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Falha ao carregar ${path} (${response.status})`);
  }
  return response.text();
}

function normalizeDataRelativePath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/^data\//i, "");
}

function isExternalHref(href) {
  return /^(https?:|mailto:|tel:|javascript:|data:|\/\/)/i.test(href);
}

async function discoverJsonFilesRecursively(startDir = "") {
  const visitedDirs = new Set();
  const foundFiles = new Set();

  async function walk(dirPath) {
    const normalizedDir = normalizeDataRelativePath(dirPath);
    const dirKey = normalizedDir
      ? normalizedDir.endsWith("/")
        ? normalizedDir
        : `${normalizedDir}/`
      : "";

    if (visitedDirs.has(dirKey)) {
      return;
    }
    visitedDirs.add(dirKey);

    const requestPath = `./data/${dirKey}`;
    const html = await fetchText(requestPath);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const baseDataUrl = new URL("./data/", window.location.href);
    const subDirs = new Set();

    Array.from(doc.querySelectorAll("a[href]")).forEach((anchor) => {
      const rawHref = String(anchor.getAttribute("href") || "")
        .split("#")[0]
        .split("?")[0]
        .trim();

      if (!rawHref || rawHref === "." || rawHref === "./" || rawHref === "/" || rawHref === "../") {
        return;
      }
      if (isExternalHref(rawHref)) {
        return;
      }

      let resolvedUrl;
      try {
        resolvedUrl = new URL(rawHref, new URL(requestPath, window.location.href));
      } catch (_error) {
        return;
      }

      if (!resolvedUrl.pathname.startsWith(baseDataUrl.pathname)) {
        return;
      }

      const relPath = decodeURIComponent(
        resolvedUrl.pathname.slice(baseDataUrl.pathname.length).replace(/^\/+/, "")
      );

      if (!relPath) {
        return;
      }

      if (/index\.json$/i.test(relPath)) {
        return;
      }

      if (relPath.toLowerCase().endsWith(".json")) {
        foundFiles.add(relPath);
        return;
      }

      const looksLikeDir = rawHref.endsWith("/") || resolvedUrl.pathname.endsWith("/");
      if (looksLikeDir) {
        subDirs.add(relPath.endsWith("/") ? relPath : `${relPath}/`);
      }
    });

    for (const subDir of subDirs) {
      await walk(subDir);
    }
  }

  await walk(startDir);
  return [...foundFiles].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function discoverJsonFilesFromIndex() {
  const manifest = await fetchJson("./data/index.json");
  const areas = Array.isArray(manifest?.areas) ? manifest.areas : [];

  const files = areas
    .map((entry) => {
      if (isNonEmptyString(entry?.file)) {
        return normalizeDataRelativePath(entry.file);
      }
      if (isNonEmptyString(entry?.slug)) {
        return `${normalizeDataRelativePath(entry.slug)}.json`;
      }
      return "";
    })
    .filter((filePath) => isNonEmptyString(filePath) && filePath.toLowerCase().endsWith(".json"))
    .filter((filePath) => !/index\.json$/i.test(filePath));

  return [...new Set(files)].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function loadData() {
  state.loading = true;
  dom.loadingState.hidden = false;

  try {
    let discoveredFiles = [];
    let usedIndexFallback = false;

    try {
      discoveredFiles = await discoverJsonFilesRecursively("");
    } catch (_error) {
      discoveredFiles = [];
    }

    if (!discoveredFiles.length) {
      discoveredFiles = await discoverJsonFilesFromIndex();
      usedIndexFallback = true;
    }

    if (!discoveredFiles.length) {
      throw new Error(
        "Nenhum JSON de área encontrado em /data. No GitHub Pages, preencha data/index.json com a lista dos arquivos."
      );
    }

    const areasData = await Promise.all(
      discoveredFiles.map(async (filePath) => {
        const rawArea = await fetchJson(`./data/${filePath.replace(/^\/+/, "")}`);
        const fallbackSlug = filePath
          .split("/")
          .pop()
          .replace(/\.json$/i, "")
          .toLowerCase();

        return {
          area: isNonEmptyString(rawArea?.area) ? rawArea.area.trim() : fallbackSlug,
          slug: isNonEmptyString(rawArea?.slug) ? rawArea.slug : fallbackSlug,
          assuntos: Array.isArray(rawArea?.assuntos) ? rawArea.assuntos : [],
          _filePath: filePath
        };
      })
    );

    const validAreas = areasData.filter(
      (area) =>
        isNonEmptyString(area?.area) &&
        isNonEmptyString(area?.slug) &&
        Array.isArray(area?.assuntos)
    );

    if (!validAreas.length) {
      throw new Error(
        usedIndexFallback
          ? "Os arquivos listados em data/index.json não seguem o formato esperado de área/assuntos."
          : "Os JSONs encontrados não seguem o formato esperado de área/assuntos."
      );
    }

    const protocols = [];
    validAreas.forEach((area) => {
      area.assuntos.forEach((subject) => {
        protocols.push(buildProtocol(area, subject));
      });
    });

    state.areas = validAreas.map((area) => ({ area: area.area, slug: area.slug }));
    state.protocols = protocols;

    renderAreaFilters();
    renderProtocols();
  } catch (error) {
    state.error = error?.message || "Erro desconhecido ao ler JSON.";
    renderError(state.error);
  } finally {
    state.loading = false;
    dom.loadingState.hidden = true;
  }
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const btn = event.target.closest(".filter-btn[data-filter]");
    if (!btn) {
      return;
    }

    state.activeFilter = btn.dataset.filter;
    renderAreaFilters();
    renderProtocols();
  });

  dom.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value || "";
    renderProtocols();
  });

  const hasPageScroll = () => document.documentElement.scrollHeight > window.innerHeight + 2;

  document.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (event.defaultPrevented) {
      return;
    }
    if (target?.closest("input, textarea, select, [contenteditable='true']")) {
      return;
    }
    if (!hasPageScroll()) {
      return;
    }

    let delta = 0;
    if (event.key === "ArrowDown") delta = 56;
    if (event.key === "ArrowUp") delta = -56;
    if (event.key === "PageDown") delta = Math.round(window.innerHeight * 0.9);
    if (event.key === "PageUp") delta = -Math.round(window.innerHeight * 0.9);

    if (delta !== 0) {
      window.scrollBy(0, delta);
      event.preventDefault();
    }
  });

  document.addEventListener(
    "wheel",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.defaultPrevented) {
        return;
      }
      if (!target?.closest(".app-modal")) {
        return;
      }
      if (target.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      if (!hasPageScroll()) {
        return;
      }

      window.scrollBy(0, event.deltaY);
      event.preventDefault();
    },
    { passive: false }
  );
}

function init() {
  bindEvents();
  loadData();
}

init();
