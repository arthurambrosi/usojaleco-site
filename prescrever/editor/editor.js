import { Editor, Extension, Node, Mark, mergeAttributes } from "https://esm.sh/@tiptap/core@2.6.6";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@2.6.6";
import Underline from "https://esm.sh/@tiptap/extension-underline@2.6.6";
import Table from "https://esm.sh/@tiptap/extension-table@2.6.6";
import TableRow from "https://esm.sh/@tiptap/extension-table-row@2.6.6";
import TableHeaderBase from "https://esm.sh/@tiptap/extension-table-header@2.6.6";
import TableCellBase from "https://esm.sh/@tiptap/extension-table-cell@2.6.6";
import { Plugin, PluginKey } from "https://esm.sh/prosemirror-state@1.4.3";

const SCHEMA_VERSION = "1.2.0";
const MARKS = ["bold", "italic", "underline"];
const VALID_BLOCK_TYPES = ["heading", "paragraph", "list", "callout", "divider", "table"];
const CALLOUT_TONES = ["info", "warning", "danger", "success"];
const TAB_MODES = ["free", "structured"];
const STRUCTURED_GROUP_TYPES = ["or", "add"];
const SUBJECT_STATUS_BUILDING = "building";
const SUBJECT_STATUS_DONE = "done";
const SUBJECT_STATUSES = [SUBJECT_STATUS_BUILDING, SUBJECT_STATUS_DONE];
const DEFAULT_EDITOR_FONT_SIZE = 0.93;
const MIN_EDITOR_FONT_SIZE = 0.72;
const MAX_EDITOR_FONT_SIZE = 1.35;
const HANDLE_DB_NAME = "prescrever-fs-access";
const HANDLE_DB_VERSION = 1;
const HANDLE_STORE = "handles";
const HANDLE_KEY_DATA_DIR = "data-dir";
const GITHUB_CONFIG_STORAGE_KEY = "prescrever:github-sync-config:v1";
const GITHUB_SYNC_DATA_PATH = "prescrever/data";
const SYNC_BROADCAST_STORAGE_KEY = "prescrever:last-sync-at";
const INDEX_FILE_NAME = "index.json";
const INDEX_SIGNATURE_KEY = "__index__";
const SYNC_BUTTON_FEEDBACK_MS = 3000;
const TAG_MODAL_EDITABLE_KEYS = new Set([
  "Backspace",
  "Delete",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Escape",
  "Tab"
]);
const TAG_IMAGE_MIN_WIDTH = 90;
const TAG_IMAGE_MAX_WIDTH = 2200;

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
  subjectMetaReviewed: document.getElementById("subjectMetaReviewed"),
  subjectReferencesList: document.getElementById("subjectReferencesList"),
  btnAddSubjectReferenceLink: document.getElementById("btnAddSubjectReferenceLink"),
  btnAddSubjectReferencePdf: document.getElementById("btnAddSubjectReferencePdf"),
  subjectReferencePdfInput: document.getElementById("subjectReferencePdfInput"),

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
  tagMetaModal: document.getElementById("tagMetaModal"),
  tagMetaTitle: document.getElementById("tagMetaTitle"),
  tagMetaLabel: document.getElementById("tagMetaLabel"),
  tagMetaContent: document.getElementById("tagMetaContent"),
  btnTagMetaSave: document.getElementById("btnTagMetaSave"),
  btnTagMetaDelete: document.getElementById("btnTagMetaDelete"),
  btnTagMetaClose: document.getElementById("btnTagMetaClose"),

  textStyleSelect: document.getElementById("textStyleSelect"),
  calloutToneSelect: document.getElementById("calloutToneSelect"),
  btnInsertCallout: document.getElementById("btnInsertCallout"),
  btnInsertTable: document.getElementById("btnInsertTable"),
  btnCreateTag: document.getElementById("btnCreateTag"),
  tableCellColor: document.getElementById("tableCellColor"),
  btnApplyCellColor: document.getElementById("btnApplyCellColor"),
  btnClearCellColor: document.getElementById("btnClearCellColor"),
  btnFontDown: document.getElementById("btnFontDown"),
  btnFontUp: document.getElementById("btnFontUp"),

  btnNewArea: document.getElementById("btnNewArea"),
  btnRenameArea: document.getElementById("btnRenameArea"),
  btnDeleteArea: document.getElementById("btnDeleteArea"),
  btnImportArea: document.getElementById("btnImportArea"),
  fileImportArea: document.getElementById("fileImportArea"),
  btnNewSubject: document.getElementById("btnNewSubject"),
  btnRenameSubject: document.getElementById("btnRenameSubject"),
  btnDeleteSubject: document.getElementById("btnDeleteSubject"),
  btnToggleSubjectStatus: document.getElementById("btnToggleSubjectStatus"),
  btnNewTab: document.getElementById("btnNewTab"),
  btnGroupTabs: document.getElementById("btnGroupTabs"),
  btnNewChildTab: document.getElementById("btnNewChildTab"),
  btnConvertToNotes: document.getElementById("btnConvertToNotes"),
  btnRenameTab: document.getElementById("btnRenameTab"),
  btnTabLeft: document.getElementById("btnTabLeft"),
  btnTabRight: document.getElementById("btnTabRight"),
  btnDeleteTab: document.getElementById("btnDeleteTab"),

  btnDownloadArea: document.getElementById("btnDownloadArea"),
  btnExportTab: document.getElementById("btnExportTab"),
  btnCopyPreview: document.getElementById("btnCopyPreview"),
  btnSyncJson: document.getElementById("btnSyncJson"),
  btnSyncGithub: document.getElementById("btnSyncGithub"),
  btnLinkDataFolder: document.getElementById("btnLinkDataFolder"),
  ghOwner: document.getElementById("ghOwner"),
  ghRepo: document.getElementById("ghRepo"),
  ghBranch: document.getElementById("ghBranch"),
  ghDataPath: document.getElementById("ghDataPath"),
  ghToken: document.getElementById("ghToken"),
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
  tagMetaContext: null,
  areaFileNames: new Map(),
  areaFileHandles: new Map(),
  areaFileHandleNames: new Map(),
  dataDirHandle: null,
  editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
  lastSyncedSignatures: new Map(),
  collapsedStructuredGroups: new Set(),
  syncFeedbackTimer: null,
  pendingReferenceUploadId: ""
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

const TagRefMark = Mark.create({
  name: "tagRef",
  inclusive: false,
  addAttributes() {
    return {
      tagId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-tag-ref") || null
      }
    };
  },
  parseHTML() {
    return [{ tag: "span[data-tag-ref]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const tagId = isNonEmptyString(HTMLAttributes.tagId) ? HTMLAttributes.tagId.trim() : "";
    const attrs = mergeAttributes(HTMLAttributes, {
      class: "inline-tag-ref"
    });
    if (tagId) {
      attrs["data-tag-ref"] = tagId;
    } else {
      delete attrs["data-tag-ref"];
    }
    return [
      "span",
      attrs,
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
    notas: "",
    revisadoEspecialista: false
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

function getReferenceAssetHref(assetPath) {
  const safePath = normalizeReferenceAssetPath(assetPath);
  return safePath ? `../data/${safePath}` : "";
}

function getReferenceAssetFileName(assetPath) {
  const safePath = normalizeReferenceAssetPath(assetPath);
  if (!safePath) {
    return "";
  }
  const parts = safePath.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

function deriveReferenceTitleFromFileName(fileName) {
  const raw = asString(fileName).trim().replace(/\.pdf$/i, "");
  return raw.replace(/[-_]+/g, " ").trim();
}

function createSubjectReference(type = "link", overrides = {}) {
  return normalizeSubjectReference(
    {
      id: overrides.id || uid("ref"),
      tipo: type,
      titulo: overrides.titulo ?? "",
      url: overrides.url ?? "",
      arquivo: overrides.arquivo ?? "",
      nomeArquivo: overrides.nomeArquivo ?? "",
      uploadBase64: overrides.uploadBase64 ?? "",
      uploadMimeType: overrides.uploadMimeType ?? "",
      uploadFileName: overrides.uploadFileName ?? ""
    },
    0
  );
}

function normalizeSubjectReference(rawReference, index = 0) {
  const type = rawReference?.tipo === "pdf" ? "pdf" : "link";
  const assetPath = normalizeReferenceAssetPath(rawReference?.arquivo ?? rawReference?.assetPath);
  return {
    id: isNonEmptyString(rawReference?.id) ? rawReference.id : uid(`ref${index + 1}`),
    tipo: type,
    titulo: asString(rawReference?.titulo).trim(),
    url: type === "link" ? asString(rawReference?.url).trim() : "",
    arquivo: type === "pdf" ? assetPath : "",
    nomeArquivo:
      type === "pdf"
        ? asString(rawReference?.nomeArquivo ?? rawReference?.fileName).trim() || getReferenceAssetFileName(assetPath)
        : "",
    uploadBase64: type === "pdf" ? asString(rawReference?.uploadBase64).trim() : "",
    uploadMimeType: type === "pdf" ? asString(rawReference?.uploadMimeType).trim() : "",
    uploadFileName:
      type === "pdf"
        ? asString(rawReference?.uploadFileName ?? rawReference?.nomeArquivo ?? rawReference?.fileName).trim()
        : ""
  };
}

function normalizeSubjectReferences(rawReferences) {
  if (!Array.isArray(rawReferences)) {
    return [];
  }
  return rawReferences.map((reference, index) => normalizeSubjectReference(reference, index));
}

function isMeaningfulSubjectReference(reference) {
  const normalized = normalizeSubjectReference(reference, 0);
  if (normalized.tipo === "pdf") {
    return Boolean(
      normalized.titulo ||
      normalized.arquivo ||
      normalized.uploadBase64 ||
      normalized.uploadFileName ||
      normalized.nomeArquivo
    );
  }
  return Boolean(normalized.titulo || normalized.url);
}

function serializeSubjectReference(reference) {
  const normalized = normalizeSubjectReference(reference, 0);
  if (normalized.tipo === "pdf") {
    const payload = {
      id: normalized.id,
      tipo: "pdf",
      titulo: normalized.titulo || deriveReferenceTitleFromFileName(normalized.uploadFileName || normalized.nomeArquivo),
      arquivo: normalized.arquivo
    };
    if (normalized.nomeArquivo || normalized.uploadFileName) {
      payload.nomeArquivo = normalized.nomeArquivo || normalized.uploadFileName;
    }
    return payload;
  }

  return {
    id: normalized.id,
    tipo: "link",
    titulo: normalized.titulo,
    url: normalized.url
  };
}

function buildReferenceAssetPath(area, subject, referenceId, fileName) {
  const areaSlug = slugify(area?.slug || area?.area || "area") || "area";
  const subjectSlug = slugify(subject?.slug || subject?.titulo || "assunto") || "assunto";
  const baseName = slugify(deriveReferenceTitleFromFileName(fileName) || "referencia") || "referencia";
  const safeId = String(referenceId || uid("ref")).replace(/[^a-z0-9]+/gi, "").toLowerCase().slice(-10) || "arquivo";
  return `referencias/${areaSlug}/${subjectSlug}/${baseName}-${safeId}.pdf`;
}

function normalizeEntityMeta(rawMeta) {
  return {
    orientacoes: asString(rawMeta?.orientacoes).trim(),
    alertas: asString(rawMeta?.alertas).trim(),
    notas: asString(rawMeta?.notas).trim(),
    revisadoEspecialista: normalizeBooleanFlag(rawMeta?.revisadoEspecialista ?? rawMeta?.revisadoPorEspecialista)
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

function normalizeSubjectStatus(rawStatus) {
  const normalized = asString(rawStatus).trim().toLowerCase();
  if (["done", "finalizado", "terminado", "concluido", "concluído"].includes(normalized)) {
    return SUBJECT_STATUS_DONE;
  }
  if (SUBJECT_STATUSES.includes(normalized)) {
    return normalized;
  }
  return SUBJECT_STATUS_BUILDING;
}

function getSubjectStatusLabel(status) {
  return status === SUBJECT_STATUS_DONE ? "Terminado" : "Em construção";
}

function createStructuredItem(initialName = "Novo medicamento") {
  const safeName =
    arguments.length === 0 ? "Novo medicamento" : isNonEmptyString(initialName) ? initialName.trim() : "";
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

function createStructuredSection(initialTitle = "") {
  const safeTitle = isNonEmptyString(initialTitle) ? initialTitle.trim() : "";
  return {
    id: uid("section"),
    titulo: safeTitle,
    items: [createStructuredItem("")]
  };
}

function normalizeStructuredSection(rawSection, sectionIndex = 0) {
  const items = Array.isArray(rawSection?.items)
    ? rawSection.items.map((item, itemIndex) => normalizeStructuredItem(item, itemIndex))
    : [];
  return {
    id: isNonEmptyString(rawSection?.id) ? rawSection.id : uid(`section${sectionIndex + 1}`),
    titulo: isNonEmptyString(rawSection?.titulo)
      ? rawSection.titulo.trim()
      : isNonEmptyString(rawSection?.title)
        ? rawSection.title.trim()
        : "",
    items: items.length ? items : [createStructuredItem("")]
  };
}

function flattenLegacySubgroupsToSections(rawGroups, out = []) {
  if (!Array.isArray(rawGroups)) {
    return out;
  }
  rawGroups.forEach((rawGroup, index) => {
    if (!rawGroup || typeof rawGroup !== "object") {
      return;
    }

    const items = Array.isArray(rawGroup.items) ? rawGroup.items : [];
    const children = Array.isArray(rawGroup.subgroups)
      ? rawGroup.subgroups
      : Array.isArray(rawGroup.groups)
        ? rawGroup.groups
        : [];
    if (items.length || !children.length) {
      out.push({
        id: isNonEmptyString(rawGroup.id) ? rawGroup.id : uid(`legacySection${index + 1}`),
        titulo: isNonEmptyString(rawGroup.titulo)
          ? rawGroup.titulo.trim()
          : isNonEmptyString(rawGroup.label)
            ? rawGroup.label.trim()
            : "",
        items
      });
    }
    if (children.length) {
      flattenLegacySubgroupsToSections(children, out);
    }
  });
  return out;
}

function createStructuredGroup(type = "or") {
  const validType = STRUCTURED_GROUP_TYPES.includes(type) ? type : "or";
  return {
    id: uid("group"),
    type: validType,
    rotulo: validType === "or" ? "OU" : "ASSOCIAR",
    titulo: validType === "or" ? "Escolha uma das opções abaixo:" : "Associar / adicionar",
    sections: [createStructuredSection("")]
  };
}

function normalizeStructuredGroup(rawGroup, groupIndex = 0) {
  const type = STRUCTURED_GROUP_TYPES.includes(rawGroup?.type) ? rawGroup.type : "or";
  const rawSections = Array.isArray(rawGroup?.sections) ? rawGroup.sections : [];
  let sections = rawSections.map((section, sectionIndex) => normalizeStructuredSection(section, sectionIndex));

  if (!sections.length) {
    const legacySections = [];
    if (Array.isArray(rawGroup?.items) && rawGroup.items.length) {
      legacySections.push({
        titulo: "",
        items: rawGroup.items
      });
    }

    const rawSubgroups = Array.isArray(rawGroup?.subgroups)
      ? rawGroup.subgroups
      : Array.isArray(rawGroup?.groups)
        ? rawGroup.groups
        : [];
    flattenLegacySubgroupsToSections(rawSubgroups, legacySections);
    sections = legacySections.map((section, sectionIndex) => normalizeStructuredSection(section, sectionIndex));
  }

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
        ? "Escolha uma das opções abaixo:"
        : "Associar / adicionar",
    sections: sections.length ? sections : [createStructuredSection("")]
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

function getGroupSections(group) {
  if (!group || !Array.isArray(group.sections)) {
    return [];
  }
  return group.sections;
}

function findGroupContext(groups, groupId, parentGroup = null, depth = 0) {
  if (!Array.isArray(groups) || !isNonEmptyString(groupId)) {
    return null;
  }

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (!group || typeof group !== "object") {
      continue;
    }
    if (group.id === groupId) {
      return { group, groups, index, parentGroup: null, depth: 0 };
    }
  }

  return null;
}

function hasStructuredItemsInGroups(groups) {
  if (!Array.isArray(groups)) {
    return false;
  }
  return groups.some((group) => {
    if (!group || typeof group !== "object") {
      return false;
    }
    const sections = getGroupSections(group);
    return sections.some(
      (section) =>
        section &&
        Array.isArray(section.items) &&
        section.items.some((item) => isNonEmptyString(item?.nome))
    );
  });
}

function normalizeMarks(rawMarks) {
  if (!Array.isArray(rawMarks)) return [];
  return [...new Set(rawMarks.filter((mark) => MARKS.includes(mark)))];
}

function normalizeTagId(rawTagId) {
  return isNonEmptyString(rawTagId) ? String(rawTagId).trim() : "";
}

function normalizeTagContent(rawContent) {
  if (!Array.isArray(rawContent)) {
    if (isNonEmptyString(rawContent)) {
      return [{ type: "paragraph", text: String(rawContent).trim() }];
    }
    return [];
  }

  const nodes = [];
  for (const node of rawContent) {
    if (!node || typeof node !== "object") {
      continue;
    }

    const type = node.type === "image" ? "image" : "paragraph";
    if (type === "image") {
      const src = asString(node.src).trim();
      const widthValue = Number(node.width);
      const width =
        Number.isFinite(widthValue) && widthValue > 0
          ? Math.min(TAG_IMAGE_MAX_WIDTH, Math.max(TAG_IMAGE_MIN_WIDTH, Math.round(widthValue)))
          : null;
      if (/^data:image\//i.test(src)) {
        nodes.push({
          type: "image",
          src,
          alt: asString(node.alt).trim(),
          ...(width ? { width } : {})
        });
      }
      continue;
    }

    const text = asString(node.text).trim();
    if (text) {
      nodes.push({
        type: "paragraph",
        text
      });
    }
  }

  return nodes;
}

function createTagDef(initialLabel = "Nova tag") {
  const label = isNonEmptyString(initialLabel) ? initialLabel.trim() : "Nova tag";
  return {
    id: uid("tag"),
    label,
    content: []
  };
}

function normalizeTagDef(rawTag, tagIndex = 0) {
  return {
    id: normalizeTagId(rawTag?.id) || uid(`tag${tagIndex + 1}`),
    label: isNonEmptyString(rawTag?.label) ? rawTag.label.trim() : `Tag ${tagIndex + 1}`,
    content: normalizeTagContent(rawTag?.content)
  };
}

function normalizeTagDefs(rawTagDefs) {
  if (!Array.isArray(rawTagDefs)) {
    return [];
  }
  const used = new Set();
  const out = [];
  rawTagDefs.forEach((rawTag, index) => {
    const normalized = normalizeTagDef(rawTag, index);
    if (used.has(normalized.id)) {
      normalized.id = makeUniqueSlug(normalized.id, used);
    }
    used.add(normalized.id);
    out.push(normalized);
  });
  return out;
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
    const tagId = normalizeTagId(span.tagId);
    const next = marks.length ? { text, marks } : { text };
    if (tagId) {
      next.tagId = tagId;
    }
    spans.push(next);
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
    tagDefs: [],
    structured: createStructuredModel(),
    children: []
  };
}

function getTabChildren(tab) {
  return Array.isArray(tab?.children) ? tab.children : [];
}

function ensureUniqueTabSlugs(tabs, used = new Set()) {
  if (!Array.isArray(tabs)) {
    return;
  }

  tabs.forEach((tab) => {
    tab.slug = makeUniqueSlug(tab.slug || tab.titulo, used);
    used.add(tab.slug);
    ensureUniqueTabSlugs(getTabChildren(tab), used);
  });
}

function countTabsInTree(tabs) {
  if (!Array.isArray(tabs)) {
    return 0;
  }

  return tabs.reduce((total, tab) => total + 1 + countTabsInTree(getTabChildren(tab)), 0);
}

function flattenTabs(tabs, out = [], depth = 0, lineage = []) {
  if (!Array.isArray(tabs)) {
    return out;
  }

  tabs.forEach((tab, index) => {
    const numberingSegments = [...lineage.map((entry) => entry.index + 1), index + 1];
    const lineageTabs = lineage.map((entry) => entry.tab);
    out.push({
      tab,
      depth,
      index,
      siblings: tabs,
      parent: lineageTabs.length ? lineageTabs[lineageTabs.length - 1] : null,
      lineage: lineageTabs,
      numberingSegments,
      numbering: numberingSegments.join(".")
    });
    flattenTabs(getTabChildren(tab), out, depth + 1, [...lineage, { tab, index }]);
  });

  return out;
}

function findTabContextInTree(tabs, slug, depth = 0, lineage = []) {
  if (!Array.isArray(tabs) || !isNonEmptyString(slug)) {
    return null;
  }

  for (let index = 0; index < tabs.length; index += 1) {
    const tab = tabs[index];
    const numberingSegments = [...lineage.map((entry) => entry.index + 1), index + 1];
    const lineageTabs = lineage.map((entry) => entry.tab);
    const context = {
      tab,
      depth,
      index,
      siblings: tabs,
      parent: lineageTabs.length ? lineageTabs[lineageTabs.length - 1] : null,
      lineage: lineageTabs,
      numberingSegments,
      numbering: numberingSegments.join(".")
    };

    if (tab.slug === slug) {
      return context;
    }

    const childContext = findTabContextInTree(getTabChildren(tab), slug, depth + 1, [...lineage, { tab, index }]);
    if (childContext) {
      return childContext;
    }
  }

  return null;
}

function getFirstTabInTree(tabs) {
  const flattened = flattenTabs(tabs);
  return flattened[0]?.tab || null;
}

function createDefaultSubject(title = "Geral") {
  return {
    titulo: title,
    slug: slugify(title) || "geral",
    status: SUBJECT_STATUS_BUILDING,
    descricaoCurta: "",
    meta: createEntityMeta(),
    referencias: [],
    tabs: [createDefaultTab("Conduta inicial", "conduta-inicial")]
  };
}

function normalizeTab(rawTab, tabIndex = 0) {
  const title = isNonEmptyString(rawTab?.titulo) ? rawTab.titulo.trim() : `Secao ${tabIndex + 1}`;
  const mode = inferTabMode(rawTab);
  const rawChildren = Array.isArray(rawTab?.children)
    ? rawTab.children
    : Array.isArray(rawTab?.subsections)
      ? rawTab.subsections
      : Array.isArray(rawTab?.tabs)
        ? rawTab.tabs
        : [];

  return {
    titulo: title,
    slug: slugify(rawTab?.slug || title || `secao-${tabIndex + 1}`),
    mode,
    meta: normalizeEntityMeta(rawTab?.meta || rawTab?.metadados),
    blocks: normalizeBlocks(rawTab?.blocks),
    tagDefs: normalizeTagDefs(rawTab?.tagDefs),
    structured: normalizeStructuredModel(rawTab?.structured || rawTab?.prescricaoEstruturada),
    children: rawChildren.map((child, childIndex) => normalizeTab(child, childIndex))
  };
}

function normalizeSubject(rawSubject, subjectIndex = 0) {
  const title = isNonEmptyString(rawSubject?.titulo)
    ? rawSubject.titulo.trim()
    : `Assunto ${subjectIndex + 1}`;

  const rawTabs = Array.isArray(rawSubject?.tabs) ? rawSubject.tabs : [];
  const tabs = rawTabs.map((tab, tabIndex) => normalizeTab(tab, tabIndex));
  const normalizedTabs = tabs.length ? tabs : [createDefaultTab("Resumo", "resumo")];
  ensureUniqueTabSlugs(normalizedTabs, new Set());

  return {
    titulo: title,
    slug: slugify(rawSubject?.slug || title || `assunto-${subjectIndex + 1}`),
    status: normalizeSubjectStatus(rawSubject?.status ?? rawSubject?.situacao ?? rawSubject?.estado),
    descricaoCurta: isNonEmptyString(rawSubject?.descricaoCurta)
      ? rawSubject.descricaoCurta.trim()
      : "",
    meta: normalizeEntityMeta(rawSubject?.meta || rawSubject?.metadados),
    referencias: normalizeSubjectReferences(rawSubject?.referencias ?? rawSubject?.references),
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
  return getActiveTabContext()?.tab || null;
}

function getActiveTabContext() {
  const subject = getActiveSubject();
  if (!subject) {
    return null;
  }
  return findTabContextInTree(subject.tabs, state.activeTabSlug);
}

function getTabMode(tab) {
  return tab?.mode === "structured" ? "structured" : "free";
}

function getTagDefsForTab(tab = getActiveTab()) {
  if (!tab) {
    return [];
  }
  tab.tagDefs = normalizeTagDefs(tab.tagDefs);
  return tab.tagDefs;
}

function getActiveTagDefById(tagId) {
  const safeId = normalizeTagId(tagId);
  if (!safeId) {
    return null;
  }
  return getTagDefsForTab().find((tag) => tag.id === safeId) || null;
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
  tab.tagDefs = normalizeTagDefs(tab.tagDefs);
  tab.structured = normalizeStructuredModel(tab.structured);
  tab.children = getTabChildren(tab).map((child, index) => normalizeTab(child, index));
}

function ensureSubjectShape(subject) {
  if (!subject || typeof subject !== "object") {
    return;
  }

  subject.meta = normalizeEntityMeta(subject.meta);
  subject.referencias = normalizeSubjectReferences(subject.referencias);
  subject.tabs = Array.isArray(subject.tabs)
    ? subject.tabs.map((tab, index) => normalizeTab(tab, index))
    : [createDefaultTab("Resumo", "resumo")];
  ensureUniqueTabSlugs(subject.tabs, new Set());
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

  if (subject) {
    ensureSubjectShape(subject);
  }

  const tab =
    getActiveTabContext()?.tab ||
    getFirstTabInTree(subject?.tabs) ||
    null;

  state.activeTabSlug = tab ? tab.slug : "";

  if (tab) {
    ensureTabShape(tab);
  }
}

function setStatus(message) {
  dom.statusBar.textContent = message;
}

function clearSyncButtonFeedback() {
  if (!dom.btnSyncJson) {
    return;
  }
  dom.btnSyncJson.classList.remove("btn-sync-ok", "btn-sync-error");
  if (state.syncFeedbackTimer) {
    window.clearTimeout(state.syncFeedbackTimer);
    state.syncFeedbackTimer = null;
  }
}

function pulseSyncButton(kind) {
  if (!dom.btnSyncJson) {
    return;
  }
  clearSyncButtonFeedback();
  dom.btnSyncJson.classList.add(kind === "ok" ? "btn-sync-ok" : "btn-sync-error");
  state.syncFeedbackTimer = window.setTimeout(() => {
    dom.btnSyncJson.classList.remove("btn-sync-ok", "btn-sync-error");
    state.syncFeedbackTimer = null;
  }, SYNC_BUTTON_FEEDBACK_MS);
}

function broadcastLocalSync() {
  try {
    localStorage.setItem(SYNC_BROADCAST_STORAGE_KEY, String(Date.now()));
  } catch (_error) {
    // Ignora falha de storage em modo privado/restrito.
  }
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

function serializeSubject(subject) {
  ensureSubjectShape(subject);
  return {
    ...subject,
    referencias: normalizeSubjectReferences(subject.referencias)
      .filter((reference) => isMeaningfulSubjectReference(reference))
      .map((reference) => serializeSubjectReference(reference))
  };
}

function serializeArea(area) {
  return {
    schemaVersion: SCHEMA_VERSION,
    area: area.area,
    slug: area.slug,
    assuntos: Array.isArray(area.assuntos) ? area.assuntos.map((subject) => serializeSubject(subject)) : []
  };
}

function normalizeRepoSubPath(value, fallback = GITHUB_SYNC_DATA_PATH) {
  const normalized = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  return normalized || fallback;
}

function collectAreaSyncPayloads() {
  return state.areas.map((area) => {
    const fileName = normalizeFileName(getAreaFileName(area), `${area.slug}.json`);
    return {
      area,
      fileName,
      payload: serializeArea(area)
    };
  });
}

function buildDataIndexPayload() {
  const areas = state.areas.map((area) => {
    const fileName = normalizeFileName(getAreaFileName(area), `${area.slug}.json`);
    return {
      slug: area.slug,
      file: fileName,
      area: area.area
    };
  });

  return {
    schemaVersion: "1.0.0",
    areas
  };
}

function collectReferenceAssetUploads(config) {
  const uploads = [];

  state.areas.forEach((area) => {
    area.assuntos.forEach((subject) => {
      ensureSubjectShape(subject);
      subject.referencias.forEach((reference) => {
        if (reference.tipo !== "pdf" || !isNonEmptyString(reference.arquivo) || !isNonEmptyString(reference.uploadBase64)) {
          return;
        }

        uploads.push({
          area,
          subject,
          reference,
          remoteFilePath: `${config.dataPath}/${normalizeReferenceAssetPath(reference.arquivo)}`
        });
      });
    });
  });

  return uploads;
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

function indexSyncSignature(indexPayload) {
  return `${INDEX_FILE_NAME}\n${JSON.stringify(indexPayload)}`;
}

function captureCurrentSyncSignatures() {
  const next = new Map();
  const areaPayloads = collectAreaSyncPayloads();
  areaPayloads.forEach(({ area, fileName }) => {
    next.set(area.slug, areaSyncSignature(area, fileName));
  });
  next.set(INDEX_SIGNATURE_KEY, indexSyncSignature(buildDataIndexPayload()));
  state.lastSyncedSignatures = next;
}

function loadStoredGithubConfig() {
  try {
    const raw = localStorage.getItem(GITHUB_CONFIG_STORAGE_KEY);
    if (!raw) {
      return {
        owner: "",
        repo: "",
        branch: "main",
        dataPath: GITHUB_SYNC_DATA_PATH
      };
    }
    const parsed = JSON.parse(raw);
    return {
      owner: asString(parsed?.owner).trim(),
      repo: asString(parsed?.repo).trim(),
      branch: isNonEmptyString(parsed?.branch) ? asString(parsed.branch).trim() : "main",
      dataPath: GITHUB_SYNC_DATA_PATH
    };
  } catch (_error) {
    return {
      owner: "",
      repo: "",
      branch: "main",
      dataPath: GITHUB_SYNC_DATA_PATH
    };
  }
}

function saveGithubConfig(config) {
  try {
    localStorage.setItem(
      GITHUB_CONFIG_STORAGE_KEY,
      JSON.stringify({
        owner: asString(config?.owner).trim(),
        repo: asString(config?.repo).trim(),
        branch: isNonEmptyString(config?.branch) ? asString(config.branch).trim() : "main",
        dataPath: GITHUB_SYNC_DATA_PATH
      })
    );
  } catch (_error) {}
}

function applyGithubConfigToInputs(config) {
  if (!dom.ghOwner || !dom.ghRepo || !dom.ghBranch || !dom.ghDataPath) {
    return;
  }
  dom.ghOwner.value = asString(config?.owner).trim();
  dom.ghRepo.value = asString(config?.repo).trim();
  dom.ghBranch.value = isNonEmptyString(config?.branch) ? asString(config.branch).trim() : "main";
  dom.ghDataPath.value = GITHUB_SYNC_DATA_PATH;
  dom.ghDataPath.readOnly = true;
}

function getGithubConfigFromInputs() {
  return {
    owner: asString(dom.ghOwner?.value).trim(),
    repo: asString(dom.ghRepo?.value).trim(),
    branch: isNonEmptyString(dom.ghBranch?.value) ? asString(dom.ghBranch.value).trim() : "main",
    dataPath: GITHUB_SYNC_DATA_PATH,
    token: asString(dom.ghToken?.value).trim()
  };
}

function persistGithubConfigInputs() {
  const config = getGithubConfigFromInputs();
  saveGithubConfig(config);
}

function toBase64Utf8(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function buildGithubContentUrl(config, filePath) {
  const safePath = String(filePath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(
    config.repo
  )}/contents/${safePath}`;
}

function buildGithubHeaders(config, withJsonBody = false) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${config.token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (withJsonBody) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function fetchGithubFileSha(config, filePath) {
  const url = `${buildGithubContentUrl(config, filePath)}?ref=${encodeURIComponent(config.branch)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: buildGithubHeaders(config, false)
  });

  if (response.status === 404) {
    return null;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {}

  if (!response.ok) {
    const msg = payload?.message ? ` - ${payload.message}` : "";
    throw new Error(`Falha ao consultar ${filePath} no GitHub (${response.status})${msg}`);
  }

  return isNonEmptyString(payload?.sha) ? payload.sha : null;
}

async function upsertGithubJsonFile(config, remoteFilePath, payload) {
  const sha = await fetchGithubFileSha(config, remoteFilePath);
  const url = buildGithubContentUrl(config, remoteFilePath);
  const body = {
    message: `chore(data): sincronizar ${remoteFilePath} via editor`,
    content: toBase64Utf8(`${JSON.stringify(payload, null, 2)}\n`),
    branch: config.branch
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: buildGithubHeaders(config, true),
    body: JSON.stringify(body)
  });

  let result = null;
  try {
    result = await response.json();
  } catch (_error) {}

  if (!response.ok) {
    const msg = result?.message ? ` - ${result.message}` : "";
    throw new Error(`Falha ao gravar ${remoteFilePath} no GitHub (${response.status})${msg}`);
  }

  return { created: response.status === 201, updated: response.status === 200 };
}

async function upsertGithubBase64File(config, remoteFilePath, contentBase64, message) {
  const sha = await fetchGithubFileSha(config, remoteFilePath);
  const url = buildGithubContentUrl(config, remoteFilePath);
  const body = {
    message: message || `chore(data): sincronizar ${remoteFilePath} via editor`,
    content: contentBase64,
    branch: config.branch
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: buildGithubHeaders(config, true),
    body: JSON.stringify(body)
  });

  let result = null;
  try {
    result = await response.json();
  } catch (_error) {}

  if (!response.ok) {
    const msg = result?.message ? ` - ${result.message}` : "";
    throw new Error(`Falha ao gravar ${remoteFilePath} no GitHub (${response.status})${msg}`);
  }

  return { created: response.status === 201, updated: response.status === 200 };
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

async function ensureLinkedDataDirHandle(allowPicker = false, forcePicker = false) {
  if (!forcePicker) {
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
  }

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
    setStatus("Selecione C:\\Users\\Arthur\\Documents\\prescrever\\data.");
    const handle = await ensureLinkedDataDirHandle(true, true);
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

function makeEntityListItem(label, subtitle, isActive, onClick, extraClass = "") {
  const li = document.createElement("li");
  li.className = `entity-item${extraClass ? ` ${extraClass}` : ""}${isActive ? " active" : ""}`;

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

function getTabDisplayTitle(tabContext) {
  if (!tabContext?.tab) {
    return "Secao";
  }

  return `${tabContext.numbering} ${tabContext.tab.titulo}`.trim();
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
    const subjectStatus = normalizeSubjectStatus(subject.status);
    subject.status = subjectStatus;
    const subtitle = isNonEmptyString(subject.descricaoCurta)
      ? subject.descricaoCurta
      : `${countTabsInTree(subject.tabs)} seção(ões) · ${getSubjectStatusLabel(subjectStatus)}`;

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
      },
      subjectStatus === SUBJECT_STATUS_DONE ? "subject-done" : "subject-building"
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

  const flatTabs = flattenTabs(subject.tabs);

  for (const tabContext of flatTabs) {
    const { tab } = tabContext;
    const modeLabel = getTabMode(tab) === "structured" ? "estruturado" : "texto livre";
    const childCount = getTabChildren(tab).length;
    const item = makeEntityListItem(
      getTabDisplayTitle(tabContext),
      `${tab.slug} · ${modeLabel}${childCount ? ` · ${childCount} subseção(ões)` : ""}`,
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
    item.classList.add("tab-tree-item");
    item.style.setProperty("--tree-depth", String(tabContext.depth));

    dom.tabsList.appendChild(item);
  }
}

function renderTabPills() {
  const subject = getActiveSubject();
  dom.tabPills.innerHTML = "";

  if (!subject) {
    return;
  }

  for (const tabContext of flattenTabs(subject.tabs)) {
    const { tab } = tabContext;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-pill${tab.slug === state.activeTabSlug ? " active" : ""}`;
    button.textContent = getTabDisplayTitle(tabContext);
    button.style.setProperty("--tree-depth", String(tabContext.depth));
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
  const tabContext = getActiveTabContext();
  const tabTrail = tabContext ? [...tabContext.lineage.map((entry) => entry.titulo), tabContext.tab.titulo] : [];
  dom.breadcrumb.textContent = [area?.area, subject?.titulo, ...tabTrail].filter(Boolean).join(" > ") || "Sem selecao";
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
  if (dom.btnCreateTag) dom.btnCreateTag.disabled = !enabled;
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
  const activeTabContext = getActiveTabContext();
  const mode = getTabMode(getActiveTab());
  const canGroupTabs =
    Boolean(activeTabContext) &&
    Array.isArray(activeTabContext?.siblings) &&
    activeTabContext.siblings.length - activeTabContext.index >= 2;

  if (dom.btnRenameArea) dom.btnRenameArea.disabled = !hasArea;
  if (dom.btnDeleteArea) dom.btnDeleteArea.disabled = !hasArea;
  dom.btnNewSubject.disabled = !hasArea;
  if (dom.btnRenameSubject) dom.btnRenameSubject.disabled = !hasSubject;
  if (dom.btnDeleteSubject) dom.btnDeleteSubject.disabled = !hasSubject;
  if (dom.btnToggleSubjectStatus) dom.btnToggleSubjectStatus.disabled = !hasSubject;
  dom.btnNewTab.disabled = !hasSubject;
  if (dom.btnGroupTabs) dom.btnGroupTabs.disabled = !canGroupTabs;
  if (dom.btnNewChildTab) dom.btnNewChildTab.disabled = !hasTab;
  if (dom.btnConvertToNotes) dom.btnConvertToNotes.disabled = !hasTab;
  dom.btnRenameTab.disabled = !hasTab;
  dom.btnTabLeft.disabled = !hasTab || !activeTabContext || !activeTabContext.parent;
  dom.btnTabRight.disabled = !hasTab || !activeTabContext || activeTabContext.index <= 0;
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
  if (dom.btnAddSubjectReferenceLink) {
    dom.btnAddSubjectReferenceLink.disabled = disableSubjectMeta;
  }
  if (dom.btnAddSubjectReferencePdf) {
    dom.btnAddSubjectReferencePdf.disabled = disableSubjectMeta;
  }
  if (dom.subjectReferencePdfInput) {
    dom.subjectReferencePdfInput.disabled = disableSubjectMeta;
  }
  if (dom.subjectMetaReviewed) {
    dom.subjectMetaReviewed.disabled = disableSubjectMeta;
  }

  dom.sectionMetaOrientacoes.disabled = disableSectionMeta;
  dom.sectionMetaAlertas.disabled = disableSectionMeta;
  dom.sectionMetaNotas.disabled = disableSectionMeta;

  if (dom.btnToggleSubjectStatus) {
    const activeSubject = getActiveSubject();
    const nextLabel =
      normalizeSubjectStatus(activeSubject?.status) === SUBJECT_STATUS_DONE
        ? "Marcar em construção"
        : "Marcar terminado";
    dom.btnToggleSubjectStatus.textContent = nextLabel;
  }
}

function setInputValue(inputEl, value) {
  if (!inputEl) {
    return;
  }
  inputEl.value = value || "";
}

function autoSizeInputByContent(inputEl, min = 4, max = null) {
  if (!(inputEl instanceof HTMLInputElement)) {
    return;
  }
  const textLength = String(inputEl.value || "").trim().length;
  const target = Math.max(min, textLength + 1);
  if (Number.isFinite(max)) {
    inputEl.size = Math.max(min, Math.min(Number(max), target));
    return;
  }
  inputEl.size = target;
}

function renderMetadataFields() {
  const subject = getActiveSubject();
  const tab = getActiveTab();

  const subjectMeta = normalizeEntityMeta(subject?.meta);
  const sectionMeta = normalizeEntityMeta(tab?.meta);

  setInputValue(dom.subjectMetaOrientacoes, subjectMeta.orientacoes);
  setInputValue(dom.subjectMetaAlertas, subjectMeta.alertas);
  setInputValue(dom.subjectMetaNotas, subjectMeta.notas);
  if (dom.subjectMetaReviewed) {
    dom.subjectMetaReviewed.checked = Boolean(subjectMeta.revisadoEspecialista);
  }
  renderSubjectReferences();

  setInputValue(dom.sectionMetaOrientacoes, sectionMeta.orientacoes);
  setInputValue(dom.sectionMetaAlertas, sectionMeta.alertas);
  setInputValue(dom.sectionMetaNotas, sectionMeta.notas);
}

function updateSubjectReferenceField(referenceId, field, value) {
  const subject = getActiveSubject();
  if (!subject) {
    return;
  }

  subject.referencias = normalizeSubjectReferences(subject.referencias);
  const reference = subject.referencias.find((entry) => entry.id === referenceId);
  if (!reference) {
    return;
  }

  reference[field] = value;
  subject.referencias = normalizeSubjectReferences(subject.referencias);
  refreshPreviewAndValidation();
}

function removeSubjectReference(referenceId) {
  const subject = getActiveSubject();
  if (!subject) {
    return;
  }

  subject.referencias = normalizeSubjectReferences(subject.referencias).filter((reference) => reference.id !== referenceId);
  renderSubjectReferences();
  refreshPreviewAndValidation();
}

function renderSubjectReferences() {
  if (!dom.subjectReferencesList) {
    return;
  }

  const subject = getActiveSubject();
  dom.subjectReferencesList.innerHTML = "";

  if (!subject) {
    return;
  }

  subject.referencias = normalizeSubjectReferences(subject.referencias);

  if (!subject.referencias.length) {
    dom.subjectReferencesList.appendChild(createEl("div", "subject-references-empty", "Nenhuma referência cadastrada."));
    return;
  }

  subject.referencias.forEach((reference) => {
    const card = createEl("article", "subject-reference-card");

    const head = createEl("div", "subject-reference-head");
    head.appendChild(
      createEl("span", `subject-reference-kind${reference.tipo === "pdf" ? " is-pdf" : ""}`, reference.tipo === "pdf" ? "PDF" : "LINK")
    );

    const removeBtn = createEl("button", "btn btn-small btn-danger", "Remover");
    removeBtn.type = "button";
    removeBtn.addEventListener("click", () => {
      removeSubjectReference(reference.id);
    });
    head.appendChild(removeBtn);
    card.appendChild(head);

    const titleLabel = createEl("label", "", "Nome exibido da referência");
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = reference.titulo || "";
    titleInput.placeholder = "Ex.: Diretriz da FEBRASGO 2025";
    titleInput.addEventListener("input", () => {
      updateSubjectReferenceField(reference.id, "titulo", titleInput.value);
    });
    card.appendChild(titleLabel);
    card.appendChild(titleInput);

    if (reference.tipo === "link") {
      const urlLabel = createEl("label", "", "Link do site");
      const urlInput = document.createElement("input");
      urlInput.type = "url";
      urlInput.value = reference.url || "";
      urlInput.placeholder = "https://...";
      urlInput.addEventListener("input", () => {
        updateSubjectReferenceField(reference.id, "url", urlInput.value);
      });
      card.appendChild(urlLabel);
      card.appendChild(urlInput);
    } else {
      const fileMeta = createEl("div", "subject-reference-filemeta");
      const fileText = reference.uploadFileName || reference.nomeArquivo || getReferenceAssetFileName(reference.arquivo);
      fileMeta.appendChild(
        createEl(
          "span",
          "subject-reference-filetext",
          fileText ? `Arquivo: ${fileText}` : "Nenhum PDF selecionado."
        )
      );

      const fileActions = createEl("div", "subject-reference-fileactions");

      const replaceBtn = createEl("button", "btn btn-small btn-ghost", fileText ? "Trocar PDF" : "Selecionar PDF");
      replaceBtn.type = "button";
      replaceBtn.addEventListener("click", () => {
        state.pendingReferenceUploadId = reference.id;
        if (dom.subjectReferencePdfInput) {
          dom.subjectReferencePdfInput.value = "";
          dom.subjectReferencePdfInput.click();
        }
      });
      fileActions.appendChild(replaceBtn);

      const openHref = getReferenceAssetHref(reference.arquivo);
      if (openHref) {
        const openLink = document.createElement("a");
        openLink.className = "btn btn-small";
        openLink.href = openHref;
        openLink.target = "_blank";
        openLink.rel = "noopener noreferrer";
        openLink.textContent = "Abrir PDF";
        fileActions.appendChild(openLink);
      }

      fileMeta.appendChild(fileActions);
      card.appendChild(fileMeta);
    }

    dom.subjectReferencesList.appendChild(card);
  });
}

function textOrDash(value) {
  return isNonEmptyString(value) ? value : "-";
}

function getActiveGroupById(groupId) {
  const tab = getActiveTab();
  if (!tab || !tab.structured || !Array.isArray(tab.structured.groups)) {
    return null;
  }
  const context = findGroupContext(tab.structured.groups, groupId);
  return context?.group || null;
}

function getActiveGroupContextById(groupId) {
  const tab = getActiveTab();
  if (!tab || !tab.structured || !Array.isArray(tab.structured.groups)) {
    return null;
  }
  return findGroupContext(tab.structured.groups, groupId);
}

function getActiveSectionById(groupId, sectionId) {
  const group = getActiveGroupById(groupId);
  if (!group || !Array.isArray(group.sections)) {
    return null;
  }
  return group.sections.find((section) => section.id === sectionId) || null;
}

function getActiveItemById(groupId, sectionId, itemId) {
  const section = getActiveSectionById(groupId, sectionId);
  if (!section || !Array.isArray(section.items)) {
    return null;
  }
  return section.items.find((item) => item.id === itemId) || null;
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

function getStructuredGroupCollapseKey(groupId) {
  const safeId = isNonEmptyString(groupId) ? groupId : "";
  return `${state.activeAreaSlug}::${state.activeSubjectSlug}::${state.activeTabSlug}::${safeId}`;
}

function isStructuredGroupCollapsed(groupId) {
  const key = getStructuredGroupCollapseKey(groupId);
  if (key.endsWith("::")) {
    return true;
  }
  return !state.collapsedStructuredGroups.has(key);
}

function setStructuredGroupCollapsed(groupId, collapsed) {
  const key = getStructuredGroupCollapseKey(groupId);
  if (!key.endsWith("::")) {
    if (collapsed) {
      state.collapsedStructuredGroups.delete(key);
    } else {
      state.collapsedStructuredGroups.add(key);
    }
  }
}

function toggleStructuredGroupCollapsed(groupId) {
  const next = !isStructuredGroupCollapsed(groupId);
  setStructuredGroupCollapsed(groupId, next);
}

function makeStructuredInput(labelText, field, value, groupId, sectionId, itemId, isTextArea = false) {
  const wrapper = createEl("div", `structured-field${field === "posologia" ? " full" : ""}`);
  const label = createEl("label", "", labelText);
  wrapper.appendChild(label);

  const control = isTextArea ? document.createElement("textarea") : document.createElement("input");
  control.value = value || "";
  control.dataset.itemField = field;
  control.dataset.groupId = groupId;
  control.dataset.sectionId = sectionId;
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

function renderStructuredGroupNode(group, depth = 0) {
  const wrapper = createEl("section", `structured-block ${group.type === "add" ? "is-add" : "is-or"}`);
  wrapper.dataset.groupId = group.id;
  wrapper.dataset.depth = String(depth);
  const collapsed = isStructuredGroupCollapsed(group.id);
  if (depth > 0) {
    wrapper.classList.add("is-nested");
  }
  if (collapsed) {
    wrapper.classList.add("is-collapsed");
  }

  const header = createEl("div", "structured-block-header");
  const left = createEl("div", "structured-block-left");

  const kindInput = document.createElement("input");
  kindInput.className = `structured-kind-input${group.type === "add" ? " is-add" : ""}`;
  kindInput.type = "text";
  kindInput.value = isNonEmptyString(group.rotulo) ? group.rotulo : group.type === "add" ? "ASSOCIAR" : "OU";
  kindInput.dataset.groupField = "rotulo";
  kindInput.dataset.groupId = group.id;
  kindInput.title = "Rótulo do bloco (ex.: OU, ASSOCIAR, INDUÇÃO...)";
  autoSizeInputByContent(kindInput, 3);
  left.appendChild(kindInput);

  const titleInput = document.createElement("input");
  titleInput.className = "structured-group-title";
  titleInput.type = "text";
  titleInput.value = group.titulo || "";
  titleInput.dataset.groupField = "titulo";
  titleInput.dataset.groupId = group.id;
  left.appendChild(titleInput);

  const actions = createEl("div", "structured-block-actions");

  const toggleBtn = createEl(
    "button",
    "btn btn-small btn-ghost btn-collapse-group",
    collapsed ? "Expandir" : "Minimizar"
  );
  toggleBtn.type = "button";
  toggleBtn.dataset.action = "toggle-group";
  toggleBtn.dataset.groupId = group.id;
  toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
  actions.appendChild(toggleBtn);

  const addSectionBtn = createEl("button", "btn btn-small", "+ Seção interna");
  addSectionBtn.type = "button";
  addSectionBtn.dataset.action = "add-section";
  addSectionBtn.dataset.groupId = group.id;
  actions.appendChild(addSectionBtn);

  const removeGroupBtn = createEl(
    "button",
    "btn btn-small btn-danger",
    "Excluir bloco"
  );
  removeGroupBtn.type = "button";
  removeGroupBtn.dataset.action = "remove-group";
  removeGroupBtn.dataset.groupId = group.id;
  actions.appendChild(removeGroupBtn);

  header.appendChild(left);
  header.appendChild(actions);
  wrapper.appendChild(header);

  if (collapsed) {
    wrapper.appendChild(createEl("div", "structured-empty-text", "Bloco minimizado."));
    return wrapper;
  }

  const sectionsWrap = createEl("div", "structured-sections");
  const sections = getGroupSections(group);

  sections.forEach((section, sectionIndex) => {
    const sectionWrap = createEl("section", "structured-section");
    sectionWrap.dataset.groupId = group.id;
    sectionWrap.dataset.sectionId = section.id;

    const sectionHead = createEl("div", "structured-section-head");
    const sectionLeft = createEl("div", "structured-section-left");
    const sectionTitle = document.createElement("input");
    sectionTitle.className = "structured-section-title";
    sectionTitle.type = "text";
    sectionTitle.value = section.titulo || "";
    sectionTitle.dataset.sectionField = "titulo";
    sectionTitle.dataset.groupId = group.id;
    sectionTitle.dataset.sectionId = section.id;
    sectionLeft.appendChild(sectionTitle);

    const sectionActions = createEl("div", "structured-section-actions");
    const addItemBtn = createEl("button", "btn btn-small", "+ Item");
    addItemBtn.type = "button";
    addItemBtn.dataset.action = "add-item";
    addItemBtn.dataset.groupId = group.id;
    addItemBtn.dataset.sectionId = section.id;
    sectionActions.appendChild(addItemBtn);

    const removeSectionBtn = createEl("button", "btn btn-small btn-danger", "Excluir seção");
    removeSectionBtn.type = "button";
    removeSectionBtn.dataset.action = "remove-section";
    removeSectionBtn.dataset.groupId = group.id;
    removeSectionBtn.dataset.sectionId = section.id;
    removeSectionBtn.disabled = sections.length <= 1;
    sectionActions.appendChild(removeSectionBtn);

    sectionHead.appendChild(sectionLeft);
    sectionHead.appendChild(sectionActions);
    sectionWrap.appendChild(sectionHead);

    const itemsWrap = createEl("div", "structured-items");
    const items = Array.isArray(section.items) ? section.items : [];

    items.forEach((item, itemIndex) => {
      const itemCard = createEl("article", "structured-item");
      itemCard.dataset.groupId = group.id;
      itemCard.dataset.sectionId = section.id;
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
      susCheck.dataset.sectionId = section.id;
      susCheck.dataset.itemId = item.id;
      susLabel.appendChild(susCheck);
      susLabel.appendChild(createEl("span", "", "SUS"));
      itemActions.appendChild(susLabel);

      const metaBtn = createEl("button", "meta-dots", "⋯");
      metaBtn.type = "button";
      metaBtn.dataset.action = "open-item-meta";
      metaBtn.dataset.groupId = group.id;
      metaBtn.dataset.sectionId = section.id;
      metaBtn.dataset.itemId = item.id;
      metaBtn.title = "Metadados do item";
      itemActions.appendChild(metaBtn);

      const removeItemBtn = createEl("button", "btn btn-small btn-danger", "Excluir item");
      removeItemBtn.type = "button";
      removeItemBtn.dataset.action = "remove-item";
      removeItemBtn.dataset.groupId = group.id;
      removeItemBtn.dataset.sectionId = section.id;
      removeItemBtn.dataset.itemId = item.id;
      itemActions.appendChild(removeItemBtn);

      itemTop.appendChild(itemActions);

      const fieldsGrid = createEl("div", "structured-fields-grid");
      fieldsGrid.appendChild(makeStructuredInput("Nome do medicamento", "nome", item.nome, group.id, section.id, item.id));
      fieldsGrid.appendChild(
        makeStructuredInput("Apresentacao / forma", "apresentacao", item.apresentacao, group.id, section.id, item.id)
      );
      fieldsGrid.appendChild(
        makeStructuredInput("Posologia / uso", "posologia", item.posologia, group.id, section.id, item.id, true)
      );

      itemCard.appendChild(itemTop);
      itemCard.appendChild(fieldsGrid);
      itemCard.appendChild(createEl("div", "item-meta-divider"));
      itemCard.appendChild(renderItemMetaSummary(item));
      itemsWrap.appendChild(itemCard);
    });

    if (!items.length) {
      itemsWrap.appendChild(createEl("div", "structured-empty-text", "Sem itens nesta seção."));
    }

    sectionWrap.appendChild(itemsWrap);
    sectionsWrap.appendChild(sectionWrap);
  });

  if (!sections.length) {
    sectionsWrap.appendChild(createEl("div", "structured-empty-text", "Sem seções neste bloco."));
  }

  wrapper.appendChild(sectionsWrap);

  return wrapper;
}

function renderStructuredBuilder() {
  const tab = getActiveTab();
  dom.structuredBlocks.innerHTML = "";

  if (!tab) {
    return;
  }

  ensureTabShape(tab);
  const groups = Array.isArray(tab.structured?.groups) ? tab.structured.groups : [];

  groups.forEach((group) => {
    dom.structuredBlocks.appendChild(renderStructuredGroupNode(group, 0));
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
    notas: dom.subjectMetaNotas.value,
    revisadoEspecialista: Boolean(dom.subjectMetaReviewed?.checked)
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
  closeTagMetaModal(true);
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

  const hasStructuredItems = hasStructuredItemsInGroups(tab.structured?.groups);

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

function addStructuredSection(groupId) {
  const group = getActiveGroupById(groupId);
  if (!group) {
    return;
  }

  if (!Array.isArray(group.sections)) {
    group.sections = [];
  }
  group.sections.push(createStructuredSection(""));
  renderStructuredBuilder();
  refreshPreviewAndValidation();
}

function removeStructuredGroup(groupId) {
  const tab = getActiveTab();
  if (!tab || getTabMode(tab) !== "structured") {
    return;
  }

  const groupContext = getActiveGroupContextById(groupId);
  if (!groupContext) {
    return;
  }

  if (tab.structured.groups.length <= 1) {
    window.alert("Mantenha pelo menos 1 bloco na secao estruturada.");
    return;
  }

  groupContext.groups.splice(groupContext.index, 1);
  renderStructuredBuilder();
  refreshPreviewAndValidation();
}

function removeStructuredSection(groupId, sectionId) {
  const group = getActiveGroupById(groupId);
  if (!group || !Array.isArray(group.sections)) {
    return;
  }

  if (group.sections.length <= 1) {
    window.alert("Cada bloco precisa ter pelo menos 1 seção interna.");
    return;
  }

  group.sections = group.sections.filter((section) => section.id !== sectionId);
  renderStructuredBuilder();
  refreshPreviewAndValidation();
}

function addStructuredItem(groupId, sectionId) {
  const section = getActiveSectionById(groupId, sectionId);
  if (!section) {
    return;
  }

  if (!Array.isArray(section.items)) {
    section.items = [];
  }
  section.items.push(createStructuredItem(""));
  renderStructuredBuilder();
  refreshPreviewAndValidation();
}

function removeStructuredItem(groupId, sectionId, itemId) {
  const section = getActiveSectionById(groupId, sectionId);
  if (!section) {
    return;
  }

  const items = Array.isArray(section.items) ? section.items : [];
  if (items.length <= 1) {
    window.alert("Cada seção interna precisa ter pelo menos 1 item.");
    return;
  }

  section.items = items.filter((item) => item.id !== itemId);
  renderStructuredBuilder();
  refreshPreviewAndValidation();
}

function openItemMetaModal(groupId, sectionId, itemId) {
  const item = getActiveItemById(groupId, sectionId, itemId);
  if (!item) {
    return;
  }

  state.itemMetaContext = {
    groupId,
    sectionId,
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

  const item = getActiveItemById(context.groupId, context.sectionId, context.itemId);
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

function clearTagMetaContentSurface() {
  if (dom.tagMetaContent) {
    dom.tagMetaContent.innerHTML = "";
  }
}

function appendTagMetaParagraph(text) {
  if (!dom.tagMetaContent) {
    return;
  }
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  dom.tagMetaContent.appendChild(paragraph);
}

function clampTagImageWidth(rawWidth) {
  const width = Number.parseFloat(String(rawWidth ?? "").trim());
  if (!Number.isFinite(width) || width <= 0) {
    return null;
  }
  return Math.min(TAG_IMAGE_MAX_WIDTH, Math.max(TAG_IMAGE_MIN_WIDTH, Math.round(width)));
}

function applyTagImageWidth(imageEl, rawWidth) {
  const width = clampTagImageWidth(rawWidth);
  if (!imageEl) {
    return width;
  }
  if (!width) {
    imageEl.style.removeProperty("width");
    delete imageEl.dataset.width;
    return null;
  }
  imageEl.style.width = `${width}px`;
  imageEl.dataset.width = String(width);
  return width;
}

function makeTagResizableImageWrap(src, alt = "", width = null) {
  const wrap = document.createElement("figure");
  wrap.className = "tag-image-wrap";
  wrap.contentEditable = "false";

  const image = document.createElement("img");
  image.className = "tag-resizable-image";
  image.src = src;
  image.alt = alt;
  image.draggable = false;
  applyTagImageWidth(image, width);
  wrap.appendChild(image);

  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "tag-image-resize-handle";
  handle.title = "Arraste para redimensionar proporcionalmente";
  handle.setAttribute("aria-label", "Redimensionar imagem");
  wrap.appendChild(handle);

  handle.addEventListener("pointerdown", (event) => {
    if (!dom.tagMetaContent) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const imageRect = image.getBoundingClientRect();
    const startWidth = imageRect.width || clampTagImageWidth(image.dataset.width) || TAG_IMAGE_MIN_WIDTH;
    const startX = event.clientX;
    const startY = event.clientY;
    const containerMax = Math.max(TAG_IMAGE_MIN_WIDTH, dom.tagMetaContent.clientWidth - 26);

    const onMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const delta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
      const nextWidth = Math.min(containerMax, Math.max(TAG_IMAGE_MIN_WIDTH, startWidth + delta));
      applyTagImageWidth(image, nextWidth);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });

  return wrap;
}

function appendTagMetaImage(src, alt = "", width = null) {
  if (!dom.tagMetaContent || !isNonEmptyString(src)) {
    return;
  }
  const wrap = makeTagResizableImageWrap(src, alt, width);
  dom.tagMetaContent.appendChild(wrap);

  const spacer = document.createElement("p");
  spacer.innerHTML = "<br>";
  dom.tagMetaContent.appendChild(spacer);
}

function fillTagMetaSurface(content) {
  clearTagMetaContentSurface();
  const nodes = normalizeTagContent(content);
  nodes.forEach((node) => {
    if (node.type === "image") {
      appendTagMetaImage(node.src, node.alt, node.width);
    } else {
      appendTagMetaParagraph(node.text);
    }
  });
}

function splitTagModalText(rawText) {
  return String(rawText || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function readTagContentFromSurface() {
  if (!dom.tagMetaContent) {
    return [];
  }

  const nodes = [];
  const pushText = (rawText) => {
    splitTagModalText(rawText).forEach((line) => {
      nodes.push({ type: "paragraph", text: line });
    });
  };

  const pushImage = (src, alt = "", width = null) => {
    const normalizedSrc = asString(src).trim();
    if (!/^data:image\//i.test(normalizedSrc)) {
      return;
    }
    const normalizedWidth = clampTagImageWidth(width);
    nodes.push({
      type: "image",
      src: normalizedSrc,
      alt: asString(alt).trim(),
      ...(normalizedWidth ? { width: normalizedWidth } : {})
    });
  };

  if (!dom.tagMetaContent.childNodes.length) {
    pushText(dom.tagMetaContent.textContent || "");
    return nodes;
  }

  dom.tagMetaContent.childNodes.forEach((node) => {
    if (node.nodeType === window.Node.TEXT_NODE) {
      pushText(node.textContent || "");
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (node.classList.contains("tag-image-wrap")) {
      const image = node.querySelector("img");
      if (image) {
        pushImage(
          image.getAttribute("src"),
          image.getAttribute("alt") || "",
          image.dataset.width || image.style.width
        );
      }
      return;
    }

    if (node.tagName === "IMG") {
      pushImage(node.getAttribute("src"), node.getAttribute("alt") || "", node.dataset.width || node.style.width);
      return;
    }

    const directText = node.cloneNode(true);
    directText.querySelectorAll("img").forEach((img) => img.remove());
    pushText(directText.textContent || "");
    node.querySelectorAll("img").forEach((img) => {
      pushImage(img.getAttribute("src"), img.getAttribute("alt") || "");
    });
  });

  return normalizeTagContent(nodes);
}

function currentTagContextStillActive(context) {
  return (
    context &&
    context.areaSlug === state.activeAreaSlug &&
    context.subjectSlug === state.activeSubjectSlug &&
    context.tabSlug === state.activeTabSlug
  );
}

function openTagMetaModal(tagId, fallbackLabel = "") {
  const tab = getActiveTab();
  if (!tab || getTabMode(tab) !== "free") {
    return;
  }

  const safeTagId = normalizeTagId(tagId);
  if (!safeTagId) {
    return;
  }

  const tagDefs = getTagDefsForTab(tab);
  let tag = tagDefs.find((entry) => entry.id === safeTagId) || null;
  if (!tag) {
    tag = {
      id: safeTagId,
      label: isNonEmptyString(fallbackLabel) ? fallbackLabel.trim() : "Tag",
      content: []
    };
    tagDefs.push(tag);
  }

  state.tagMetaContext = {
    areaSlug: state.activeAreaSlug,
    subjectSlug: state.activeSubjectSlug,
    tabSlug: state.activeTabSlug,
    tagId: safeTagId
  };

  dom.tagMetaTitle.textContent = `Tag: ${tag.label || safeTagId}`;
  dom.tagMetaLabel.value = tag.label || "";
  fillTagMetaSurface(tag.content);
  dom.tagMetaModal.hidden = false;
  dom.tagMetaLabel.focus();
}

function closeTagMetaModal(silent = false) {
  if (!dom.tagMetaModal) {
    return;
  }
  dom.tagMetaModal.hidden = true;
  state.tagMetaContext = null;
  clearTagMetaContentSurface();
  if (!silent) {
    refreshPreviewAndValidation();
  }
}

function removeTagMarkFromEditor(tagId) {
  const editor = state.editor;
  const safeTagId = normalizeTagId(tagId);
  if (!editor || !safeTagId) {
    return;
  }

  const { state: editorState, view } = editor;
  let tr = editorState.tr;

  editorState.doc.descendants((node, pos) => {
    if (!node.isText || !Array.isArray(node.marks) || !node.marks.length) {
      return;
    }
    node.marks.forEach((mark) => {
      if (mark.type.name === "tagRef" && normalizeTagId(mark.attrs?.tagId) === safeTagId) {
        tr = tr.removeMark(pos, pos + node.nodeSize, mark);
      }
    });
  });

  if (tr.docChanged) {
    view.dispatch(tr);
  }
}

function saveTagMetaFromModal() {
  const context = state.tagMetaContext;
  if (!currentTagContextStillActive(context)) {
    closeTagMetaModal(true);
    return;
  }

  const tab = getActiveTab();
  if (!tab) {
    closeTagMetaModal(true);
    return;
  }

  const tagDefs = getTagDefsForTab(tab);
  const safeTagId = normalizeTagId(context.tagId);
  if (!safeTagId) {
    closeTagMetaModal(true);
    return;
  }

  let tag = tagDefs.find((entry) => entry.id === safeTagId) || null;
  if (!tag) {
    tag = {
      id: safeTagId,
      label: "Tag",
      content: []
    };
    tagDefs.push(tag);
  }

  tag.label = isNonEmptyString(dom.tagMetaLabel.value) ? dom.tagMetaLabel.value.trim() : "Tag";
  tag.content = readTagContentFromSurface();

  closeTagMetaModal(true);
  refreshPreviewAndValidation();
}

function deleteTagMetaFromModal() {
  const context = state.tagMetaContext;
  if (!currentTagContextStillActive(context)) {
    closeTagMetaModal(true);
    return;
  }

  const tab = getActiveTab();
  if (!tab) {
    closeTagMetaModal(true);
    return;
  }

  const safeTagId = normalizeTagId(context.tagId);
  if (!safeTagId) {
    closeTagMetaModal(true);
    return;
  }

  const confirmed = window.confirm("Excluir esta tag e remover suas marcações no texto?");
  if (!confirmed) {
    return;
  }

  const tagDefs = getTagDefsForTab(tab);
  tab.tagDefs = tagDefs.filter((entry) => entry.id !== safeTagId);
  removeTagMarkFromEditor(safeTagId);
  persistCurrentTabFromEditor();
  closeTagMetaModal(true);
  refreshPreviewAndValidation();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler imagem colada."));
    reader.readAsDataURL(file);
  });
}

async function readFileAsBase64(file) {
  const buffer = await file.arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
}

function addSubjectReferenceLink() {
  const subject = getActiveSubject();
  if (!subject) {
    return;
  }

  subject.referencias = normalizeSubjectReferences(subject.referencias);
  subject.referencias.push(createSubjectReference("link"));
  renderSubjectReferences();
  refreshPreviewAndValidation();
}

function queueSubjectReferencePdfUpload(referenceId = "") {
  if (!dom.subjectReferencePdfInput) {
    return;
  }
  state.pendingReferenceUploadId = referenceId || "";
  dom.subjectReferencePdfInput.value = "";
  dom.subjectReferencePdfInput.click();
}

async function handleSubjectReferencePdfSelection(event) {
  const subject = getActiveSubject();
  const area = getActiveArea();
  const input = event?.target;
  const file = input?.files?.[0] || null;

  if (!subject || !area || !file) {
    state.pendingReferenceUploadId = "";
    return;
  }

  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    window.alert("Selecione um arquivo PDF.");
    state.pendingReferenceUploadId = "";
    input.value = "";
    return;
  }

  subject.referencias = normalizeSubjectReferences(subject.referencias);

  let reference = subject.referencias.find((entry) => entry.id === state.pendingReferenceUploadId) || null;
  if (!reference) {
    reference = createSubjectReference("pdf");
    subject.referencias.push(reference);
  }

  try {
    reference.tipo = "pdf";
    reference.uploadBase64 = await readFileAsBase64(file);
    reference.uploadMimeType = file.type || "application/pdf";
    reference.uploadFileName = file.name;
    reference.nomeArquivo = file.name;
    reference.arquivo =
      normalizeReferenceAssetPath(reference.arquivo) ||
      buildReferenceAssetPath(area, subject, reference.id, file.name);
    if (!isNonEmptyString(reference.titulo)) {
      reference.titulo = deriveReferenceTitleFromFileName(file.name);
    }
  } catch (error) {
    console.error(error);
    window.alert("Não foi possível ler o PDF selecionado.");
  } finally {
    state.pendingReferenceUploadId = "";
    input.value = "";
  }

  renderSubjectReferences();
  refreshPreviewAndValidation();
}

function pasteTagModalText(text) {
  const lines = splitTagModalText(text);
  if (!lines.length) {
    return;
  }
  lines.forEach((line) => appendTagMetaParagraph(line));
}

async function handleTagMetaPaste(event) {
  const clipboard = event.clipboardData;
  if (!clipboard) {
    return;
  }

  const imageItems = Array.from(clipboard.items || []).filter(
    (item) => item.kind === "file" && /^image\//i.test(item.type)
  );

  if (!imageItems.length) {
    return;
  }

  event.preventDefault();

  for (const item of imageItems) {
    const file = item.getAsFile();
    if (!file) {
      continue;
    }
    try {
      const src = await readFileAsDataUrl(file);
      appendTagMetaImage(src, file.name || "imagem");
    } catch (_error) {
      // Ignora falha pontual de leitura de imagem colada.
    }
  }
}

function handleTagMetaKeydown(event) {
  // Digitação livre habilitada no conteúdo da tag.
  // Ctrl+V continua disponível para colar imagens.
  return;
}

function createTagFromSelection() {
  const editor = state.editor;
  const tab = getActiveTab();
  if (!editor || !tab || getTabMode(tab) !== "free") {
    return;
  }

  const { from, to, empty } = editor.state.selection;
  if (empty || from === to) {
    window.alert("Selecione um trecho do texto para criar a tag.");
    return;
  }

  const selectedText = editor.state.doc.textBetween(from, to, " ").trim();
  const defaultLabel = isNonEmptyString(selectedText) ? selectedText.slice(0, 80) : "Tag";

  const tag = createTagDef(defaultLabel);
  const tagDefs = getTagDefsForTab(tab);
  tagDefs.push(tag);

  const applied = editor.chain().focus().setMark("tagRef", { tagId: tag.id }).run();
  if (!applied) {
    tab.tagDefs = tagDefs.filter((entry) => entry.id !== tag.id);
    window.alert("Não foi possível aplicar a tag ao trecho selecionado.");
    return;
  }

  persistCurrentTabFromEditor();
  refreshPreviewAndValidation();
  openTagMetaModal(tag.id, defaultLabel);
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
      autoSizeInputByContent(target, 3);
      refreshPreviewAndValidation();
      return;
    }
    if (groupField === "titulo") {
      group.titulo = target.value;
      refreshPreviewAndValidation();
    }
    return;
  }

  const sectionField = target.dataset.sectionField;
  if (sectionField) {
    const section = getActiveSectionById(target.dataset.groupId, target.dataset.sectionId);
    if (!section) {
      return;
    }
    if (sectionField === "titulo") {
      section.titulo = target.value;
      refreshPreviewAndValidation();
    }
    return;
  }

  const itemField = target.dataset.itemField;
  if (!itemField) {
    return;
  }

  const item = getActiveItemById(target.dataset.groupId, target.dataset.sectionId, target.dataset.itemId);
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
  const sectionId = button.dataset.sectionId;
  const itemId = button.dataset.itemId;

  if (action === "add-section") {
    addStructuredSection(groupId);
    return;
  }

  if (action === "add-item") {
    addStructuredItem(groupId, sectionId);
    return;
  }

  if (action === "toggle-group") {
    toggleStructuredGroupCollapsed(groupId);
    renderStructuredBuilder();
    return;
  }

  if (action === "remove-section") {
    removeStructuredSection(groupId, sectionId);
    return;
  }

  if (action === "remove-group") {
    removeStructuredGroup(groupId);
    return;
  }

  if (action === "remove-item") {
    removeStructuredItem(groupId, sectionId, itemId);
    return;
  }

  if (action === "open-item-meta") {
    openItemMetaModal(groupId, sectionId, itemId);
  }
}

function inlineFromDoc(contentNodes) {
  if (!Array.isArray(contentNodes)) {
    return [];
  }

  const spans = [];

  for (const node of contentNodes) {
    if (node.type === "text" && typeof node.text === "string") {
      let tagId = "";
      const marks = [];
      if (Array.isArray(node.marks)) {
        node.marks.forEach((mark) => {
          if (mark?.type === "tagRef") {
            const candidateTagId = normalizeTagId(mark.attrs?.tagId);
            if (candidateTagId) {
              tagId = candidateTagId;
            }
            return;
          }
          if (MARKS.includes(mark?.type)) {
            marks.push(mark.type);
          }
        });
      }

      const span = marks.length ? { text: node.text, marks } : { text: node.text };
      if (tagId) {
        span.tagId = tagId;
      }
      const previous = spans[spans.length - 1];

      if (
        previous &&
        normalizeTagId(previous.tagId) === normalizeTagId(span.tagId) &&
        JSON.stringify(previous.marks || []) === JSON.stringify(span.marks || [])
      ) {
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

    const markNodes = [];
    if (normalizeTagId(span.tagId)) {
      markNodes.push({
        type: "tagRef",
        attrs: {
          tagId: normalizeTagId(span.tagId)
        }
      });
    }
    markNodes.push(...marksToDoc(span.marks));
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

  tab.tagDefs = normalizeTagDefs(tab.tagDefs);
  const editorJson = state.editor.getJSON();
  tab.blocks = docNodesToBlocks(editorJson.content || []);
}

function validateInlineContent(content, path, errors, validTagIds = null) {
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

    if (span.tagId !== undefined) {
      if (!isNonEmptyString(span.tagId)) {
        errors.push(`${path}[${index}].tagId invalido.`);
      } else if (validTagIds instanceof Set && !validTagIds.has(span.tagId.trim())) {
        errors.push(`${path}[${index}].tagId não encontrado em tagDefs.`);
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
  if (typeof meta.revisadoEspecialista !== "boolean") {
    errors.push(`${path}.revisadoEspecialista invalido.`);
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

function validateTagContent(content, path, errors) {
  if (!Array.isArray(content)) {
    errors.push(`${path} invalido.`);
    return;
  }

  content.forEach((node, nodeIndex) => {
    const nodePath = `${path}[${nodeIndex}]`;
    if (!node || typeof node !== "object") {
      errors.push(`${nodePath} invalido.`);
      return;
    }

    if (node.type === "image") {
      if (!isNonEmptyString(node.src) || !/^data:image\//i.test(node.src)) {
        errors.push(`${nodePath}.src invalido.`);
      }
      if (node.alt !== undefined && typeof node.alt !== "string") {
        errors.push(`${nodePath}.alt invalido.`);
      }
      if (node.width !== undefined) {
        const width = Number(node.width);
        if (!Number.isFinite(width) || width <= 0) {
          errors.push(`${nodePath}.width invalido.`);
        }
      }
      return;
    }

    if (node.type !== "paragraph") {
      errors.push(`${nodePath}.type invalido.`);
      return;
    }

    if (typeof node.text !== "string") {
      errors.push(`${nodePath}.text invalido.`);
    }
  });
}

function validateTagDefs(tagDefs, path, errors) {
  const ids = new Set();
  if (!Array.isArray(tagDefs)) {
    errors.push(`${path} invalido.`);
    return ids;
  }

  tagDefs.forEach((tag, index) => {
    const tagPath = `${path}[${index}]`;
    if (!tag || typeof tag !== "object") {
      errors.push(`${tagPath} invalido.`);
      return;
    }

    if (!isNonEmptyString(tag.id)) {
      errors.push(`${tagPath}.id vazio.`);
    } else if (ids.has(tag.id.trim())) {
      errors.push(`${tagPath}.id duplicado (${tag.id.trim()}).`);
    } else {
      ids.add(tag.id.trim());
    }

    if (!isNonEmptyString(tag.label)) {
      errors.push(`${tagPath}.label vazio.`);
    }

    validateTagContent(tag.content, `${tagPath}.content`, errors);
  });

  return ids;
}

function validateBlocks(blocks, path, errors, validTagIds = null) {
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
      validateInlineContent(block.content, `${blockPath}.content`, errors, validTagIds);
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
          validateInlineContent(item?.content, `${blockPath}.items[${itemIndex}].content`, errors, validTagIds);
        });
      }
      return;
    }

    if (block.type === "callout") {
      if (!CALLOUT_TONES.includes(block.tone)) {
        errors.push(`${blockPath}.tone invalido.`);
      }
      validateBlocks(block.blocks, `${blockPath}.blocks`, errors, validTagIds);
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

function validateStructuredGroupNode(group, groupPath, errors) {
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

  const sections = Array.isArray(group.sections) ? group.sections : [];

  if (!Array.isArray(group.sections)) {
    errors.push(`${groupPath}.sections invalido.`);
  }

  if (!sections.length) {
    errors.push(`${groupPath}.sections vazio.`);
  }

  sections.forEach((section, sectionIndex) => {
    const sectionPath = `${groupPath}.sections[${sectionIndex}]`;
    if (!section || typeof section !== "object") {
      errors.push(`${sectionPath} invalido.`);
      return;
    }

    if (!isNonEmptyString(section.id)) {
      errors.push(`${sectionPath}.id vazio.`);
    }

    if (!Array.isArray(section.items) || !section.items.length) {
      errors.push(`${sectionPath}.items vazio.`);
      return;
    }

    section.items.forEach((item, itemIndex) => {
      const itemPath = `${sectionPath}.items[${itemIndex}]`;
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
    validateStructuredGroupNode(group, `${tabPath}.structured.groups[${groupIndex}]`, errors);
  });
}

function validateTabNode(tab, tabPath, errors, usedTabs, slugRegex) {
  if (!tab || typeof tab !== "object") {
    errors.push(`${tabPath} invalido.`);
    return;
  }

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
  const validTagIds = validateTagDefs(tab.tagDefs, `${tabPath}.tagDefs`, errors);

  if (getTabMode(tab) === "structured") {
    validateStructured(tab, tabPath, errors);
  } else {
    validateBlocks(tab.blocks, `${tabPath}.blocks`, errors, validTagIds);
  }

  const children = Array.isArray(tab.children) ? tab.children : [];
  if (tab.children !== undefined && !Array.isArray(tab.children)) {
    errors.push(`${tabPath}.children invalido.`);
  }

  children.forEach((child, childIndex) => {
    validateTabNode(child, `${tabPath}.children[${childIndex}]`, errors, usedTabs, slugRegex);
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

    const rawStatus = asString(subject.status).trim();
    if (rawStatus && !SUBJECT_STATUSES.includes(rawStatus)) {
      errors.push(`${subjectPath}.status invalido.`);
    }

    validateEntityMeta(subject.meta, `${subjectPath}.meta`, errors);

    if (!Array.isArray(subject.tabs) || !subject.tabs.length) {
      errors.push(`${subjectPath}.tabs vazio.`);
      return;
    }

    const usedTabs = new Set();

    subject.tabs.forEach((tab, tabIndex) => {
      validateTabNode(tab, `${subjectPath}.tabs[${tabIndex}]`, errors, usedTabs, slugRegex);
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
    li.textContent = `JSON valido para schema ${SCHEMA_VERSION}.`;
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
  state.activeTabSlug = getFirstTabInTree(area.assuntos[0].tabs)?.slug || "";

  renderAll();
  loadActiveTabIntoEditor();
}

function renameArea() {
  const area = getActiveArea();
  if (!area) {
    return;
  }

  persistCurrentTabFromEditor();

  const nextName = window.prompt("Novo nome da area:", area.area);
  if (!isNonEmptyString(nextName)) {
    return;
  }

  const oldSlug = area.slug;
  area.area = nextName.trim();

  const used = new Set(state.areas.filter((item) => item !== area).map((item) => item.slug));
  area.slug = makeUniqueSlug(slugify(area.area), used);

  if (oldSlug !== area.slug) {
    state.areaFileNames.delete(oldSlug);
    setAreaFileName(area.slug, `${area.slug}.json`);
    state.areaFileHandles.delete(oldSlug);
    state.areaFileHandleNames.delete(oldSlug);
    state.lastSyncedSignatures.delete(oldSlug);
    state.activeAreaSlug = area.slug;
  }

  renderAll();
}

function deleteArea() {
  const area = getActiveArea();
  if (!area) {
    return;
  }

  const confirmed = window.confirm(`Excluir a área "${area.area}"?`);
  if (!confirmed) {
    return;
  }

  persistCurrentTabFromEditor();
  closeItemMetaModal(true);
  closeTagMetaModal(true);

  const index = state.areas.findIndex((item) => item.slug === area.slug);
  if (index < 0) {
    return;
  }

  state.areas.splice(index, 1);
  state.areaFileNames.delete(area.slug);
  state.areaFileHandles.delete(area.slug);
  state.areaFileHandleNames.delete(area.slug);
  state.lastSyncedSignatures.delete(area.slug);

  const safeIndex = Math.max(0, index - 1);
  const nextArea = state.areas[safeIndex] || state.areas[0] || null;
  state.activeAreaSlug = nextArea?.slug || "";
  state.activeSubjectSlug = "";
  state.activeTabSlug = "";

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
  state.activeTabSlug = getFirstTabInTree(subject.tabs)?.slug || "";

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

function deleteSubject() {
  const area = getActiveArea();
  const subject = getActiveSubject();
  if (!area || !subject) {
    return;
  }

  if (area.assuntos.length <= 1) {
    window.alert("Cada área precisa ter pelo menos 1 assunto.");
    return;
  }

  const confirmed = window.confirm(`Excluir o assunto \"${subject.titulo}\"?`);
  if (!confirmed) {
    return;
  }

  persistCurrentTabFromEditor();
  closeItemMetaModal(true);
  closeTagMetaModal(true);

  const index = area.assuntos.findIndex((item) => item.slug === subject.slug);
  if (index < 0) {
    return;
  }

  area.assuntos.splice(index, 1);
  const safeIndex = Math.max(0, index - 1);
  const nextSubject = area.assuntos[safeIndex] || area.assuntos[0];
  state.activeSubjectSlug = nextSubject?.slug || "";
  state.activeTabSlug = getFirstTabInTree(nextSubject?.tabs)?.slug || "";

  renderAll();
  loadActiveTabIntoEditor();
}

function toggleSubjectStatus() {
  const subject = getActiveSubject();
  if (!subject) {
    return;
  }

  persistCurrentTabFromEditor();
  subject.status =
    normalizeSubjectStatus(subject.status) === SUBJECT_STATUS_DONE
      ? SUBJECT_STATUS_BUILDING
      : SUBJECT_STATUS_DONE;

  renderAll();
  refreshPreviewAndValidation();
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

  const usedTabSlugs = new Set(flattenTabs(subject.tabs).map((entry) => entry.tab.slug));
  const tabSlug = makeUniqueSlug(slugify(tabName), usedTabSlugs);
  const tab = normalizeTab({
    titulo: tabName.trim(),
    slug: tabSlug,
    mode: "structured",
    meta: createEntityMeta(),
    blocks: [createParagraphBlock("Edite o protocolo aqui.")],
    structured: createStructuredModel()
  });

  const activeContext = getActiveTabContext();
  const targetTabs = activeContext?.siblings || subject.tabs;
  const insertIndex = activeContext ? activeContext.index + 1 : targetTabs.length;
  targetTabs.splice(insertIndex, 0, tab);
  ensureUniqueTabSlugs(subject.tabs, new Set());
  state.activeTabSlug = tab.slug;

  renderAll();
  loadActiveTabIntoEditor();
}

function createChildTab() {
  const subject = getActiveSubject();
  const tabContext = getActiveTabContext();
  if (!subject || !tabContext) {
    return;
  }

  persistCurrentTabFromEditor();

  const tabName = window.prompt("Nome da nova subseção:", "Nova Subseção");
  if (!isNonEmptyString(tabName)) {
    return;
  }

  const usedTabSlugs = new Set(flattenTabs(subject.tabs).map((entry) => entry.tab.slug));
  const tabSlug = makeUniqueSlug(slugify(tabName), usedTabSlugs);
  const childTab = normalizeTab({
    titulo: tabName.trim(),
    slug: tabSlug,
    mode: "structured",
    meta: createEntityMeta(),
    blocks: [createParagraphBlock("Edite o protocolo aqui.")],
    structured: createStructuredModel()
  });

  if (!Array.isArray(tabContext.tab.children)) {
    tabContext.tab.children = [];
  }
  tabContext.tab.children.push(childTab);
  ensureUniqueTabSlugs(subject.tabs, new Set());
  state.activeTabSlug = childTab.slug;

  renderAll();
  loadActiveTabIntoEditor();
}

function groupTabsIntoParent() {
  const subject = getActiveSubject();
  const tabContext = getActiveTabContext();
  if (!subject || !tabContext) {
    return;
  }

  const availableCount = tabContext.siblings.length - tabContext.index;
  if (availableCount < 2) {
    window.alert("Selecione uma seção que tenha pelo menos mais uma seção abaixo no mesmo nível para agrupar.");
    return;
  }

  persistCurrentTabFromEditor();

  const groupTitle = window.prompt("Nome do novo grupo:", "Novo Grupo");
  if (!isNonEmptyString(groupTitle)) {
    return;
  }

  const rawCount = window.prompt(
    `Quantas seções consecutivas deseja agrupar a partir de "${tabContext.tab.titulo}"? (mínimo 2, máximo ${availableCount})`,
    "2"
  );
  if (!isNonEmptyString(rawCount)) {
    return;
  }

  const count = Number.parseInt(rawCount, 10);
  if (!Number.isInteger(count) || count < 2 || count > availableCount) {
    window.alert(`Informe um número entre 2 e ${availableCount}.`);
    return;
  }

  const groupedTabs = tabContext.siblings.splice(tabContext.index, count);
  const usedTabSlugs = new Set(flattenTabs(subject.tabs).map((entry) => entry.tab.slug));
  const groupSlug = makeUniqueSlug(slugify(groupTitle), usedTabSlugs);
  const groupTab = normalizeTab({
    titulo: groupTitle.trim(),
    slug: groupSlug,
    mode: "free",
    meta: createEntityMeta(),
    blocks: [createParagraphBlock("")],
    tagDefs: [],
    children: groupedTabs
  });

  tabContext.siblings.splice(tabContext.index, 0, groupTab);
  ensureUniqueTabSlugs(subject.tabs, new Set());
  state.activeTabSlug = groupTab.slug;

  renderAll();
  loadActiveTabIntoEditor();
}

function renameTab() {
  const subject = getActiveSubject();
  const tabContext = getActiveTabContext();
  const tab = tabContext?.tab;
  if (!subject || !tabContext || !tab) {
    return;
  }

  const nextTitle = window.prompt("Novo titulo da secao:", tab.titulo);
  if (!isNonEmptyString(nextTitle)) {
    return;
  }

  tab.titulo = nextTitle.trim();

  const used = new Set(
    flattenTabs(subject.tabs)
      .filter((entry) => entry.tab !== tab)
      .map((entry) => entry.tab.slug)
  );
  tab.slug = makeUniqueSlug(slugify(tab.titulo), used);
  state.activeTabSlug = tab.slug;

  renderAll();
}

function moveTab(offset) {
  const subject = getActiveSubject();
  const tabContext = getActiveTabContext();
  if (!subject || !tabContext) {
    return;
  }

  if (offset > 0) {
    if (tabContext.index <= 0) {
      return;
    }

    const targetParent = tabContext.siblings[tabContext.index - 1];
    tabContext.siblings.splice(tabContext.index, 1);
    if (!Array.isArray(targetParent.children)) {
      targetParent.children = [];
    }
    targetParent.children.push(tabContext.tab);
  } else {
    if (!tabContext.parent) {
      return;
    }

    const parentContext = findTabContextInTree(subject.tabs, tabContext.parent.slug);
    if (!parentContext) {
      return;
    }

    tabContext.siblings.splice(tabContext.index, 1);
    parentContext.siblings.splice(parentContext.index + 1, 0, tabContext.tab);
  }

  renderAll();
}

function deleteTab() {
  const subject = getActiveSubject();
  const tabContext = getActiveTabContext();
  const tab = tabContext?.tab;
  if (!subject || !tabContext || !tab) {
    return;
  }

  if (countTabsInTree(subject.tabs) <= 1) {
    window.alert("Cada assunto precisa ter pelo menos 1 secao.");
    return;
  }

  const descendants = countTabsInTree(getTabChildren(tab));
  const confirmed = window.confirm(
    descendants
      ? `Excluir a seção "${tab.titulo}" e ${descendants} subseção(ões)?`
      : `Excluir a seção "${tab.titulo}"?`
  );
  if (!confirmed) {
    return;
  }

  const flatBefore = flattenTabs(subject.tabs);
  const previousIndex = flatBefore.findIndex((entry) => entry.tab.slug === tab.slug);
  tabContext.siblings.splice(tabContext.index, 1);

  const flatAfter = flattenTabs(subject.tabs);
  const nextContext = flatAfter[Math.min(previousIndex, flatAfter.length - 1)] || null;
  state.activeTabSlug = nextContext?.tab?.slug || "";

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
  closeTagMetaModal(true);

  if (!state.areas.length) {
    setStatus("Nenhuma área para sincronizar.");
    pulseSyncButton("error");
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
      pulseSyncButton("error");
      return;
    }
  }

  const payloads = collectAreaSyncPayloads();
  const indexPayload = buildDataIndexPayload();

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
        downloadObject(INDEX_FILE_NAME, indexPayload);
        setStatus("Sem pasta vinculada. JSONs baixados.");
        pulseSyncButton("error");
      } else {
        setStatus("Sincronização cancelada (pasta não vinculada).");
        pulseSyncButton("error");
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

    const nextIndexSignature = indexSyncSignature(indexPayload);
    const lastIndexSignature = state.lastSyncedSignatures.get(INDEX_SIGNATURE_KEY);
    let indexUpdated = false;

    if (lastIndexSignature !== nextIndexSignature) {
      let indexHandle = state.areaFileHandles.get(INDEX_SIGNATURE_KEY);
      const mappedIndexName = state.areaFileHandleNames.get(INDEX_SIGNATURE_KEY);
      if (!indexHandle || mappedIndexName !== INDEX_FILE_NAME) {
        indexHandle = await targetDirHandle.getFileHandle(INDEX_FILE_NAME, { create: true });
        state.areaFileHandles.set(INDEX_SIGNATURE_KEY, indexHandle);
        state.areaFileHandleNames.set(INDEX_SIGNATURE_KEY, INDEX_FILE_NAME);
      }
      await writeJsonToFileHandle(indexHandle, indexPayload);
      state.lastSyncedSignatures.set(INDEX_SIGNATURE_KEY, nextIndexSignature);
      indexUpdated = true;
    }

    setStatus(
      `Sincronização local concluída: ${savedCount} área(s) atualizada(s)/criada(s), ${skippedCount} sem alteração, index.json ${indexUpdated ? "atualizado" : "sem alteração"}.`
    );
    pulseSyncButton("ok");
    broadcastLocalSync();
  } catch (error) {
    const message = String(error?.message || "");
    const blockedBySystemFolder = /system files|arquivos do sistema/i.test(message);

    if (error?.name === "AbortError") {
      setStatus("Sincronização cancelada.");
      pulseSyncButton("error");
      return;
    }

    console.error(error);
    state.dataDirHandle = null;
    state.areaFileHandles.clear();
    state.areaFileHandleNames.clear();
    await clearStoredHandle(HANDLE_KEY_DATA_DIR).catch(() => {});
    if (blockedBySystemFolder) {
      window.alert(
        "O navegador bloqueou a pasta escolhida por segurança.\nUse 'Vincular pasta data (1x)' e selecione C:\\Users\\Arthur\\Documents\\prescrever\\data.\nAgora os JSONs serão baixados."
      );
    } else {
      window.alert("Falha ao sincronizar direto na pasta. Os JSONs serão baixados.");
    }
    payloads.forEach(({ fileName, payload }) => {
      downloadObject(fileName, payload);
    });
    downloadObject(INDEX_FILE_NAME, indexPayload);
    setStatus("Falha na sincronização direta. JSONs baixados.");
    pulseSyncButton("error");
  }
}

async function syncGithubJsonFiles() {
  persistCurrentTabFromEditor();
  closeItemMetaModal(true);
  closeTagMetaModal(true);

  if (!state.areas.length) {
    setStatus("Nenhuma área para sincronizar no GitHub.");
    return;
  }

  const allErrors = state.areas.flatMap((area) => validateArea(area).map((error) => `[${area.slug}] ${error}`));
  if (allErrors.length) {
    const preview = allErrors.slice(0, 8).join("\n- ");
    const shouldContinue = window.confirm(
      `Foram encontrados ${allErrors.length} erro(s) de validação.\n\n- ${preview}\n\nDeseja sincronizar no GitHub mesmo assim?`
    );
    if (!shouldContinue) {
      refreshPreviewAndValidation();
      return;
    }
  }

  const config = getGithubConfigFromInputs();
  if (!isNonEmptyString(config.owner) || !isNonEmptyString(config.repo) || !isNonEmptyString(config.token)) {
    window.alert("Preencha Usuário/Org, Repositório e Token para sincronizar no GitHub.");
    setStatus("Sincronização GitHub cancelada: dados de autenticação incompletos.");
    return;
  }
  persistGithubConfigInputs();

  const referenceUploads = collectReferenceAssetUploads(config);
  const areaPayloads = collectAreaSyncPayloads();
  const indexPayload = buildDataIndexPayload();
  const queue = [
    ...areaPayloads.map((item) => ({
      ...item,
      remoteFilePath: `${config.dataPath}/${normalizeFileName(item.fileName, `${item.area.slug}.json`)}`,
      signature: areaSyncSignature(item.area, item.fileName),
      signatureKey: item.area.slug
    })),
    {
      area: null,
      fileName: INDEX_FILE_NAME,
      payload: indexPayload,
      remoteFilePath: `${config.dataPath}/${INDEX_FILE_NAME}`,
      signature: indexSyncSignature(indexPayload),
      signatureKey: INDEX_SIGNATURE_KEY
    }
  ];

  let createdCount = 0;
  let updatedCount = 0;
  let uploadedAssetsCount = 0;

  if (dom.btnSyncGithub) {
    dom.btnSyncGithub.disabled = true;
  }

  try {
    const totalSteps = referenceUploads.length + queue.length;

    for (let index = 0; index < referenceUploads.length; index += 1) {
      const item = referenceUploads[index];
      setStatus(`Sincronizando no GitHub (${index + 1}/${totalSteps}): ${item.remoteFilePath}`);
      const result = await upsertGithubBase64File(
        config,
        item.remoteFilePath,
        item.reference.uploadBase64,
        `chore(data): sincronizar ${item.remoteFilePath} via editor`
      );
      if (result.created) createdCount += 1;
      if (result.updated) updatedCount += 1;
      item.reference.uploadBase64 = "";
      item.reference.uploadMimeType = "";
      item.reference.uploadFileName = "";
      uploadedAssetsCount += 1;
    }

    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];
      setStatus(`Sincronizando no GitHub (${referenceUploads.length + index + 1}/${totalSteps}): ${item.remoteFilePath}`);
      const result = await upsertGithubJsonFile(config, item.remoteFilePath, item.payload);
      if (result.created) createdCount += 1;
      if (result.updated) updatedCount += 1;
      state.lastSyncedSignatures.set(item.signatureKey, item.signature);
    }

    setStatus(
      `Sincronização GitHub concluída: ${updatedCount} atualizado(s), ${createdCount} criado(s), ${uploadedAssetsCount} PDF(s) enviado(s).`
    );
    renderSubjectReferences();
    refreshPreviewAndValidation();
  } catch (error) {
    console.error(error);
    const message = String(error?.message || "Falha desconhecida na sincronização com GitHub.");
    window.alert(message);
    setStatus(`Falha na sincronização GitHub: ${message}`);
  } finally {
    if (dom.btnSyncGithub) {
      dom.btnSyncGithub.disabled = false;
    }
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
  state.activeTabSlug = getFirstTabInTree(incomingArea.assuntos[0]?.tabs)?.slug || "";

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
      TagRefMark,
      SanitizedPaste
    ],
    editorProps: {
      attributes: {
        class: "prescrever-editor"
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target instanceof Element ? event.target.closest("[data-tag-ref]") : null;
        const tagId = normalizeTagId(target?.getAttribute("data-tag-ref"));
        if (!tagId) {
          return false;
        }
        openTagMetaModal(tagId, target?.textContent || "Tag");
        return true;
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

  function normalizeDataBasePath(basePath) {
    return String(basePath || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");
  }

  function makeDataFileUrl(basePath, relativePath) {
    const safeBase = normalizeDataBasePath(basePath);
    const safeFile = String(relativePath || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");
    return `${safeBase}/${safeFile}`;
  }

  async function loadAreasFromIndexAtBase(basePath) {
    const safeBase = normalizeDataBasePath(basePath);
    if (!safeBase) {
      return [];
    }

    const response = await fetch(makeDataFileUrl(safeBase, "index.json"), { cache: "no-store" });
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
        const normalizedFile = String(file).replace(/^\/+/, "");
        const fileResponse = await fetch(makeDataFileUrl(safeBase, normalizedFile), { cache: "no-store" });
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
    const baseCandidates = [
      "../data",
      "./data",
      "../prescrever/data",
      "/prescrever/data",
      "/data"
    ];

    for (const basePath of baseCandidates) {
      try {
        const payloads = await loadAreasFromIndexAtBase(basePath);
        if (payloads.length) {
          return payloads;
        }
      } catch (error) {
        console.warn(`Falha ao carregar index.json em ${basePath}.`, error);
      }
    }

    return [];
  }

  try {
    const fromIndex = await loadAreasFromIndexFile();
    if (fromIndex.length) {
      return fromIndex;
    }
  } catch (error) {
    console.warn("Falha ao carregar index.json de /data.", error);
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
        status: SUBJECT_STATUS_BUILDING,
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
                  titulo: "Escolha uma das opções abaixo:",
                  sections: [
                    {
                      titulo: "",
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
                {
                  type: "add",
                  titulo: "Associar / adicionar",
                  sections: [
                    {
                      titulo: "",
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
  if (dom.btnRenameArea) {
    dom.btnRenameArea.addEventListener("click", renameArea);
  }
  if (dom.btnDeleteArea) {
    dom.btnDeleteArea.addEventListener("click", deleteArea);
  }
  dom.btnNewSubject.addEventListener("click", createSubject);
  if (dom.btnRenameSubject) {
    dom.btnRenameSubject.addEventListener("click", renameSubject);
  }
  if (dom.btnDeleteSubject) {
    dom.btnDeleteSubject.addEventListener("click", deleteSubject);
  }
  if (dom.btnToggleSubjectStatus) {
    dom.btnToggleSubjectStatus.addEventListener("click", toggleSubjectStatus);
  }
  dom.btnNewTab.addEventListener("click", createTab);
  if (dom.btnGroupTabs) {
    dom.btnGroupTabs.addEventListener("click", groupTabsIntoParent);
  }
  if (dom.btnNewChildTab) {
    dom.btnNewChildTab.addEventListener("click", createChildTab);
  }
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
  if (dom.subjectMetaReviewed) {
    dom.subjectMetaReviewed.addEventListener("change", () => {
      persistSubjectMetaFromUI();
      refreshPreviewAndValidation();
    });
  }
  if (dom.btnAddSubjectReferenceLink) {
    dom.btnAddSubjectReferenceLink.addEventListener("click", addSubjectReferenceLink);
  }
  if (dom.btnAddSubjectReferencePdf) {
    dom.btnAddSubjectReferencePdf.addEventListener("click", () => queueSubjectReferencePdfUpload(""));
  }
  if (dom.subjectReferencePdfInput) {
    dom.subjectReferencePdfInput.addEventListener("change", handleSubjectReferencePdfSelection);
  }

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
  if (dom.btnTagMetaClose) {
    dom.btnTagMetaClose.addEventListener("click", () => closeTagMetaModal());
  }
  if (dom.btnTagMetaSave) {
    dom.btnTagMetaSave.addEventListener("click", saveTagMetaFromModal);
  }
  if (dom.btnTagMetaDelete) {
    dom.btnTagMetaDelete.addEventListener("click", deleteTagMetaFromModal);
  }
  if (dom.tagMetaModal) {
    dom.tagMetaModal.addEventListener("click", (event) => {
      if (event.target === dom.tagMetaModal) {
        closeTagMetaModal();
      }
    });
  }
  if (dom.tagMetaContent) {
    dom.tagMetaContent.addEventListener("paste", handleTagMetaPaste);
    dom.tagMetaContent.addEventListener("keydown", handleTagMetaKeydown);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dom.itemMetaModal.hidden) {
      closeItemMetaModal();
      return;
    }
    if (event.key === "Escape" && dom.tagMetaModal && !dom.tagMetaModal.hidden) {
      closeTagMetaModal();
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
  if (dom.btnCreateTag) {
    dom.btnCreateTag.addEventListener("click", createTagFromSelection);
  }
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
  if (dom.btnSyncGithub) {
    dom.btnSyncGithub.addEventListener("click", syncGithubJsonFiles);
  }
  if (dom.btnLinkDataFolder) {
    dom.btnLinkDataFolder.addEventListener("click", linkDataFolder);
  }
  [dom.ghOwner, dom.ghRepo, dom.ghBranch, dom.ghDataPath]
    .filter(Boolean)
    .forEach((input) => {
      input.addEventListener("input", persistGithubConfigInputs);
    });
  dom.btnDownloadArea.addEventListener("click", downloadActiveArea);
  dom.btnExportTab.addEventListener("click", exportCurrentTab);
  dom.btnCopyPreview.addEventListener("click", copyPreview);
}

async function bootstrap() {
  initEditor();
  bindEvents();
  applyGithubConfigToInputs(loadStoredGithubConfig());

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


