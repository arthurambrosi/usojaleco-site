import { Editor, Extension, Node, mergeAttributes } from "https://esm.sh/@tiptap/core@2.6.6";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@2.6.6";
import Underline from "https://esm.sh/@tiptap/extension-underline@2.6.6";
import Table from "https://esm.sh/@tiptap/extension-table@2.6.6";
import TableRow from "https://esm.sh/@tiptap/extension-table-row@2.6.6";
import TableHeaderBase from "https://esm.sh/@tiptap/extension-table-header@2.6.6";
import TableCellBase from "https://esm.sh/@tiptap/extension-table-cell@2.6.6";
import { Plugin, PluginKey } from "https://esm.sh/prosemirror-state@1.4.3";

const SCHEMA_VERSION = "1.1.0";
const MARKS = ["bold", "italic", "underline"];
const VALID_BLOCK_TYPES = ["heading", "paragraph", "list", "callout", "divider", "table"];
const CALLOUT_TONES = ["info", "warning", "danger", "success"];
const TAB_MODES = ["free", "structured"];
const STRUCTURED_GROUP_TYPES = ["or", "add"];
const DEFAULT_EDITOR_FONT_SIZE = 0.93;
const MIN_EDITOR_FONT_SIZE = 0.72;
const MAX_EDITOR_FONT_SIZE = 1.35;
const HANDLE_DB_NAME = "prescrever-fs-access";
const HANDLE_DB_VERSION = 1;
const HANDLE_STORE = "handles";
const HANDLE_KEY_DATA_DIR = "data-dir";

const TONE_LABEL = {
  info: "Info",
  warning: "Atencao",
  danger: "Contraindicacao",
  success: "Conduta"
};

function makeCellColorAttribute() {
  return {
    default: null,
    parseHTML: (element) => element.getAttribute("data-cell-bg") || element.style.backgroundColor || null,
    renderHTML: (attributes) => {
      if (!attributes.backgroundColor) {
        return {};
      }
      return {
        "data-cell-bg": attributes.backgroundColor,
        style: `background-color: ${attributes.backgroundColor};`
      };
    }
  };
}

const TableHeader = TableHeaderBase.extend({
  addAttributes() {
    return {
      ...(this.parent ? this.parent() : {}),
      backgroundColor: makeCellColorAttribute()
    };
  }
});

const TableCell = TableCellBase.extend({
  addAttributes() {
    return {
      ...(this.parent ? this.parent() : {}),
      backgroundColor: makeCellColorAttribute()
    };
  }
});

const dom = {
  areasList: document.getElementById("areasList"),
  subjectsList: document.getElementById("subjectsList"),
  tabsList: document.getElementById("tabsList"),
  tabPills: document.getElementById("tabPills"),
  breadcrumb: document.getElementById("breadcrumb"),

  btnModeStructured: document.getElementById("btnModeStructured"),
  btnModeFree: document.getElementById("btnModeFree"),
  structuredModePane: document.getElementById("structuredModePane"),
  freeModePane: document.getElementById("freeModePane"),

  subjectMetaOrientacoes: document.getElementById("subjectMetaOrientacoes"),
  subjectMetaAlertas: document.getElementById("subjectMetaAlertas"),
  subjectMetaNotas: document.getElementById("subjectMetaNotas"),

  sectionMetaOrientacoes: document.getElementById("sectionMetaOrientacoes"),
  sectionMetaAlertas: document.getElementById("sectionMetaAlertas"),
  sectionMetaNotas: document.getElementById("sectionMetaNotas"),

  btnAddOrBlock: document.getElementById("btnAddOrBlock"),
  btnAddAddBlock: document.getElementById("btnAddAddBlock"),
  structuredBlocks: document.getElementById("structuredBlocks"),

  itemMetaModal: document.getElementById("itemMetaModal"),
  itemMetaTitle: document.getElementById("itemMetaTitle"),
  itemMetaContra: document.getElementById("itemMetaContra"),
  itemMetaOrientacoes: document.getElementById("itemMetaOrientacoes"),
  itemMetaAlertas: document.getElementById("itemMetaAlertas"),
  btnItemMetaSave: document.getElementById("btnItemMetaSave"),
  btnItemMetaClose: document.getElementById("btnItemMetaClose"),

  textStyleSelect: document.getElementById("textStyleSelect"),
  calloutToneSelect: document.getElementById("calloutToneSelect"),
  btnInsertCallout: document.getElementById("btnInsertCallout"),
  btnInsertTable: document.getElementById("btnInsertTable"),
  tableCellColor: document.getElementById("tableCellColor"),
  btnApplyCellColor: document.getElementById("btnApplyCellColor"),
  btnClearCellColor: document.getElementById("btnClearCellColor"),
  btnFontDown: document.getElementById("btnFontDown"),
  btnFontUp: document.getElementById("btnFontUp"),

  btnNewArea: document.getElementById("btnNewArea"),
  btnImportArea: document.getElementById("btnImportArea"),
  fileImportArea: document.getElementById("fileImportArea"),
  btnNewSubject: document.getElementById("btnNewSubject"),
  btnRenameSubject: document.getElementById("btnRenameSubject"),
  btnNewTab: document.getElementById("btnNewTab"),
  btnConvertToNotes: document.getElementById("btnConvertToNotes"),
  btnRenameTab: document.getElementById("btnRenameTab"),
  btnTabLeft: document.getElementById("btnTabLeft"),
  btnTabRight: document.getElementById("btnTabRight"),
  btnDeleteTab: document.getElementById("btnDeleteTab"),

  btnDownloadArea: document.getElementById("btnDownloadArea"),
  btnExportTab: document.getElementById("btnExportTab"),
  btnCopyPreview: document.getElementById("btnCopyPreview"),
  btnSyncJson: document.getElementById("btnSyncJson"),
  btnLinkDataFolder: document.getElementById("btnLinkDataFolder"),
  jsonPreview: document.getElementById("jsonPreview"),
  validationList: document.getElementById("validationList"),
  statusBar: document.getElementById("statusBar"),
  editorElement: document.getElementById("editor")
};

const state = {
  areas: [],
  activeAreaSlug: "",
  activeSubjectSlug: "",
  activeTabSlug: "",
  editor: null,
  ignoreEditorUpdate: false,
  itemMetaContext: null,
  areaFileNames: new Map(),
  areaFileHandles: new Map(),
  areaFileHandleNames: new Map(),
  dataDirHandle: null,
  editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
  lastSyncedSignatures: new Map()
};

const CalloutNode = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      tone: {
        default: "info",
        parseHTML: (element) => element.getAttribute("data-tone") || "info"
      },
      title: {
        default: "Info",
        parseHTML: (element) => element.getAttribute("data-title") || "Info"
      }
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    const tone = CALLOUT_TONES.includes(HTMLAttributes.tone) ? HTMLAttributes.tone : "info";
    const title = isNonEmptyString(HTMLAttributes.title) ? HTMLAttributes.title : TONE_LABEL[tone];
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "callout",
        "data-tone": tone,
        "data-title": title
      }),
      0
    ];
  }
});

const SanitizedPaste = Extension.create({
  name: "sanitizedPaste",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("sanitizedPaste"),
        props: {
          handlePaste: (_view, event) => {
            const text = event.clipboardData?.getData("text/plain");
            if (!text) return false;
            event.preventDefault();
            const nodes = plainTextToDocNodes(text);
            this.editor.chain().focus().insertContent(nodes).run();
            return true;
          }
        }
      })
    ];
  }
});

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function asString(value) {
  return typeof value === "string" ? value : "";
}

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .replace(/-{2,}/g, "-");
}

function makeUniqueSlug(baseSlug, usedSlugs) {
  const base = isNonEmptyString(baseSlug) ? slugify(baseSlug) : "item";
  let candidate = base || "item";
  let index = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}

function createEntityMeta() {
  return {
    orientacoes: "",
    alertas: "",
    notas: ""
  };
}

function normalizeEntityMeta(rawMeta) {
  return {
    orientacoes: asString(rawMeta?.orientacoes).trim(),
    alertas: asString(rawMeta?.alertas).trim(),
    notas: asString(rawMeta?.notas).trim()
  };
}

function createItemMeta() {
  return {
    contraindicacoes: "",
    orientacoes: "",
    alertas: ""
  };
}

function normalizeItemMeta(rawMeta) {
  return {
    contraindicacoes: asString(rawMeta?.contraindicacoes).trim(),
    orientacoes: asString(rawMeta?.orientacoes).trim(),
    alertas: asString(rawMeta?.alertas).trim()
  };
}

function createStructuredItem(initialName = "Novo medicamento") {
  const safeName = isNonEmptyString(initialName) ? initialName.trim() : "Novo medicamento";
  return {
    id: uid("item"),
    nome: safeName,
    apresentacao: "",
    posologia: "",
    sus: false,
    meta: createItemMeta()
  };
}

function normalizeStructuredItem(rawItem, itemIndex = 0) {
  return {
    id: isNonEmptyString(rawItem?.id) ? rawItem.id : uid(`item${itemIndex + 1}`),
    nome: asString(rawItem?.nome).trim(),
    apresentacao: asString(rawItem?.apresentacao).trim(),
    posologia: asString(rawItem?.posologia).trim(),
    sus: Boolean(rawItem?.sus),
    meta: normalizeItemMeta(rawItem?.meta)
  };
}

function createStructuredGroup(type = "or") {
  const validType = STRUCTURED_GROUP_TYPES.includes(type) ? type : "or";
  return {
    id: uid("group"),
    type: validType,
    rotulo: validType === "or" ? "OU" : "ASSOCIAR",
    titulo: validType === "or" ? "Escolha uma das opcoes abaixo:" : "Associar / adicionar",
    items: [createStructuredItem("")]
  };
}

function normalizeStructuredGroup(rawGroup, groupIndex = 0) {
  const type = STRUCTURED_GROUP_TYPES.includes(rawGroup?.type) ? rawGroup.type : "or";
  const items = Array.isArray(rawGroup?.items)
    ? rawGroup.items.map((item, itemIndex) => normalizeStructuredItem(item, itemIndex))
    : [];

  return {
    id: isNonEmptyString(rawGroup?.id) ? rawGroup.id : uid(`group${groupIndex + 1}`),
    type,
    rotulo: isNonEmptyString(rawGroup?.rotulo)
      ? rawGroup.rotulo.trim()
      : isNonEmptyString(rawGroup?.label)
        ? rawGroup.label.trim()
        : type === "or"
          ? "OU"
          : "ASSOCIAR",
    titulo: isNonEmptyString(rawGroup?.titulo)
      ? rawGroup.titulo.trim()
      : type === "or"
        ? "Escolha uma das opcoes abaixo:"
        : "Associar / adicionar",
    items: items.length ? items : [createStructuredItem("")]
  };
}

function createStructuredModel() {
  return {
    groups: [createStructuredGroup("or"), createStructuredGroup("add")]
  };
}

function normalizeStructuredModel(rawStructured) {
  const rawGroups = Array.isArray(rawStructured)
    ? rawStructured
    : Array.isArray(rawStructured?.groups)
      ? rawStructured.groups
      : [];

  const groups = rawGroups.map((group, groupIndex) => normalizeStructuredGroup(group, groupIndex));
  return { groups: groups.length ? groups : [createStructuredGroup("or")] };
}

function normalizeMarks(rawMarks) {
  if (!Array.isArray(rawMarks)) return [];
  return [...new Set(rawMarks.filter((mark) => MARKS.includes(mark)))];
}

function normalizeInlineContent(rawContent) {
  if (typeof rawContent === "string") {
    const text = rawContent.trim();
    return text ? [{ text }] : [];
  }

  if (!Array.isArray(rawContent)) {
    return [];
  }

  const spans = [];

  for (const span of rawContent) {
    if (typeof span === "string") {
      if (span.length) {
        spans.push({ text: span });
      }
      continue;
    }

    if (!span || typeof span !== "object") {
      continue;
    }

    const text = typeof span.text === "string" ? span.text : "";
    if (!text.length) {
      continue;
    }

    const marks = normalizeMarks(span.marks);
    spans.push(marks.length ? { text, marks } : { text });
  }

  return spans;
}

function normalizeListItems(rawItems) {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  const items = [];
  for (const item of rawItems) {
    if (typeof item === "string") {
      if (item.trim()) {
        items.push({ content: [{ text: item.trim() }] });
      }
      continue;
    }

    if (!item || typeof item !== "object") {
      continue;
    }

    const content = normalizeInlineContent(item.content);
    if (content.length) {
      items.push({ content });
    }
  }

  return items;
}

function normalizeTone(rawTone) {
  return CALLOUT_TONES.includes(rawTone) ? rawTone : "info";
}

function normalizeRows(rawRows) {
  if (!Array.isArray(rawRows)) {
    return [];
  }

  return rawRows
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((cell) => String(cell ?? "").trim()));
}

function normalizeColorRow(rawRow, size) {
  const out = Array.from({ length: size }, () => null);
  if (!Array.isArray(rawRow)) {
    return out;
  }
  for (let index = 0; index < size; index += 1) {
    const value = rawRow[index];
    out[index] = isNonEmptyString(value) ? value.trim() : null;
  }
  return out;
}

function normalizeTable(raw) {
  const headers = Array.isArray(raw?.headers)
    ? raw.headers.map((header) => String(header ?? "").trim())
    : [];

  const rows = normalizeRows(raw?.rows);
  const columns = Math.max(headers.length, rows[0]?.length || 0);

  if (!headers.length && !rows.length) {
    return null;
  }

  const headerBackgrounds = normalizeColorRow(raw?.headerBackgrounds, columns || headers.length);
  const rowBackgrounds = Array.isArray(raw?.rowBackgrounds)
    ? rows.map((_, rowIndex) => normalizeColorRow(raw.rowBackgrounds[rowIndex], columns || rows[rowIndex].length))
    : rows.map((row) => normalizeColorRow([], columns || row.length));

  return {
    type: "table",
    headers,
    rows,
    headerBackgrounds,
    rowBackgrounds
  };
}

function createParagraphBlock(text) {
  return {
    type: "paragraph",
    content: text ? [{ text }] : []
  };
}

function normalizeBlock(rawBlock) {
  if (!rawBlock || typeof rawBlock !== "object") {
    return null;
  }

  if (!VALID_BLOCK_TYPES.includes(rawBlock.type)) {
    return null;
  }

  switch (rawBlock.type) {
    case "heading":
      return {
        type: "heading",
        level: rawBlock.level === 3 ? 3 : 2,
        content: normalizeInlineContent(rawBlock.content)
      };

    case "paragraph":
      return {
        type: "paragraph",
        content: normalizeInlineContent(rawBlock.content)
      };

    case "list":
      return {
        type: "list",
        style: rawBlock.style === "ordered" ? "ordered" : "unordered",
        items: normalizeListItems(rawBlock.items)
      };

    case "callout": {
      const nestedBlocks = normalizeBlocks(rawBlock.blocks, true);
      const tone = normalizeTone(rawBlock.tone);
      return {
        type: "callout",
        tone,
        title: isNonEmptyString(rawBlock.title) ? rawBlock.title.trim() : TONE_LABEL[tone],
        blocks: nestedBlocks.length ? nestedBlocks : [createParagraphBlock("Edite o protocolo aqui.")]
      };
    }

    case "divider":
      return { type: "divider" };

    case "table":
      return normalizeTable(rawBlock);

    default:
      return null;
  }
}

function normalizeBlocks(rawBlocks, allowEmpty = false) {
  if (!Array.isArray(rawBlocks)) {
    return allowEmpty ? [] : [createParagraphBlock("Edite o protocolo aqui.")];
  }

  const blocks = rawBlocks
    .map((block) => normalizeBlock(block))
    .filter((block) => Boolean(block));

  if (!blocks.length && !allowEmpty) {
    return [createParagraphBlock("Edite o protocolo aqui.")];
  }

  return blocks;
}

function inferTabMode(rawTab) {
  if (TAB_MODES.includes(rawTab?.mode)) {
    return rawTab.mode;
  }

  const hasStructuredContent =
    Array.isArray(rawTab?.structured?.groups) ||
    Array.isArray(rawTab?.structured) ||
    Array.isArray(rawTab?.prescricaoEstruturada?.groups);

  return hasStructuredContent ? "structured" : "free";
}

function createDefaultTab(title = "Nova Secao", slugBase = "nova-secao") {
  return {
    titulo: title,
    slug: slugify(slugBase) || "nova-secao",
    mode: "structured",
    meta: createEntityMeta(),
    blocks: [createParagraphBlock("Edite o protocolo aqui.")],
    structured: createStructuredModel()
  };
}

function createDefaultSubject(title = "Geral") {
  return {
    titulo: title,
    slug: slugify(title) || "geral",
    descricaoCurta: "",
    meta: createEntityMeta(),
    tabs: [createDefaultTab("Conduta inicial", "conduta-inicial")]
  };
}

function normalizeTab(rawTab, tabIndex = 0) {
  const title = isNonEmptyString(rawTab?.titulo) ? rawTab.titulo.trim() : `Secao ${tabIndex + 1}`;
  const mode = inferTabMode(rawTab);

  return {
    titulo: title,
    slug: slugify(rawTab?.slug || title || `secao-${tabIndex + 1}`),
    mode,
    meta: normalizeEntityMeta(rawTab?.meta || rawTab?.metadados),
    blocks: normalizeBlocks(rawTab?.blocks),
    structured: normalizeStructuredModel(rawTab?.structured || rawTab?.prescricaoEstruturada)
  };
}

function normalizeSubject(rawSubject, subjectIndex = 0) {
  const title = isNonEmptyString(rawSubject?.titulo)
    ? rawSubject.titulo.trim()
    : `Assunto ${subjectIndex + 1}`;

  const rawTabs = Array.isArray(rawSubject?.tabs) ? rawSubject.tabs : [];
  const tabs = rawTabs.map((tab, tabIndex) => normalizeTab(tab, tabIndex));
  const normalizedTabs = tabs.length ? tabs : [createDefaultTab("Resumo", "resumo")];

  const uniqueTabSlugs = new Set();
  for (const tab of normalizedTabs) {
    tab.slug = makeUniqueSlug(tab.slug || tab.titulo, uniqueTabSlugs);
    uniqueTabSlugs.add(tab.slug);
  }

  return {
    titulo: title,
    slug: slugify(rawSubject?.slug || title || `assunto-${subjectIndex + 1}`),
    descricaoCurta: isNonEmptyString(rawSubject?.descricaoCurta)
      ? rawSubject.descricaoCurta.trim()
      : "",
    meta: normalizeEntityMeta(rawSubject?.meta || rawSubject?.metadados),
    tabs: normalizedTabs
  };
}

function normalizeArea(rawArea, areaIndex = 0) {
  const areaName = isNonEmptyString(rawArea?.area)
    ? rawArea.area.trim()
    : `Area ${areaIndex + 1}`;

  const rawSubjects = Array.isArray(rawArea?.assuntos) ? rawArea.assuntos : [];
  const subjects = rawSubjects.map((subject, subjectIndex) => normalizeSubject(subject, subjectIndex));
  const normalizedSubjects = subjects.length ? subjects : [createDefaultSubject("Geral")];

  const uniqueSubjectSlugs = new Set();
  for (const subject of normalizedSubjects) {
    subject.slug = makeUniqueSlug(subject.slug || subject.titulo, uniqueSubjectSlugs);
    uniqueSubjectSlugs.add(subject.slug);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    area: areaName,
    slug: slugify(rawArea?.slug || areaName || `area-${areaIndex + 1}`),
    assuntos: normalizedSubjects
  };
}

function normalizeAreas(rawAreas) {
  const normalized = rawAreas.map((area, index) => normalizeArea(area, index));
  const used = new Set();

  for (const area of normalized) {
    area.slug = makeUniqueSlug(area.slug || area.area, used);
    used.add(area.slug);
  }

  return normalized;
}

function getActiveArea() {
  return state.areas.find((area) => area.slug === state.activeAreaSlug) || null;
}

function getActiveSubject() {
  const area = getActiveArea();
  if (!area) {
    return null;
  }
  return area.assuntos.find((subject) => subject.slug === state.activeSubjectSlug) || null;
}

function getActiveTab() {
  const subject = getActiveSubject();
  if (!subject) {
    return null;
  }
  return subject.tabs.find((tab) => tab.slug === state.activeTabSlug) || null;
}

function getTabMode(tab) {
  return tab?.mode === "structured" ? "structured" : "free";
}

function ensureTabShape(tab) {
  if (!tab || typeof tab !== "object") {
    return;
  }

  if (!TAB_MODES.includes(tab.mode)) {
    tab.mode = "free";
  }

  tab.meta = normalizeEntityMeta(tab.meta);
  tab.blocks = normalizeBlocks(tab.blocks);
  tab.structured = normalizeStructuredModel(tab.structured);
}

function ensureActiveSelection() {
  if (!state.areas.length) {
    state.activeAreaSlug = "";
    state.activeSubjectSlug = "";
    state.activeTabSlug = "";
    return;
  }

  const area = getActiveArea() || state.areas[0];
  state.activeAreaSlug = area.slug;

  const subject =
    area.assuntos.find((item) => item.slug === state.activeSubjectSlug) ||
    area.assuntos[0] ||
    null;

  state.activeSubjectSlug = subject ? subject.slug : "";

  const tab =
    subject?.tabs.find((item) => item.slug === state.activeTabSlug) ||
    subject?.tabs[0] ||
    null;

  state.activeTabSlug = tab ? tab.slug : "";

  if (subject) {
    subject.meta = normalizeEntityMeta(subject.meta);
  }

  if (tab) {
    ensureTabShape(tab);
  }
}

function setStatus(message) {
  dom.statusBar.textContent = message;
}

function applyEditorFontSize(size) {
  const nextSize = Math.max(MIN_EDITOR_FONT_SIZE, Math.min(MAX_EDITOR_FONT_SIZE, Number(size) || DEFAULT_EDITOR_FONT_SIZE));
  state.editorFontSize = Number(nextSize.toFixed(2));
  dom.editorElement.style.setProperty("--editor-font-size", `${state.editorFontSize}rem`);
}

function adjustEditorFontSize(delta) {
  applyEditorFontSize(state.editorFontSize + delta);
}

function normalizeFileName(value, fallback = "area.json") {
  const base = String(value || "").trim().split(/[\\/]/).pop();
  return isNonEmptyString(base) ? base : fallback;
}

function setAreaFileName(areaSlug, filename) {
  if (!isNonEmptyString(areaSlug)) {
    return;
  }
  state.areaFileNames.set(areaSlug, normalizeFileName(filename, `${areaSlug}.json`));
}

function getAreaFileName(area) {
  const mapped = state.areaFileNames.get(area.slug);
  if (isNonEmptyString(mapped)) {
    return mapped;
  }
  return `${area.slug}.json`;
}

function serializeArea(area) {
  return {
    schemaVersion: SCHEMA_VERSION,
    area: area.area,
    slug: area.slug,
    assuntos: area.assuntos
  };
}

async function writeJsonToFileHandle(fileHandle, payload) {
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
}

async function resolveJsonTargetDirectory(baseDirHandle) {
  if (!baseDirHandle) {
    throw new Error("Diretório base não definido.");
  }

  try {
    return await baseDirHandle.getDirectoryHandle("data");
  } catch (_error) {
    return baseDirHandle;
  }
}

function areaSyncSignature(area, fileName) {
  const payload = serializeArea(area);
  return `${normalizeFileName(fileName, `${area.slug}.json`)}\n${JSON.stringify(payload)}`;
}

function captureCurrentSyncSignatures() {
  const next = new Map();
  state.areas.forEach((area) => {
    const fileName = getAreaFileName(area);
    next.set(area.slug, areaSyncSignature(area, fileName));
  });
  state.lastSyncedSignatures = next;
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      resolve(null);
      return;
    }

    const request = indexedDB.open(HANDLE_DB_NAME, HANDLE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha ao abrir IndexedDB."));
  });
}

async function readStoredHandle(key) {
  const db = await openHandleDb();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readonly");
    const store = tx.objectStore(HANDLE_STORE);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Falha ao ler handle."));
    tx.oncomplete = () => db.close();
  });
}

async function writeStoredHandle(key, value) {
  const db = await openHandleDb();
  if (!db) return;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    const store = tx.objectStore(HANDLE_STORE);
    store.put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Falha ao salvar handle."));
  });
  db.close();
}

async function clearStoredHandle(key) {
  const db = await openHandleDb();
  if (!db) return;

  await new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    const store = tx.objectStore(HANDLE_STORE);
    store.delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Falha ao remover handle."));
  });
  db.close();
}

async function ensureHandleReadWritePermission(handle) {
  if (!handle || typeof handle.queryPermission !== "function") {
    return false;
  }
  const opts = { mode: "readwrite" };
  const current = await handle.queryPermission(opts);
  if (current === "granted") return true;
  const requested = await handle.requestPermission(opts);
  return requested === "granted";
}

async function ensureLinkedDataDirHandle(allowPicker = false) {
  if (state.dataDirHandle) {
    const ok = await ensureHandleReadWritePermission(state.dataDirHandle);
    if (ok) {
      return state.dataDirHandle;
    }
    state.dataDirHandle = null;
  }

  try {
    const stored = await readStoredHandle(HANDLE_KEY_DATA_DIR);
    if (stored) {
      const ok = await ensureHandleReadWritePermission(stored);
      if (ok) {
        state.dataDirHandle = stored;
        return stored;
      }
    }
  } catch (_error) {}

  if (!allowPicker || typeof window.showDirectoryPicker !== "function") {
    return null;
  }

  const picked = await window.showDirectoryPicker({
    id: "prescrever-data",
    mode: "readwrite",
    startIn: "documents"
  });

  const ok = await ensureHandleReadWritePermission(picked);
  if (!ok) {
    throw new Error("Permissão negada para escrita na pasta vinculada.");
  }

  state.dataDirHandle = picked;
  await writeStoredHandle(HANDLE_KEY_DATA_DIR, picked);
  return picked;
}

async function linkDataFolder() {
  try {
    setStatus("Selecione C:\\Users\\Arthur\\Desktop\\Prescrever\\data (somente 1 vez).");
    const handle = await ensureLinkedDataDirHandle(true);
    if (!handle) {
      setStatus("Pasta de dados não vinculada.");
      return;
    }
    setStatus("Pasta de dados vinculada com sucesso.");
  } catch (error) {
    if (error?.name === "AbortError") {
      setStatus("Vinculação de pasta cancelada.");
      return;
    }
    console.error(error);
    setStatus("Falha ao vincular pasta de dados.");
  }
}

function markButtonActive(button, active) {
  if (!button) {
    return;
  }
  button.classList.toggle("active", Boolean(active));
}

function makeEntityListItem(label, subtitle, isActive, onClick) {
  const li = document.createElement("li");
  li.className = `entity-item${isActive ? " active" : ""}`;

  const button = document.createElement("button");
  button.type = "button";
  button.addEventListener("click", onClick);

  const main = document.createElement("span");
  main.textContent = label;
  button.appendChild(main);

  if (subtitle) {
    const detail = document.createElement("small");
    detail.textContent = subtitle;
    button.appendChild(detail);
  }

  li.appendChild(button);
  return li;
}

function renderAreasList() {
  dom.areasList.innerHTML = "";

  for (const area of state.areas) {
    const item = makeEntityListItem(
      area.area,
      `${area.assuntos.length} assunto(s)`,
      area.slug === state.activeAreaSlug,
      () => {
        persistCurrentTabFromEditor();
        closeItemMetaModal(true);
        state.activeAreaSlug = area.slug;
        state.activeSubjectSlug = "";
        state.activeTabSlug = "";
        ensureActiveSelection();
        renderAll();
        loadActiveTabIntoEditor();
      }
    );
    dom.areasList.appendChild(item);
  }
}

function renderSubjectsList() {
  const area = getActiveArea();
  dom.subjectsList.innerHTML = "";

  if (!area) {
    return;
  }

  for (const subject of area.assuntos) {
    const subtitle = isNonEmptyString(subject.descricaoCurta)
      ? subject.descricaoCurta
      : `${subject.tabs.length} secao(oes)`;

    const item = makeEntityListItem(
      subject.titulo,
      subtitle,
      subject.slug === state.activeSubjectSlug,
      () => {
        persistCurrentTabFromEditor();
        closeItemMetaModal(true);
        state.activeSubjectSlug = subject.slug;
        state.activeTabSlug = "";
        ensureActiveSelection();
        renderAll();
        loadActiveTabIntoEditor();
      }
    );

    dom.subjectsList.appendChild(item);
  }
}

function renderTabsList() {
  const subject = getActiveSubject();
  dom.tabsList.innerHTML = "";

  if (!subject) {
    return;
  }

  for (const tab of subject.tabs) {
    const modeLabel = getTabMode(tab) === "structured" ? "estruturado" : "texto livre";

    const item = makeEntityListItem(
      tab.titulo,
      `${tab.slug} · ${modeLabel}`,
      tab.slug === state.activeTabSlug,
      () => {
        persistCurrentTabFromEditor();
        closeItemMetaModal(true);
        state.activeTabSlug = tab.slug;
        ensureActiveSelection();
        renderAll();
        loadActiveTabIntoEditor();
      }
    );

    dom.tabsList.appendChild(item);
  }
}

function renderTabPills() {
  const subject = getActiveSubject();
  dom.tabPills.innerHTML = "";

  if (!subject) {
    return;
  }

  for (const tab of subject.tabs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-pill${tab.slug === state.activeTabSlug ? " active" : ""}`;
    button.textContent = tab.titulo;
    button.addEventListener("click", () => {
      persistCurrentTabFromEditor();
      closeItemMetaModal(true);
      state.activeTabSlug = tab.slug;
      ensureActiveSelection();
      renderAll();
      loadActiveTabIntoEditor();
    });
    dom.tabPills.appendChild(button);
  }
}

function renderBreadcrumb() {
  const area = getActiveArea();
  const subject = getActiveSubject();
  const tab = getActiveTab();
  dom.breadcrumb.textContent = [area?.area, subject?.titulo, tab?.titulo].filter(Boolean).join(" > ") || "Sem selecao";
}

function renderModeUI() {
  const tab = getActiveTab();
  const mode = getTabMode(tab);

  markButtonActive(dom.btnModeStructured, mode === "structured");
  markButtonActive(dom.btnModeFree, mode === "free");

  dom.structuredModePane.hidden = mode !== "structured";
  dom.freeModePane.hidden = mode !== "free";
}

function setToolbarEnabled(enabled) {
  dom.textStyleSelect.disabled = !enabled;
  dom.btnInsertCallout.disabled = !enabled;
  dom.btnInsertTable.disabled = !enabled;
  if (dom.tableCellColor) dom.tableCellColor.disabled = !enabled;
  if (dom.btnApplyCellColor) dom.btnApplyCellColor.disabled = !enabled;
  if (dom.btnClearCellColor) dom.btnClearCellColor.disabled = !enabled;
  if (dom.btnFontDown) dom.btnFontDown.disabled = !enabled;
  if (dom.btnFontUp) dom.btnFontUp.disabled = !enabled;

  document.querySelectorAll("[data-cmd]").forEach((button) => {
    button.disabled = !enabled;
    if (!enabled) {
      button.classList.remove("active");
    }
  });
}

function renderCommandState() {
  const editor = state.editor;
  const tab = getActiveTab();
  const isFreeMode = Boolean(editor) && getTabMode(tab) === "free";

  setToolbarEnabled(isFreeMode);
  if (!isFreeMode) {
    return;
  }

  document.querySelectorAll("[data-cmd]").forEach((button) => {
    const cmd = button.getAttribute("data-cmd");
    if (cmd === "bold") markButtonActive(button, editor.isActive("bold"));
    if (cmd === "italic") markButtonActive(button, editor.isActive("italic"));
    if (cmd === "underline") markButtonActive(button, editor.isActive("underline"));
    if (cmd === "bulletList") markButtonActive(button, editor.isActive("bulletList"));
    if (cmd === "orderedList") markButtonActive(button, editor.isActive("orderedList"));
  });

  if (dom.btnUndo) {
    dom.btnUndo.disabled = !editor.can().chain().focus().undo().run();
  }
  if (dom.btnRedo) {
    dom.btnRedo.disabled = !editor.can().chain().focus().redo().run();
  }

  if (editor.isActive("heading", { level: 2 })) {
    dom.textStyleSelect.value = "h2";
  } else if (editor.isActive("heading", { level: 3 })) {
    dom.textStyleSelect.value = "h3";
  } else {
    dom.textStyleSelect.value = "paragraph";
  }
}

function toggleActionButtons() {
  const hasArea = Boolean(getActiveArea());
  const hasSubject = Boolean(getActiveSubject());
  const hasTab = Boolean(getActiveTab());
  const mode = getTabMode(getActiveTab());

  dom.btnNewSubject.disabled = !hasArea;
  if (dom.btnRenameSubject) dom.btnRenameSubject.disabled = !hasSubject;
  dom.btnNewTab.disabled = !hasSubject;
  if (dom.btnConvertToNotes) dom.btnConvertToNotes.disabled = !hasTab;
  dom.btnRenameTab.disabled = !hasTab;
  dom.btnTabLeft.disabled = !hasTab;
  dom.btnTabRight.disabled = !hasTab;
  dom.btnDeleteTab.disabled = !hasTab;
  dom.btnDownloadArea.disabled = !hasArea;
  dom.btnExportTab.disabled = !hasTab;

  dom.btnModeStructured.disabled = !hasTab;
  dom.btnModeFree.disabled = !hasTab;

  dom.btnAddOrBlock.disabled = !hasTab || mode !== "structured";
  dom.btnAddAddBlock.disabled = !hasTab || mode !== "structured";

  const disableSubjectMeta = !hasSubject;
  const disableSectionMeta = !hasTab;

  dom.subjectMetaOrientacoes.disabled = disableSubjectMeta;
  dom.subjectMetaAlertas.disabled = disableSubjectMeta;
  dom.subjectMetaNotas.disabled = disableSubjectMeta;

  dom.sectionMetaOrientacoes.disabled = disableSectionMeta;
  dom.sectionMetaAlertas.disabled = disableSectionMeta;
  dom.sectionMetaNotas.disabled = disableSectionMeta;
}

function setInputValue(inputEl, value) {
  if (!inputEl) {
    return;
  }
  inputEl.value = value || "";
}

function autoSizeInputByContent(inputEl, min = 4, max = 32) {
  if (!(inputEl instanceof HTMLInputElement)) {
    return;
  }
  const textLength = String(inputEl.value || "").trim().length;
  inputEl.size = Math.max(min, Math.min(max, textLength + 1));
}

function renderMetadataFields() {
  const subject = getActiveSubject();
  const tab = getActiveTab();

  const subjectMeta = normalizeEntityMeta(subject?.meta);
  const sectionMeta = normalizeEntityMeta(tab?.meta);

  setInputValue(dom.subjectMetaOrientacoes, subjectMeta.orientacoes);
  setInputValue(dom.subjectMetaAlertas, subjectMeta.alertas);
  setInputValue(dom.subjectMetaNotas, subjectMeta.notas);

  setInputValue(dom.sectionMetaOrientacoes, sectionMeta.orientacoes);
  setInputValue(dom.sectionMetaAlertas, sectionMeta.alertas);
  setInputValue(dom.sectionMetaNotas, sectionMeta.notas);
}

function textOrDash(value) {
  return isNonEmptyString(value) ? value : "-";
}

function getActiveGroupById(groupId) {
  const tab = getActiveTab();
  if (!tab || !tab.structured || !Array.isArray(tab.structured.groups)) {
    return null;
  }
  return tab.structured.groups.find((group) => group.id === groupId) || null;
}

function getActiveItemById(groupId, itemId) {
  const group = getActiveGroupById(groupId);
  if (!group || !Array.isArray(group.items)) {
    return null;
  }
  return group.items.find((item) => item.id === itemId) || null;
}

function createEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (typeof text === "string") {
    node.textContent = text;
  }
  return node;
}

function makeStructuredInput(labelText, field, value, groupId, itemId, isTextArea = false) {
  const wrapper = createEl("div", `structured-field${field === "posologia" ? " full" : ""}`);
  const label = createEl("label", "", labelText);
  wrapper.appendChild(label);

  const control = isTextArea ? document.createElement("textarea") : document.createElement("input");
  control.value = value || "";
  control.dataset.itemField = field;
  control.dataset.groupId = groupId;
  control.dataset.itemId = itemId;
  if (!isTextArea) {
    control.type = "text";
  }
  if (isTextArea) {
    control.rows = 2;
  }

  wrapper.appendChild(control);
  return wrapper;
}

function renderItemMetaSummary(item) {
  const summary = createEl("div", "item-meta-summary");
  const meta = normalizeItemMeta(item.meta);

  if (isNonEmptyString(meta.contraindicacoes)) {
    summary.appendChild(createEl("span", "meta-chip", "Contraindicações"));
  }
  if (item.sus) {
    summary.appendChild(createEl("span", "meta-chip", "SUS"));
  }
  if (isNonEmptyString(meta.orientacoes)) {
    summary.appendChild(createEl("span", "meta-chip", "Orientações ao profissional"));
  }
  if (isNonEmptyString(meta.alertas)) {
    summary.appendChild(createEl("span", "meta-chip", "Alertas"));
  }

  if (!summary.childNodes.length) {
    summary.appendChild(createEl("span", "meta-chip", "Sem metadados do item"));
  }

  return summary;
}

function renderStructuredBuilder() {
  const tab = getActiveTab();
  dom.structuredBlocks.innerHTML = "";

  if (!tab) {
    return;
  }

  ensureTabShape(tab);
  const groups = Array.isArray(tab.structured?.groups) ? tab.structured.groups : [];

  groups.forEach((group, groupIndex) => {
    const wrapper = createEl("section", `structured-block ${group.type === "add" ? "is-add" : "is-or"}`);
    wrapper.dataset.groupId = group.id;

    const header = createEl("div", "structured-block-header");
    const left = createEl("div", "structured-block-left");

    const kindInput = document.createElement("input");
    kindInput.className = `structured-kind-input${group.type === "add" ? " is-add" : ""}`;
    kindInput.type = "text";
    kindInput.value = isNonEmptyString(group.rotulo) ? group.rotulo : group.type === "add" ? "ASSOCIAR" : "OU";
    kindInput.dataset.groupField = "rotulo";
    kindInput.dataset.groupId = group.id;
    kindInput.maxLength = 28;
    kindInput.title = "Rótulo do bloco (ex.: OU, ASSOCIAR, 1ª opção...)";
    autoSizeInputByContent(kindInput, 3, 32);
    left.appendChild(kindInput);

    const titleInput = document.createElement("input");
    titleInput.className = "structured-group-title";
    titleInput.type = "text";
    titleInput.value = group.titulo || "";
    titleInput.dataset.groupField = "titulo";
    titleInput.dataset.groupId = group.id;
    left.appendChild(titleInput);

    const actions = createEl("div", "structured-block-actions");

    const addItemBtn = createEl("button", "btn btn-small", "+ Item");
    addItemBtn.type = "button";
    addItemBtn.dataset.action = "add-item";
    addItemBtn.dataset.groupId = group.id;
    actions.appendChild(addItemBtn);

    const removeGroupBtn = createEl("button", "btn btn-small btn-danger", "Excluir bloco");
    removeGroupBtn.type = "button";
    removeGroupBtn.dataset.action = "remove-group";
    removeGroupBtn.dataset.groupId = group.id;
    actions.appendChild(removeGroupBtn);

    header.appendChild(left);
    header.appendChild(actions);

    const itemsWrap = createEl("div", "structured-items");

    group.items.forEach((item, itemIndex) => {
      const itemCard = createEl("article", "structured-item");
      itemCard.dataset.groupId = group.id;
      itemCard.dataset.itemId = item.id;

      const itemTop = createEl("div", "structured-item-top");
      itemTop.appendChild(createEl("span", "structured-item-title", `Item ${itemIndex + 1}`));

      const itemActions = createEl("div", "structured-item-actions");

      const susLabel = createEl("label", "sus-toggle");
      const susCheck = document.createElement("input");
      susCheck.type = "checkbox";
      susCheck.checked = Boolean(item.sus);
      susCheck.dataset.itemField = "sus";
      susCheck.dataset.groupId = group.id;
      susCheck.dataset.itemId = item.id;
      susLabel.appendChild(susCheck);
      susLabel.appendChild(createEl("span", "", "SUS"));
      itemActions.appendChild(susLabel);

      const metaBtn = createEl("button", "meta-dots", "⋯");
      metaBtn.type = "button";
      metaBtn.dataset.action = "open-item-meta";
      metaBtn.dataset.groupId = group.id;
      metaBtn.dataset.itemId = item.id;
      metaBtn.title = "Metadados do item";
      itemActions.appendChild(metaBtn);

      const removeItemBtn = createEl("button", "btn btn-small btn-danger", "Excluir item");
      removeItemBtn.type = "button";
      removeItemBtn.dataset.action = "remove-item";
      removeItemBtn.dataset.groupId = group.id;
      removeItemBtn.dataset.itemId = item.id;
      itemActions.appendChild(removeItemBtn);

      itemTop.appendChild(itemActions);

      const fieldsGrid = createEl("div", "structured-fields-grid");
      fieldsGrid.appendChild(makeStructuredInput("Nome do medicamento", "nome", item.nome, group.id, item.id));
      fieldsGrid.appendChild(makeStructuredInput("Apresentacao / forma", "apresentacao", item.apresentacao, group.id, item.id));
      fieldsGrid.appendChild(makeStructuredInput("Posologia / uso", "posologia", item.posologia, group.id, item.id, true));

      itemCard.appendChild(itemTop);
      itemCard.appendChild(fieldsGrid);
      itemCard.appendChild(renderItemMetaSummary(item));

      itemsWrap.appendChild(itemCard);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(itemsWrap);

    if (groupIndex > 0) {
      const divider = createEl("div", "structured-item-title", "");
      divider.textContent = group.type === "add" ? "Bloco de associacao" : "Bloco de escolha";
      wrapper.appendChild(divider);
    }

    dom.structuredBlocks.appendChild(wrapper);
  });

  if (!groups.length) {
    const empty = createEl("div", "structured-item", "Sem blocos estruturados nesta secao.");
    dom.structuredBlocks.appendChild(empty);
  }
}

function persistSubjectMetaFromUI() {
  const subject = getActiveSubject();
  if (!subject) {
    return;
  }

  subject.meta = normalizeEntityMeta({
    orientacoes: dom.subjectMetaOrientacoes.value,
    alertas: dom.subjectMetaAlertas.value,
    notas: dom.subjectMetaNotas.value
  });
}

function persistSectionMetaFromUI() {
  const tab = getActiveTab();
  if (!tab) {
    return;
  }

  tab.meta = normalizeEntityMeta({
    orientacoes: dom.sectionMetaOrientacoes.value,
    alertas: dom.sectionMetaAlertas.value,
    notas: dom.sectionMetaNotas.value
  });
}

function loadActiveTabIntoEditor() {
  const editor = state.editor;
  const tab = getActiveTab();

  closeItemMetaModal(true);
  renderModeUI();
  renderMetadataFields();
  renderStructuredBuilder();

  if (!editor) {
    refreshPreviewAndValidation();
    toggleActionButtons();
    return;
  }

  state.ignoreEditorUpdate = true;

  if (!tab || getTabMode(tab) !== "free") {
    editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] }, false);
  } else {
    editor.commands.setContent({ type: "doc", content: blocksToDocNodes(tab.blocks) }, false);
  }

  state.ignoreEditorUpdate = false;
  renderCommandState();
  refreshPreviewAndValidation();
  toggleActionButtons();
}

function renderAll() {
  ensureActiveSelection();
  renderAreasList();
  renderSubjectsList();
  renderTabsList();
  renderTabPills();
  renderBreadcrumb();
  renderModeUI();
  renderMetadataFields();
  renderStructuredBuilder();
  toggleActionButtons();
  refreshPreviewAndValidation();
  renderCommandState();
}

function setTabMode(mode) {
  if (!TAB_MODES.includes(mode)) {
    return;
  }

  const tab = getActiveTab();
  if (!tab) {
    return;
  }

  ensureTabShape(tab);

  if (tab.mode === mode) {
    renderModeUI();
    toggleActionButtons();
    return;
  }

  if (tab.mode === "free") {
    persistCurrentTabFromEditor();
  }

  tab.mode = mode;

  if (mode === "free" && (!Array.isArray(tab.blocks) || !tab.blocks.length)) {
    tab.blocks = [createParagraphBlock("Edite o protocolo aqui.")];
  }

  if (mode === "structured") {
    tab.structured = normalizeStructuredModel(tab.structured);
  }

  loadActiveTabIntoEditor();
}

function convertCurrentTabToNotes() {
  const tab = getActiveTab();
  if (!tab) {
    return;
  }

  ensureTabShape(tab);
  persistCurrentTabFromEditor();

  const hasStructuredItems = Array.isArray(tab.structured?.groups)
    && tab.structured.groups.some((group) => Array.isArray(group.items) && group.items.some((item) => isNonEmptyString(item.nome)));

  if (hasStructuredItems) {
    const confirmed = window.confirm(
      "Esta seção tem itens estruturados. Deseja manter os dados, mas mudar para Bloco de Notas?"
    );
    if (!confirmed) {
      return;
    }
  }

  tab.mode = "free";
  if (!Array.isArray(tab.blocks) || !tab.blocks.length) {
    tab.blocks = [
      createParagraphBlock("Notas da seção:"),
      {
        type: "table",
        headers: ["Item", "Observação"],
        rows: [["", ""], ["", ""]]
      }
    ];
  }

  loadActiveTabIntoEditor();
  setStatus("Seção convertida para Bloco de Notas.");
}

function addStructuredGroup(type) {
  const tab = getActiveTab();
  if (!tab || getTabMode(tab) !== "structured") {
    return;
  }

  tab.structured = normalizeStructuredModel(tab.structured);
  tab.structured.groups.push(createStructuredGroup(type));
  renderStructuredBuilder();
  refreshPreviewAndValidation();
}

function removeStructuredGroup(groupId) {
  const tab = getActiveTab();
  if (!tab || getTabMode(tab) !== "structured") {
    return;
  }

  tab.structured = normalizeStructuredModel(tab.structured);

  if (tab.structured.groups.length <= 1) {
    window.alert("Mantenha pelo menos 1 bloco na secao estruturada.");
    return;
  }

  tab.structured.groups = tab.structured.groups.filter((group) => group.id !== groupId);
  renderStructuredBuilder();
  refreshPreviewAndValidation();
}

function addStructuredItem(groupId) {
  const group = getActiveGroupById(groupId);
  if (!group) {
    return;
  }

  group.items.push(createStructuredItem(""));
  renderStructuredBuilder();
  refreshPreviewAndValidation();
}

function removeStructuredItem(groupId, itemId) {
  const group = getActiveGroupById(groupId);
  if (!group) {
    return;
  }

  if (group.items.length <= 1) {
    window.alert("Cada bloco precisa ter pelo menos 1 item.");
    return;
  }

  group.items = group.items.filter((item) => item.id !== itemId);
  renderStructuredBuilder();
  refreshPreviewAndValidation();
}

function openItemMetaModal(groupId, itemId) {
  const item = getActiveItemById(groupId, itemId);
  if (!item) {
    return;
  }

  state.itemMetaContext = {
    groupId,
    itemId,
    tabSlug: state.activeTabSlug,
    subjectSlug: state.activeSubjectSlug,
    areaSlug: state.activeAreaSlug
  };

  const meta = normalizeItemMeta(item.meta);
  item.meta = meta;

  dom.itemMetaTitle.textContent = `Metadados do item: ${textOrDash(item.nome)}`;
  dom.itemMetaContra.value = meta.contraindicacoes;
  dom.itemMetaOrientacoes.value = meta.orientacoes;
  dom.itemMetaAlertas.value = meta.alertas;
  dom.itemMetaModal.hidden = false;
}

function closeItemMetaModal(silent = false) {
  dom.itemMetaModal.hidden = true;
  state.itemMetaContext = null;

  if (!silent) {
    renderStructuredBuilder();
    refreshPreviewAndValidation();
  }
}

function saveItemMetaFromModal() {
  const context = state.itemMetaContext;
  if (!context) {
    return;
  }

  if (
    context.areaSlug !== state.activeAreaSlug ||
    context.subjectSlug !== state.activeSubjectSlug ||
    context.tabSlug !== state.activeTabSlug
  ) {
    closeItemMetaModal(true);
    return;
  }

  const item = getActiveItemById(context.groupId, context.itemId);
  if (!item) {
    closeItemMetaModal(true);
    return;
  }

  item.meta = normalizeItemMeta({
    contraindicacoes: dom.itemMetaContra.value,
    orientacoes: dom.itemMetaOrientacoes.value,
    alertas: dom.itemMetaAlertas.value
  });

  closeItemMetaModal(true);
  renderStructuredBuilder();
  refreshPreviewAndValidation();
}

function handleStructuredInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return;
  }

  const tab = getActiveTab();
  if (!tab || getTabMode(tab) !== "structured") {
    return;
  }

  const groupField = target.dataset.groupField;
  if (groupField) {
    const group = getActiveGroupById(target.dataset.groupId);
    if (!group) {
      return;
    }
    if (groupField === "rotulo") {
      group.rotulo = target.value;
      autoSizeInputByContent(target, 3, 32);
      refreshPreviewAndValidation();
      return;
    }
    if (groupField === "titulo") {
      group.titulo = target.value;
      refreshPreviewAndValidation();
    }
    return;
  }

  const itemField = target.dataset.itemField;
  if (!itemField) {
    return;
  }

  const item = getActiveItemById(target.dataset.groupId, target.dataset.itemId);
  if (!item) {
    return;
  }

  if (itemField === "sus" && target instanceof HTMLInputElement) {
    item.sus = Boolean(target.checked);
    refreshPreviewAndValidation();
    return;
  }

  if (["nome", "apresentacao", "posologia"].includes(itemField)) {
    item[itemField] = target.value;
    refreshPreviewAndValidation();
  }
}

function handleStructuredClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const groupId = button.dataset.groupId;
  const itemId = button.dataset.itemId;

  if (action === "add-item") {
    addStructuredItem(groupId);
    return;
  }

  if (action === "remove-group") {
    removeStructuredGroup(groupId);
    return;
  }

  if (action === "remove-item") {
    removeStructuredItem(groupId, itemId);
    return;
  }

  if (action === "open-item-meta") {
    openItemMetaModal(groupId, itemId);
  }
}

function inlineFromDoc(contentNodes) {
  if (!Array.isArray(contentNodes)) {
    return [];
  }

  const spans = [];

  for (const node of contentNodes) {
    if (node.type === "text" && typeof node.text === "string") {
      const marks = Array.isArray(node.marks)
        ? node.marks.map((mark) => mark.type).filter((mark) => MARKS.includes(mark))
        : [];

      const span = marks.length ? { text: node.text, marks } : { text: node.text };
      const previous = spans[spans.length - 1];

      if (previous && JSON.stringify(previous.marks || []) === JSON.stringify(span.marks || [])) {
        previous.text += span.text;
      } else {
        spans.push(span);
      }
      continue;
    }

    if (node.type === "hardBreak") {
      spans.push({ text: "\n" });
    }
  }

  return spans;
}

function plainTextFromNode(node) {
  if (!node) {
    return "";
  }

  if (node.type === "text") {
    return node.text || "";
  }

  if (!Array.isArray(node.content)) {
    return "";
  }

  return node.content.map((child) => plainTextFromNode(child)).join("");
}

function listItemToInline(itemNode) {
  if (!itemNode || !Array.isArray(itemNode.content)) {
    return [];
  }

  const paragraph = itemNode.content.find((child) => child.type === "paragraph");
  if (paragraph) {
    return inlineFromDoc(paragraph.content || []);
  }

  const fallback = plainTextFromNode(itemNode).trim();
  return fallback ? [{ text: fallback }] : [];
}

function tableNodeToBlock(tableNode) {
  const rowNodes = Array.isArray(tableNode.content) ? tableNode.content : [];
  const rows = rowNodes.map((rowNode) => {
    const cells = Array.isArray(rowNode.content) ? rowNode.content : [];
    return cells.map((cell) => plainTextFromNode(cell).trim());
  });
  const bgRows = rowNodes.map((rowNode) => {
    const cells = Array.isArray(rowNode.content) ? rowNode.content : [];
    return cells.map((cell) => {
      const bg = cell?.attrs?.backgroundColor;
      return isNonEmptyString(bg) ? String(bg).trim() : null;
    });
  });

  if (!rows.length) {
    return {
      type: "table",
      headers: [],
      rows: [],
      headerBackgrounds: [],
      rowBackgrounds: []
    };
  }

  const [headers, ...bodyRows] = rows;
  const [headerBackgrounds, ...bodyBackgrounds] = bgRows;
  return {
    type: "table",
    headers,
    rows: bodyRows,
    headerBackgrounds: headerBackgrounds || [],
    rowBackgrounds: bodyBackgrounds || []
  };
}

function docNodesToBlocks(docNodes) {
  if (!Array.isArray(docNodes)) {
    return [];
  }

  const blocks = [];

  for (const node of docNodes) {
    if (!node || typeof node !== "object") {
      continue;
    }

    switch (node.type) {
      case "paragraph":
        blocks.push({
          type: "paragraph",
          content: inlineFromDoc(node.content || [])
        });
        break;

      case "heading":
        blocks.push({
          type: "heading",
          level: node.attrs?.level === 3 ? 3 : 2,
          content: inlineFromDoc(node.content || [])
        });
        break;

      case "bulletList":
      case "orderedList": {
        const listItems = Array.isArray(node.content)
          ? node.content
              .filter((child) => child.type === "listItem")
              .map((item) => ({ content: listItemToInline(item) }))
          : [];

        blocks.push({
          type: "list",
          style: node.type === "orderedList" ? "ordered" : "unordered",
          items: listItems
        });
        break;
      }

      case "horizontalRule":
        blocks.push({ type: "divider" });
        break;

      case "callout": {
        const tone = normalizeTone(node.attrs?.tone);
        const title = isNonEmptyString(node.attrs?.title) ? node.attrs.title : TONE_LABEL[tone];
        blocks.push({
          type: "callout",
          tone,
          title,
          blocks: docNodesToBlocks(node.content || [])
        });
        break;
      }

      case "table":
        blocks.push(tableNodeToBlock(node));
        break;

      default:
        break;
    }
  }

  return blocks;
}

function marksToDoc(marks) {
  return normalizeMarks(marks).map((mark) => ({ type: mark }));
}

function inlineToDocContent(content) {
  const spans = normalizeInlineContent(content);
  const nodes = [];

  for (const span of spans) {
    if (!span.text.length) {
      continue;
    }

    const textNode = {
      type: "text",
      text: span.text
    };

    const markNodes = marksToDoc(span.marks);
    if (markNodes.length) {
      textNode.marks = markNodes;
    }

    nodes.push(textNode);
  }

  return nodes;
}

function blockToDocNode(block) {
  if (!block || typeof block !== "object") {
    return null;
  }

  if (block.type === "paragraph") {
    return {
      type: "paragraph",
      content: inlineToDocContent(block.content)
    };
  }

  if (block.type === "heading") {
    return {
      type: "heading",
      attrs: { level: block.level === 3 ? 3 : 2 },
      content: inlineToDocContent(block.content)
    };
  }

  if (block.type === "list") {
    const ordered = block.style === "ordered";
    const items = Array.isArray(block.items)
      ? block.items.map((item) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: inlineToDocContent(item?.content) }]
        }))
      : [];

    return {
      type: ordered ? "orderedList" : "bulletList",
      content: items.length ? items : [{ type: "listItem", content: [{ type: "paragraph" }] }]
    };
  }

  if (block.type === "divider") {
    return { type: "horizontalRule" };
  }

  if (block.type === "callout") {
    const innerBlocks = Array.isArray(block.blocks)
      ? block.blocks.map((innerBlock) => blockToDocNode(innerBlock)).filter(Boolean)
      : [];

    return {
      type: "callout",
      attrs: {
        tone: normalizeTone(block.tone),
        title: isNonEmptyString(block.title) ? block.title.trim() : TONE_LABEL[normalizeTone(block.tone)]
      },
      content: innerBlocks.length ? innerBlocks : [{ type: "paragraph" }]
    };
  }

  if (block.type === "table") {
    const headers = Array.isArray(block.headers) ? block.headers : [];
    const rows = Array.isArray(block.rows) ? block.rows : [];
    const headerBackgrounds = Array.isArray(block.headerBackgrounds) ? block.headerBackgrounds : [];
    const rowBackgrounds = Array.isArray(block.rowBackgrounds) ? block.rowBackgrounds : [];

    const headerRow = {
      type: "tableRow",
      content: (headers.length ? headers : ["Coluna 1", "Coluna 2"]).map((headerText, headerIndex) => {
        const bgColor = isNonEmptyString(headerBackgrounds[headerIndex]) ? headerBackgrounds[headerIndex] : null;
        return {
          type: "tableHeader",
          attrs: bgColor ? { backgroundColor: bgColor } : {},
          content: [
            {
              type: "paragraph",
              content: headerText ? [{ type: "text", text: String(headerText) }] : []
            }
          ]
        };
      })
    };

    const bodyRows = rows.map((row, rowIndex) => {
      const bgRow = Array.isArray(rowBackgrounds[rowIndex]) ? rowBackgrounds[rowIndex] : [];
      return {
        type: "tableRow",
        content: row.map((cellText, cellIndex) => {
          const bgColor = isNonEmptyString(bgRow[cellIndex]) ? bgRow[cellIndex] : null;
          return {
            type: "tableCell",
            attrs: bgColor ? { backgroundColor: bgColor } : {},
            content: [
              {
                type: "paragraph",
                content: cellText ? [{ type: "text", text: String(cellText) }] : []
              }
            ]
          };
        })
      };
    });

    return {
      type: "table",
      content: [headerRow, ...bodyRows]
    };
  }

  return null;
}

function blocksToDocNodes(blocks) {
  const source = Array.isArray(blocks) ? blocks : [];
  const nodes = source.map((block) => blockToDocNode(block)).filter(Boolean);
  return nodes.length ? nodes : [{ type: "paragraph" }];
}

function persistCurrentTabFromEditor() {
  if (state.ignoreEditorUpdate || !state.editor) {
    return;
  }

  const tab = getActiveTab();
  if (!tab || getTabMode(tab) !== "free") {
    return;
  }

  const editorJson = state.editor.getJSON();
  tab.blocks = docNodesToBlocks(editorJson.content || []);
}

function validateInlineContent(content, path, errors) {
  if (!Array.isArray(content)) {
    errors.push(`${path} invalido.`);
    return;
  }

  content.forEach((span, index) => {
    if (!span || typeof span !== "object" || typeof span.text !== "string") {
      errors.push(`${path}[${index}] invalido.`);
      return;
    }

    if (Array.isArray(span.marks)) {
      const invalid = span.marks.filter((mark) => !MARKS.includes(mark));
      if (invalid.length) {
        errors.push(`${path}[${index}].marks invalido: ${invalid.join(", ")}.`);
      }
    }
  });
}

function validateEntityMeta(meta, path, errors) {
  if (!meta || typeof meta !== "object") {
    errors.push(`${path} invalido.`);
    return;
  }

  if (typeof meta.orientacoes !== "string") {
    errors.push(`${path}.orientacoes invalido.`);
  }
  if (typeof meta.alertas !== "string") {
    errors.push(`${path}.alertas invalido.`);
  }
  if (typeof meta.notas !== "string") {
    errors.push(`${path}.notas invalido.`);
  }
}

function validateItemMeta(meta, path, errors) {
  if (!meta || typeof meta !== "object") {
    errors.push(`${path} invalido.`);
    return;
  }

  if (typeof meta.contraindicacoes !== "string") {
    errors.push(`${path}.contraindicacoes invalido.`);
  }
  if (typeof meta.orientacoes !== "string") {
    errors.push(`${path}.orientacoes invalido.`);
  }
  if (typeof meta.alertas !== "string") {
    errors.push(`${path}.alertas invalido.`);
  }
}

function validateBlocks(blocks, path, errors) {
  if (!Array.isArray(blocks) || !blocks.length) {
    errors.push(`${path} blocks vazio.`);
    return;
  }

  blocks.forEach((block, blockIndex) => {
    const blockPath = `${path}[${blockIndex}]`;

    if (!block || typeof block !== "object") {
      errors.push(`${blockPath} bloco invalido.`);
      return;
    }

    if (!VALID_BLOCK_TYPES.includes(block.type)) {
      errors.push(`${blockPath}.type invalido.`);
      return;
    }

    if (block.type === "paragraph" || block.type === "heading") {
      validateInlineContent(block.content, `${blockPath}.content`, errors);
      if (block.type === "heading" && ![2, 3].includes(block.level)) {
        errors.push(`${blockPath}.level deve ser 2 ou 3.`);
      }
      return;
    }

    if (block.type === "list") {
      if (!["ordered", "unordered"].includes(block.style)) {
        errors.push(`${blockPath}.style invalido.`);
      }

      if (!Array.isArray(block.items) || !block.items.length) {
        errors.push(`${blockPath}.items vazio.`);
      } else {
        block.items.forEach((item, itemIndex) => {
          validateInlineContent(item.content, `${blockPath}.items[${itemIndex}].content`, errors);
        });
      }
      return;
    }

    if (block.type === "callout") {
      if (!CALLOUT_TONES.includes(block.tone)) {
        errors.push(`${blockPath}.tone invalido.`);
      }
      validateBlocks(block.blocks, `${blockPath}.blocks`, errors);
      return;
    }

    if (block.type === "table") {
      if (!Array.isArray(block.headers) || !block.headers.length) {
        errors.push(`${blockPath}.headers vazio.`);
      }
      if (!Array.isArray(block.rows)) {
        errors.push(`${blockPath}.rows invalido.`);
      }
      if (block.headerBackgrounds !== undefined && !Array.isArray(block.headerBackgrounds)) {
        errors.push(`${blockPath}.headerBackgrounds invalido.`);
      }
      if (block.rowBackgrounds !== undefined && !Array.isArray(block.rowBackgrounds)) {
        errors.push(`${blockPath}.rowBackgrounds invalido.`);
      }
    }
  });
}

function validateStructured(tab, tabPath, errors) {
  if (!tab.structured || typeof tab.structured !== "object") {
    errors.push(`${tabPath}.structured invalido.`);
    return;
  }

  const groups = tab.structured.groups;
  if (!Array.isArray(groups) || !groups.length) {
    errors.push(`${tabPath}.structured.groups vazio.`);
    return;
  }

  groups.forEach((group, groupIndex) => {
    const groupPath = `${tabPath}.structured.groups[${groupIndex}]`;
    if (!group || typeof group !== "object") {
      errors.push(`${groupPath} invalido.`);
      return;
    }

    if (!STRUCTURED_GROUP_TYPES.includes(group.type)) {
      errors.push(`${groupPath}.type invalido.`);
    }

    if (!isNonEmptyString(group.id)) {
      errors.push(`${groupPath}.id vazio.`);
    }

    if (!isNonEmptyString(group.titulo)) {
      errors.push(`${groupPath}.titulo vazio.`);
    }

    if (typeof group.rotulo !== "string") {
      errors.push(`${groupPath}.rotulo invalido.`);
    }

    if (!Array.isArray(group.items) || !group.items.length) {
      errors.push(`${groupPath}.items vazio.`);
      return;
    }

    group.items.forEach((item, itemIndex) => {
      const itemPath = `${groupPath}.items[${itemIndex}]`;
      if (!item || typeof item !== "object") {
        errors.push(`${itemPath} invalido.`);
        return;
      }

      if (!isNonEmptyString(item.id)) {
        errors.push(`${itemPath}.id vazio.`);
      }

      if (!isNonEmptyString(item.nome)) {
        errors.push(`${itemPath}.nome vazio.`);
      }

      if (typeof item.apresentacao !== "string") {
        errors.push(`${itemPath}.apresentacao invalido.`);
      }

      if (typeof item.posologia !== "string") {
        errors.push(`${itemPath}.posologia invalido.`);
      }

      if (typeof item.sus !== "boolean") {
        errors.push(`${itemPath}.sus invalido.`);
      }

      validateItemMeta(item.meta, `${itemPath}.meta`, errors);
    });
  });
}

function validateArea(area) {
  const errors = [];

  if (!area || typeof area !== "object") {
    errors.push("Area invalida.");
    return errors;
  }

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  if (!isNonEmptyString(area.area)) {
    errors.push("Campo area vazio.");
  }

  if (!isNonEmptyString(area.slug) || !slugRegex.test(area.slug)) {
    errors.push("Campo slug da area invalido.");
  }

  if (!Array.isArray(area.assuntos) || !area.assuntos.length) {
    errors.push("Lista de assuntos vazia.");
    return errors;
  }

  const usedSubjects = new Set();

  area.assuntos.forEach((subject, subjectIndex) => {
    const subjectPath = `assuntos[${subjectIndex}]`;

    if (!isNonEmptyString(subject.titulo)) {
      errors.push(`${subjectPath}.titulo vazio.`);
    }

    if (!isNonEmptyString(subject.slug) || !slugRegex.test(subject.slug)) {
      errors.push(`${subjectPath}.slug invalido.`);
    }

    if (usedSubjects.has(subject.slug)) {
      errors.push(`${subjectPath}.slug duplicado.`);
    }
    usedSubjects.add(subject.slug);

    validateEntityMeta(subject.meta, `${subjectPath}.meta`, errors);

    if (!Array.isArray(subject.tabs) || !subject.tabs.length) {
      errors.push(`${subjectPath}.tabs vazio.`);
      return;
    }

    const usedTabs = new Set();

    subject.tabs.forEach((tab, tabIndex) => {
      const tabPath = `${subjectPath}.tabs[${tabIndex}]`;

      if (!isNonEmptyString(tab.titulo)) {
        errors.push(`${tabPath}.titulo vazio.`);
      }

      if (!isNonEmptyString(tab.slug) || !slugRegex.test(tab.slug)) {
        errors.push(`${tabPath}.slug invalido.`);
      }

      if (usedTabs.has(tab.slug)) {
        errors.push(`${tabPath}.slug duplicado.`);
      }
      usedTabs.add(tab.slug);

      if (!TAB_MODES.includes(tab.mode)) {
        errors.push(`${tabPath}.mode invalido.`);
      }

      validateEntityMeta(tab.meta, `${tabPath}.meta`, errors);

      if (getTabMode(tab) === "structured") {
        validateStructured(tab, tabPath, errors);
      } else {
        validateBlocks(tab.blocks, `${tabPath}.blocks`, errors);
      }
    });
  });

  return errors;
}

function refreshPreviewAndValidation() {
  const area = getActiveArea();

  if (!area) {
    dom.jsonPreview.textContent = "{}";
    dom.validationList.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = "Nenhuma area carregada.";
    li.className = "error";
    dom.validationList.appendChild(li);
    return;
  }

  dom.jsonPreview.textContent = JSON.stringify(area, null, 2);

  const errors = validateArea(area);
  dom.validationList.innerHTML = "";

  if (!errors.length) {
    const li = document.createElement("li");
    li.textContent = "JSON valido para schema 1.1.0.";
    li.className = "ok";
    dom.validationList.appendChild(li);
  } else {
    errors.forEach((error) => {
      const li = document.createElement("li");
      li.textContent = error;
      li.className = "error";
      dom.validationList.appendChild(li);
    });
  }

  const subject = getActiveSubject();
  const tab = getActiveTab();
  const mode = getTabMode(tab) === "structured" ? "estruturado" : "texto livre";

  setStatus(
    `Area: ${area.area} | Assunto: ${subject?.titulo || "-"} | Secao: ${tab?.titulo || "-"} | Modo: ${mode} | Erros: ${errors.length}`
  );
}

function runEditorCommand(cmd) {
  const editor = state.editor;
  const tab = getActiveTab();

  if (!editor || getTabMode(tab) !== "free") {
    return;
  }

  if (cmd === "bold") editor.chain().focus().toggleBold().run();
  if (cmd === "italic") editor.chain().focus().toggleItalic().run();
  if (cmd === "underline") editor.chain().focus().toggleUnderline().run();
  if (cmd === "bulletList") editor.chain().focus().toggleBulletList().run();
  if (cmd === "orderedList") editor.chain().focus().toggleOrderedList().run();
  if (cmd === "divider") editor.chain().focus().setHorizontalRule().run();
  if (cmd === "undo") editor.chain().focus().undo().run();
  if (cmd === "redo") editor.chain().focus().redo().run();

  renderCommandState();
  refreshPreviewAndValidation();
}

function applyTextStyle(value) {
  const editor = state.editor;
  const tab = getActiveTab();

  if (!editor || getTabMode(tab) !== "free") {
    return;
  }

  if (value === "paragraph") {
    editor.chain().focus().setParagraph().run();
  }
  if (value === "h2") {
    editor.chain().focus().setHeading({ level: 2 }).run();
  }
  if (value === "h3") {
    editor.chain().focus().setHeading({ level: 3 }).run();
  }

  renderCommandState();
}

function insertCallout() {
  const editor = state.editor;
  const tab = getActiveTab();

  if (!editor || !tab || getTabMode(tab) !== "free") {
    return;
  }

  const tone = normalizeTone(dom.calloutToneSelect.value);
  const defaultTitle = TONE_LABEL[tone];
  const promptedTitle = window.prompt("Titulo do callout:", defaultTitle);
  if (promptedTitle === null) {
    return;
  }

  const title = promptedTitle.trim() || defaultTitle;

  editor
    .chain()
    .focus()
    .insertContent({
      type: "callout",
      attrs: {
        tone,
        title
      },
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Descreva orientacoes clinicas importantes." }]
        }
      ]
    })
    .run();

  renderCommandState();
}

function insertTable() {
  const editor = state.editor;
  const tab = getActiveTab();

  if (!editor || !tab || getTabMode(tab) !== "free") {
    return;
  }

  editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run();
  renderCommandState();
}

function applyTableCellColor(color) {
  const editor = state.editor;
  const tab = getActiveTab();

  if (!editor || !tab || getTabMode(tab) !== "free") {
    return;
  }

  const normalizedColor = typeof color === "string" && color.trim() ? color.trim() : null;
  const ok = editor.chain().focus().setCellAttribute("backgroundColor", normalizedColor).run();
  if (!ok) {
    window.alert("Selecione uma ou mais células da tabela para aplicar a cor.");
    return;
  }

  persistCurrentTabFromEditor();
  refreshPreviewAndValidation();
}

function createArea() {
  persistCurrentTabFromEditor();
  const areaName = window.prompt("Nome da nova area:");
  if (!isNonEmptyString(areaName)) {
    return;
  }

  const usedAreaSlugs = new Set(state.areas.map((area) => area.slug));
  const areaSlug = makeUniqueSlug(slugify(areaName), usedAreaSlugs);

  const area = normalizeArea({
    area: areaName.trim(),
    slug: areaSlug,
    assuntos: [createDefaultSubject("Geral")]
  });

  state.areas.push(area);
  setAreaFileName(area.slug, `${area.slug}.json`);
  state.areaFileHandles.delete(area.slug);
  state.areaFileHandleNames.delete(area.slug);
  state.lastSyncedSignatures.delete(area.slug);
  state.activeAreaSlug = area.slug;
  state.activeSubjectSlug = area.assuntos[0].slug;
  state.activeTabSlug = area.assuntos[0].tabs[0].slug;

  renderAll();
  loadActiveTabIntoEditor();
}

function createSubject() {
  const area = getActiveArea();
  if (!area) {
    return;
  }

  persistCurrentTabFromEditor();
  const subjectName = window.prompt("Nome do novo assunto:");
  if (!isNonEmptyString(subjectName)) {
    return;
  }

  const usedSubjectSlugs = new Set(area.assuntos.map((subject) => subject.slug));
  const subjectSlug = makeUniqueSlug(slugify(subjectName), usedSubjectSlugs);

  const subject = normalizeSubject({
    titulo: subjectName.trim(),
    slug: subjectSlug,
    descricaoCurta: "",
    meta: createEntityMeta(),
    tabs: [createDefaultTab("Resumo", "resumo")]
  });

  area.assuntos.push(subject);
  state.activeSubjectSlug = subject.slug;
  state.activeTabSlug = subject.tabs[0].slug;

  renderAll();
  loadActiveTabIntoEditor();
}

function renameSubject() {
  const area = getActiveArea();
  const subject = getActiveSubject();
  if (!area || !subject) {
    return;
  }

  persistCurrentTabFromEditor();

  const nextTitle = window.prompt("Novo título do assunto:", subject.titulo);
  if (!isNonEmptyString(nextTitle)) {
    return;
  }

  subject.titulo = nextTitle.trim();

  const used = new Set(area.assuntos.filter((item) => item !== subject).map((item) => item.slug));
  subject.slug = makeUniqueSlug(slugify(subject.titulo), used);
  state.activeSubjectSlug = subject.slug;

  renderAll();
}

function createTab() {
  const subject = getActiveSubject();
  if (!subject) {
    return;
  }

  persistCurrentTabFromEditor();

  const tabName = window.prompt("Nome da nova secao:", "Nova Secao");
  if (!isNonEmptyString(tabName)) {
    return;
  }

  const usedTabSlugs = new Set(subject.tabs.map((tab) => tab.slug));
  const tabSlug = makeUniqueSlug(slugify(tabName), usedTabSlugs);
  const tab = normalizeTab({
    titulo: tabName.trim(),
    slug: tabSlug,
    mode: "structured",
    meta: createEntityMeta(),
    blocks: [createParagraphBlock("Edite o protocolo aqui.")],
    structured: createStructuredModel()
  });

  subject.tabs.push(tab);
  state.activeTabSlug = tab.slug;

  renderAll();
  loadActiveTabIntoEditor();
}

function renameTab() {
  const subject = getActiveSubject();
  const tab = getActiveTab();
  if (!subject || !tab) {
    return;
  }

  const nextTitle = window.prompt("Novo titulo da secao:", tab.titulo);
  if (!isNonEmptyString(nextTitle)) {
    return;
  }

  tab.titulo = nextTitle.trim();

  const used = new Set(subject.tabs.filter((item) => item !== tab).map((item) => item.slug));
  tab.slug = makeUniqueSlug(slugify(tab.titulo), used);
  state.activeTabSlug = tab.slug;

  renderAll();
}

function moveTab(offset) {
  const subject = getActiveSubject();
  const tab = getActiveTab();
  if (!subject || !tab) {
    return;
  }

  const currentIndex = subject.tabs.findIndex((item) => item.slug === tab.slug);
  const nextIndex = currentIndex + offset;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= subject.tabs.length) {
    return;
  }

  const temp = subject.tabs[currentIndex];
  subject.tabs[currentIndex] = subject.tabs[nextIndex];
  subject.tabs[nextIndex] = temp;

  renderAll();
}

function deleteTab() {
  const subject = getActiveSubject();
  const tab = getActiveTab();
  if (!subject || !tab) {
    return;
  }

  if (subject.tabs.length <= 1) {
    window.alert("Cada assunto precisa ter pelo menos 1 secao.");
    return;
  }

  const confirmed = window.confirm(`Excluir a secao "${tab.titulo}"?`);
  if (!confirmed) {
    return;
  }

  const index = subject.tabs.findIndex((item) => item.slug === tab.slug);
  subject.tabs.splice(index, 1);

  const safeIndex = index > 0 ? index - 1 : 0;
  state.activeTabSlug = subject.tabs[safeIndex].slug;

  renderAll();
  loadActiveTabIntoEditor();
}

function downloadObject(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function syncJsonFiles() {
  persistCurrentTabFromEditor();
  closeItemMetaModal(true);

  if (!state.areas.length) {
    setStatus("Nenhuma área para sincronizar.");
    return;
  }

  const allErrors = state.areas.flatMap((area) => validateArea(area).map((error) => `[${area.slug}] ${error}`));
  if (allErrors.length) {
    const preview = allErrors.slice(0, 8).join("\n- ");
    const shouldContinue = window.confirm(
      `Foram encontrados ${allErrors.length} erro(s) de validação.\n\n- ${preview}\n\nDeseja sincronizar mesmo assim?`
    );
    if (!shouldContinue) {
      refreshPreviewAndValidation();
      return;
    }
  }

  const payloads = state.areas.map((area) => ({
    area,
    fileName: getAreaFileName(area),
    payload: serializeArea(area)
  }));

  try {
    const linkedHandle = await ensureLinkedDataDirHandle(false);
    if (!linkedHandle) {
      const shouldDownload = window.confirm(
        "A pasta de dados ainda não está vinculada.\nClique em 'Vincular pasta data (1x)' para sincronização direta.\n\nDeseja baixar os JSONs agora?"
      );
      if (shouldDownload) {
        payloads.forEach(({ fileName, payload }) => {
          downloadObject(fileName, payload);
        });
        setStatus("Sem pasta vinculada. JSONs baixados.");
      } else {
        setStatus("Sincronização cancelada (pasta não vinculada).");
      }
      return;
    }

    const targetDirHandle = await resolveJsonTargetDirectory(linkedHandle);

    let savedCount = 0;
    let skippedCount = 0;
    for (const item of payloads) {
      const expectedFileName = normalizeFileName(item.fileName, `${item.area.slug}.json`);
      const nextSignature = areaSyncSignature(item.area, expectedFileName);
      const lastSignature = state.lastSyncedSignatures.get(item.area.slug);

      if (lastSignature === nextSignature) {
        skippedCount += 1;
        continue;
      }

      let fileHandle = state.areaFileHandles.get(item.area.slug);
      const mappedFileName = state.areaFileHandleNames.get(item.area.slug);

      if (!fileHandle || mappedFileName !== expectedFileName) {
        fileHandle = await targetDirHandle.getFileHandle(expectedFileName, { create: true });
        state.areaFileHandles.set(item.area.slug, fileHandle);
        state.areaFileHandleNames.set(item.area.slug, expectedFileName);
      }

      await writeJsonToFileHandle(fileHandle, item.payload);
      setAreaFileName(item.area.slug, expectedFileName);
      state.lastSyncedSignatures.set(item.area.slug, nextSignature);
      savedCount += 1;
    }

    setStatus(
      `Sincronização concluída: ${savedCount} atualizado(s)/criado(s), ${skippedCount} sem alteração.`
    );
  } catch (error) {
    const message = String(error?.message || "");
    const blockedBySystemFolder = /system files|arquivos do sistema/i.test(message);

    if (error?.name === "AbortError") {
      setStatus("Sincronização cancelada.");
      return;
    }

    console.error(error);
    state.dataDirHandle = null;
    state.areaFileHandles.clear();
    state.areaFileHandleNames.clear();
    await clearStoredHandle(HANDLE_KEY_DATA_DIR).catch(() => {});
    if (blockedBySystemFolder) {
      window.alert(
        "O navegador bloqueou a pasta escolhida por segurança.\nUse 'Vincular pasta data (1x)' e selecione C:\\Users\\Arthur\\Desktop\\Prescrever\\data.\nAgora os JSONs serão baixados."
      );
    } else {
      window.alert("Falha ao sincronizar direto na pasta. Os JSONs serão baixados.");
    }
    payloads.forEach(({ fileName, payload }) => {
      downloadObject(fileName, payload);
    });
    setStatus("Falha na sincronização direta. JSONs baixados.");
  }
}

function downloadActiveArea() {
  persistCurrentTabFromEditor();
  const area = getActiveArea();
  if (!area) {
    return;
  }

  downloadObject(getAreaFileName(area), serializeArea(area));
}

function exportCurrentTab() {
  persistCurrentTabFromEditor();

  const area = getActiveArea();
  const subject = getActiveSubject();
  const tab = getActiveTab();

  if (!area || !subject || !tab) {
    return;
  }

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    area: area.slug,
    assunto: subject.slug,
    secao: tab
  };

  downloadObject(`${area.slug}-${subject.slug}-${tab.slug}.json`, payload);
}

async function copyPreview() {
  try {
    await navigator.clipboard.writeText(dom.jsonPreview.textContent);
    setStatus("Preview copiado para a area de transferencia.");
  } catch (_error) {
    window.alert("Nao foi possivel copiar automaticamente.");
  }
}

async function importAreaFile(file) {
  const text = await file.text();
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    window.alert("JSON invalido.");
    return;
  }

  if (!parsed || typeof parsed !== "object" || !parsed.area || !parsed.assuntos) {
    window.alert("Formato invalido. Esperado: objeto de area com { area, slug, assuntos }.");
    return;
  }

  const incomingArea = normalizeArea(parsed);
  const existingIndex = state.areas.findIndex((area) => area.slug === incomingArea.slug);

  if (existingIndex >= 0) {
    const shouldReplace = window.confirm(
      `Ja existe uma area com slug "${incomingArea.slug}". Deseja substituir?`
    );

    if (shouldReplace) {
      state.areas[existingIndex] = incomingArea;
    } else {
      const used = new Set(state.areas.map((area) => area.slug));
      incomingArea.slug = makeUniqueSlug(incomingArea.slug, used);
      state.areas.push(incomingArea);
    }
  } else {
    state.areas.push(incomingArea);
  }

  setAreaFileName(incomingArea.slug, file?.name || `${incomingArea.slug}.json`);
  state.areaFileHandles.delete(incomingArea.slug);
  state.areaFileHandleNames.delete(incomingArea.slug);
  state.lastSyncedSignatures.delete(incomingArea.slug);

  state.activeAreaSlug = incomingArea.slug;
  state.activeSubjectSlug = incomingArea.assuntos[0]?.slug || "";
  state.activeTabSlug = incomingArea.assuntos[0]?.tabs[0]?.slug || "";

  renderAll();
  loadActiveTabIntoEditor();
  setStatus(`Area importada: ${incomingArea.area}`);
}

function plainTextToDocNodes(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const nodes = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        const content = lines[index].replace(/^\s*[-*]\s+/, "").trim();
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: content ? [{ type: "text", text: content }] : []
            }
          ]
        });
        index += 1;
      }
      nodes.push({ type: "bulletList", content: items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        const content = lines[index].replace(/^\s*\d+[.)]\s+/, "").trim();
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: content ? [{ type: "text", text: content }] : []
            }
          ]
        });
        index += 1;
      }
      nodes.push({ type: "orderedList", content: items });
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+[.)]\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    nodes.push({
      type: "paragraph",
      content: [{ type: "text", text: paragraphLines.join(" ") }]
    });
  }

  return nodes.length ? nodes : [{ type: "paragraph" }];
}

function initEditor() {
  applyEditorFontSize(state.editorFontSize);
  state.editor = new Editor({
    element: dom.editorElement,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3]
        }
      }),
      Underline,
      Table.configure({
        resizable: false,
        lastColumnResizable: false
      }),
      TableRow,
      TableHeader,
      TableCell,
      CalloutNode,
      SanitizedPaste
    ],
    editorProps: {
      attributes: {
        class: "prescrever-editor"
      }
    },
    content: {
      type: "doc",
      content: [{ type: "paragraph" }]
    },
    onUpdate: () => {
      if (state.ignoreEditorUpdate) {
        return;
      }
      persistCurrentTabFromEditor();
      refreshPreviewAndValidation();
      renderCommandState();
    },
    onSelectionUpdate: () => {
      renderCommandState();
    }
  });
}

async function loadAreasFromDataFolder() {
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

      const requestPath = `../data/${dirKey}`;
      const html = await fetchText(requestPath);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const baseDataUrl = new URL("../data/", window.location.href);
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

  async function loadAreasFromIndexFile() {
    const response = await fetch("../data/index.json", { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const indexPayload = await response.json();
    const entries = Array.isArray(indexPayload)
      ? indexPayload
      : Array.isArray(indexPayload?.areas)
        ? indexPayload.areas
        : [];

    if (!entries.length) {
      return [];
    }

    const dataFiles = entries
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        if (entry && typeof entry === "object" && typeof entry.file === "string") {
          return entry.file;
        }
        return null;
      })
      .filter(Boolean);

    const payloads = await Promise.all(
      dataFiles.map(async (file) => {
        const normalizedFile = file.replace(/^\/+/, "");
        const fileResponse = await fetch(`../data/${normalizedFile}`, { cache: "no-store" });
        if (!fileResponse.ok) {
          throw new Error(`Falha ao carregar ${normalizedFile} (${fileResponse.status})`);
        }
        return {
          fileName: normalizeFileName(normalizedFile, "area.json"),
          payload: await fileResponse.json()
        };
      })
    );

    return payloads;
  }

  try {
    const discoveredFiles = await discoverJsonFilesRecursively("");
    if (discoveredFiles.length) {
      const payloads = await Promise.all(
        discoveredFiles.map(async (filePath) => {
          const normalizedFile = filePath.replace(/^\/+/, "");
          const fileResponse = await fetch(`../data/${normalizedFile}`, { cache: "no-store" });
          if (!fileResponse.ok) {
            throw new Error(`Falha ao carregar ${normalizedFile} (${fileResponse.status})`);
          }
          return {
            fileName: normalizeFileName(normalizedFile, "area.json"),
            payload: await fileResponse.json()
          };
        })
      );
      return payloads;
    }
  } catch (error) {
    console.warn("Falha ao descobrir JSONs automaticamente em /data.", error);
  }

  try {
    const fromIndex = await loadAreasFromIndexFile();
    if (fromIndex.length) {
      return fromIndex;
    }
  } catch (error) {
    console.warn("Falha ao carregar index.json de /data.", error);
  }

  console.warn("Falha ao carregar /data, iniciando com estrutura padrao.");
  return [];
}

function fallbackArea() {
  return normalizeArea({
    area: "Nova Area",
    slug: "nova-area",
    assuntos: [
      {
        titulo: "Geral",
        slug: "geral",
        descricaoCurta: "",
        meta: {
          orientacoes: "",
          alertas: "",
          notas: ""
        },
        tabs: [
          {
            titulo: "Resumo",
            slug: "resumo",
            mode: "structured",
            meta: {
              orientacoes: "",
              alertas: "",
              notas: ""
            },
            structured: {
              groups: [
                {
                  type: "or",
                  titulo: "Escolha uma das opcoes abaixo:",
                  items: [
                    {
                      nome: "",
                      apresentacao: "",
                      posologia: "",
                      meta: {
                        contraindicacoes: "",
                        orientacoes: "",
                        alertas: ""
                      }
                    }
                  ]
                },
                {
                  type: "add",
                  titulo: "Associar / adicionar",
                  items: [
                    {
                      nome: "",
                      apresentacao: "",
                      posologia: "",
                      meta: {
                        contraindicacoes: "",
                        orientacoes: "",
                        alertas: ""
                      }
                    }
                  ]
                }
              ]
            },
            blocks: [
              {
                type: "paragraph",
                content: [{ text: "Comece editando este protocolo." }]
              }
            ]
          }
        ]
      }
    ]
  });
}

function bindEvents() {
  dom.btnNewArea.addEventListener("click", createArea);
  dom.btnNewSubject.addEventListener("click", createSubject);
  if (dom.btnRenameSubject) {
    dom.btnRenameSubject.addEventListener("click", renameSubject);
  }
  dom.btnNewTab.addEventListener("click", createTab);
  if (dom.btnConvertToNotes) {
    dom.btnConvertToNotes.addEventListener("click", convertCurrentTabToNotes);
  }
  dom.btnRenameTab.addEventListener("click", renameTab);
  dom.btnTabLeft.addEventListener("click", () => moveTab(-1));
  dom.btnTabRight.addEventListener("click", () => moveTab(1));
  dom.btnDeleteTab.addEventListener("click", deleteTab);

  dom.btnModeStructured.addEventListener("click", () => setTabMode("structured"));
  dom.btnModeFree.addEventListener("click", () => setTabMode("free"));

  dom.subjectMetaOrientacoes.addEventListener("input", () => {
    persistSubjectMetaFromUI();
    refreshPreviewAndValidation();
  });
  dom.subjectMetaAlertas.addEventListener("input", () => {
    persistSubjectMetaFromUI();
    refreshPreviewAndValidation();
  });
  dom.subjectMetaNotas.addEventListener("input", () => {
    persistSubjectMetaFromUI();
    refreshPreviewAndValidation();
  });

  dom.sectionMetaOrientacoes.addEventListener("input", () => {
    persistSectionMetaFromUI();
    refreshPreviewAndValidation();
  });
  dom.sectionMetaAlertas.addEventListener("input", () => {
    persistSectionMetaFromUI();
    refreshPreviewAndValidation();
  });
  dom.sectionMetaNotas.addEventListener("input", () => {
    persistSectionMetaFromUI();
    refreshPreviewAndValidation();
  });

  dom.btnAddOrBlock.addEventListener("click", () => addStructuredGroup("or"));
  dom.btnAddAddBlock.addEventListener("click", () => addStructuredGroup("add"));

  dom.structuredBlocks.addEventListener("input", handleStructuredInput);
  dom.structuredBlocks.addEventListener("click", handleStructuredClick);

  dom.btnItemMetaClose.addEventListener("click", () => closeItemMetaModal());
  dom.btnItemMetaSave.addEventListener("click", saveItemMetaFromModal);
  dom.itemMetaModal.addEventListener("click", (event) => {
    if (event.target === dom.itemMetaModal) {
      closeItemMetaModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dom.itemMetaModal.hidden) {
      closeItemMetaModal();
    }
  });

  dom.btnImportArea.addEventListener("click", () => {
    dom.fileImportArea.value = "";
    dom.fileImportArea.click();
  });

  dom.fileImportArea.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await importAreaFile(file);
    dom.fileImportArea.value = "";
  });

  document.querySelectorAll("[data-cmd]").forEach((button) => {
    button.addEventListener("click", () => {
      const cmd = button.getAttribute("data-cmd");
      if (cmd) {
        runEditorCommand(cmd);
      }
    });
  });

  dom.textStyleSelect.addEventListener("change", (event) => {
    applyTextStyle(event.target.value);
  });

  dom.btnInsertCallout.addEventListener("click", insertCallout);
  dom.btnInsertTable.addEventListener("click", insertTable);
  if (dom.btnApplyCellColor && dom.tableCellColor) {
    dom.btnApplyCellColor.addEventListener("click", () => applyTableCellColor(dom.tableCellColor.value));
  }
  if (dom.btnClearCellColor) {
    dom.btnClearCellColor.addEventListener("click", () => applyTableCellColor(null));
  }
  if (dom.btnFontDown) {
    dom.btnFontDown.addEventListener("click", () => adjustEditorFontSize(-0.06));
  }
  if (dom.btnFontUp) {
    dom.btnFontUp.addEventListener("click", () => adjustEditorFontSize(0.06));
  }

  dom.btnSyncJson.addEventListener("click", syncJsonFiles);
  if (dom.btnLinkDataFolder) {
    dom.btnLinkDataFolder.addEventListener("click", linkDataFolder);
  }
  dom.btnDownloadArea.addEventListener("click", downloadActiveArea);
  dom.btnExportTab.addEventListener("click", exportCurrentTab);
  dom.btnCopyPreview.addEventListener("click", copyPreview);
}

async function bootstrap() {
  initEditor();
  bindEvents();

  const loadedAreas = await loadAreasFromDataFolder();
  if (loadedAreas.length) {
    const normalizedEntries = loadedAreas.map((entry) => ({
      fileName: entry.fileName,
      area: normalizeArea(entry.payload)
    }));
    state.areas = normalizeAreas(normalizedEntries.map((entry) => entry.area));

    const fileNameBySlug = new Map(
      normalizedEntries.map((entry) => [entry.area.slug, normalizeFileName(entry.fileName, `${entry.area.slug}.json`)])
    );

    state.areas.forEach((area) => {
      const fileName = fileNameBySlug.get(area.slug);
      if (fileName) {
        setAreaFileName(area.slug, fileName);
      }
    });
  } else {
    const area = fallbackArea();
    state.areas = [area];
    setAreaFileName(area.slug, `${area.slug}.json`);
  }

  captureCurrentSyncSignatures();

  ensureActiveSelection();
  renderAll();
  loadActiveTabIntoEditor();
}

bootstrap();
