import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
const projectRoot = process.cwd();
const dataDir = path.join(projectRoot, "data");
const protocolsFile = path.join(dataDir, "protocols.json");
const protocolsBackupFile = `${protocolsFile}.bak`;
const port = Number(process.env.PORT || 3e3);
const host = process.env.HOST || "127.0.0.1";
const isProduction = process.env.NODE_ENV === "production";
let cachedProtocols = null;
let cachedProtocolsMtimeMs = 0;
let protocolWriteQueue = Promise.resolve();
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
const ensureDataFile = async () => {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(protocolsFile);
  } catch {
    await fs.writeFile(protocolsFile, "[]\n", "utf8");
  }
};
const readProtocols = async () => {
  await ensureDataFile();
  const stats = await fs.stat(protocolsFile);
  if (cachedProtocols && cachedProtocolsMtimeMs === stats.mtimeMs) {
    return cloneProtocols(cachedProtocols);
  }
  const content = await fs.readFile(protocolsFile, "utf8");
  const parsed = JSON.parse(content || "[]");
  if (!Array.isArray(parsed)) {
    throw new Error("data/protocols.json precisa conter uma lista de protocolos.");
  }
  const protocols = parsed.map(normalizeProtocol);
  cachedProtocols = cloneProtocols(protocols);
  cachedProtocolsMtimeMs = stats.mtimeMs;
  return cloneProtocols(protocols);
};
const writeProtocols = async (protocols) => {
  await ensureDataFile();
  const tmpFile = `${protocolsFile}.tmp`;
  const normalizedProtocols = protocols.map(normalizeProtocol);
  const content = `${JSON.stringify(normalizedProtocols, null, 2)}
`;
  await fs.writeFile(tmpFile, content, "utf8");
  await fs.copyFile(protocolsFile, protocolsBackupFile);
  await fs.rename(tmpFile, protocolsFile);
  const stats = await fs.stat(protocolsFile);
  cachedProtocols = cloneProtocols(normalizedProtocols);
  cachedProtocolsMtimeMs = stats.mtimeMs;
};
const updateProtocols = async (updater) => {
  const operation = protocolWriteQueue.then(async () => {
    const currentProtocols = await readProtocols();
    const { protocols, result } = await updater(currentProtocols);
    await writeProtocols(protocols);
    return result;
  });
  protocolWriteQueue = operation.then(
    () => void 0,
    () => void 0
  );
  return operation;
};
const createEntityId = (prefix) => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};
const createProtocolId = () => createEntityId("protocol");
const normalizeProtocol = (value) => {
  const protocol = isObject(value) ? value : {};
  return {
    id: toText(protocol.id) || createProtocolId(),
    name: toText(protocol.name),
    category: toText(protocol.category),
    diagnostico: normalizeDiagnostico(protocol.diagnostico),
    exames: normalizeExames(protocol.exames),
    orientacoes: normalizeOrientacoes(protocol.orientacoes),
    prescricao: normalizePrescricao(protocol.prescricao),
    metas: normalizeMetas(protocol.metas)
  };
};
const isObject = (value) => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};
const toText = (value) => {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
};
const toTextList = (value, filterEmpty = true) => {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : [];
  const normalizedValues = values.map(toText);
  return filterEmpty ? normalizedValues.filter(Boolean) : normalizedValues;
};
const normalizeDiagnostico = (value) => {
  const diagnostico = isObject(value) ? value : {};
  const highlight = isObject(diagnostico.highlight) ? diagnostico.highlight : null;
  const classification = isObject(diagnostico.classification) ? diagnostico.classification : null;
  const blocks = Array.isArray(diagnostico.blocks) ? diagnostico.blocks.map(normalizeDiagnosticBlock).filter((block) => Boolean(block)) : [];
  const normalized = {
    criteria: toText(diagnostico.criteria)
  };
  if (highlight) {
    const title = toText(highlight.title);
    const content = toText(highlight.content);
    if (title || content) {
      normalized.highlight = { title, content };
    }
  }
  if (classification) {
    const headers = toTextList(classification.headers, false);
    const rows = Array.isArray(classification.rows) ? classification.rows.map((row) => normalizeClassificationRow(row, headers.length || 3)).filter((row) => row.cells.some(Boolean)) : [];
    const title = toText(classification.title);
    if (title || headers.some(Boolean) || rows.length > 0) {
      normalized.classification = { title, headers, rows };
    }
  }
  if (blocks.length > 0) {
    normalized.blocks = blocks;
  }
  return normalized;
};
const normalizeClassificationRow = (value, columnCount = 0) => {
  const row = isObject(value) ? value : {};
  const legacyCells = [row.category, row.sistolica, row.diastolica].filter((item) => item !== void 0);
  const cells = (Array.isArray(row.cells) ? row.cells : legacyCells).map(toText);
  while (columnCount > 0 && cells.length < columnCount) {
    cells.push("");
  }
  const normalized = {
    cells: columnCount > 0 ? cells.slice(0, columnCount) : cells
  };
  if (row.isHighlight === true) {
    normalized.isHighlight = true;
  }
  return normalized;
};
const normalizeDiagnosticBlock = (value) => {
  const block = isObject(value) ? value : {};
  const type = toText(block.type);
  if (!["criteria", "quote", "table", "text", "resource"].includes(type)) {
    return null;
  }
  if (type === "resource") {
    const resource = normalizeClinicalResourceForStorage(block.resource);
    if (!resource) {
      return null;
    }
    return {
      id: toText(block.id) || createEntityId("diag"),
      type,
      resource
    };
  }
  if (type === "table") {
    const table = isObject(block.table) ? block.table : {};
    const headers = toTextList(table.headers, false).filter(Boolean);
    const rows = Array.isArray(table.rows) ? table.rows.map((row) => normalizeClassificationRow(row, headers.length)).filter((row) => row.cells.some(Boolean)) : [];
    if (!toText(block.title) && headers.length === 0 && rows.length === 0) {
      return null;
    }
    return {
      id: toText(block.id) || createEntityId("diag"),
      type,
      title: toText(block.title),
      table: { headers, rows }
    };
  }
  const title = toText(block.title);
  const content = toText(block.content);
  if (!title && !content) {
    return null;
  }
  return {
    id: toText(block.id) || createEntityId("diag"),
    type,
    ...title ? { title } : {},
    content
  };
};
const normalizeClinicalResourceForStorage = (value) => {
  const resource = isObject(value) ? structuredClone(value) : null;
  if (!resource) {
    return null;
  }
  const rawMode = toText(resource.mode);
  const mode = rawMode === "classification" ? "direct_classification" : rawMode === "direct" ? "direct_classification" : rawMode === "link" ? "external_link" : rawMode;
  if (![
    "external_link",
    "sum_points",
    "formula",
    "direct_classification",
    "classification_scale",
    "rule_based"
  ].includes(mode)) {
    return null;
  }
  const title = toText(resource.title);
  if (!title) {
    return null;
  }
  return {
    ...resource,
    schemaVersion: toText(resource.schemaVersion) || "1",
    type: "clinical_resource",
    id: toText(resource.id) || createEntityId("resource"),
    title,
    mode
  };
};
const normalizeExames = (value) => {
  const exames = isObject(value) ? value : {};
  const normalized = {
    blocks: Array.isArray(exames.blocks) ? exames.blocks.map(normalizeExamBlock).filter((block) => block.title || block.subtitle || block.sequences.length > 0) : []
  };
  const observations = toText(exames.observations);
  if (observations) {
    normalized.observations = observations;
  }
  return normalized;
};
const normalizeExamBlock = (value) => {
  const block = isObject(value) ? value : {};
  const normalized = {
    title: toText(block.title),
    sequences: Array.isArray(block.sequences) ? block.sequences.map(normalizeExamSequence).filter((sequence) => sequence.name || sequence.exams.length > 0) : []
  };
  const subtitle = toText(block.subtitle);
  if (subtitle) {
    normalized.subtitle = subtitle;
  }
  return normalized;
};
const normalizeExamSequence = (value) => {
  const sequence = isObject(value) ? value : {};
  const exams = toTextList(sequence.exams);
  const rawNotes = isObject(sequence.examNotes) ? sequence.examNotes : {};
  const examNotes = Object.fromEntries(
    exams.map((exam) => [exam, toText(rawNotes[exam])]).filter(([, note]) => Boolean(note))
  );
  return {
    name: toText(sequence.name),
    exams,
    ...Object.keys(examNotes).length > 0 ? { examNotes } : {}
  };
};
const normalizeOrientacoes = (value) => {
  const orientacoes = isObject(value) ? value : {};
  return {
    blocks: Array.isArray(orientacoes.blocks) ? orientacoes.blocks.map(normalizeOrientationBlock).filter((block) => block.title || block.items.length > 0) : []
  };
};
const normalizeOrientationBlock = (value) => {
  const block = isObject(value) ? value : {};
  return {
    title: toText(block.title),
    items: toTextList(block.items)
  };
};
const normalizePrescricao = (value) => {
  const prescricao = isObject(value) ? value : {};
  return {
    items: Array.isArray(prescricao.items) ? prescricao.items.map(normalizePrescriptionItem) : [],
    sections: Array.isArray(prescricao.sections) ? prescricao.sections.map(normalizePrescriptionSection).filter(hasPrescriptionSectionContent) : []
  };
};
const normalizePrescriptionItem = (value) => {
  const item = isObject(value) ? value : {};
  const orientations = isObject(item.orientations) ? item.orientations : {};
  return {
    drug: toText(item.drug),
    dose: toText(item.dose),
    presentation: toText(item.presentation),
    posology: toText(item.posology),
    orientations: {
      cuidados: toText(orientations.cuidados),
      contraindicacoes: toText(orientations.contraindicacoes),
      sus: toText(orientations.sus),
      gerais: toText(orientations.gerais)
    }
  };
};
const normalizePrescriptionSection = (value) => {
  const section = isObject(value) ? value : {};
  return {
    id: toText(section.id) || createEntityId("sec"),
    title: toText(section.title),
    items: Array.isArray(section.items) ? section.items.map(normalizePrescriptionItem) : [],
    sections: Array.isArray(section.sections) ? section.sections.map(normalizePrescriptionSection).filter(hasPrescriptionSectionContent) : []
  };
};
const hasPrescriptionSectionContent = (section) => {
  return Boolean(section.title || section.items.length > 0 || (section.sections || []).length > 0);
};
const normalizeMetas = (value) => {
  const metas = isObject(value) ? value : {};
  return {
    blocks: Array.isArray(metas.blocks) ? metas.blocks.map(normalizeMetaBlock).filter((block) => block.title || hasMetaContent(block.content) || block.table) : []
  };
};
const normalizeMetaBlock = (value) => {
  const block = isObject(value) ? value : {};
  const content = Array.isArray(block.content) ? toTextList(block.content) : toText(block.content);
  const normalized = {
    title: toText(block.title),
    content
  };
  const table = isObject(block.table) ? block.table : null;
  if (table) {
    const headers = toTextList(table.headers, false);
    const rows = Array.isArray(table.rows) ? table.rows.filter(Array.isArray).map((row) => row.map(toText)).filter((row) => row.some(Boolean)) : [];
    if (headers.some(Boolean) || rows.length > 0) {
      normalized.table = { headers, rows };
    }
  }
  return normalized;
};
const hasMetaContent = (content) => {
  return Array.isArray(content) ? content.length > 0 : Boolean(content);
};
const cloneProtocol = (protocol) => {
  return {
    ...protocol,
    diagnostico: structuredClone(protocol.diagnostico),
    exames: structuredClone(protocol.exames),
    orientacoes: structuredClone(protocol.orientacoes),
    prescricao: structuredClone(protocol.prescricao),
    metas: structuredClone(protocol.metas)
  };
};
const cloneProtocols = (protocols) => protocols.map(cloneProtocol);
const sendProtocols = async (res) => {
  await protocolWriteQueue;
  const protocols = await readProtocols();
  res.json(protocols);
};
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.get("/api/protocols", async (_req, res) => {
  try {
    await sendProtocols(res);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error) });
  }
});
app.post("/api/protocols", async (req, res) => {
  try {
    const result = await updateProtocols((protocols) => {
      const protocol = normalizeProtocol(req.body || {});
      if (!protocol.name) {
        throw new ClientError("Informe o nome do protocolo.");
      }
      const nextProtocols = [...protocols, protocol];
      return { protocols: nextProtocols, result: { protocol, protocols: nextProtocols } };
    });
    res.status(201).json(result);
  } catch (error) {
    sendError(res, error);
  }
});
app.put("/api/protocols", async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      res.status(400).json({ error: "Envie uma lista de protocolos." });
      return;
    }
    const protocols = await updateProtocols(() => {
      const nextProtocols = req.body.map(normalizeProtocol);
      return { protocols: nextProtocols, result: nextProtocols };
    });
    res.json(protocols);
  } catch (error) {
    sendError(res, error);
  }
});
app.put("/api/protocols/:id", async (req, res) => {
  try {
    const result = await updateProtocols((protocols) => {
      const protocol = normalizeProtocol({ ...isObject(req.body) ? req.body : {}, id: req.params.id });
      const index = protocols.findIndex((item) => item.id === req.params.id);
      if (!protocol.name) {
        throw new ClientError("Informe o nome do protocolo.");
      }
      const nextProtocols = [...protocols];
      if (index === -1) {
        nextProtocols.push(protocol);
      } else {
        nextProtocols[index] = protocol;
      }
      return { protocols: nextProtocols, result: { protocol, protocols: nextProtocols } };
    });
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});
app.delete("/api/protocols/:id", async (req, res) => {
  try {
    const result = await updateProtocols((protocols) => {
      const nextProtocols = protocols.filter((item) => item.id !== req.params.id);
      return { protocols: nextProtocols, result: { protocols: nextProtocols } };
    });
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});
if (isProduction) {
  const distDir = path.join(projectRoot, "dist");
  app.use("/assets", express.static(path.join(distDir, "assets"), {
    immutable: true,
    maxAge: "1y"
  }));
  app.use(express.static(distDir, {
    index: false,
    maxAge: "1h"
  }));
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: projectRoot,
    appType: "spa",
    server: {
      middlewareMode: true,
      hmr: process.env.DISABLE_HMR !== "true"
    }
  });
  app.use(vite.middlewares);
}
app.listen(port, host, () => {
  console.log(`UsoJaleco rodando em http://${host}:${port}/`);
  console.log(`Protocolos: ${path.relative(projectRoot, protocolsFile)}`);
});
class ClientError extends Error {
  constructor() {
    super(...arguments);
    this.status = 400;
  }
}
const sendError = (res, error) => {
  const status = error instanceof ClientError ? error.status : 500;
  res.status(status).json({ error: getErrorMessage(error) });
};
const getErrorMessage = (error) => {
  return error instanceof Error ? error.message : "Erro inesperado.";
};
