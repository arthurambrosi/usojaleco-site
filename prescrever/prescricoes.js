const STORAGE_FAVORITES_KEY = "prescrever:favoritos:v1";

const STORAGE_LAST_SYNC_KEY = "prescrever:last-sync-at";
const PT_BR_COLLATOR = new Intl.Collator("pt-BR", {
  usage: "sort",
  sensitivity: "base",
  numeric: true,
  ignorePunctuation: true
});

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
  activeFilter: "all",
  search: "",
  favorites: new Set(loadFavorites()),
  selectedItems: new Set(),
  expandedId: "",
  expandedSections: new Map(),
  tagLookup: new Map(),
  tagPopover: null,
  lastSyncToken: "",
  pendingSyncReload: false,
  loading: true,
  error: ""
};

const FREE_BLOCK_PLACEHOLDER_TEXTS = new Set([
  "edite o protocolo aqui.",
  "notas da seção:",
  "notas da secao:"
]);

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

function normalizeBooleanFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "sim", "yes"].includes(normalized);
  }
  return false;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function comparePtBrAlpha(left, right) {
  return PT_BR_COLLATOR.compare(asString(left).trim(), asString(right).trim());
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
    notas: asString(meta?.notas).trim(),
    revisadoEspecialista: normalizeBooleanFlag(meta?.revisadoEspecialista ?? meta?.revisadoPorEspecialista)
  };
}

function normalizeReferenceAssetPath(value) {
  return asString(value)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/^data\//i, "")
    .replace(/^\/+/, "");
}

function buildReferenceHref(assetPath) {
  const safePath = normalizeReferenceAssetPath(assetPath);
  return safePath ? `./data/${safePath}` : "";
}

function normalizeReference(rawReference, index = 0) {
  const type = rawReference?.tipo === "pdf" ? "pdf" : "link";
  const fileName = asString(rawReference?.nomeArquivo ?? rawReference?.fileName).trim();
  const assetPath = normalizeReferenceAssetPath(
    rawReference?.arquivo ?? rawReference?.assetPath ?? rawReference?.pdf ?? rawReference?.file
  );
  const externalUrl = asString(rawReference?.url ?? rawReference?.href).trim();
  const href = type === "pdf" ? buildReferenceHref(assetPath) : externalUrl;
  const fallbackTitle = type === "pdf" ? fileName : externalUrl;

  return {
    id: isNonEmptyString(rawReference?.id) ? rawReference.id.trim() : `ref-${index + 1}`,
    type,
    title: asString(rawReference?.titulo ?? rawReference?.label ?? rawReference?.nome).trim() || fallbackTitle,
    href,
    fileName
  };
}

function normalizeReferences(rawReferences) {
  if (!Array.isArray(rawReferences)) {
    return [];
  }

  return rawReferences
    .map((reference, index) => normalizeReference(reference, index))
    .filter((reference) => isNonEmptyString(reference.title) && isNonEmptyString(reference.href));
}

function normalizeItemMeta(meta) {
  return {
    contraindicacoes: asString(meta?.contraindicacoes).trim(),
    orientacoes: asString(meta?.orientacoes).trim(),
    alertas: asString(meta?.alertas).trim()
  };
}

function normalizeTagContent(content) {
  if (!Array.isArray(content)) {
    if (isNonEmptyString(content)) {
      return [{ type: "paragraph", text: asString(content).trim() }];
    }
    return [];
  }

  const out = [];
  content.forEach((node) => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (node.type === "image") {
      const src = asString(node.src).trim();
      const widthValue = Number.parseFloat(asString(node.width));
      const width = Number.isFinite(widthValue) && widthValue > 0 ? Math.round(widthValue) : null;
      if (/^data:image\//i.test(src)) {
        out.push({
          type: "image",
          src,
          alt: asString(node.alt).trim(),
          ...(width ? { width } : {})
        });
      }
      return;
    }

    const text = asString(node.text).trim();
    if (text) {
      out.push({
        type: "paragraph",
        text
      });
    }
  });

  return out;
}

function normalizeTagDefs(tagDefs) {
  if (!Array.isArray(tagDefs)) {
    return [];
  }

  const seen = new Set();
  const out = [];

  tagDefs.forEach((tag, index) => {
    if (!tag || typeof tag !== "object") {
      return;
    }
    const id = asString(tag.id).trim();
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    out.push({
      id,
      label: isNonEmptyString(tag.label) ? tag.label.trim() : `Tag ${index + 1}`,
      content: normalizeTagContent(tag.content)
    });
  });

  return out;
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

function readLastSyncToken() {
  try {
    return String(localStorage.getItem(STORAGE_LAST_SYNC_KEY) || "");
  } catch (_error) {
    return "";
  }
}

function requestReloadAfterSync() {
  const token = readLastSyncToken();
  if (!token || token === state.lastSyncToken) {
    return;
  }

  state.lastSyncToken = token;
  if (state.loading) {
    state.pendingSyncReload = true;
    return;
  }

  loadData();
}

function itemHasPrescriptionContent(item) {
  const name = asString(item?.nome).trim();
  const presentation = asString(item?.apresentacao).trim();
  const usage = asString(item?.posologia).trim();
  const isPlaceholderName = name.toLocaleLowerCase("pt-BR") === "novo medicamento";

  if (isPlaceholderName && !presentation && !usage) {
    return false;
  }

  return Boolean(name || presentation || usage);
}

function inlineContentHasMeaning(content) {
  return normalizeInlineContent(content).some((span) => {
    const text = asString(span?.text).trim();
    return text && !FREE_BLOCK_PLACEHOLDER_TEXTS.has(text.toLocaleLowerCase("pt-BR"));
  });
}

function listBlockHasMeaning(items) {
  if (!Array.isArray(items)) {
    return false;
  }

  return items.some((item) => inlineContentHasMeaning(item?.content));
}

function tableBlockHasMeaning(block) {
  const headers = Array.isArray(block?.headers) ? block.headers : [];
  const rows = Array.isArray(block?.rows) ? block.rows : [];

  if (headers.some((header) => isNonEmptyString(header))) {
    return true;
  }

  return rows.some((row) => Array.isArray(row) && row.some((cell) => isNonEmptyString(cell)));
}

function blockHasVisibleContent(block) {
  if (!block || typeof block !== "object") {
    return false;
  }

  switch (block.type) {
    case "heading":
    case "paragraph":
      return inlineContentHasMeaning(block.content);
    case "list":
      return listBlockHasMeaning(block.items);
    case "callout": {
      const title = asString(block.title).trim();
      const defaultTitle =
        block.tone === "warning"
          ? "Atencao"
          : block.tone === "danger"
            ? "Contraindicacao"
            : block.tone === "success"
              ? "Conduta"
              : "Info";
      return (title && title !== defaultTitle) || hasVisibleFreeBlocks(block.blocks);
    }
    case "table":
      return tableBlockHasMeaning(block);
    case "divider":
      return false;
    default:
      return false;
  }
}

function hasVisibleFreeBlocks(blocks) {
  return Array.isArray(blocks) && blocks.some((block) => blockHasVisibleContent(block));
}

function sectionHasOwnVisibleContent(section) {
  if (!section || typeof section !== "object") {
    return false;
  }

  if (
    isNonEmptyString(section.meta?.orientacoes) ||
    isNonEmptyString(section.meta?.alertas) ||
    isNonEmptyString(section.meta?.notas)
  ) {
    return true;
  }

  if (section.mode === "structured") {
    return Array.isArray(section.groups) && section.groups.some((group) => collectVisibleItemsFromGroup(group, []).length > 0);
  }

  return hasVisibleFreeBlocks(section.blocks);
}

function buildItemKey(protocolId, sectionPath, groupPath, itemId, itemIndex = 0) {
  const safeSectionPath = isNonEmptyString(sectionPath) ? sectionPath : "0";
  const safePath = isNonEmptyString(groupPath) ? groupPath : "0";
  const safeItemId = isNonEmptyString(itemId) ? itemId : `item-${itemIndex + 1}`;
  return `${protocolId}::${safeSectionPath}:${safePath}:${safeItemId}:${itemIndex}`;
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

function collectStructuredEntriesFromSection(protocol, section, out = []) {
  if (section.mode === "structured") {
    section.groups.forEach((group, groupIndex) => {
      const groupPath = String(groupIndex);
      const groupSections = getGroupSections(group);
      groupSections.forEach((groupSection, groupSectionIndex) => {
        if (!Array.isArray(groupSection?.items)) {
          return;
        }
        const entryPath = `${groupPath}.${groupSectionIndex}`;
        groupSection.items.forEach((item, itemIndex) => {
          if (!itemHasPrescriptionContent(item)) {
            return;
          }
          out.push({
            key: buildItemKey(protocol.id, section.path, entryPath, item?.id, itemIndex),
            protocolId: protocol.id,
            sectionPath: section.path,
            groupPath: entryPath,
            itemIndex,
            section,
            group,
            groupSection,
            item
          });
        });
      });
    });
  }

  if (Array.isArray(section.children) && section.children.length) {
    section.children.forEach((child) => collectStructuredEntriesFromSection(protocol, child, out));
  }

  return out;
}

function collectStructuredEntries(protocol) {
  const entries = [];
  protocol.sections.forEach((section) => {
    collectStructuredEntriesFromSection(protocol, section, entries);
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

function createStructuredSectionEntry(initialTitle = "") {
  return {
    id: createId("grpsec"),
    titulo: asString(initialTitle).trim(),
    items: []
  };
}

function normalizeStructuredSectionEntry(section, index = 0) {
  const items = Array.isArray(section?.items)
    ? section.items.map((item, itemIndex) => normalizeStructuredItem(item, itemIndex))
    : [];

  return {
    id: isNonEmptyString(section?.id) ? section.id : `grpsec-${index + 1}`,
    titulo: isNonEmptyString(section?.titulo) ? section.titulo.trim() : "",
    items
  };
}

function flattenLegacySubgroupsToSections(rawGroups, out = []) {
  if (!Array.isArray(rawGroups)) {
    return out;
  }

  rawGroups.forEach((rawGroup) => {
    const sectionTitle = isNonEmptyString(rawGroup?.titulo)
      ? rawGroup.titulo.trim()
      : "";
    out.push({
      id: isNonEmptyString(rawGroup?.id) ? rawGroup.id : `legacy-${out.length + 1}`,
      titulo: sectionTitle,
      items: Array.isArray(rawGroup?.items)
        ? rawGroup.items.map((item, itemIndex) => normalizeStructuredItem(item, itemIndex))
        : []
    });

    const children = Array.isArray(rawGroup?.subgroups)
      ? rawGroup.subgroups
      : Array.isArray(rawGroup?.groups)
        ? rawGroup.groups
        : [];

    if (children.length) {
      flattenLegacySubgroupsToSections(children, out);
    }
  });

  return out;
}

function normalizeStructuredGroup(group, index = 0) {
  const rawSections = Array.isArray(group?.sections) ? group.sections : [];
  let sections = rawSections.map((entry, sectionIndex) => normalizeStructuredSectionEntry(entry, sectionIndex));

  if (!sections.length) {
    const legacySections = [];

    if (Array.isArray(group?.items) && group.items.length) {
      legacySections.push({
        id: isNonEmptyString(group?.id) ? `${group.id}-root` : `legacy-root-${index + 1}`,
        titulo: "",
        items: group.items.map((item, itemIndex) => normalizeStructuredItem(item, itemIndex))
      });
    }

    const rawSubgroups = Array.isArray(group?.subgroups)
      ? group.subgroups
      : Array.isArray(group?.groups)
        ? group.groups
        : [];
    if (rawSubgroups.length) {
      flattenLegacySubgroupsToSections(rawSubgroups, legacySections);
    }

    sections = legacySections.map((entry, sectionIndex) => normalizeStructuredSectionEntry(entry, sectionIndex));
  }

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
    sections: sections.length ? sections : [createStructuredSectionEntry("")]
  };
}

function getGroupSections(group) {
  return Array.isArray(group?.sections) ? group.sections : [];
}

function countNamedItemsInGroups(groups) {
  let total = 0;
  if (!Array.isArray(groups)) {
    return total;
  }
  groups.forEach((group) => {
    const sections = getGroupSections(group);
    sections.forEach((entry) => {
      if (!Array.isArray(entry?.items)) {
        return;
      }
      total += entry.items.filter((item) => isNonEmptyString(item?.nome)).length;
    });
  });
  return total;
}

function collectSearchTextsFromGroups(groups) {
  const out = [];
  if (!Array.isArray(groups)) {
    return out;
  }
  groups.forEach((group) => {
    out.push(group?.rotulo, group?.titulo);
    const sections = getGroupSections(group);
    sections.forEach((entry) => {
      out.push(entry?.titulo);
      if (!Array.isArray(entry?.items)) {
        return;
      }
      entry.items.forEach((item) => {
        out.push(
          item?.nome,
          item?.apresentacao,
          item?.posologia,
          item?.meta?.contraindicacoes,
          item?.meta?.orientacoes,
          item?.meta?.alertas
        );
      });
    });
  });
  return out;
}

function normalizeSection(tab, index = 0, lineage = []) {
  const title = isNonEmptyString(tab?.titulo) ? tab.titulo.trim() : `Seção ${index + 1}`;
  const slug = isNonEmptyString(tab?.slug) ? tab.slug : `secao-${index + 1}`;
  const numberingSegments = [...lineage, index + 1];
  const rawChildren = Array.isArray(tab?.children)
    ? tab.children
    : Array.isArray(tab?.subsections)
      ? tab.subsections
      : Array.isArray(tab?.tabs)
        ? tab.tabs
        : [];

  const groupsRaw = Array.isArray(tab?.structured?.groups)
    ? tab.structured.groups
    : Array.isArray(tab?.structured)
      ? tab.structured
      : [];

  const groups = groupsRaw.map((group, groupIndex) => normalizeStructuredGroup(group, groupIndex));
  const hasStructured = groups.length > 0;

  const mode = tab?.mode === "free" ? "free" : hasStructured ? "structured" : "free";
  const children = rawChildren.map((child, childIndex) => normalizeSection(child, childIndex, numberingSegments));

  return {
    id: `${slug}-${numberingSegments.join("-")}`,
    title,
    slug,
    mode,
    meta: normalizeMeta(tab?.meta),
    groups,
    tagDefs: normalizeTagDefs(tab?.tagDefs),
    blocks: Array.isArray(tab?.blocks) ? tab.blocks : [],
    children,
    depth: lineage.length,
    numberingSegments,
    numbering: numberingSegments.join("."),
    path: numberingSegments.join(".")
  };
}

function countSectionsInTree(sections) {
  if (!Array.isArray(sections)) {
    return 0;
  }

  return sections.reduce((total, section) => total + 1 + countSectionsInTree(section.children), 0);
}

function getMedicationCount(sections) {
  return sections.reduce((total, section) => {
    return total + getSectionMedicationCount(section);
  }, 0);
}

function getSectionMedicationCount(section) {
  const ownCount = section.mode === "structured" ? countNamedItemsInGroups(section.groups) : 0;
  const childCount = Array.isArray(section.children)
    ? section.children.reduce((total, child) => total + getSectionMedicationCount(child), 0)
    : 0;
  return ownCount + childCount;
}

function getSectionDisplayTitle(section) {
  return `${section.numbering} ${section.title}`.trim();
}

function getSectionInitial(title) {
  const text = asString(title).trim();
  return text ? text[0].toLocaleUpperCase("pt-BR") : "S";
}

function tagContentToSearchText(content) {
  const nodes = normalizeTagContent(content);
  return nodes
    .map((node) => (node.type === "paragraph" ? node.text : ""))
    .filter((text) => isNonEmptyString(text))
    .join(" ");
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

function collectSectionSearchTexts(section, out = []) {
  out.push(
    section.title,
    section.numbering,
    section.meta.orientacoes,
    section.meta.alertas,
    section.meta.notas,
    ...section.tagDefs.flatMap((tag) => [tag.label, tagContentToSearchText(tag.content)]),
    ...collectSearchTextsFromGroups(section.groups)
  );

  if (Array.isArray(section.children) && section.children.length) {
    section.children.forEach((child) => collectSectionSearchTexts(child, out));
  }

  return out;
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
    references: normalizeReferences(subject?.referencias ?? subject?.meta?.referencias),
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
    ...protocol.references.flatMap((reference) => [reference.title, reference.href]),
    ...protocol.sections.flatMap((section) => collectSectionSearchTexts(section))
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
      marks: Array.isArray(span.marks) ? span.marks : [],
      tagId: isNonEmptyString(span.tagId) ? span.tagId.trim() : ""
    }));
}

function appendInline(container, content, context = null) {
  const spans = normalizeInlineContent(content);
  if (!spans.length) {
    return;
  }

  spans.forEach((span) => {
    let node;
    if (isNonEmptyString(span.tagId)) {
      const tagButton = document.createElement("button");
      tagButton.type = "button";
      tagButton.className = "inline-tag-ref";
      tagButton.dataset.tagId = span.tagId;
      if (context?.protocolId) {
        tagButton.dataset.protocolId = context.protocolId;
      }
      if (context?.sectionId) {
        tagButton.dataset.sectionId = context.sectionId;
      }
      tagButton.textContent = span.text;
      node = tagButton;
    } else {
      node = document.createTextNode(span.text);
    }

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

function renderFreeBlocks(blocks, context = null) {
  const wrap = document.createElement("div");
  wrap.className = "free-blocks";

  if (!Array.isArray(blocks) || !blocks.length) {
    return wrap;
  }

  blocks.forEach((block) => {
    if (!block || typeof block !== "object") {
      return;
    }
    if (!blockHasVisibleContent(block) && block.type !== "divider") {
      return;
    }

    if (block.type === "heading") {
      const heading = document.createElement(block.level === 3 ? "h5" : "h4");
      appendInline(heading, block.content, context);
      wrap.appendChild(heading);
      return;
    }

    if (block.type === "paragraph") {
      const p = document.createElement("p");
      appendInline(p, block.content, context);
      wrap.appendChild(p);
      return;
    }

    if (block.type === "list") {
      const list = document.createElement(block.style === "ordered" ? "ol" : "ul");
      const items = Array.isArray(block.items) ? block.items : [];
      items.forEach((item) => {
        const li = document.createElement("li");
        appendInline(li, item?.content, context);
        list.appendChild(li);
      });
      wrap.appendChild(list);
      return;
    }

    if (block.type === "divider") {
      if (!wrap.childNodes.length) {
        return;
      }
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

      const nested = renderFreeBlocks(block.blocks, context);
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

function renderReferencesSection(references) {
  if (!Array.isArray(references) || !references.length) {
    return null;
  }

  const section = document.createElement("section");
  section.className = "references-panel";

  const heading = document.createElement("div");
  heading.className = "references-head";

  const title = document.createElement("h4");
  title.textContent = "Referências";
  heading.appendChild(title);

  const helper = document.createElement("p");
  helper.textContent = "Links externos e PDFs abrem em uma nova guia.";
  heading.appendChild(helper);

  section.appendChild(heading);

  const list = document.createElement("ol");
  list.className = "references-list";

  references.forEach((reference) => {
    const item = document.createElement("li");
    item.className = "reference-item";

    const link = document.createElement("a");
    link.className = "reference-link";
    link.href = reference.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = reference.title;
    item.appendChild(link);

    if (reference.type === "pdf") {
      const badge = document.createElement("span");
      badge.className = "reference-kind";
      badge.textContent = "PDF";
      item.appendChild(badge);
    }

    list.appendChild(item);
  });

  section.appendChild(list);
  return section;
}

function medicationMetaEntries(item) {
  const out = [];
  if (isNonEmptyString(item.meta.contraindicacoes)) {
    out.push({ label: "Contraindicações", value: item.meta.contraindicacoes });
  }
  if (isNonEmptyString(item.meta.orientacoes)) {
    out.push({ label: "Orientações ao profissional", value: item.meta.orientacoes });
  }
  if (isNonEmptyString(item.meta.alertas)) {
    out.push({ label: "Alertas", value: item.meta.alertas });
  }
  return out;
}

function getGroupDisplayLabel(group) {
  return isNonEmptyString(group?.rotulo)
    ? group.rotulo
    : group?.type === "add"
      ? "ASSOCIAR"
      : "OU";
}

function collectVisibleItemsFromGroup(group, out = []) {
  if (!group || typeof group !== "object") {
    return out;
  }
  const sections = getGroupSections(group);
  sections.forEach((entry) => {
    if (!Array.isArray(entry?.items)) {
      return;
    }
    entry.items.forEach((item) => {
      if (itemHasPrescriptionContent(item)) {
        out.push(item);
      }
    });
  });
  return out;
}

function renderStructuredGroupBlock({
  protocol,
  section,
  sectionPath,
  group,
  groupPath
}) {
  const visibleSections = getGroupSections(group)
    .map((entry, groupSectionIndex) => ({
      entry,
      groupSectionIndex,
      items: Array.isArray(entry?.items)
        ? entry.items
            .map((item, itemIndex) => ({ item, itemIndex }))
            .filter(({ item }) => itemHasPrescriptionContent(item))
        : []
    }))
    .filter(({ items }) => items.length > 0);

  if (!visibleSections.length) {
    return null;
  }

  const groupWrap = document.createElement("div");
  groupWrap.className = `group-block ${group.type === "add" ? "group-add" : "group-or"}`;

  const groupHead = document.createElement("div");
  groupHead.className = "group-head";

  const groupMain = document.createElement("div");
  groupMain.className = "group-main";

  const badge = document.createElement("span");
  badge.className = `group-kind ${group.type === "add" ? "add" : ""}`;
  badge.textContent = getGroupDisplayLabel(group);

  const title = document.createElement("h5");
  title.className = "group-title";
  title.textContent = group.titulo;

  groupMain.appendChild(badge);
  groupMain.appendChild(title);
  groupHead.appendChild(groupMain);

  const groupActions = document.createElement("div");
  groupActions.className = "group-actions";
  const groupItems = collectVisibleItemsFromGroup(group, []);
  const hasSusInGroup = groupItems.some((item) => item.sus);
  if (hasSusInGroup) {
    groupActions.appendChild(createSusNode(group.type));
  }

  const copyGroupBtn = document.createElement("button");
  copyGroupBtn.type = "button";
  copyGroupBtn.className = "copy-btn copy-btn-mini";
  copyGroupBtn.textContent = "Copiar bloco";
  copyGroupBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    const groupEntries = groupItems.map((item) => ({ item }));
    await copyTextWithButtonFeedback(copyGroupBtn, entriesToPrescriptionText(groupEntries), "Copiar bloco");
  });
  groupActions.appendChild(copyGroupBtn);
  groupHead.appendChild(groupActions);
  groupWrap.appendChild(groupHead);

  const sectionsWrap = document.createElement("div");
  sectionsWrap.className = "group-sections";

  visibleSections.forEach(({ entry, groupSectionIndex, items }) => {
    const groupSection = document.createElement("section");
    groupSection.className = "group-section";

    const sectionTitle = asString(entry?.titulo).trim();
    if (sectionTitle) {
      const groupSectionHead = document.createElement("div");
      groupSectionHead.className = "group-section-head";
      const groupSectionTitle = document.createElement("h6");
      groupSectionTitle.className = "group-section-title";
      groupSectionTitle.textContent = sectionTitle;
      groupSectionHead.appendChild(groupSectionTitle);
      groupSection.appendChild(groupSectionHead);
    }

    const medList = document.createElement("div");
    medList.className = "med-list";

    items.forEach(({ item, itemIndex }) => {
      const itemPath = `${groupPath}.${groupSectionIndex}`;
      const itemKey = buildItemKey(protocol.id, sectionPath, itemPath, item?.id, itemIndex);
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
      const setItemSelected = (selected) => {
        const next = Boolean(selected);
        itemCheck.checked = next;
        if (next) {
          state.selectedItems.add(itemKey);
        } else {
          state.selectedItems.delete(itemKey);
        }
      };
      setItemSelected(state.selectedItems.has(itemKey));
      itemCheck.addEventListener("change", () => {
        setItemSelected(itemCheck.checked);
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

      medCard.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("button, input, label, a")) {
          return;
        }
        setItemSelected(!itemCheck.checked);
      });

      const use = document.createElement("p");
      use.className = "med-use";
      const useStrong = document.createElement("strong");
      useStrong.textContent = "Uso : ";
      use.appendChild(useStrong);
      use.appendChild(document.createTextNode(isNonEmptyString(item.posologia) ? item.posologia : "-"));
      medCard.appendChild(use);

      const metaEntries = medicationMetaEntries(item);
      if (metaEntries.length) {
        const divider = document.createElement("div");
        divider.className = "med-meta-divider";
        medCard.appendChild(divider);

        const metaBox = document.createElement("div");
        metaBox.className = "med-meta";
        metaEntries.forEach((entryMeta) => {
          const lineMeta = document.createElement("p");
          lineMeta.className = "med-meta-line";
          const strong = document.createElement("strong");
          strong.textContent = `${entryMeta.label}:`;
          lineMeta.appendChild(strong);
          lineMeta.appendChild(document.createTextNode(` ${entryMeta.value}`));
          metaBox.appendChild(lineMeta);
        });
        medCard.appendChild(metaBox);
      }

      medList.appendChild(medCard);
    });

    groupSection.appendChild(medList);
    sectionsWrap.appendChild(groupSection);
  });

  groupWrap.appendChild(sectionsWrap);

  return groupWrap;
}

function tagLookupKey(protocolId, sectionId, tagId) {
  return `${protocolId || ""}::${sectionId || ""}::${tagId || ""}`;
}

function closeTagPopover() {
  if (!state.tagPopover) {
    return;
  }
  state.tagPopover.remove();
  state.tagPopover = null;
}

function resolveTagFromButton(button) {
  const tagId = asString(button?.dataset?.tagId).trim();
  const protocolId = asString(button?.dataset?.protocolId).trim();
  const sectionId = asString(button?.dataset?.sectionId).trim();
  if (!tagId || !protocolId || !sectionId) {
    return null;
  }
  const key = tagLookupKey(protocolId, sectionId, tagId);
  const tag = state.tagLookup.get(key);
  if (!tag) {
    return null;
  }
  return {
    id: tagId,
    protocolId,
    sectionId,
    tag
  };
}

function buildTagPopover(tag) {
  const popover = document.createElement("div");
  popover.className = "tag-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-live", "polite");

  const head = document.createElement("div");
  head.className = "tag-popover-head";

  const title = document.createElement("strong");
  title.textContent = isNonEmptyString(tag.label) ? tag.label : "Tag";
  head.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "tag-popover-close";
  closeBtn.textContent = "×";
  closeBtn.title = "Fechar";
  closeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    closeTagPopover();
  });
  head.appendChild(closeBtn);

  popover.appendChild(head);

  const body = document.createElement("div");
  body.className = "tag-popover-body";
  const nodes = normalizeTagContent(tag.content);
  if (!nodes.length) {
    const empty = document.createElement("p");
    empty.textContent = "Sem conteúdo adicional.";
    body.appendChild(empty);
  } else {
    nodes.forEach((node) => {
      if (node.type === "image") {
        const img = document.createElement("img");
        img.src = node.src;
        img.alt = isNonEmptyString(node.alt) ? node.alt : tag.label || "Imagem da tag";
        if (Number.isFinite(Number(node.width)) && Number(node.width) > 0) {
          img.style.width = `${Math.round(Number(node.width))}px`;
        }
        body.appendChild(img);
      } else {
        const p = document.createElement("p");
        p.textContent = node.text;
        body.appendChild(p);
      }
    });
  }
  popover.appendChild(body);

  return popover;
}

function positionTagPopover(anchor, popover) {
  const anchorRect = anchor.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const padding = 10;

  let top = window.scrollY + anchorRect.top - popoverRect.height - 8;
  if (top < window.scrollY + padding) {
    top = window.scrollY + anchorRect.bottom + 8;
  }

  let left = window.scrollX + anchorRect.left;
  const maxLeft = window.scrollX + window.innerWidth - popoverRect.width - padding;
  if (left > maxLeft) {
    left = maxLeft;
  }
  if (left < window.scrollX + padding) {
    left = window.scrollX + padding;
  }

  popover.style.top = `${Math.round(top)}px`;
  popover.style.left = `${Math.round(left)}px`;
}

function openTagPopover(anchor, tag) {
  closeTagPopover();
  const popover = buildTagPopover(tag);
  document.body.appendChild(popover);
  positionTagPopover(anchor, popover);
  state.tagPopover = popover;
}

function renderProtocolDetail(protocol) {
  const totalSections = countSectionsInTree(protocol.sections);
  const detail = document.createElement("div");
  detail.className = "protocol-detail";
  const protocolEntries = collectStructuredEntries(protocol);
  const protocolEntryKeys = protocolEntries.map((entry) => entry.key);

  const head = document.createElement("div");
  head.className = "detail-head";

  const meta = document.createElement("small");
  meta.textContent = `${protocol.areaName} · ${totalSections} seção(ões)`;
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
    detail.appendChild(renderMetaBox("⚠ Orientações ao profissional", protocol.meta.orientacoes, "orient"));
  }
  if (isNonEmptyString(protocol.meta.alertas)) {
    detail.appendChild(renderMetaBox("Alertas gerais", protocol.meta.alertas, "warn"));
  }
  if (isNonEmptyString(protocol.meta.notas)) {
    detail.appendChild(renderMetaBox("Notas gerais", protocol.meta.notas, "soft"));
  }

  const sectionList = document.createElement("div");
  sectionList.className = "section-list";

  const renderSectionNode = (section) => {
    const sectionTagDefs = Array.isArray(section.tagDefs) ? section.tagDefs : [];
    sectionTagDefs.forEach((tag) => {
      state.tagLookup.set(`${protocol.id}::${section.id}::${tag.id}`, tag);
    });

    const sectionItem = document.createElement("details");
    sectionItem.className = "section-item";
    sectionItem.open = isSectionExpanded(protocol.id, section.id, totalSections);
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

    const sectionNumber = document.createElement("div");
    sectionNumber.className = "section-number";
    sectionNumber.textContent = section.numbering;
    sectionMain.appendChild(sectionNumber);

    const sectionTitle = document.createElement("h4");
    sectionTitle.className = "section-main-title";
    sectionTitle.textContent = section.title;
    sectionMain.appendChild(sectionTitle);

    const sectionSub = document.createElement("div");
    sectionSub.className = "section-main-sub";
    const sectionMeds = getSectionMedicationCount(section);
    const childCount = Array.isArray(section.children) ? section.children.length : 0;
    const summaryParts = [];
    if (childCount) {
      summaryParts.push(childCount === 1 ? "1 subseção" : `${childCount} subseções`);
    }
    if (sectionMeds) {
      summaryParts.push(sectionMeds === 1 ? "1 medicamento" : `${sectionMeds} medicamentos`);
    }
    if (summaryParts.length) {
      sectionSub.textContent = summaryParts.join(" · ");
      sectionMain.appendChild(sectionSub);
    }

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
      sectionCard.appendChild(renderMetaBox("⚠ Orientações ao profissional", section.meta.orientacoes, "orient"));
    }
    if (isNonEmptyString(section.meta.alertas)) {
      sectionCard.appendChild(renderMetaBox("Alertas da seção", section.meta.alertas, "warn"));
    }
    if (isNonEmptyString(section.meta.notas)) {
      sectionCard.appendChild(renderMetaBox("Notas da seção", section.meta.notas, "soft"));
    }

    const inlineContext = {
      protocolId: protocol.id,
      sectionId: section.id
    };

    if (section.mode === "structured") {
      section.groups.forEach((group, groupIndex) => {
        const groupNode = renderStructuredGroupBlock({
          protocol,
          section,
          sectionPath: section.path,
          group,
          groupPath: String(groupIndex)
        });
        if (groupNode) {
          sectionCard.appendChild(groupNode);
        }
      });
    } else if (hasVisibleFreeBlocks(section.blocks)) {
      sectionCard.appendChild(renderFreeBlocks(section.blocks, inlineContext));
    }

    if (sectionCard.childNodes.length) {
      sectionBody.appendChild(sectionCard);
    }

    if (Array.isArray(section.children) && section.children.length) {
      const childList = document.createElement("div");
      childList.className = "section-list section-list-nested";
      section.children.forEach((child) => {
        childList.appendChild(renderSectionNode(child));
      });
      sectionBody.appendChild(childList);
    }

    if (sectionHasOwnVisibleContent(section) || sectionBody.childNodes.length) {
      sectionItem.appendChild(sectionBody);
    }
    return sectionItem;
  };

  protocol.sections.forEach((section) => {
    sectionList.appendChild(renderSectionNode(section));
  });

  detail.appendChild(sectionList);

  const referencesNode = renderReferencesSection(protocol.references);
  if (referencesNode) {
    detail.appendChild(referencesNode);
  }

  return detail;
}

function protocolToText(protocol) {
  const lines = [];
  lines.push(`${protocol.title} (${protocol.areaName})`);

  const appendSectionText = (section, depth = 0) => {
    const baseIndent = "  ".repeat(depth);
    lines.push(`\n${baseIndent}[Seção ${section.numbering}] ${section.title}`);

    if (section.mode === "structured") {
      const counter = { value: 1 };
      section.groups.forEach((group) => {
        const visibleSections = getGroupSections(group)
          .map((entry) => ({
            titulo: asString(entry?.titulo).trim(),
            items: Array.isArray(entry?.items)
              ? entry.items.filter((item) => itemHasPrescriptionContent(item))
              : []
          }))
          .filter((entry) => entry.items.length > 0);
        if (!visibleSections.length) {
          return;
        }

        lines.push(`${baseIndent}  (${getGroupDisplayLabel(group)}) ${group.titulo}`);
        visibleSections.forEach((entry) => {
          if (isNonEmptyString(entry.titulo)) {
            lines.push(`${baseIndent}    [${entry.titulo}]`);
          }
          entry.items.forEach((item) => {
            const entryLines = buildPrescriptionEntryLines(item, counter.value);
            entryLines.forEach((line) => {
              lines.push(`${baseIndent}      ${line}`);
            });
            counter.value += 1;
          });
        });
      });
    }

    if (Array.isArray(section.children) && section.children.length) {
      section.children.forEach((child) => appendSectionText(child, depth + 1));
    }
  };

  protocol.sections.forEach((section) => {
    appendSectionText(section, 0);
  });

  if (Array.isArray(protocol.references) && protocol.references.length) {
    lines.push("\nReferências");
    protocol.references.forEach((reference, index) => {
      lines.push(`${index + 1}. ${reference.title} - ${reference.href}`);
    });
  }

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

  return list.sort((a, b) => {
    const byTitle = comparePtBrAlpha(a.title, b.title);
    if (byTitle !== 0) {
      return byTitle;
    }
    const byArea = comparePtBrAlpha(a.areaName, b.areaName);
    if (byArea !== 0) {
      return byArea;
    }
    return comparePtBrAlpha(a.id, b.id);
  });
}

function renderAreaFilters() {
  const areas = state.areas.slice().sort((a, b) => {
    const byArea = comparePtBrAlpha(a.area, b.area);
    if (byArea !== 0) {
      return byArea;
    }
    return comparePtBrAlpha(a.slug, b.slug);
  });
  const validFilters = new Set(["all", ...areas.map((area) => area.slug)]);
  if (!validFilters.has(state.activeFilter)) {
    state.activeFilter = "all";
  }

  dom.areaFilters.innerHTML = "";

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `filter-btn${state.activeFilter === "all" ? " active" : ""}`;
  allButton.dataset.filter = "all";

  const allLabel = document.createElement("span");
  allLabel.className = "filter-label";

  const allText = document.createElement("span");
  allText.textContent = "Todos";
  allLabel.appendChild(allText);

  const allBadge = document.createElement("span");
  allBadge.className = "count";
  allBadge.textContent = String(state.protocols.length);

  allButton.appendChild(allLabel);
  allButton.appendChild(allBadge);
  dom.areaFilters.appendChild(allButton);

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
    labelText.className = "filter-area-name";
    labelText.textContent = area.area;
    label.appendChild(labelText);

    const badge = document.createElement("span");
    badge.className = "count";
    badge.textContent = String(count);

    button.appendChild(label);
    button.appendChild(badge);
    dom.areaFilters.appendChild(button);
  });

  document.querySelectorAll("#areaFilters .filter-btn[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.activeFilter);
  });
}

function renderProtocols() {
  const visible = getVisibleProtocols();
  state.tagLookup = new Map();
  closeTagPopover();

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
    sub.textContent = protocol.references.length ? `${medLabel} · Possui referências` : medLabel;
    main.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "protocol-actions";

    if (protocol.meta?.revisadoEspecialista) {
      const reviewedTag = document.createElement("span");
      reviewedTag.className = "reviewed-specialist-tag";
      reviewedTag.textContent = "Revisado por especialista";
      actions.appendChild(reviewedTag);
    }

    const arrow = document.createElement("span");
    arrow.className = "icon-btn";
    arrow.textContent = state.expandedId === protocol.id ? "▴" : "▾";

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
    if (state.pendingSyncReload) {
      state.pendingSyncReload = false;
      window.setTimeout(() => {
        if (!state.loading) {
          loadData();
        } else {
          state.pendingSyncReload = true;
        }
      }, 80);
    }
  }
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const clickTarget = event.target instanceof Element ? event.target : null;
    if (!clickTarget) {
      return;
    }

    const tagBtn = clickTarget.closest(".inline-tag-ref");
    if (tagBtn) {
      event.preventDefault();
      event.stopPropagation();
      const resolved = resolveTagFromButton(tagBtn);
      if (resolved) {
        openTagPopover(tagBtn, resolved.tag);
      } else {
        closeTagPopover();
      }
      return;
    }

    if (state.tagPopover && !clickTarget.closest(".tag-popover")) {
      closeTagPopover();
    }

    const btn = clickTarget.closest(".filter-btn[data-filter]");
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
    if (event.key === "Escape" && state.tagPopover) {
      closeTagPopover();
      return;
    }
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

  window.addEventListener("resize", () => {
    closeTagPopover();
  });
  window.addEventListener(
    "scroll",
    () => {
      if (state.tagPopover) {
        closeTagPopover();
      }
    },
    { passive: true, capture: true }
  );

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_LAST_SYNC_KEY) {
      return;
    }
    requestReloadAfterSync();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      requestReloadAfterSync();
    }
  });
}

function init() {
  state.lastSyncToken = readLastSyncToken();
  bindEvents();
  loadData();
}

init();
