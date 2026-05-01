/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Search, 
  X, 
  Clipboard, 
  Check, 
  Activity, 
  Stethoscope, 
  FileText, 
  Pill, 
  Target,
  ChevronRight,
  Info
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  ClinicalResourceEditor,
  ClinicalResourceRenderer,
  createEmptyClinicalResource,
  getClinicalResourceErrors,
  normalizeClinicalResource,
  parseClinicalResourceJson,
  type ClinicalResource,
  type ClinicalResourceEditorMode
} from '@/src/clinicalResource';

// --- Types ---

type TabType = 'Diagnóstico' | 'Exames' | 'Orientações' | 'Prescrição' | 'Metas terapêuticas';
type ViewType = 'home' | 'management';

const PROTOCOL_TABS: TabType[] = ['Diagnóstico', 'Exames', 'Orientações', 'Prescrição', 'Metas terapêuticas'];

interface ClassificationRow {
  cells: string[];
  isHighlight?: boolean;
}

interface ExamSequence {
  name: string;
  exams: string[];
  examNotes?: Record<string, string>;
}

interface ExamBlock {
  title: string;
  subtitle?: string;
  sequences: ExamSequence[];
}

interface PrescriptionItem {
  drug: string;
  dose: string;
  presentation: string;
  posology: string;
  orientations?: {
    cuidados?: string;
    contraindicacoes?: string;
    sus?: string;
    gerais?: string;
  };
}

interface PrescriptionSection {
  id: string;
  title: string;
  items: PrescriptionItem[];
  sections?: PrescriptionSection[];
}

interface MetaBlock {
  title: string;
  content: string | string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
}

type DiagnosticBlockType = 'criteria' | 'quote' | 'table' | 'text' | 'resource';

interface DiagnosticBlock {
  id: string;
  type: DiagnosticBlockType;
  title?: string;
  content?: string;
  table?: {
    headers: string[];
    rows: ClassificationRow[];
  };
  resource?: ClinicalResource;
  resourceEditorMode?: ClinicalResourceEditorMode;
  resourceJsonDraft?: string;
  resourceValidationError?: string;
}

interface Pathology {
  id: string;
  name: string;
  category: string;
  diagnostico: {
    criteria: string;
    highlight?: {
      title: string;
      content: string;
    };
    classification?: {
      title: string;
      headers: string[];
      rows: ClassificationRow[];
    };
    blocks?: DiagnosticBlock[];
  };
  exames: {
    blocks: ExamBlock[];
    observations?: string;
  };
  orientacoes: {
    blocks: { title: string; items: string[] }[];
  };
  prescricao: {
    items: PrescriptionItem[];
    sections?: PrescriptionSection[];
  };
  metas: {
    blocks: MetaBlock[];
  };
}

// --- Data API ---

const LEGACY_PATHOLOGIES_STORAGE_KEY = 'usojaleco.pathologies.v1';
const PRESCRIPTION_PRESENTATION_OPTIONS = ['CONTÍNUO', '01 CAIXA'];

const normalizeSearchText = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const copyToClipboard = (text: string) => {
  void navigator.clipboard?.writeText(text).catch(() => undefined);
};

const requestJson = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Nao foi possivel salvar os protocolos.');
  }

  return data as T;
};

const loadPathologiesFromData = () => requestJson<Pathology[]>('/api/protocols');

const replacePathologiesInData = (pathologies: Pathology[]) => {
  return requestJson<Pathology[]>('/api/protocols', {
    method: 'PUT',
    body: JSON.stringify(pathologies),
  });
};

const savePathologyInData = async (pathology: Pathology, isEditing: boolean) => {
  const result = await requestJson<{ protocols: Pathology[] }>(
    isEditing ? `/api/protocols/${encodeURIComponent(pathology.id)}` : '/api/protocols',
    {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(pathology),
    }
  );

  return result.protocols;
};

const deletePathologyFromData = async (id: string) => {
  const result = await requestJson<{ protocols: Pathology[] }>(
    `/api/protocols/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );

  return result.protocols;
};

const loadLegacyBrowserPathologies = (): Pathology[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(LEGACY_PATHOLOGIES_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed as Pathology[] : [];
  } catch {
    return [];
  }
};

const clearLegacyBrowserPathologies = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(LEGACY_PATHOLOGIES_STORAGE_KEY);
  }
};

const mergePathologies = (base: Pathology[], incoming: Pathology[]) => {
  const byId = new Map(base.map((pathology) => [pathology.id, pathology]));

  incoming.forEach((pathology) => {
    byId.set(pathology.id, pathology);
  });

  return Array.from(byId.values());
};

const hasMedicationOrientations = (
  orientations?: PrescriptionItem['orientations']
): orientations is NonNullable<PrescriptionItem['orientations']> => {
  return Boolean(
    orientations?.cuidados ||
    orientations?.contraindicacoes ||
    orientations?.sus ||
    orientations?.gerais
  );
};

const hasDisplayText = (value?: string) => Boolean(value?.trim());

const hasDiagnosticBlockDisplayContent = (block: DiagnosticBlock) => {
  if (block.type === 'resource') {
    return Boolean(normalizeClinicalResource(block.resource));
  }

  if (block.type === 'table') {
    return Boolean(
      block.table?.rows?.some(row => row.cells.some(hasDisplayText))
    );
  }

  return Boolean(hasDisplayText(block.title) || hasDisplayText(block.content));
};

const hasExamSequenceDisplayContent = (sequence: ExamSequence) => {
  return sequence.exams.some(hasDisplayText);
};

const hasExamBlockDisplayContent = (block: ExamBlock) => {
  return block.sequences.some(hasExamSequenceDisplayContent);
};

const hasExamsDisplayContent = (exames: Pathology['exames']) => {
  return Boolean(
    exames.blocks.some(hasExamBlockDisplayContent) ||
    hasDisplayText(exames.observations)
  );
};

const hasOrientationBlockDisplayContent = (block: { title: string; items: string[] }) => {
  return block.items.some(hasDisplayText);
};

const hasOrientationsDisplayContent = (orientacoes: Pathology['orientacoes']) => {
  return orientacoes.blocks.some(hasOrientationBlockDisplayContent);
};

const hasPrescriptionItemDisplayContent = (item: PrescriptionItem) => {
  return Boolean(
    hasDisplayText(item.drug) ||
    hasDisplayText(item.dose) ||
    hasDisplayText(item.presentation) ||
    hasDisplayText(item.posology) ||
    hasMedicationOrientations(item.orientations)
  );
};

const hasPrescriptionSectionDisplayContent = (section: PrescriptionSection): boolean => {
  return Boolean(
    (section.items || []).some(hasPrescriptionItemDisplayContent) ||
    (section.sections || []).some(hasPrescriptionSectionDisplayContent)
  );
};

const hasPrescriptionDisplayContent = (prescricao: Pathology['prescricao']) => {
  return Boolean(
    (prescricao.items || []).some(hasPrescriptionItemDisplayContent) ||
    (prescricao.sections || []).some(hasPrescriptionSectionDisplayContent)
  );
};

const getDisplayPrescriptionSections = (sections: PrescriptionSection[] = []): PrescriptionSection[] => {
  return sections
    .filter(hasPrescriptionSectionDisplayContent)
    .map(section => ({
      ...section,
      items: (section.items || []).filter(hasPrescriptionItemDisplayContent),
      sections: getDisplayPrescriptionSections(section.sections || [])
    }));
};

const getDisplayPrescription = (prescricao: Pathology['prescricao']): Pathology['prescricao'] => ({
  items: (prescricao.items || []).filter(hasPrescriptionItemDisplayContent),
  sections: getDisplayPrescriptionSections(prescricao.sections || [])
});

const hasMetaTableDisplayContent = (table?: MetaBlock['table']) => {
  return Boolean(table?.rows?.some(row => row.some(hasDisplayText)));
};

const hasMetaBlockDisplayContent = (block: MetaBlock) => {
  const hasContent = Array.isArray(block.content)
    ? block.content.some(hasDisplayText)
    : hasDisplayText(block.content);

  return Boolean(hasContent || hasMetaTableDisplayContent(block.table));
};

const hasMetasDisplayContent = (metas: Pathology['metas']) => {
  return metas.blocks.some(hasMetaBlockDisplayContent);
};

const getAvailableProtocolTabs = (pathology: Pathology): TabType[] => {
  const diagnosticBlocks = getDiagnosticBlocks(pathology.diagnostico);

  return PROTOCOL_TABS.filter((tab) => {
    switch (tab) {
      case 'Diagnóstico':
        return diagnosticBlocks.some(hasDiagnosticBlockDisplayContent);
      case 'Exames':
        return hasExamsDisplayContent(pathology.exames);
      case 'Orientações':
        return hasOrientationsDisplayContent(pathology.orientacoes);
      case 'Prescrição':
        return hasPrescriptionDisplayContent(pathology.prescricao);
      case 'Metas terapêuticas':
        return hasMetasDisplayContent(pathology.metas);
    }
  });
};

const createEmptyPrescriptionItem = (): PrescriptionItem => ({
  drug: '',
  dose: '',
  presentation: '',
  posology: '',
  orientations: {
    cuidados: '',
    contraindicacoes: '',
    sus: '',
    gerais: ''
  }
});

const createPrescriptionSectionId = () => {
  return `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const createEmptyPrescriptionSection = (): PrescriptionSection => ({
  id: createPrescriptionSectionId(),
  title: '',
  items: [],
  sections: []
});

const TREATMENT_LINE_SECTION_OPTIONS = [
  'Tratamento de primeira linha',
  'Tratamento de segunda linha',
  'Tratamento de terceira linha',
  'Tratamento de quarta linha',
  'Tratamento de quinta linha'
];

const showSectionTitleOptions = (input: HTMLInputElement) => {
  const showPicker = (input as HTMLInputElement & { showPicker?: () => void }).showPicker;

  if (!input.list || !showPicker) {
    return;
  }

  try {
    showPicker.call(input);
  } catch {
    return;
  }
};

const normalizePrescriptionForForm = (prescricao: Pathology['prescricao']): Pathology['prescricao'] => {
  const rootItems = prescricao.items || [];
  const sections = prescricao.sections || [];

  if (rootItems.length === 0) {
    return {
      ...prescricao,
      items: [],
      sections
    };
  }

  return {
    ...prescricao,
    items: [],
    sections: [
      {
        id: createPrescriptionSectionId(),
        title: 'Prescrição geral',
        items: rootItems,
        sections: []
      },
      ...sections
    ]
  };
};

const normalizePathologyForForm = (pathology: Pathology): Pathology => ({
  ...pathology,
  diagnostico: normalizeDiagnosticoForForm(pathology.diagnostico),
  prescricao: normalizePrescriptionForForm(pathology.prescricao)
});

const cleanTextList = (items: string[]) => {
  return items.map(item => item.trim()).filter(Boolean);
};

const createEntityId = (prefix: string) => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const createDiagnosticBlock = (type: DiagnosticBlockType): DiagnosticBlock => {
  if (type === 'table') {
    return {
      id: createEntityId('diag'),
      type,
      title: '',
      table: {
        headers: ['Coluna 1', 'Coluna 2'],
        rows: [{ cells: ['', ''] }]
      }
    };
  }

  if (type === 'resource') {
    return {
      id: createEntityId('diag'),
      type,
      resourceEditorMode: 'external_link',
      resource: createEmptyClinicalResource('external_link')
    };
  }

  return {
    id: createEntityId('diag'),
    type,
    title: type === 'quote' ? '' : undefined,
    content: ''
  };
};

const normalizeClassificationRowForForm = (
  row: ClassificationRow | (ClassificationRow & { category?: string; sistolica?: string; diastolica?: string }),
  columnCount: number
): ClassificationRow => {
  const legacyRow = row as ClassificationRow & { category?: string; sistolica?: string; diastolica?: string };
  const legacyCells = [legacyRow.category, legacyRow.sistolica, legacyRow.diastolica].filter(value => value !== undefined) as string[];
  const cells = (Array.isArray(row.cells) ? row.cells : legacyCells).slice(0, columnCount);

  while (cells.length < columnCount) {
    cells.push('');
  }

  return {
    cells,
    ...(row.isHighlight ? { isHighlight: true } : {})
  };
};

const normalizeDiagnosticBlockForForm = (block: DiagnosticBlock): DiagnosticBlock => {
  if (block.type === 'resource') {
    return {
      id: block.id || createEntityId('diag'),
      type: 'resource',
      resource: normalizeClinicalResource(block.resource) || createEmptyClinicalResource('external_link'),
      resourceEditorMode: block.resourceEditorMode || 'external_link',
      resourceJsonDraft: block.resourceJsonDraft,
      resourceValidationError: block.resourceValidationError
    };
  }

  if (block.type !== 'table') {
    return {
      id: block.id || createEntityId('diag'),
      type: block.type,
      title: block.title || undefined,
      content: block.content || ''
    };
  }

  const headers = block.table?.headers?.length ? block.table.headers : ['Coluna 1', 'Coluna 2'];

  return {
    id: block.id || createEntityId('diag'),
    type: 'table',
    title: block.title || '',
    table: {
      headers,
      rows: (block.table?.rows || []).map(row => normalizeClassificationRowForForm(row, headers.length))
    }
  };
};

const normalizeDiagnosticBlockForSave = (block: DiagnosticBlock): DiagnosticBlock | null => {
  if (block.type === 'resource') {
    const resourceValidation = block.resourceJsonDraft
      ? parseClinicalResourceJson(block.resourceJsonDraft)
      : { resource: normalizeClinicalResource(block.resource), errors: getClinicalResourceErrors(block.resource) };

    if (!resourceValidation.resource || resourceValidation.errors.length > 0) {
      return null;
    }

    return {
      id: block.id || createEntityId('diag'),
      type: 'resource',
      resource: resourceValidation.resource
    };
  }

  if (block.type === 'table') {
    const headers = (block.table?.headers || []).map(header => header.trim()).filter(Boolean);
    const rows = (block.table?.rows || [])
      .map(row => ({
        cells: row.cells.slice(0, headers.length).map(cell => cell.trim()),
        ...(row.isHighlight ? { isHighlight: true } : {})
      }))
      .filter(row => row.cells.some(Boolean));

    if (!block.title?.trim() && headers.length === 0 && rows.length === 0) {
      return null;
    }

    return {
      id: block.id || createEntityId('diag'),
      type: 'table',
      title: block.title?.trim() || '',
      table: { headers, rows }
    };
  }

  const content = block.content?.trim() || '';
  const title = block.title?.trim();

  if (!content && !title) {
    return null;
  }

  return {
    id: block.id || createEntityId('diag'),
    type: block.type,
    ...(title ? { title } : {}),
    content
  };
};

const getDiagnosticBlocks = (diagnostico: Pathology['diagnostico']): DiagnosticBlock[] => {
  if (diagnostico.blocks?.length) {
    return diagnostico.blocks.map(normalizeDiagnosticBlockForForm);
  }

  const blocks: DiagnosticBlock[] = [];

  if (diagnostico.criteria) {
    blocks.push({
      id: createEntityId('diag'),
      type: 'criteria',
      content: diagnostico.criteria
    });
  }

  if (diagnostico.highlight?.title || diagnostico.highlight?.content) {
    blocks.push({
      id: createEntityId('diag'),
      type: 'quote',
      title: diagnostico.highlight?.title || '',
      content: diagnostico.highlight?.content || ''
    });
  }

  if (diagnostico.classification) {
    blocks.push({
      id: createEntityId('diag'),
      type: 'table',
      title: diagnostico.classification.title,
      table: {
        headers: diagnostico.classification.headers,
        rows: diagnostico.classification.rows.map(row => normalizeClassificationRowForForm(row, diagnostico.classification!.headers.length))
      }
    });
  }

  return blocks;
};

const normalizeDiagnosticoForForm = (diagnostico: Pathology['diagnostico']): Pathology['diagnostico'] => ({
  ...diagnostico,
  blocks: getDiagnosticBlocks(diagnostico)
});

const buildLegacyDiagnosticoFields = (blocks: DiagnosticBlock[]): Pick<Pathology['diagnostico'], 'criteria' | 'highlight' | 'classification'> => {
  const firstCriteria = blocks.find(block => block.type === 'criteria' || block.type === 'text');
  const firstQuote = blocks.find(block => block.type === 'quote');
  const firstTable = blocks.find(block => block.type === 'table');

  return {
    criteria: firstCriteria?.content || '',
    highlight: firstQuote
      ? {
          title: firstQuote.title || '',
          content: firstQuote.content || ''
        }
      : undefined,
    classification: firstTable?.table
      ? {
          title: firstTable.title || '',
          headers: firstTable.table.headers,
          rows: firstTable.table.rows
        }
      : undefined
  };
};

const getDiagnosticResourceValidationErrors = (blocks: DiagnosticBlock[]) => {
  return blocks.flatMap((block, blockIndex) => {
    if (block.type !== 'resource') return [];

    const validation = block.resourceJsonDraft
      ? parseClinicalResourceJson(block.resourceJsonDraft)
      : { errors: getClinicalResourceErrors(block.resource) };

    return validation.errors.map(error => `Escore / Calculadora / Link ${blockIndex + 1}: ${error}`);
  });
};

const normalizePrescriptionItemForSave = (item: PrescriptionItem): PrescriptionItem => ({
  ...item,
  drug: item.drug.trim(),
  dose: item.dose.trim(),
  presentation: item.presentation.trim(),
  posology: item.posology.trim(),
  orientations: item.orientations
    ? {
        cuidados: item.orientations.cuidados?.trim() || '',
        contraindicacoes: item.orientations.contraindicacoes?.trim() || '',
        sus: item.orientations.sus?.trim() || '',
        gerais: item.orientations.gerais?.trim() || ''
      }
    : undefined
});

const normalizePrescriptionSectionForSave = (section: PrescriptionSection): PrescriptionSection => ({
  ...section,
  title: section.title.trim(),
  items: (section.items || []).map(normalizePrescriptionItemForSave),
  sections: (section.sections || [])
    .map(normalizePrescriptionSectionForSave)
    .filter(childSection => (
      childSection.title ||
      childSection.items.length > 0 ||
      (childSection.sections || []).length > 0
    ))
});

const normalizePathologyForSave = (pathology: Pathology): Pathology => {
  const normalized = normalizePathologyForForm(pathology);
  const diagnosticBlocks = (normalized.diagnostico.blocks || [])
    .map(normalizeDiagnosticBlockForSave)
    .filter((block): block is DiagnosticBlock => Boolean(block));
  const legacyDiagnostico = buildLegacyDiagnosticoFields(diagnosticBlocks);

  return {
    ...normalized,
    name: normalized.name.trim(),
    category: normalized.category.trim(),
    diagnostico: {
      ...normalized.diagnostico,
      ...legacyDiagnostico,
      blocks: diagnosticBlocks
    },
    exames: {
      ...normalized.exames,
      blocks: normalized.exames.blocks
        .map(block => ({
          ...block,
          title: block.title.trim(),
          subtitle: block.subtitle?.trim(),
          sequences: block.sequences
            .map(sequence => ({
              ...sequence,
              name: sequence.name.trim(),
              exams: cleanTextList(sequence.exams),
              examNotes: Object.fromEntries(
                cleanTextList(sequence.exams)
                  .map(exam => [exam, sequence.examNotes?.[exam]?.trim() || ''])
                  .filter(([, note]) => Boolean(note))
              )
            }))
            .filter(sequence => sequence.name || sequence.exams.length > 0)
        }))
        .filter(block => block.title || block.subtitle || block.sequences.length > 0),
      observations: normalized.exames.observations?.trim()
    },
    orientacoes: {
      blocks: normalized.orientacoes.blocks
        .map(block => ({
          title: block.title.trim(),
          items: cleanTextList(block.items)
        }))
        .filter(block => block.title || block.items.length > 0)
    },
    prescricao: {
      items: normalized.prescricao.items.map(normalizePrescriptionItemForSave),
      sections: (normalized.prescricao.sections || [])
        .map(normalizePrescriptionSectionForSave)
        .filter(section => (
          section.title ||
          section.items.length > 0 ||
          (section.sections || []).length > 0
        ))
    },
    metas: {
      blocks: normalized.metas.blocks
        .map(block => ({
          ...block,
          title: block.title.trim(),
          content: Array.isArray(block.content)
            ? cleanTextList(block.content)
            : block.content.trim()
        }))
        .filter(block => block.title || (Array.isArray(block.content) ? block.content.length > 0 : block.content) || block.table)
    }
  };
};

interface PrescriptionEntry {
  key: string;
  item: PrescriptionItem;
  sectionPath: string[];
}

interface ExamEntry {
  key: string;
  blockTitle: string;
  sequence: ExamSequence;
}

const flattenExamEntries = (exames: Pathology['exames']): ExamEntry[] => {
  return (exames.blocks || []).flatMap((block, blockIndex) => {
    return (block.sequences || []).map((sequence, sequenceIndex) => ({
      key: `block-${blockIndex}-sequence-${sequenceIndex}`,
      blockTitle: block.title,
      sequence
    }));
  });
};

const formatExamEntry = (entry: ExamEntry) => {
  const title = [entry.blockTitle, entry.sequence.name].filter(Boolean).join(' - ');
  const exams = entry.sequence.exams.join(', ');
  return title ? `${title}\n${exams}` : exams;
};

const formatExams = (exames: Pathology['exames']) => {
  const blocks = (exames.blocks || []).map(block => {
    const lines = [block.title, block.subtitle].filter(Boolean) as string[];

    (block.sequences || []).forEach(sequence => {
      const exams = sequence.exams.join(', ');
      lines.push(sequence.name ? `${sequence.name}: ${exams}` : exams);
    });

    return lines.join('\n');
  });

  if (exames.observations) {
    blocks.push(`Observações: ${exames.observations}`);
  }

  return blocks.filter(Boolean).join('\n\n');
};

const formatPrescriptionItem = (item: PrescriptionItem) => {
  const medication = [item.drug, item.dose].filter(Boolean).join(' ');
  const presentation = item.presentation ? ` ------- ${item.presentation}` : '';
  const title = `${medication}${presentation}`.trim();

  return [title, item.posology ? `Uso: ${item.posology}` : 'Uso:'].filter(Boolean).join('\n');
};

const formatPrescriptionEntry = (entry: PrescriptionEntry) => {
  const sectionPath = entry.sectionPath.filter(Boolean).join(' > ');
  const medicationText = formatPrescriptionItem(entry.item);

  return sectionPath ? `${sectionPath}\n${medicationText}` : medicationText;
};

const flattenPrescriptionEntries = (
  prescricao: Pathology['prescricao'],
  sectionPath: string[] = [],
  keyPrefix = 'root'
): PrescriptionEntry[] => {
  const rootItems = (prescricao.items || []).map((item, index) => ({
    key: `${keyPrefix}-item-${index}`,
    item,
    sectionPath
  }));

  const sectionItems = (prescricao.sections || []).flatMap((section, sectionIndex) => {
    return flattenPrescriptionSectionEntries(
      section,
      [...sectionPath, section.title],
      `${keyPrefix}-section-${section.id || sectionIndex}`
    );
  });

  return [...rootItems, ...sectionItems];
};

const flattenPrescriptionSectionEntries = (
  section: PrescriptionSection,
  sectionPath: string[],
  keyPrefix: string
): PrescriptionEntry[] => {
  const items = (section.items || []).map((item, index) => ({
    key: `${keyPrefix}-item-${index}`,
    item,
    sectionPath
  }));

  const childItems = (section.sections || []).flatMap((childSection, childIndex) => {
    return flattenPrescriptionSectionEntries(
      childSection,
      [...sectionPath, childSection.title],
      `${keyPrefix}-section-${childSection.id || childIndex}`
    );
  });

  return [...items, ...childItems];
};

const formatPrescription = (prescricao: Pathology['prescricao']) => {
  const lines: string[] = [];

  (prescricao.items || []).forEach(item => {
    lines.push(formatPrescriptionItem(item));
  });

  (prescricao.sections || []).forEach(section => {
    const sectionText = formatPrescriptionSection(section);
    if (sectionText) {
      lines.push(sectionText);
    }
  });

  return lines.join('\n\n');
};

const formatPrescriptionSection = (section: PrescriptionSection, depth = 0): string => {
  const lines: string[] = [];
  const title = section.title || 'Secao sem titulo';
  const marker = '#'.repeat(Math.min(depth + 1, 3));

  lines.push(`${marker} ${title}`);

  (section.items || []).forEach(item => {
    lines.push(formatPrescriptionItem(item));
  });

  (section.sections || []).forEach(childSection => {
    const childText = formatPrescriptionSection(childSection, depth + 1);
    if (childText) {
      lines.push(childText);
    }
  });

  return lines.join('\n\n');
};

const renderFormattedText = (content: string | string[]) => {
  const text = Array.isArray(content) ? content.join('\n') : content;
  const lines = text.split('\n');
  const rendered: React.ReactNode[] = [];
  let bulletItems: string[] = [];

  const flushBullets = () => {
    if (bulletItems.length === 0) {
      return;
    }

    rendered.push(
      <ul key={`bullets-${rendered.length}`} className="space-y-2">
        {bulletItems.map((item, index) => (
          <li key={index} className="flex gap-2">
            <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-200" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
    bulletItems = [];
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushBullets();
      return;
    }

    if (trimmedLine.startsWith('-')) {
      bulletItems.push(trimmedLine.replace(/^-+\s*/, ''));
      return;
    }

    flushBullets();
    rendered.push(<p key={`paragraph-${index}`}>{trimmedLine}</p>);
  });

  flushBullets();

  return <div className="space-y-3">{rendered}</div>;
};

const getDiagnosticBlockLabel = (type: DiagnosticBlockType) => {
  switch (type) {
    case 'criteria':
      return 'Critérios diagnósticos';
    case 'quote':
      return 'Citação';
    case 'table':
      return 'Tabela';
    case 'text':
      return 'Texto livre';
    case 'resource':
      return 'Escore / Calculadora / Link';
  }
};

// --- Components ---

const TabButton = ({ 
  label, 
  active, 
  onClick 
}: { 
  label: TabType; 
  active: boolean; 
  onClick: () => void;
  key?: React.Key;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all relative whitespace-nowrap",
      active 
        ? "text-red-700" 
        : "text-gray-500 hover:text-gray-700"
    )}
  >
    {label}
    {active && (
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />
    )}
  </button>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-semibold text-gray-900 mb-4">{children}</h3>
);

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      onClick={handleCopy}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        copied ? "text-green-600 bg-green-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
      )}
      title="Copiar lista"
    >
      {copied ? <Check size={14} /> : <Clipboard size={14} />}
    </button>
  );
};

const AutoGrowTextarea = ({
  value,
  rows = 3,
  className,
  onChange,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resizeToContent = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    resizeToContent(textarea);
  }, [value]);

  useEffect(() => {
    const textarea = textareaRef.current;
    const parent = textarea?.parentElement;
    if (!textarea || !parent || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => resizeToContent(textarea));
    observer.observe(parent);

    return () => observer.disconnect();
  }, []);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      rows={rows}
      onChange={event => {
        onChange?.(event);
        resizeToContent(event.currentTarget);
      }}
      className={cn("overflow-hidden resize-none", className)}
    />
  );
};

// --- Main Component ---

function PathologyForm({ 
  initialData, 
  onSave, 
  onCancel 
}: { 
  initialData?: Pathology; 
  onSave: (data: Pathology) => void | Promise<void>; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Pathology>(() => normalizePathologyForForm(initialData || {
    id: Math.random().toString(36).substr(2, 9),
    name: '',
    category: '',
    diagnostico: { criteria: '' },
    exames: { blocks: [] },
    orientacoes: { blocks: [] },
    prescricao: { items: [], sections: [] },
    metas: { blocks: [] }
  }));

  const [activeFormTab, setActiveFormTab] = useState<TabType | 'Geral'>('Geral');
  const [collapsedPrescriptionEditors, setCollapsedPrescriptionEditors] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const isSavingRef = useRef(false);

  const isPrescriptionEditorCollapsed = (key: string) => collapsedPrescriptionEditors.has(key);
  const getOpenSectionKey = (key: string) => `open:${key}`;
  const isPrescriptionSectionEditorCollapsed = (key: string) => !collapsedPrescriptionEditors.has(getOpenSectionKey(key));

  const togglePrescriptionEditor = (key: string) => {
    setCollapsedPrescriptionEditors(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const togglePrescriptionSectionEditor = (key: string) => {
    const openKey = getOpenSectionKey(key);
    setCollapsedPrescriptionEditors(prev => {
      const next = new Set(prev);
      if (next.has(openKey)) {
        next.delete(openKey);
      } else {
        next.add(openKey);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (isSavingRef.current) {
      return;
    }

    const diagnosticResourceErrors = getDiagnosticResourceValidationErrors(formData.diagnostico.blocks || []);
    if (diagnosticResourceErrors.length > 0) {
      setFormError(diagnosticResourceErrors[0]);
      setActiveFormTab('Diagnóstico');
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setFormError('');

    try {
      await onSave(normalizePathologyForSave(formData));
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleUpdate = (path: string, value: any) => {
    const newData = { ...formData };
    const keys = path.split('.');
    let current: any = newData;
    for (let i = 0; i < keys.length - 1; i++) {
       current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    setFormData(newData);
  };

  const updateDiagnostico = (diagnostico: Pathology['diagnostico']) => {
    setFormData(prev => ({ ...prev, diagnostico }));
  };

  const diagnosticBlocks = formData.diagnostico.blocks || [];

  const updateDiagnosticBlocks = (blocks: DiagnosticBlock[]) => {
    updateDiagnostico({
      ...formData.diagnostico,
      blocks
    });
  };

  const updateDiagnosticBlock = (index: number, block: DiagnosticBlock) => {
    const blocks = [...diagnosticBlocks];
    blocks[index] = block;
    updateDiagnosticBlocks(blocks);
  };

  const removeDiagnosticBlock = (index: number) => {
    updateDiagnosticBlocks(diagnosticBlocks.filter((_, blockIndex) => blockIndex !== index));
  };

  const updateHighlight = (field: 'title' | 'content', value: string) => {
    updateDiagnostico({
      ...formData.diagnostico,
      highlight: {
        title: formData.diagnostico.highlight?.title || '',
        content: formData.diagnostico.highlight?.content || '',
        [field]: value
      }
    });
  };

  const removeHighlight = () => {
    const { highlight: _highlight, ...diagnostico } = formData.diagnostico;
    updateDiagnostico(diagnostico);
  };

  const addClassificationTable = () => {
    updateDiagnostico({
      ...formData.diagnostico,
      classification: {
        title: '',
        headers: ['Categoria', 'Coluna 2', 'Coluna 3'],
        rows: []
      }
    });
  };

  const updateClassification = (
    classification: NonNullable<Pathology['diagnostico']['classification']>
  ) => {
    updateDiagnostico({
      ...formData.diagnostico,
      classification
    });
  };

  const removeClassification = () => {
    const { classification: _classification, ...diagnostico } = formData.diagnostico;
    updateDiagnostico(diagnostico);
  };

  const InputLabel = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{children}</label>
  );

  const prescriptionSections = formData.prescricao.sections || [];

  const updatePrescriptionSections = (sections: PrescriptionSection[]) => {
    setFormData(prev => ({
      ...prev,
      prescricao: {
        ...prev.prescricao,
        sections
      }
    }));
  };

  const updateSectionAtPath = (
    sections: PrescriptionSection[],
    path: number[],
    updater: (section: PrescriptionSection) => PrescriptionSection
  ): PrescriptionSection[] => {
    return sections.map((section, index) => {
      if (index !== path[0]) {
        return section;
      }

      if (path.length === 1) {
        return updater(section);
      }

      return {
        ...section,
        sections: updateSectionAtPath(section.sections || [], path.slice(1), updater)
      };
    });
  };

  const removeSectionAtPath = (
    sections: PrescriptionSection[],
    path: number[]
  ): PrescriptionSection[] => {
    if (path.length === 1) {
      return sections.filter((_, index) => index !== path[0]);
    }

    return sections.map((section, index) => {
      if (index !== path[0]) {
        return section;
      }

      return {
        ...section,
        sections: removeSectionAtPath(section.sections || [], path.slice(1))
      };
    });
  };

  const updateSection = (
    path: number[],
    updater: (section: PrescriptionSection) => PrescriptionSection
  ) => {
    updatePrescriptionSections(updateSectionAtPath(prescriptionSections, path, updater));
  };

  const renderDiagnosticTableEditor = (block: DiagnosticBlock, blockIndex: number) => {
    const table = block.table || { headers: ['Coluna 1', 'Coluna 2'], rows: [{ cells: ['', ''] }] };
    const updateTable = (table: NonNullable<DiagnosticBlock['table']>) => {
      updateDiagnosticBlock(blockIndex, { ...block, table });
    };

    return (
      <div className="space-y-4">
        <div>
          <InputLabel>Título da tabela</InputLabel>
          <input
            type="text"
            value={block.title || ''}
            onChange={e => updateDiagnosticBlock(blockIndex, { ...block, title: e.target.value })}
            placeholder="Ex: Classificação no Consultório"
            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
          />
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-center text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              <tr>
                {table.headers.map((header, headerIndex) => (
                  <th key={headerIndex} className="border-r border-gray-100 px-4 py-3 last:border-r-0">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={header}
                        onChange={e => {
                          const headers = [...table.headers];
                          headers[headerIndex] = e.target.value;
                          updateTable({ ...table, headers });
                        }}
                        className="w-full border-none bg-transparent text-center text-[10px] font-bold uppercase tracking-wider text-gray-500 outline-none focus:ring-0"
                      />
                      {table.headers.length > 1 && (
                        <button
                          onClick={() => {
                            const headers = table.headers.filter((_, index) => index !== headerIndex);
                            const rows = table.rows.map(row => ({
                              ...row,
                              cells: row.cells.filter((_, index) => index !== headerIndex)
                            }));
                            updateTable({ headers, rows });
                          }}
                          className="text-gray-300 hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className={cn("transition-colors", row.isHighlight ? "bg-red-50/30" : "hover:bg-gray-50/50")}>
                  {table.headers.map((_, cellIndex) => (
                    <td key={cellIndex} className="h-12 border-r border-gray-100 px-4 py-3 last:border-r-0">
                      <input
                        type="text"
                        value={row.cells[cellIndex] || ''}
                        onChange={e => {
                          const rows = table.rows.map((currentRow, currentRowIndex) => {
                            if (currentRowIndex !== rowIndex) return currentRow;
                            const cells = [...currentRow.cells];
                            cells[cellIndex] = e.target.value;
                            return { ...currentRow, cells };
                          });
                          updateTable({ ...table, rows });
                        }}
                        className={cn(
                          "h-full w-full border-none bg-transparent text-center text-sm outline-none focus:ring-0",
                          row.isHighlight ? "font-bold text-red-700" : "text-gray-600"
                        )}
                      />
                    </td>
                  ))}
                  <td className="w-16 px-2 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="checkbox"
                        checked={Boolean(row.isHighlight)}
                        onChange={e => {
                          const rows = table.rows.map((currentRow, currentRowIndex) => (
                            currentRowIndex === rowIndex ? { ...currentRow, isHighlight: e.target.checked } : currentRow
                          ));
                          updateTable({ ...table, rows });
                        }}
                        className="h-3 w-3 accent-red-600"
                        title="Destacar linha"
                      />
                      <button
                        onClick={() => updateTable({ ...table, rows: table.rows.filter((_, index) => index !== rowIndex) })}
                        className="text-gray-300 hover:text-red-500"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            onClick={() => updateTable({
              ...table,
              headers: [...table.headers, `Coluna ${table.headers.length + 1}`],
              rows: table.rows.map(row => ({ ...row, cells: [...row.cells, ''] }))
            })}
            className="py-2 border-2 border-dashed border-gray-200 rounded-lg text-[10px] font-bold text-gray-400 hover:border-red-200 hover:text-red-400 transition-all uppercase tracking-widest"
          >
            + Coluna
          </button>
          <button
            onClick={() => updateTable({
              ...table,
              rows: [{ cells: new Array(table.headers.length).fill('') }, ...table.rows]
            })}
            className="py-2 border-2 border-dashed border-gray-200 rounded-lg text-[10px] font-bold text-gray-400 hover:border-red-200 hover:text-red-400 transition-all uppercase tracking-widest"
          >
            + Linha acima
          </button>
          <button
            onClick={() => updateTable({
              ...table,
              rows: [...table.rows, { cells: new Array(table.headers.length).fill('') }]
            })}
            className="py-2 border-2 border-dashed border-gray-200 rounded-lg text-[10px] font-bold text-gray-400 hover:border-red-200 hover:text-red-400 transition-all uppercase tracking-widest"
          >
            + Linha abaixo
          </button>
        </div>
      </div>
    );
  };

  const renderDiagnosticBlockEditor = (block: DiagnosticBlock, blockIndex: number) => (
    <div key={block.id || blockIndex} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-5 relative group">
      <button
        onClick={() => removeDiagnosticBlock(blockIndex)}
        className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
      >
        <X size={16} />
      </button>
      <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">{getDiagnosticBlockLabel(block.type)}</span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      {block.type === 'resource' ? (
        <ClinicalResourceEditor
          resource={block.resource}
          editorMode={block.resourceEditorMode}
          jsonDraft={block.resourceJsonDraft}
          validationError={block.resourceValidationError}
          onChange={next => updateDiagnosticBlock(blockIndex, { ...block, ...next })}
        />
      ) : block.type === 'table' ? (
        renderDiagnosticTableEditor(block, blockIndex)
      ) : (
        <div className="space-y-4">
          {block.type === 'quote' && (
            <div>
              <InputLabel>Título da citação</InputLabel>
              <input
                type="text"
                value={block.title || ''}
                onChange={e => updateDiagnosticBlock(blockIndex, { ...block, title: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
              />
            </div>
          )}
          <div>
            <InputLabel>{block.type === 'criteria' ? 'Critérios diagnósticos' : block.type === 'quote' ? 'Texto da citação' : 'Texto livre'}</InputLabel>
            <AutoGrowTextarea
              value={block.content || ''}
              onChange={e => updateDiagnosticBlock(blockIndex, { ...block, content: e.target.value })}
              rows={block.type === 'quote' ? 3 : 5}
              placeholder={block.type === 'text' ? 'Use linhas iniciadas com - para criar tópicos' : undefined}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderMetaTableEditor = (block: MetaBlock, blockIndex: number) => {
    if (!block.table) {
      return (
        <button
          onClick={() => {
            const newBlocks = [...formData.metas.blocks];
            newBlocks[blockIndex].table = {
              headers: ['Coluna 1', 'Coluna 2'],
              rows: [['', '']]
            };
            handleUpdate('metas.blocks', newBlocks);
          }}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-[10px] font-bold text-gray-400 hover:border-red-200 hover:text-red-400 transition-all uppercase tracking-widest"
        >
          + Adicionar Tabela
        </button>
      );
    }

    const updateTable = (table: NonNullable<MetaBlock['table']>) => {
      const newBlocks = [...formData.metas.blocks];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], table };
      handleUpdate('metas.blocks', newBlocks);
    };

    return (
      <div className="pt-4 border-t border-gray-50 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Tabela</p>
          <button
            onClick={() => {
              const newBlocks = [...formData.metas.blocks];
              delete newBlocks[blockIndex].table;
              handleUpdate('metas.blocks', newBlocks);
            }}
            className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest"
          >
            Remover Tabela
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-center text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              <tr>
                {block.table.headers.map((header, headerIndex) => (
                  <th key={headerIndex} className="border-r border-gray-100 px-4 py-3 last:border-r-0">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={header}
                        onChange={e => {
                          const headers = [...block.table!.headers];
                          headers[headerIndex] = e.target.value;
                          updateTable({ ...block.table!, headers });
                        }}
                        className="w-full border-none bg-transparent text-center text-[10px] font-bold uppercase tracking-wider text-gray-500 outline-none focus:ring-0"
                      />
                      {block.table!.headers.length > 1 && (
                        <button
                          onClick={() => {
                            const headers = block.table!.headers.filter((_, index) => index !== headerIndex);
                            const rows = block.table!.rows.map(row => row.filter((_, index) => index !== headerIndex));
                            updateTable({ headers, rows });
                          }}
                          className="text-gray-300 hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {block.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="transition-colors hover:bg-gray-50/50">
                  {block.table!.headers.map((_, cellIndex) => (
                    <td key={cellIndex} className="h-12 border-r border-gray-100 px-4 py-3 last:border-r-0">
                      <input
                        type="text"
                        value={row[cellIndex] || ''}
                        onChange={e => {
                          const rows = block.table!.rows.map((currentRow, currentRowIndex) => {
                            if (currentRowIndex !== rowIndex) return currentRow;
                            const cells = [...currentRow];
                            cells[cellIndex] = e.target.value;
                            return cells;
                          });
                          updateTable({ ...block.table!, rows });
                        }}
                        className={cn(
                          "h-full w-full border-none bg-transparent text-center text-sm text-gray-600 outline-none focus:ring-0",
                          cellIndex === 1 && "font-bold text-red-700"
                        )}
                      />
                    </td>
                  ))}
                  <td className="w-10 px-2 py-3">
                    <button
                      onClick={() => updateTable({ ...block.table!, rows: block.table!.rows.filter((_, index) => index !== rowIndex) })}
                      className="text-gray-300 hover:text-red-500"
                    >
                      <X size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            onClick={() => updateTable({
              headers: [...block.table!.headers, `Coluna ${block.table!.headers.length + 1}`],
              rows: block.table!.rows.map(row => [...row, ''])
            })}
            className="py-2 border-2 border-dashed border-gray-200 rounded-lg text-[10px] font-bold text-gray-400 hover:border-red-200 hover:text-red-400 transition-all uppercase tracking-widest"
          >
            + Coluna
          </button>
          <button
            onClick={() => updateTable({
              ...block.table!,
              rows: [new Array(block.table!.headers.length).fill(''), ...block.table!.rows]
            })}
            className="py-2 border-2 border-dashed border-gray-200 rounded-lg text-[10px] font-bold text-gray-400 hover:border-red-200 hover:text-red-400 transition-all uppercase tracking-widest"
          >
            + Linha acima
          </button>
          <button
            onClick={() => updateTable({
              ...block.table!,
              rows: [...block.table!.rows, new Array(block.table!.headers.length).fill('')]
            })}
            className="py-2 border-2 border-dashed border-gray-200 rounded-lg text-[10px] font-bold text-gray-400 hover:border-red-200 hover:text-red-400 transition-all uppercase tracking-widest"
          >
            + Linha abaixo
          </button>
        </div>
      </div>
    );
  };

  const renderPrescriptionItemEditor = (
    item: PrescriptionItem,
    onChange: (item: PrescriptionItem) => void,
    onRemove: () => void,
    collapseKey: string
  ) => {
    const isCollapsed = isPrescriptionEditorCollapsed(collapseKey);

    return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6 relative group">
      <div className="flex items-center gap-3">
        <button
          onClick={() => togglePrescriptionEditor(collapseKey)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChevronRight size={16} className={cn("text-gray-300", !isCollapsed && "rotate-90")} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{item.drug || 'Medicamento sem nome'}</p>
            <p className="truncate text-xs text-gray-400">{[item.dose, item.presentation].filter(Boolean).join(' • ') || 'Clique para editar'}</p>
          </div>
        </button>
        <button
          onClick={onRemove}
          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      {!isCollapsed && (
        <>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <InputLabel>Nome da Medicação</InputLabel>
          <input
            type="text"
            value={item.drug}
            onChange={e => onChange({ ...item, drug: e.target.value })}
            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-red-100 outline-none"
          />
        </div>
        <div>
          <InputLabel>Dose</InputLabel>
          <input
            type="text"
            value={item.dose}
            onChange={e => onChange({ ...item, dose: e.target.value })}
            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
          />
        </div>
        <div>
          <InputLabel>Apresentação</InputLabel>
          <input
            type="text"
            value={item.presentation}
            onChange={e => onChange({ ...item, presentation: e.target.value })}
            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESCRIPTION_PRESENTATION_OPTIONS.map(option => (
              <button
                key={option}
                onClick={() => onChange({ ...item, presentation: option })}
                className="rounded-full border border-gray-100 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-red-200 hover:text-red-500"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <InputLabel>Posologia / Instrução de Uso</InputLabel>
        <AutoGrowTextarea
          value={item.posology}
          onChange={e => onChange({ ...item, posology: e.target.value })}
          rows={2}
          className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
        />
      </div>
      <div className="space-y-4 pt-4 border-t border-gray-50">
        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Orientações da Medicação</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            ['cuidados', 'Cuidados', 'Ex: Monitorar função renal, PA, sintomas...'],
            ['contraindicacoes', 'Contraindicações', 'Ex: Gestantes, alergia, insuficiência grave...'],
            ['sus', 'Disponibilidade SUS', 'Ex: Disponível na UBS / Farmácia Popular...'],
            ['gerais', 'Orientações gerais', 'Ex: Tomar no mesmo horário, não interromper sem orientação...']
          ] as const).map(([field, label, placeholder]) => (
            <div key={field}>
              <InputLabel>{label}</InputLabel>
              <AutoGrowTextarea
                value={item.orientations?.[field] || ''}
                onChange={e => onChange({
                  ...item,
                  orientations: {
                    ...item.orientations,
                    [field]: e.target.value
                  }
                })}
                rows={3}
                placeholder={placeholder}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
              />
            </div>
          ))}
        </div>
      </div>
        </>
      )}
    </div>
    );
  };

  const renderPrescriptionSectionEditor = (
    section: PrescriptionSection,
    path: number[],
    depth = 0
  ): React.ReactNode => {
    const isSubsection = depth > 0;
    const sectionKey = `section-${path.join('-')}`;
    const sectionTitleOptionsId = `${sectionKey}-title-options`;
    const isSectionCollapsed = isPrescriptionSectionEditorCollapsed(sectionKey);

    return (
    <div
      key={section.id || path.join('-')}
      className={cn(
        "space-y-5 rounded-2xl border p-5 transition-colors",
        isSubsection
          ? "border-gray-200 bg-gray-50/70"
          : "border-red-100 bg-white shadow-sm"
      )}
    >
      <div className="flex gap-3 items-end">
        <button
          onClick={() => togglePrescriptionSectionEditor(sectionKey)}
          className={cn(
            "pb-3 transition-colors",
            isSubsection ? "text-gray-400 hover:text-gray-700" : "text-red-300 hover:text-red-600"
          )}
        >
          <ChevronRight size={16} className={cn(!isSectionCollapsed && "rotate-90")} />
        </button>
        <div className="flex-1">
          <InputLabel>Título</InputLabel>
          <input
            type="text"
            value={section.title}
            onChange={e => updateSection(path, current => ({ ...current, title: e.target.value }))}
            onClick={isSubsection ? undefined : e => showSectionTitleOptions(e.currentTarget)}
            list={isSubsection ? undefined : sectionTitleOptionsId}
            placeholder={isSubsection ? 'Ex: Combinações' : 'Ex: Tratamento de primeira linha'}
            className={cn(
              "w-full px-4 py-3 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-100",
              isSubsection ? "bg-white" : "bg-red-50/40"
            )}
          />
          {!isSubsection && (
            <datalist id={sectionTitleOptionsId}>
              {TREATMENT_LINE_SECTION_OPTIONS.map(option => (
                <option key={option} value={option} />
              ))}
            </datalist>
          )}
        </div>
        <button
          onClick={() => updatePrescriptionSections(removeSectionAtPath(prescriptionSections, path))}
          className="px-3 py-3 text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest"
        >
          Remover
        </button>
      </div>

      {!isSectionCollapsed && (
        <>
      <div className="space-y-4">
        {(section.items || []).map((item, itemIndex) => (
          <React.Fragment key={`${section.id || path.join('-')}-item-${itemIndex}`}>
            {renderPrescriptionItemEditor(
              item,
              nextItem => updateSection(path, current => {
                const items = [...(current.items || [])];
                items[itemIndex] = nextItem;
                return { ...current, items };
              }),
              () => updateSection(path, current => ({
                ...current,
                items: (current.items || []).filter((_, index) => index !== itemIndex)
              })),
              `section-${path.join('-')}-item-${itemIndex}`
            )}
          </React.Fragment>
        ))}
        <button
          onClick={() => updateSection(path, current => ({
            ...current,
            items: [...(current.items || []), createEmptyPrescriptionItem()]
          }))}
          className={cn(
            "w-full py-3 border-2 border-dashed rounded-xl text-[10px] font-bold transition-all uppercase tracking-widest bg-white",
            isSubsection
              ? "border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600"
              : "border-red-100 text-red-400 hover:border-red-300 hover:text-red-600"
          )}
        >
          + Medicação
        </button>
      </div>

      <div className="space-y-4">
        {(section.sections || []).map((childSection, childIndex) => (
          renderPrescriptionSectionEditor(childSection, [...path, childIndex], depth + 1)
        ))}
        <button
          onClick={() => updateSection(path, current => ({
            ...current,
            sections: [...(current.sections || []), createEmptyPrescriptionSection()]
          }))}
          className="w-full py-3 border border-gray-200 rounded-xl text-[10px] font-bold text-gray-400 hover:border-red-200 hover:text-red-400 transition-all uppercase tracking-widest bg-white"
        >
          + Título secundário
        </button>
      </div>
        </>
      )}
    </div>
    );
  };

  return (
    <div className="flex flex-col w-full">
      {/* Form Tabs */}
      <div className="px-8 border-b border-gray-100 flex gap-4 overflow-x-auto no-scrollbar bg-white sticky top-0 z-10">
        {(['Geral', 'Diagnóstico', 'Exames', 'Orientações', 'Prescrição', 'Metas terapêuticas'] as any[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveFormTab(t)}
            className={cn(
              "px-4 py-4 text-[11px] font-bold transition-all relative whitespace-nowrap uppercase tracking-widest",
              activeFormTab === t ? "text-red-600" : "text-gray-400 hover:text-gray-600"
            )}
          >
            {t}
            {activeFormTab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />}
          </button>
        ))}
      </div>

      <div className="bg-gray-50/30 p-6 sm:p-8">
        <div className="w-full space-y-8 pb-20">
          
          {activeFormTab === 'Geral' && (
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <InputLabel>Nome da Patologia</InputLabel>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={e => handleUpdate('name', e.target.value)}
                    placeholder="Ex: Asma Brônquica"
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
                  />
                </div>
                <div>
                  <InputLabel>Categoria / Especialidade</InputLabel>
                  <input 
                    type="text" 
                    value={formData.category}
                    onChange={e => handleUpdate('category', e.target.value)}
                    placeholder="Ex: Pneumologia"
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {activeFormTab === 'Diagnóstico' && (
            <div className="space-y-6">
              {diagnosticBlocks.map(renderDiagnosticBlockEditor)}
              <div className="grid gap-2 sm:grid-cols-5">
                {(['criteria', 'quote', 'table', 'text', 'resource'] as DiagnosticBlockType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => updateDiagnosticBlocks([...diagnosticBlocks, createDiagnosticBlock(type)])}
                    className="py-3 border-2 border-dashed border-gray-200 rounded-2xl text-[10px] font-bold text-gray-400 hover:border-red-200 hover:text-red-400 transition-all uppercase tracking-widest bg-white"
                  >
                    + {getDiagnosticBlockLabel(type)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeFormTab === 'Exames' && (
            <div className="space-y-6">
              {formData.exames.blocks.map((block, bi) => (
                <div key={bi} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6 relative group">
                  <button 
                    onClick={() => {
                      const newBlocks = [...formData.exames.blocks];
                      newBlocks.splice(bi, 1);
                      handleUpdate('exames.blocks', newBlocks);
                    }}
                    className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X size={16} />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <InputLabel>Título do Bloco</InputLabel>
                      <input 
                        type="text" 
                        value={block.title}
                        onChange={e => {
                          const newBlocks = [...formData.exames.blocks];
                          newBlocks[bi].title = e.target.value;
                          handleUpdate('exames.blocks', newBlocks);
                        }}
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
                      />
                    </div>
                    <div>
                      <InputLabel>Subtítulo</InputLabel>
                      <input 
                        type="text" 
                        value={block.subtitle || ''}
                        onChange={e => {
                          const newBlocks = [...formData.exames.blocks];
                          newBlocks[bi].subtitle = e.target.value;
                          handleUpdate('exames.blocks', newBlocks);
                        }}
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
                      />
                    </div>
                  </div>
                  
                  {/* Sequences */}
                  <div className="space-y-4 pt-4">
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] border-b border-gray-50 pb-2">Sequências de Exames</p>
                    {block.sequences.map((seq, si) => (
                      <div key={si} className="p-4 bg-gray-50/50 rounded-2xl space-y-4">
                        <div className="flex gap-4">
                          <input 
                            placeholder="Nome da Categoria (Ex: Biofísica)"
                            type="text" 
                            value={seq.name}
                            onChange={e => {
                              const newBlocks = [...formData.exames.blocks];
                              newBlocks[bi].sequences[si].name = e.target.value;
                              handleUpdate('exames.blocks', newBlocks);
                            }}
                            className="flex-1 px-4 py-2 bg-white border-none rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-100"
                          />
                          <button 
                            onClick={() => {
                              const newBlocks = [...formData.exames.blocks];
                              newBlocks[bi].sequences.splice(si, 1);
                              handleUpdate('exames.blocks', newBlocks);
                            }}
                            className="text-gray-300 hover:text-red-500"
                          >
                             <X size={14} />
                          </button>
                        </div>
                        <div className="space-y-2">
                           <InputLabel>Exames (um por linha)</InputLabel>
                           <AutoGrowTextarea 
                             value={seq.exams.join('\n')}
                             onChange={e => {
                               const newBlocks = [...formData.exames.blocks];
                               const nextExams = e.target.value.split('\n');
                               const previousNotes = newBlocks[bi].sequences[si].examNotes || {};
                               newBlocks[bi].sequences[si] = {
                                 ...newBlocks[bi].sequences[si],
                                 exams: nextExams,
                                 examNotes: Object.fromEntries(
                                   nextExams
                                     .map(exam => exam.trim())
                                     .filter(Boolean)
                                     .map(exam => [exam, previousNotes[exam] || ''])
                                 )
                               };
                               handleUpdate('exames.blocks', newBlocks);
                             }}
                             rows={3}
                             className="w-full px-4 py-3 bg-white border-none rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-100"
                            />
                            {seq.exams.some(exam => exam.trim()) && (
                              <div className="space-y-3 pt-2">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Observações por exame</p>
                                {seq.exams.map(exam => exam.trim()).filter(Boolean).map((exam, examIndex) => (
                                  <div key={`${exam}-${examIndex}`} className="grid gap-2 rounded-lg border border-gray-100 bg-white p-3 md:grid-cols-[minmax(140px,0.45fr)_1fr]">
                                    <p className="text-xs font-bold text-gray-700">{exam}</p>
                                    <input
                                      type="text"
                                      value={seq.examNotes?.[exam] || ''}
                                      onChange={e => {
                                        const newBlocks = [...formData.exames.blocks];
                                        const currentSequence = newBlocks[bi].sequences[si];
                                        newBlocks[bi].sequences[si] = {
                                          ...currentSequence,
                                          examNotes: {
                                            ...(currentSequence.examNotes || {}),
                                            [exam]: e.target.value
                                          }
                                        };
                                        handleUpdate('exames.blocks', newBlocks);
                                      }}
                                      placeholder="O que espero encontrar ou motivo da solicitação"
                                      className="w-full rounded-lg border-none bg-gray-50 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-red-100"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        const newBlocks = [...formData.exames.blocks];
                        newBlocks[bi].sequences.push({ name: '', exams: [], examNotes: {} });
                        handleUpdate('exames.blocks', newBlocks);
                      }}
                      className="w-full py-2 border-2 border-dashed border-gray-100 rounded-xl text-[10px] font-bold text-gray-400 hover:border-red-200 hover:text-red-400 transition-all uppercase tracking-widest"
                    >
                      + Adicionar Sequência
                    </button>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => {
                  handleUpdate('exames.blocks', [...formData.exames.blocks, { title: '', sequences: [] }]);
                }}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-3xl text-sm font-bold text-gray-400 hover:border-red-400 hover:text-red-500 transition-all uppercase tracking-widest bg-white shadow-sm"
              >
                + Novo Bloco de Exames
              </button>
            </div>
          )}

          {activeFormTab === 'Orientações' && (
            <div className="space-y-6">
              {formData.orientacoes.blocks.map((block, bi) => (
                <div key={bi} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6 relative group">
                  <button 
                    onClick={() => {
                      const newBlocks = [...formData.orientacoes.blocks];
                      newBlocks.splice(bi, 1);
                      handleUpdate('orientacoes.blocks', newBlocks);
                    }}
                    className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X size={16} />
                  </button>
                  <div>
                    <InputLabel>Título das Orientações</InputLabel>
                    <input 
                      type="text" 
                      value={block.title}
                      onChange={e => {
                        const newBlocks = [...formData.orientacoes.blocks];
                        newBlocks[bi].title = e.target.value;
                        handleUpdate('orientacoes.blocks', newBlocks);
                      }}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
                    />
                  </div>
                  <div>
                    <InputLabel>Itens (um por linha)</InputLabel>
                    <AutoGrowTextarea 
                      value={block.items.join('\n')}
                      onChange={e => {
                        const newBlocks = [...formData.orientacoes.blocks];
                        newBlocks[bi].items = e.target.value.split('\n');
                        handleUpdate('orientacoes.blocks', newBlocks);
                      }}
                      rows={5}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none shadow-inner"
                      placeholder="Ex: Beber 2L de água por dia..."
                    />
                  </div>
                </div>
              ))}
              <button 
                onClick={() => handleUpdate('orientacoes.blocks', [...formData.orientacoes.blocks, { title: '', items: [] }])}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-3xl text-sm font-bold text-gray-400 hover:border-red-400 hover:text-red-500 transition-all uppercase tracking-widest bg-white"
              >
                + Novo Bloco de Orientações
              </button>
            </div>
          )}

          {activeFormTab === 'Prescrição' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-px bg-gray-200 flex-1" />
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Prescrição</h4>
                  <div className="h-px bg-gray-200 flex-1" />
                </div>
                {prescriptionSections.length > 0 && (
                  <div className="space-y-8">
                    {prescriptionSections.map((section, sectionIndex) => (
                      renderPrescriptionSectionEditor(section, [sectionIndex])
                    ))}
                  </div>
                )}
                <button
                  onClick={() => updatePrescriptionSections([...prescriptionSections, createEmptyPrescriptionSection()])}
                  className="w-full py-4 border-2 border-dashed border-gray-200 rounded-3xl text-sm font-bold text-gray-400 hover:border-red-400 hover:text-red-500 transition-all uppercase tracking-widest bg-white"
                >
                  + Novo título
                </button>
              </div>
            </div>
          )}

          {activeFormTab === 'Metas terapêuticas' && (
            <div className="space-y-6">
              {formData.metas.blocks.map((block, bi) => (
                <div key={bi} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6 relative group">
                  <button 
                    onClick={() => {
                      const newBlocks = [...formData.metas.blocks];
                      newBlocks.splice(bi, 1);
                      handleUpdate('metas.blocks', newBlocks);
                    }}
                    className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X size={16} />
                  </button>
                  <div>
                    <InputLabel>Título da Meta</InputLabel>
                    <input 
                      type="text" 
                      value={block.title}
                      onChange={e => {
                        const newBlocks = [...formData.metas.blocks];
                        newBlocks[bi].title = e.target.value;
                        handleUpdate('metas.blocks', newBlocks);
                      }}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none"
                    />
                  </div>
                  <div>
                    <InputLabel>Conteúdo / Alvos</InputLabel>
                    <AutoGrowTextarea 
                      value={Array.isArray(block.content) ? block.content.join('\n') : block.content}
                      onChange={e => {
                        const newBlocks = [...formData.metas.blocks];
                        newBlocks[bi].content = e.target.value.includes('\n') ? e.target.value.split('\n') : e.target.value;
                        handleUpdate('metas.blocks', newBlocks);
                      }}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-red-100 outline-none shadow-sm font-medium text-red-700"
                    />
                  </div>

                  {renderMetaTableEditor(block, bi)}
                </div>
              ))}
              <button 
                onClick={() => handleUpdate('metas.blocks', [...formData.metas.blocks, { title: '', content: '' }])}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-3xl text-sm font-bold text-gray-400 hover:border-red-400 hover:text-red-500 transition-all uppercase tracking-widest bg-white"
              >
                + Nova Meta Terapêutica
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Form Footer Actions */}
      <div className="p-6 bg-white border-t border-gray-100 space-y-4 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
        {formError && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {formError}
          </div>
        )}
        <div className="flex items-center justify-between">
        <button 
          onClick={onCancel}
          disabled={isSaving}
          className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
        >
          Descartar Alterações
        </button>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="px-10 py-3 bg-gray-900 text-white rounded-2xl text-sm font-bold hover:bg-black transition-all shadow-xl shadow-gray-200 active:scale-95 uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Salvando...' : 'Salvar Protocolo'}
        </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<ViewType>('home');
  const [pathologies, setPathologies] = useState<Pathology[]>([]);
  const [managementChoice, setManagementChoice] = useState<'add' | 'edit' | null>(null);
  const [editingPathology, setEditingPathology] = useState<Pathology | null>(null);
  const [search, setSearch] = useState('');
  const [managementSearch, setManagementSearch] = useState('');
  const [selectedPathology, setSelectedPathology] = useState<Pathology | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('Diagnóstico');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedExamSequences, setSelectedExamSequences] = useState<Set<string>>(new Set());
  const [selectedPrescriptionItems, setSelectedPrescriptionItems] = useState<Set<string>>(new Set());
  const [expandedPrescriptionDisplaySections, setExpandedPrescriptionDisplaySections] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      try {
        setDataError(null);
        let protocols = await loadPathologiesFromData();
        const legacyProtocols = loadLegacyBrowserPathologies();

        if (legacyProtocols.length > 0) {
          protocols = await replacePathologiesInData(mergePathologies(protocols, legacyProtocols));
          clearLegacyBrowserPathologies();
        }

        if (isActive) {
          setPathologies(protocols);
        }
      } catch (error) {
        if (isActive) {
          setDataError(error instanceof Error ? error.message : 'Nao foi possivel carregar os protocolos.');
        }
      } finally {
        if (isActive) {
          setIsLoadingData(false);
        }
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, []);

  const categories = useMemo<string[]>(() => {
    const cats = Array.from(
      new Set(pathologies.map(p => p.category).filter(Boolean))
    ) as string[];

    return cats.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [pathologies]);

  const filteredPathologies = useMemo(() => {
    const s = normalizeSearchText(search);
    return pathologies.filter(p => {
      const matchesSearch = normalizeSearchText(`${p.name} ${p.category}`).includes(s);
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory, pathologies]);

  const editablePathologies = useMemo(() => {
    const s = normalizeSearchText(managementSearch);
    if (!s) return pathologies;

    return pathologies.filter(p => {
      const prescriptionText = flattenPrescriptionEntries(p.prescricao)
        .map(entry => [
          entry.item.drug,
          entry.item.dose,
          entry.item.presentation,
          entry.item.posology,
          ...entry.sectionPath
        ].join(' '))
        .join(' ');
      const diagnosticText = getDiagnosticBlocks(p.diagnostico)
        .map(block => [
          block.title,
          block.content,
          block.resource?.title,
          block.resource?.subtitle,
          block.resource?.description,
          block.resource?.source,
          ...(block.table?.headers || []),
          ...(block.table?.rows || []).flatMap(row => row.cells)
        ].filter(Boolean).join(' '))
        .join(' ');

      const searchText = [
        p.name,
        p.category,
        p.diagnostico.criteria,
        diagnosticText,
        prescriptionText
      ].join(' ');

      return normalizeSearchText(searchText).includes(s);
    });
  }, [managementSearch, pathologies]);

  const handleSavePathology = async (data: Pathology) => {
    try {
      setDataError(null);
      const protocols = await savePathologyInData(data, Boolean(editingPathology));
      setPathologies(protocols);
      setView('home');
      setManagementChoice(null);
      setEditingPathology(null);
      setSelectedPathology(null);
      setSelectedExamSequences(new Set());
      setSelectedPrescriptionItems(new Set());
      setExpandedPrescriptionDisplaySections(new Set());
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Nao foi possivel salvar o protocolo.');
    }
  };

  const handleDeletePathology = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este protocolo?')) {
      try {
        setDataError(null);
        const protocols = await deletePathologyFromData(id);
        setPathologies(protocols);
        setEditingPathology(null);
      } catch (error) {
        setDataError(error instanceof Error ? error.message : 'Nao foi possivel excluir o protocolo.');
      }
    }
  };

  const handleOpenPathology = (p: Pathology) => {
    setSelectedPathology(p);
    setActiveTab(getAvailableProtocolTabs(p)[0] || 'Diagnóstico');
    setSelectedExamSequences(new Set());
    setSelectedPrescriptionItems(new Set());
    setExpandedPrescriptionDisplaySections(new Set());
  };

  const handleClose = () => {
    setSelectedPathology(null);
    setSelectedExamSequences(new Set());
    setSelectedPrescriptionItems(new Set());
    setExpandedPrescriptionDisplaySections(new Set());
  };

  const handleGoToManagement = () => {
    setView('management');
    setManagementChoice(null);
    setEditingPathology(null);
    setSelectedPathology(null);
    setSelectedExamSequences(new Set());
    setSelectedPrescriptionItems(new Set());
    setExpandedPrescriptionDisplaySections(new Set());
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (selectedPathology) {
        event.preventDefault();
        handleClose();
        return;
      }

      if (view === 'management') {
        event.preventDefault();

        if (editingPathology) {
          setEditingPathology(null);
          return;
        }

        if (managementChoice) {
          setManagementChoice(null);
          return;
        }

        setView('home');
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [editingPathology, managementChoice, selectedPathology, view]);

  const currentPathology = selectedPathology;
  const currentExamEntries = useMemo(() => {
    return currentPathology ? flattenExamEntries(currentPathology.exames) : [];
  }, [currentPathology]);
  const currentPrescriptionEntries = useMemo(() => {
    return currentPathology ? flattenPrescriptionEntries(currentPathology.prescricao) : [];
  }, [currentPathology]);
  const currentDiagnosticBlocks = useMemo(() => {
    return currentPathology ? getDiagnosticBlocks(currentPathology.diagnostico) : [];
  }, [currentPathology]);
  const currentDisplayDiagnosticBlocks = useMemo(() => {
    return currentDiagnosticBlocks.filter(hasDiagnosticBlockDisplayContent);
  }, [currentDiagnosticBlocks]);
  const currentDisplayExamBlocks = useMemo(() => {
    return currentPathology ? currentPathology.exames.blocks.filter(hasExamBlockDisplayContent) : [];
  }, [currentPathology]);
  const currentDisplayOrientationBlocks = useMemo(() => {
    return currentPathology ? currentPathology.orientacoes.blocks.filter(hasOrientationBlockDisplayContent) : [];
  }, [currentPathology]);
  const currentDisplayExamEntries = useMemo(() => {
    return currentExamEntries.filter(entry => hasExamSequenceDisplayContent(entry.sequence));
  }, [currentExamEntries]);
  const currentDisplayPrescriptionEntries = useMemo(() => {
    return currentPrescriptionEntries.filter(entry => hasPrescriptionItemDisplayContent(entry.item));
  }, [currentPrescriptionEntries]);
  const currentDisplayMetaBlocks = useMemo(() => {
    return currentPathology ? currentPathology.metas.blocks.filter(hasMetaBlockDisplayContent) : [];
  }, [currentPathology]);
  const availableProtocolTabs = useMemo(() => {
    return currentPathology ? getAvailableProtocolTabs(currentPathology) : [];
  }, [currentPathology]);

  useEffect(() => {
    if (!currentPathology || availableProtocolTabs.length === 0 || availableProtocolTabs.includes(activeTab)) {
      return;
    }

    setActiveTab(availableProtocolTabs[0]);
  }, [activeTab, availableProtocolTabs, currentPathology]);

  const renderDiagnosticBlockDisplay = (block: DiagnosticBlock, blockIndex: number) => {
    if (block.type === 'resource') {
      const resource = normalizeClinicalResource(block.resource);

      if (!resource) {
        return null;
      }

      return (
        <div key={block.id || blockIndex}>
          <ClinicalResourceRenderer resource={resource} />
        </div>
      );
    }

    if (block.type === 'table' && block.table) {
      return (
        <div key={block.id || blockIndex}>
          {block.title && <SectionTitle>{block.title}</SectionTitle>}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm text-center">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[10px] border-b border-gray-100">
                <tr>
                  {block.table.headers.map((header, headerIndex) => (
                    <th key={headerIndex} className="px-6 py-4 border-r border-gray-100 last:border-r-0">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {block.table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className={cn("transition-colors h-12", row.isHighlight ? "bg-red-50/30 font-bold text-red-700" : "text-gray-600 hover:bg-gray-50/50")}>
                    {row.cells.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-6 py-4 border-r border-gray-100 last:border-r-0 align-middle">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (block.type === 'quote') {
      return (
        <div key={block.id || blockIndex} className="bg-red-50/50 border-l-4 border-red-500 p-6 rounded-r-xl flex gap-4">
          <Info className="text-red-500 shrink-0" size={24} />
          <div>
            {block.title && <h4 className="font-semibold text-red-900 mb-1">{block.title}</h4>}
            <div className="text-red-800/80 text-sm">{renderFormattedText(block.content || '')}</div>
          </div>
        </div>
      );
    }

    return (
      <div key={block.id || blockIndex} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm leading-relaxed text-gray-700 text-lg">
        {renderFormattedText(block.content || '')}
      </div>
    );
  };

  const renderExamSequenceDisplay = (sequence: ExamSequence, entryKey: string) => {
    const isSelected = selectedExamSequences.has(entryKey);

    return (
      <div
        key={entryKey}
        onClick={() => {
          const next = new Set(selectedExamSequences);
          if (next.has(entryKey)) next.delete(entryKey);
          else next.add(entryKey);
          setSelectedExamSequences(next);
        }}
        className={cn(
          "group p-4 bg-gray-50/50 rounded-xl border transition-all shadow-sm relative cursor-pointer select-none",
          isSelected
            ? "border-red-500 bg-red-50/20 ring-2 ring-red-100"
            : "border-gray-100 hover:border-red-200 hover:bg-white"
        )}
      >
        <div className={cn(
          "absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
          isSelected ? "bg-red-600 border-red-600 text-white" : "border-gray-200 bg-white"
        )}>
          {isSelected && <Check size={12} strokeWidth={4} />}
        </div>

        <div className="flex items-center justify-between gap-4 mb-2 pr-8">
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">{sequence.name}</span>
          <CopyButton text={sequence.exams.join(', ')} />
        </div>
        <ul className="space-y-1.5">
          {sequence.exams.map((exam, examIndex) => {
            const examNote = sequence.examNotes?.[exam];

            return (
            <li key={examIndex} className="text-gray-700 flex items-center gap-2 text-sm" title={examNote || undefined}>
              <div className="w-1 h-1 bg-red-400 rounded-full shrink-0" />
              <span className={cn(examNote && "decoration-dotted underline underline-offset-4")}>{exam}</span>
              {examNote && <Info size={12} className="text-gray-300" />}
            </li>
          );
          })}
        </ul>
      </div>
    );
  };

  const renderPrescriptionDisplayItem = (item: PrescriptionItem, itemKey: string) => {
    const isSelected = selectedPrescriptionItems.has(itemKey);

    return (
      <div
        key={itemKey}
        onClick={() => {
          const next = new Set(selectedPrescriptionItems);
          if (next.has(itemKey)) next.delete(itemKey);
          else next.add(itemKey);
          setSelectedPrescriptionItems(next);
        }}
        className={cn(
          "bg-white rounded-2xl border transition-all p-6 sm:p-8 relative group cursor-pointer select-none shadow-sm",
          isSelected
            ? "border-red-500 bg-red-50/20"
            : "border-gray-200 hover:border-red-200"
        )}
      >
        <div className={cn(
          "absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
          isSelected ? "bg-red-600 border-red-600 text-white" : "border-gray-200 bg-white"
        )}>
          {isSelected && <Check size={12} strokeWidth={4} />}
        </div>

        <div className="relative z-10 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-2 pr-8">
              <h5 className="text-xl font-bold text-gray-900">{item.drug}</h5>
              <span className="text-red-600 font-semibold">{item.dose}</span>
              <span className="text-gray-400 text-sm">•</span>
              <span className="text-gray-500 text-sm italic">{item.presentation}</span>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 flex flex-col gap-1 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Posologia / Uso</p>
              <p className="text-gray-700 font-medium">{item.posology}</p>
            </div>

            {hasMedicationOrientations(item.orientations) && (
              <details
                className="group/details"
                onClick={(e) => e.stopPropagation()}
              >
                <summary className="flex items-center gap-2 text-[11px] font-bold text-red-600 hover:text-red-700 cursor-pointer uppercase tracking-wider focus:outline-none list-none">
                  <div className="rounded-lg bg-red-50 px-2.5 py-1 text-[10px] group-hover/details:bg-red-100 transition-colors">
                    ORIENTAÇÕES DA MEDICAÇÃO
                  </div>
                </summary>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {item.orientations.cuidados && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Activity size={10} className="text-blue-500" />
                        Cuidados
                      </p>
                      <p className="text-[13px] text-gray-600">{item.orientations.cuidados}</p>
                    </div>
                  )}
                  {item.orientations.contraindicacoes && (
                    <div className="bg-red-50/30 p-4 rounded-xl border border-red-100/50">
                      <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <X size={10} />
                        Contraindicações
                      </p>
                      <p className="text-[13px] text-red-900/70">{item.orientations.contraindicacoes}</p>
                    </div>
                  )}
                  {item.orientations.sus && (
                    <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100/50 sm:col-span-2">
                      <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Stethoscope size={10} />
                        Disponibilidade SUS
                      </p>
                      <p className="text-[13px] text-blue-900/70">{item.orientations.sus}</p>
                    </div>
                  )}
                  {item.orientations.gerais && (
                    <div className="bg-amber-50/30 p-4 rounded-xl border border-amber-100/60 sm:col-span-2">
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Info size={10} />
                        Orientações gerais
                      </p>
                      <p className="text-[13px] text-amber-900/80">{item.orientations.gerais}</p>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPrescriptionSectionDisplay = (
    section: PrescriptionSection,
    keyPrefix: string,
    depth = 0
  ): React.ReactNode => {
    if (!hasPrescriptionSectionDisplayContent(section)) {
      return null;
    }

    const isExpanded = expandedPrescriptionDisplaySections.has(keyPrefix);
    const normalizedDepth = Math.min(depth, 2);
    const sectionStyles = [
      {
        container: "border-red-100 bg-red-50/35",
        accent: "bg-red-500",
        icon: "text-red-500",
        title: "text-[12px] tracking-[0.2em] text-gray-900",
        line: "bg-red-100",
      },
      {
        container: "border-gray-200 bg-white",
        accent: "bg-gray-400",
        icon: "text-gray-500",
        title: "text-[11px] tracking-[0.18em] text-gray-600",
        line: "bg-gray-100",
      },
      {
        container: "border-gray-100 bg-gray-50/70",
        accent: "bg-gray-300",
        icon: "text-gray-400",
        title: "text-[10px] tracking-[0.16em] text-gray-500",
        line: "bg-gray-100",
      }
    ][normalizedDepth];
    const toggleSection = () => {
      setExpandedPrescriptionDisplaySections(prev => {
        const next = new Set(prev);
        if (next.has(keyPrefix)) {
          next.delete(keyPrefix);
        } else {
          next.add(keyPrefix);
        }
        return next;
      });
    };

    return (
      <React.Fragment key={keyPrefix}>
        <div className={cn("rounded-2xl border px-4 py-3 shadow-sm", sectionStyles.container)}>
          <button
            onClick={toggleSection}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className={cn("h-7 w-1 shrink-0 rounded-full", sectionStyles.accent)} />
            <ChevronRight size={16} className={cn("shrink-0 transition-transform", isExpanded && "rotate-90", sectionStyles.icon)} />
            <h4 className={cn("font-bold uppercase", sectionStyles.title)}>
              {section.title || 'Sem título'}
            </h4>
            <div className={cn("h-px flex-1", sectionStyles.line)} />
          </button>
        </div>

        {isExpanded && (
          <>
          {(section.items || []).map((item, index) => (
            hasPrescriptionItemDisplayContent(item)
              ? renderPrescriptionDisplayItem(item, `${keyPrefix}-item-${index}`)
              : null
          ))}

          {(section.sections || []).map((childSection, index) => (
            renderPrescriptionSectionDisplay(
              childSection,
              `${keyPrefix}-section-${childSection.id || index}`,
              depth + 1
            )
          ))}
          </>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-gray-900 selection:bg-red-100 selection:text-red-900">
      
      {/* --- Header --- */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button 
            onClick={() => setView('home')}
            className="flex items-center gap-2 self-start"
          >
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
              U
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              Uso<span className="text-red-600">Jaleco</span>
            </h1>
          </button>
          
          <div className="flex w-full min-w-0 items-center justify-between gap-3 sm:w-auto sm:justify-end">
            {view === 'home' && (
              <div className="relative min-w-0 flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Pesquisar patologia..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full min-w-0 pl-10 pr-4 py-2 bg-gray-50 border-none rounded-full text-sm sm:w-64 focus:ring-2 focus:ring-red-100 transition-all outline-none"
                />
              </div>
            )}
            <button 
              onClick={handleGoToManagement}
              className={cn(
                "flex shrink-0 items-center justify-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold transition-all shadow-sm active:scale-95 border",
                view === 'management' 
                  ? "bg-red-600 border-red-600 text-white shadow-md shadow-red-200" 
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
              )}
            >
              <Activity size={14} className={view === 'management' ? "text-white" : "text-red-500"} />
              ADICIONAR / EDITAR
            </button>
          </div>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="mx-auto w-full max-w-6xl px-6 py-12">
        {dataError && (
          <div className="mb-8 rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {dataError}
          </div>
        )}

        {view === 'home' ? (
          <>
            {/* Category Filters */}
            <div className={cn(
              "mb-10 flex flex-wrap gap-2",
              selectedPathology ? "opacity-0" : "opacity-100"
            )}>
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "px-4 py-2 rounded-full text-[11px] font-bold transition-all border",
                  !selectedCategory 
                    ? "bg-red-600 border-red-600 text-white shadow-md shadow-red-100" 
                    : "bg-white border-gray-100 text-gray-500 hover:border-gray-200"
                )}
              >
                TUDO
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-full text-[11px] font-bold transition-all border",
                    selectedCategory === cat
                      ? "bg-red-600 border-red-600 text-white shadow-md shadow-red-100" 
                      : "bg-white border-gray-100 text-gray-500 hover:border-gray-200"
                  )}
                >
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Home List */}
            <div>
              {!currentPathology ? (
                <div
                  key="list"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {isLoadingData ? (
                    <div className="col-span-full rounded-2xl border border-gray-100 bg-gray-50 px-6 py-10 text-center text-sm font-semibold text-gray-400">
                      Carregando protocolos...
                    </div>
                  ) : filteredPathologies.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-gray-100 bg-gray-50 px-6 py-10 text-center text-sm font-semibold text-gray-400">
                      Nenhum protocolo encontrado.
                    </div>
                  ) : (
                    filteredPathologies.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleOpenPathology(p)}
                        className="group flex flex-col items-start p-6 rounded-2xl border border-gray-100 bg-white hover:border-red-200 hover:shadow-xl hover:shadow-red-500/5 transition-all text-left"
                      >
                        <div className="flex items-center justify-between w-full mb-4">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-1 rounded-md">
                            {p.category}
                          </span>
                          <ChevronRight size={16} className="text-gray-300 group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-2 leading-tight">
                          {p.name}
                        </h2>
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {p.diagnostico.criteria}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div
                  key="detail"
                  className="fixed inset-0 z-40 overflow-y-auto bg-white/80 backdrop-blur-sm p-0 sm:p-4"
                  onClick={handleClose}
                >
                  <div
                    tabIndex={0}
                    className="mx-auto bg-white w-full max-w-4xl min-h-screen sm:min-h-0 sm:rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-gray-100 focus:outline-none"
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Panel Header */}
                    <div className="px-8 py-6 border-b border-gray-50 flex items-start justify-between bg-white sticky top-0 z-10">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                            {currentPathology.category}
                          </span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                          {currentPathology.name}
                        </h2>
                      </div>
                      <button 
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Tabs */}
                    {availableProtocolTabs.length > 0 && (
                    <div className="px-8 bg-white border-b border-gray-100 flex gap-1 overflow-x-auto no-scrollbar scroll-smooth">
                      {availableProtocolTabs.map((t) => (
                        <TabButton 
                          key={t} 
                          label={t} 
                          active={activeTab === t} 
                          onClick={() => setActiveTab(t)} 
                        />
                      ))}
                    </div>
                    )}

                    {/* Content */}
                    <div className="px-8 py-10 bg-gray-50/20">
                      <div className="max-w-2xl mx-auto space-y-12 pb-12">
                        {availableProtocolTabs.length === 0 && (
                          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm font-semibold text-gray-400 shadow-sm">
                            Nenhuma seção preenchida neste protocolo.
                          </div>
                        )}
                        
                        {/* 1. Diagnóstico */}
                        {availableProtocolTabs.includes('Diagnóstico') && activeTab === 'Diagnóstico' && (
                          <div className="space-y-10">
                            {currentDisplayDiagnosticBlocks.map(renderDiagnosticBlockDisplay)}
                          </div>
                        )}

                        {/* 2. Exames */}
                        {availableProtocolTabs.includes('Exames') && activeTab === 'Exames' && (
                          <div className="space-y-8">
                            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                              <div className="flex items-center gap-4">
                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                   <Stethoscope size={16} className="text-red-500" />
                                   {selectedExamSequences.size > 0 ? `${selectedExamSequences.size} selecionados` : "Sequências de Exames"}
                                </h4>
                                {selectedExamSequences.size > 0 && (
                                  <button
                                    onClick={() => setSelectedExamSequences(new Set())}
                                    className="text-[10px] font-bold text-red-600 hover:underline uppercase tracking-wider"
                                  >
                                    Limpar
                                  </button>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {selectedExamSequences.size > 0 && (
                                  <button
                                    onClick={() => {
                                      const text = currentDisplayExamEntries
                                        .filter(entry => selectedExamSequences.has(entry.key))
                                        .map(formatExamEntry)
                                        .join('\n\n');
                                      copyToClipboard(text);
                                      setSelectedExamSequences(new Set());
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-full text-[11px] font-bold hover:bg-red-700 transition-all shadow-md shadow-red-100 active:scale-95"
                                  >
                                    <Clipboard size={14} />
                                    COPIAR SELECIONADOS
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    const text = formatExams({
                                      ...currentPathology.exames,
                                      blocks: currentDisplayExamBlocks
                                    });
                                    copyToClipboard(text);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-full text-[11px] font-bold hover:bg-black transition-all active:scale-95"
                                >
                                  <Check size={14} />
                                  TODOS OS EXAMES
                                </button>
                              </div>
                            </div>

                            {currentPathology.exames.blocks.map((block, bi) => (
                              hasExamBlockDisplayContent(block) ? (
                              <div key={bi} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                                <div>
                                  <h4 className="text-lg font-bold text-gray-900 mb-1">{block.title}</h4>
                                  {block.subtitle && <p className="text-sm text-gray-500">{block.subtitle}</p>}
                                </div>
                                
                                <div className="grid gap-6">
                                  {block.sequences.map((seq, si) => (
                                    renderExamSequenceDisplay(seq, `block-${bi}-sequence-${si}`)
                                  ))}
                                </div>
                              </div>
                              ) : null
                            ))}
                            {currentPathology.exames.observations && (
                              <div className="flex gap-3 text-sm bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-blue-700 shadow-sm">
                                <Info size={18} className="shrink-0" />
                                <p>{currentPathology.exames.observations}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. Orientações */}
                        {availableProtocolTabs.includes('Orientações') && activeTab === 'Orientações' && (
                          <div className="space-y-6">
                            {currentDisplayOrientationBlocks.map((block, i) => (
                              <div key={i} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                  <div className="w-1.5 h-6 bg-red-500 rounded-full" />
                                  {block.title}
                                </h4>
                                <ul className="space-y-4">
                                  {block.items.map((item, ii) => (
                                    <li key={ii} className="flex items-start gap-4 text-gray-700 leading-relaxed">
                                      <div className="mt-2 w-1.5 h-1.5 bg-red-400 rounded-full shrink-0" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 4. Prescrição */}
                        {availableProtocolTabs.includes('Prescrição') && activeTab === 'Prescrição' && (
                          <div className="space-y-8">
                            <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex min-w-0 flex-wrap items-center gap-3">
                                <h4 className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                   <Pill size={16} className="text-red-500" />
                                   {selectedPrescriptionItems.size > 0 ? `${selectedPrescriptionItems.size} selecionado${selectedPrescriptionItems.size === 1 ? '' : 's'}` : "Itens da Prescrição"}
                                </h4>
                                {selectedPrescriptionItems.size > 0 && (
                                  <button 
                                    onClick={() => setSelectedPrescriptionItems(new Set())}
                                    className="text-[10px] font-black uppercase tracking-widest text-red-600 hover:underline"
                                  >
                                    Limpar
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                {selectedPrescriptionItems.size > 0 && (
                                  <button 
                                    onClick={() => {
                                      const text = currentDisplayPrescriptionEntries
                                        .filter(entry => selectedPrescriptionItems.has(entry.key))
                                        .map(formatPrescriptionEntry)
                                        .join('\n\n');
                                      copyToClipboard(text);
                                      setSelectedPrescriptionItems(new Set());
                                    }}
                                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-[10px] font-black uppercase tracking-tight text-white shadow-md shadow-red-100 transition-all hover:bg-red-700 active:scale-95"
                                  >
                                    <Clipboard size={14} />
                                    <span>Copiar selecionados</span>
                                  </button>
                                )}
                                <button 
                                  onClick={() => {
                                    const text = formatPrescription(getDisplayPrescription(currentPathology.prescricao));
                                    copyToClipboard(text);
                                  }}
                                  className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-gray-900 px-5 text-[10px] font-black uppercase tracking-tight text-white transition-all hover:bg-black active:scale-95"
                                >
                                  <Check size={14} />
                                  <span>Receita completa</span>
                                </button>
                              </div>
                            </div>

                            <div className="space-y-4">
                              {currentPathology.prescricao.items.map((item, i) => {
                                if (!hasPrescriptionItemDisplayContent(item)) {
                                  return null;
                                }

                                return renderPrescriptionDisplayItem(item, `root-item-${i}`);
                              })}
                              {(currentPathology.prescricao.sections || []).map((section, sectionIndex) => (
                                renderPrescriptionSectionDisplay(
                                  section,
                                  `root-section-${section.id || sectionIndex}`
                                )
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 5. Metas Terapêuticas */}
                        {availableProtocolTabs.includes('Metas terapêuticas') && activeTab === 'Metas terapêuticas' && (
                          <div className="space-y-10">
                            {currentDisplayMetaBlocks.map((block, i) => (
                              <div key={i} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                                {block.title && (
                                  <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                     <Target size={20} className="text-red-500" />
                                     {block.title}
                                  </h4>
                                )}
                                {(Array.isArray(block.content) ? block.content.length > 0 : block.content) && (
                                  <div className="text-gray-700 leading-relaxed">
                                    {renderFormattedText(block.content)}
                                  </div>
                                )}
                                
                                {block.table && (
                                  <div className="border border-gray-100 rounded-xl overflow-hidden mt-4 shadow-sm">
                                    <table className="w-full text-sm text-center">
                                      <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider text-[9px] border-b border-gray-100">
                                        <tr>
                                          {block.table.headers.map((h, hi) => <th key={hi} className="px-6 py-4 border-r border-gray-100 last:border-r-0">{h}</th>)}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-50">
                                        {block.table.rows.map((row, ri) => (
                                          <tr key={ri} className="hover:bg-gray-50/50 transition-colors">
                                            {row.map((cell, ci) => (
                                              <td key={ci} className={cn("px-6 py-4 text-gray-600 border-r border-gray-100 last:border-r-0 h-12 align-middle", ci === 1 && "font-bold text-red-700")}>
                                                {cell}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    </div>
                    
                    {/* Panel Footer */}
                    <div className="px-8 py-5 bg-white border-t border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Activity size={16} className="text-red-500" />
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          UsoJaleco — Dr. Arthur Ambrosi
                        </p>
                      </div>
                      <button 
                        onClick={handleClose}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all shadow-md shadow-red-200"
                      >
                        CONCLUIR CONSULTA
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div
            className="mx-auto w-full max-w-6xl"
          >
            <div className="flex items-center gap-4 mb-12">
              <button 
                onClick={() => setView('home')}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
              >
                <ChevronRight size={24} className="rotate-180" />
              </button>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">Gerenciar Protocolos</h2>
            </div>

            {!managementChoice ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <button 
                  onClick={() => setManagementChoice('add')}
                  className="group bg-white p-10 rounded-3xl border border-gray-100 shadow-sm hover:border-red-500 hover:shadow-2xl hover:shadow-red-500/5 transition-all text-left flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 transition-transform group-hover:scale-110 group-active:scale-95">
                    <Activity size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Adicionar Novo Protocolo</h3>
                    <p className="text-sm text-gray-400">Crie uma nova patologia configurando diagnósticos, exames e orientações.</p>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setManagementSearch('');
                    setManagementChoice('edit');
                  }}
                  className="group bg-white p-10 rounded-3xl border border-gray-100 shadow-sm hover:border-gray-900 hover:shadow-2xl transition-all text-left flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900 transition-transform group-hover:scale-110 group-active:scale-95">
                    <FileText size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Editar Existente</h3>
                    <p className="text-sm text-gray-400">Selecione uma patologia da sua lista pessoal para atualizar informações.</p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                  <h4 className="font-bold text-xl text-gray-900">
                    {managementChoice === 'add' ? "Novo Protocolo" : "Selecionar para Editar"}
                  </h4>
                  <button 
                    onClick={() => setManagementChoice(null)}
                    className="text-xs font-bold text-red-600 hover:underline uppercase tracking-widest"
                  >
                    Voltar
                  </button>
                </div>
                
                {managementChoice === 'edit' ? (
                  <div className="p-4 space-y-2">
                    {!editingPathology ? (
                      <>
                        <div className="relative mb-4">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input
                            type="text"
                            placeholder="Buscar protocolo, medicamento ou título..."
                            value={managementSearch}
                            onChange={(e) => setManagementSearch(e.target.value)}
                            className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition-all focus:bg-white focus:ring-2 focus:ring-red-100"
                          />
                        </div>
                        {editablePathologies.length === 0 ? (
                          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-10 text-center text-sm font-semibold text-gray-400">
                            Nenhum protocolo encontrado.
                          </div>
                        ) : (
                          editablePathologies.map(p => (
                            <button
                              key={p.id}
                              onClick={() => setEditingPathology(p)}
                              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors text-left group"
                            >
                              <div>
                                <p className="text-sm font-bold text-gray-900">{p.name}</p>
                                <p className="text-xs text-gray-400">{p.category}</p>
                              </div>
                              <div className="flex items-center gap-2 text-gray-300 group-hover:text-red-500 transition-colors">
                                <span className="text-[10px] font-bold uppercase tracking-widest mr-2">Editar</span>
                                <ChevronRight size={16} />
                              </div>
                            </button>
                          ))
                        )}
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="px-8 py-2 flex justify-end">
                           <button 
                             onClick={() => handleDeletePathology(editingPathology.id)}
                             className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors"
                           >
                             Excluir Protocolo
                           </button>
                        </div>
                        <PathologyForm 
                          initialData={editingPathology}
                          onSave={handleSavePathology}
                          onCancel={() => setEditingPathology(null)}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <PathologyForm 
                      onSave={handleSavePathology}
                      onCancel={() => setManagementChoice(null)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- Global Footer --- */}
      <footer className={cn(
        "mx-auto flex w-full max-w-6xl flex-col items-start gap-8 border-t border-gray-50 px-6 py-12 text-left md:flex-row md:justify-between",
        selectedPathology ? "opacity-30 pointer-events-none" : "opacity-100"
      )}>
        <div className="space-y-4">
          <div className="flex items-center justify-start gap-2">
             <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-lg">U</div>
             <span className="font-bold text-gray-900 tracking-tight text-xl">UsoJaleco</span>
          </div>
          <p className="text-sm text-gray-400 max-w-sm">
            Ferramenta pessoal de consulta médica rápida. Desenvolvido para agilizar a prática clínica com precisão e minimalismo.
          </p>
        </div>
        
        <div className="flex w-full flex-wrap justify-start gap-8 md:w-auto md:justify-end">
           <div className="space-y-3">
              <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Atalhos</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><button className="hover:text-red-600 transition-colors">Cardiologia</button></li>
                <li><button className="hover:text-red-600 transition-colors">Emergência</button></li>
                <li><button className="hover:text-red-600 transition-colors">Pediátricos</button></li>
              </ul>
           </div>
           <div className="space-y-3">
              <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Suporte</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><button className="hover:text-red-600 transition-colors">Privacidade</button></li>
                <li><button className="hover:text-red-600 transition-colors">Feedback</button></li>
              </ul>
           </div>
        </div>
      </footer>

    </div>
  );
}
