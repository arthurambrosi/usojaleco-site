import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, Check, ExternalLink, Link2, Plus, RotateCcw, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export type ClinicalResourceMode =
  | 'external_link'
  | 'sum_points'
  | 'formula'
  | 'direct_classification'
  | 'classification_scale'
  | 'rule_based';

export type ClinicalResourceInputType =
  | 'boolean'
  | 'true_false'
  | 'presence_absence'
  | 'single_choice'
  | 'multiple_choice'
  | 'number'
  | 'text'
  | 'select';

export interface ClinicalResourceResult {
  value?: string | number;
  min?: number;
  max?: number;
  title?: string;
  label?: string;
  classification?: string;
  description?: string;
  interpretation?: string;
  guidance?: string;
  note?: string;
}

export interface ClinicalResourceOption {
  id?: string;
  value?: string | number | boolean;
  label: string;
  description?: string;
  score?: number;
  result?: ClinicalResourceResult;
  interpretation?: string;
  guidance?: string;
}

export interface ClinicalResourceInput {
  id: string;
  label: string;
  description?: string;
  type: ClinicalResourceInputType;
  required?: boolean;
  unit?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  options?: ClinicalResourceOption[];
}

export interface ClinicalResourceFormula {
  expression: string;
  unit?: string;
  decimals?: number;
}

export interface ClinicalResourceRule {
  when?: Record<string, unknown>;
  result?: ClinicalResourceResult;
}

export interface ClinicalResource {
  schemaVersion?: string;
  type?: 'clinical_resource' | 'score_calculator_link';
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  source?: string;
  mode: ClinicalResourceMode;
  externalUrl?: string;
  link?: string;
  inputs?: ClinicalResourceInput[];
  formula?: string | ClinicalResourceFormula;
  categories?: ClinicalResourceOption[];
  results?: ClinicalResourceResult[];
  interpretations?: ClinicalResourceResult[];
  rules?: ClinicalResourceRule[];
  notes?: string | string[];
  unit?: string;
  decimals?: number;
}

export type ClinicalResourceEditorMode = 'external_link' | 'manual' | 'json';

interface ValidationResult {
  resource?: ClinicalResource;
  errors: string[];
}

type AnswerValue = string | number | boolean | Array<string | number | boolean>;

const RESOURCE_MODES: ClinicalResourceMode[] = [
  'external_link',
  'sum_points',
  'formula',
  'direct_classification',
  'classification_scale',
  'rule_based'
];

const RESOURCE_INPUT_TYPES: ClinicalResourceInputType[] = [
  'boolean',
  'true_false',
  'presence_absence',
  'single_choice',
  'multiple_choice',
  'number',
  'text',
  'select'
];

const SCORE_INPUT_TYPES = new Set<ClinicalResourceInputType>([
  'boolean',
  'true_false',
  'presence_absence',
  'single_choice',
  'multiple_choice',
  'select'
]);

const MODE_LABELS: Record<ClinicalResourceMode, string> = {
  external_link: 'Link externo',
  sum_points: 'Soma de pontos',
  formula: 'Fórmula',
  direct_classification: 'Classificação direta',
  classification_scale: 'Escala classificatória',
  rule_based: 'Baseado em regras'
};

const INPUT_TYPE_LABELS: Record<ClinicalResourceInputType, string> = {
  boolean: 'Sim / Não',
  true_false: 'Verdadeiro / Falso',
  presence_absence: 'Presença / Ausência',
  single_choice: 'Escolha única',
  multiple_choice: 'Múltipla escolha',
  number: 'Número',
  text: 'Texto livre',
  select: 'Seleção'
};

const toText = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const normalized = Number(value.replace(',', '.'));
    return Number.isFinite(normalized) ? normalized : undefined;
  }
  return undefined;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const createResourceEntityId = (prefix: string) => {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeMode = (value: unknown): ClinicalResourceMode | null => {
  const mode = toText(value);
  if (mode === 'classification') return 'direct_classification';
  if (mode === 'direct') return 'direct_classification';
  if (mode === 'link') return 'external_link';
  if (RESOURCE_MODES.includes(mode as ClinicalResourceMode)) {
    return mode as ClinicalResourceMode;
  }
  return null;
};

const normalizeInputType = (value: unknown): ClinicalResourceInputType | null => {
  const type = toText(value);
  if (type === 'yes_no') return 'boolean';
  if (type === 'choice') return 'single_choice';
  if (RESOURCE_INPUT_TYPES.includes(type as ClinicalResourceInputType)) {
    return type as ClinicalResourceInputType;
  }
  return null;
};

const normalizeOption = (value: unknown): ClinicalResourceOption => {
  const option = isObject(value) ? value : {};
  const result = isObject(option.result) ? normalizeResult(option.result) : undefined;
  const normalized: ClinicalResourceOption = {
    label: toText(option.label)
  };
  const id = toText(option.id);
  const description = toText(option.description);
  const interpretation = toText(option.interpretation);
  const guidance = toText(option.guidance);
  const score = toNumber(option.score);

  if (id) normalized.id = id;
  if ('value' in option) normalized.value = option.value as string | number | boolean;
  if (description) normalized.description = description;
  if (score !== undefined) normalized.score = score;
  if (result) normalized.result = result;
  if (interpretation) normalized.interpretation = interpretation;
  if (guidance) normalized.guidance = guidance;

  return normalized;
};

const normalizeInput = (value: unknown): ClinicalResourceInput => {
  const input = isObject(value) ? value : {};
  const type = normalizeInputType(input.type) || 'single_choice';
  const normalized: ClinicalResourceInput = {
    id: toText(input.id),
    label: toText(input.label),
    type
  };
  const description = toText(input.description);
  const unit = toText(input.unit);
  const placeholder = toText(input.placeholder);
  const min = toNumber(input.min);
  const max = toNumber(input.max);

  if (description) normalized.description = description;
  if (input.required === true) normalized.required = true;
  if (unit) normalized.unit = unit;
  if (placeholder) normalized.placeholder = placeholder;
  if (min !== undefined) normalized.min = min;
  if (max !== undefined) normalized.max = max;
  if (Array.isArray(input.options)) {
    normalized.options = input.options.map(normalizeOption);
  }

  return normalized;
};

const normalizeResult = (value: unknown): ClinicalResourceResult => {
  const result = isObject(value) ? value : {};
  const normalized: ClinicalResourceResult = {};
  const min = toNumber(result.min);
  const max = toNumber(result.max);

  if ('value' in result) normalized.value = result.value as string | number;
  if (min !== undefined) normalized.min = min;
  if (max !== undefined) normalized.max = max;

  (['title', 'label', 'classification', 'description', 'interpretation', 'guidance', 'note'] as const).forEach((field) => {
    const text = toText(result[field]);
    if (text) normalized[field] = text;
  });

  return normalized;
};

const normalizeFormula = (value: unknown): string | ClinicalResourceFormula | undefined => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (!isObject(value)) return undefined;

  const expression = toText(value.expression);
  if (!expression) return undefined;

  const normalized: ClinicalResourceFormula = { expression };
  const unit = toText(value.unit);
  const decimals = toNumber(value.decimals);

  if (unit) normalized.unit = unit;
  if (decimals !== undefined) normalized.decimals = Math.max(0, Math.min(8, Math.round(decimals)));

  return normalized;
};

const normalizeRules = (value: unknown): ClinicalResourceRule[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isObject)
    .map((rule) => ({
      when: isObject(rule.when) ? rule.when : undefined,
      result: isObject(rule.result) ? normalizeResult(rule.result) : undefined
    }))
    .filter(rule => rule.when || rule.result);
};

export const normalizeClinicalResource = (value: unknown): ClinicalResource | null => {
  if (!isObject(value)) return null;

  const mode = normalizeMode(value.mode);
  if (!mode) return null;

  const normalized: ClinicalResource = {
    schemaVersion: toText(value.schemaVersion) || '1',
    type: 'clinical_resource',
    id: toText(value.id) || createResourceEntityId('resource'),
    title: toText(value.title),
    mode
  };

  const subtitle = toText(value.subtitle);
  const description = toText(value.description);
  const source = toText(value.source);
  const externalUrl = toText(value.externalUrl || value.link || value.url);
  const unit = toText(value.unit);
  const decimals = toNumber(value.decimals);

  if (subtitle) normalized.subtitle = subtitle;
  if (description) normalized.description = description;
  if (source) normalized.source = source;
  if (externalUrl) normalized.externalUrl = externalUrl;
  if (unit) normalized.unit = unit;
  if (decimals !== undefined) normalized.decimals = Math.max(0, Math.min(8, Math.round(decimals)));
  if (Array.isArray(value.inputs)) normalized.inputs = value.inputs.map(normalizeInput);
  if (Array.isArray(value.categories)) normalized.categories = value.categories.map(normalizeOption);
  if (Array.isArray(value.results)) normalized.results = value.results.map(normalizeResult);
  if (Array.isArray(value.interpretations)) normalized.interpretations = value.interpretations.map(normalizeResult);

  const formula = normalizeFormula(value.formula);
  if (formula) normalized.formula = formula;

  const rules = normalizeRules(value.rules);
  if (rules.length > 0) normalized.rules = rules;

  if (Array.isArray(value.notes)) {
    const notes = value.notes.map(toText).filter(Boolean);
    if (notes.length > 0) normalized.notes = notes;
  } else {
    const notes = toText(value.notes);
    if (notes) normalized.notes = notes;
  }

  return normalized;
};

export const validateClinicalResource = (value: unknown): ValidationResult => {
  const resource = normalizeClinicalResource(value);
  const errors: string[] = [];

  if (!resource) {
    return { errors: ['JSON inválido: informe um objeto com o campo "mode" reconhecido.'] };
  }

  if (!resource.title) {
    errors.push('Campo obrigatório ausente: title.');
  }

  if (resource.mode === 'external_link') {
    if (!resource.externalUrl && !resource.link) {
      errors.push('Link externo: informe "externalUrl" ou "link".');
    }
  }

  if (resource.mode === 'formula') {
    const expression = getFormulaExpression(resource);
    if (!expression) {
      errors.push('Calculadora por fórmula: informe "formula" ou "formula.expression".');
    }
    if (!resource.inputs?.some(input => input.type === 'number' || input.type === 'select')) {
      errors.push('Calculadora por fórmula: informe ao menos um item numérico ou select em "inputs".');
    }
  }

  if (resource.mode === 'sum_points') {
    if (!resource.inputs?.length) {
      errors.push('Score por soma: informe "inputs".');
    }
    resource.inputs?.forEach((input, inputIndex) => {
      if (!SCORE_INPUT_TYPES.has(input.type)) {
        errors.push(`Item ${inputIndex + 1}: para soma de pontos use opções boolean, single_choice, multiple_choice ou select.`);
      }
      if (!input.options?.length) {
        errors.push(`Item ${inputIndex + 1}: informe opções de resposta.`);
      }
      input.options?.forEach((option, optionIndex) => {
        if (option.score === undefined) {
          errors.push(`Item ${inputIndex + 1}, opção ${optionIndex + 1}: informe score.`);
        }
      });
    });
  }

  if (resource.mode === 'direct_classification' || resource.mode === 'classification_scale') {
    const categories = getDirectClassificationOptions(resource);
    if (categories.length === 0) {
      errors.push('Escala classificatória: informe "categories" ou um input com opções.');
    }
  }

  if (resource.mode === 'rule_based' && !resource.rules?.length) {
    errors.push('Sistema baseado em regras: informe "rules".');
  }

  resource.inputs?.forEach((input, inputIndex) => {
    if (!input.id) errors.push(`Item ${inputIndex + 1}: campo obrigatório "id" ausente.`);
    if (!input.label) errors.push(`Item ${inputIndex + 1}: campo obrigatório "label" ausente.`);
    if (!RESOURCE_INPUT_TYPES.includes(input.type)) errors.push(`Item ${inputIndex + 1}: tipo de entrada inválido.`);
    if (['boolean', 'true_false', 'presence_absence', 'single_choice', 'multiple_choice', 'select'].includes(input.type)) {
      input.options?.forEach((option, optionIndex) => {
        if (!option.label) errors.push(`Item ${inputIndex + 1}, opção ${optionIndex + 1}: campo obrigatório "label" ausente.`);
      });
    }
  });

  return { resource, errors };
};

export const parseClinicalResourceJson = (json: string): ValidationResult => {
  try {
    return validateClinicalResource(JSON.parse(json));
  } catch (error) {
    return {
      errors: [`JSON inválido: ${error instanceof Error ? error.message : 'não foi possível interpretar o conteúdo.'}`]
    };
  }
};

export const getClinicalResourceErrors = (resource: unknown) => validateClinicalResource(resource).errors;

export const createEmptyClinicalResource = (mode: ClinicalResourceMode = 'external_link'): ClinicalResource => ({
  schemaVersion: '1',
  type: 'clinical_resource',
  id: createResourceEntityId('resource'),
  title: '',
  subtitle: '',
  source: '',
  mode,
  ...(mode === 'external_link' ? { externalUrl: '' } : {}),
  ...(mode === 'sum_points'
    ? {
        inputs: [
          {
            id: 'item_1',
            label: '',
            type: 'boolean',
            required: true,
            options: [
              { value: 'nao', label: 'Não', score: 0 },
              { value: 'sim', label: 'Sim', score: 1 }
            ]
          }
        ],
        results: []
      }
    : {}),
  ...(mode === 'formula'
    ? {
        inputs: [{ id: 'valor', label: '', type: 'number', required: true }],
        formula: { expression: 'valor', unit: '', decimals: 2 },
        results: []
      }
    : {}),
  ...(mode === 'direct_classification' || mode === 'classification_scale'
    ? {
        categories: [{ value: 'classe_1', label: '', description: '' }]
      }
    : {}),
  ...(mode === 'rule_based'
    ? {
        inputs: [{ id: 'criterio', label: '', type: 'single_choice', required: true, options: [{ value: 'a', label: '' }] }],
        rules: []
      }
    : {})
});

export const createClinicalResourceExampleJson = () => JSON.stringify({
  schemaVersion: '1',
  type: 'clinical_resource',
  id: 'exemplo-score',
  title: 'Exemplo de score clínico',
  subtitle: 'Soma simples de pontos',
  source: 'Fonte do material original',
  mode: 'sum_points',
  inputs: [
    {
      id: 'criterio_1',
      label: 'Critério 1 presente?',
      type: 'boolean',
      required: true,
      options: [
        { value: 'nao', label: 'Não', score: 0 },
        { value: 'sim', label: 'Sim', score: 1 }
      ]
    }
  ],
  results: [
    {
      min: 0,
      max: 0,
      title: 'Sem classificação informada',
      interpretation: ''
    }
  ],
  notes: ['Adicionar apenas interpretações presentes no material original.']
}, null, 2);

const getFormulaExpression = (resource: ClinicalResource) => {
  return typeof resource.formula === 'string' ? resource.formula : resource.formula?.expression || '';
};

const getFormulaUnit = (resource: ClinicalResource) => {
  return typeof resource.formula === 'object' ? resource.formula.unit || resource.unit : resource.unit;
};

const getFormulaDecimals = (resource: ClinicalResource) => {
  return typeof resource.formula === 'object' && resource.formula.decimals !== undefined
    ? resource.formula.decimals
    : resource.decimals;
};

const optionValue = (option: ClinicalResourceOption, index: number) => {
  return option.value ?? option.id ?? option.label ?? index;
};

const answerKey = (value: unknown) => String(value);

const getDirectClassificationOptions = (resource: ClinicalResource) => {
  if (resource.categories?.length) return resource.categories;
  return resource.inputs?.find(input => input.options?.length)?.options || [];
};

const getOptionByValue = (options: ClinicalResourceOption[] | undefined, value: unknown) => {
  return options?.find((option, index) => answerKey(optionValue(option, index)) === answerKey(value));
};

const getRangeResult = (resource: ClinicalResource, value: number): ClinicalResourceResult | undefined => {
  const ranges = [...(resource.results || []), ...(resource.interpretations || [])];

  return ranges.find((range) => {
    if (range.value !== undefined && Number(range.value) === value) return true;
    const aboveMin = range.min === undefined || value >= range.min;
    const belowMax = range.max === undefined || value <= range.max;
    return aboveMin && belowMax;
  });
};

const getRequiredError = (resource: ClinicalResource, answers: Record<string, AnswerValue>) => {
  const missing = (resource.inputs || []).find((input) => {
    if (!input.required) return false;
    const answer = answers[input.id];
    if (Array.isArray(answer)) return answer.length === 0;
    return answer === undefined || answer === null || answer === '';
  });

  return missing ? `Preencha: ${missing.label || missing.id}.` : '';
};

const getNumericAnswers = (resource: ClinicalResource, answers: Record<string, AnswerValue>) => {
  const values: Record<string, number> = {};

  (resource.inputs || []).forEach((input) => {
    const answer = answers[input.id];
    const directNumber = toNumber(answer);

    if (directNumber !== undefined) {
      values[input.id] = directNumber;
      return;
    }

    const option = getOptionByValue(input.options, answer);
    const optionNumber = toNumber(option?.value);
    const optionScore = toNumber(option?.score);

    if (optionNumber !== undefined) values[input.id] = optionNumber;
    else if (optionScore !== undefined) values[input.id] = optionScore;
  });

  return values;
};

const calculateScore = (resource: ClinicalResource, answers: Record<string, AnswerValue>) => {
  return (resource.inputs || []).reduce((total, input) => {
    const answer = answers[input.id];

    if (input.type === 'multiple_choice' && Array.isArray(answer)) {
      return total + answer.reduce<number>((sum, selectedValue) => {
        const option = getOptionByValue(input.options, selectedValue);
        return sum + (option?.score || 0);
      }, 0);
    }

    const option = getOptionByValue(input.options, answer);
    return total + (option?.score || 0);
  }, 0);
};

const evaluateRuleCondition = (answer: AnswerValue | undefined, condition: unknown) => {
  if (isObject(condition)) {
    if ('equals' in condition && answer !== condition.equals) return false;
    if ('not' in condition && answer === condition.not) return false;
    if ('includes' in condition) {
      const values = Array.isArray(answer) ? answer.map(answerKey) : [answerKey(answer)];
      if (!values.includes(answerKey(condition.includes))) return false;
    }
    const numericAnswer = toNumber(answer);
    const min = toNumber(condition.min);
    const max = toNumber(condition.max);
    if (min !== undefined && (numericAnswer === undefined || numericAnswer < min)) return false;
    if (max !== undefined && (numericAnswer === undefined || numericAnswer > max)) return false;
    return true;
  }

  if (Array.isArray(answer)) {
    return answer.map(answerKey).includes(answerKey(condition));
  }

  return answerKey(answer) === answerKey(condition);
};

const evaluateRules = (resource: ClinicalResource, answers: Record<string, AnswerValue>) => {
  return resource.rules?.find((rule) => {
    if (!rule.when) return false;
    return Object.entries(rule.when).every(([inputId, condition]) => evaluateRuleCondition(answers[inputId], condition));
  })?.result;
};

type FormulaToken =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma'; value: ',' };

const tokenizeFormula = (expression: string): FormulaToken[] => {
  const tokens: FormulaToken[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let end = index + 1;
      while (end < expression.length && /[0-9.]/.test(expression[end])) end += 1;
      const value = Number(expression.slice(index, end));
      if (!Number.isFinite(value)) throw new Error('Número inválido na fórmula.');
      tokens.push({ type: 'number', value });
      index = end;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (end < expression.length && /[A-Za-z0-9_]/.test(expression[end])) end += 1;
      tokens.push({ type: 'identifier', value: expression.slice(index, end) });
      index = end;
      continue;
    }

    if ('+-*/^'.includes(char)) {
      tokens.push({ type: 'operator', value: char });
      index += 1;
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      index += 1;
      continue;
    }

    if (char === ',') {
      tokens.push({ type: 'comma', value: ',' });
      index += 1;
      continue;
    }

    throw new Error(`Caractere não suportado na fórmula: ${char}`);
  }

  return tokens;
};

class FormulaParser {
  private position = 0;

  constructor(
    private readonly tokens: FormulaToken[],
    private readonly values: Record<string, number>
  ) {}

  parse() {
    const value = this.parseExpression();
    if (this.peek()) throw new Error('Fórmula incompleta ou com operadores sobrando.');
    return value;
  }

  private parseExpression() {
    let value = this.parseTerm();

    while (this.matchOperator('+') || this.matchOperator('-')) {
      const operator = this.previous().value;
      const right = this.parseTerm();
      value = operator === '+' ? value + right : value - right;
    }

    return value;
  }

  private parseTerm() {
    let value = this.parsePower();

    while (this.matchOperator('*') || this.matchOperator('/')) {
      const operator = this.previous().value;
      const right = this.parsePower();
      if (operator === '/' && right === 0) throw new Error('Divisão por zero.');
      value = operator === '*' ? value * right : value / right;
    }

    return value;
  }

  private parsePower() {
    let value = this.parseUnary();

    while (this.matchOperator('^')) {
      value = Math.pow(value, this.parseUnary());
    }

    return value;
  }

  private parseUnary(): number {
    if (this.matchOperator('-')) return -this.parseUnary();
    if (this.matchOperator('+')) return this.parseUnary();
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.advance();
    if (!token) throw new Error('Fórmula incompleta.');

    if (token.type === 'number') return token.value;

    if (token.type === 'identifier') {
      if (this.matchParen('(')) {
        const args: number[] = [];
        if (!this.checkParen(')')) {
          do {
            args.push(this.parseExpression());
          } while (this.matchComma());
        }
        if (!this.matchParen(')')) throw new Error('Parêntese não fechado na fórmula.');
        return this.callFunction(token.value, args);
      }

      const value = this.values[token.value];
      if (value === undefined) throw new Error(`Valor ausente para "${token.value}".`);
      return value;
    }

    if (token.type === 'paren' && token.value === '(') {
      const value = this.parseExpression();
      if (!this.matchParen(')')) throw new Error('Parêntese não fechado na fórmula.');
      return value;
    }

    throw new Error('Fórmula inválida.');
  }

  private callFunction(name: string, args: number[]) {
    switch (name) {
      case 'abs': return Math.abs(args[0]);
      case 'sqrt': return Math.sqrt(args[0]);
      case 'round': return Math.round(args[0]);
      case 'floor': return Math.floor(args[0]);
      case 'ceil': return Math.ceil(args[0]);
      case 'min': return Math.min(...args);
      case 'max': return Math.max(...args);
      case 'pow': return Math.pow(args[0], args[1]);
      case 'log': return Math.log(args[0]);
      case 'exp': return Math.exp(args[0]);
      default:
        throw new Error(`Função não suportada: ${name}.`);
    }
  }

  private peek() {
    return this.tokens[this.position];
  }

  private previous() {
    return this.tokens[this.position - 1] as FormulaToken & { value: string };
  }

  private advance() {
    return this.tokens[this.position++];
  }

  private matchOperator(operator: string) {
    const token = this.peek();
    if (token?.type === 'operator' && token.value === operator) {
      this.position += 1;
      return true;
    }
    return false;
  }

  private checkParen(paren: '(' | ')') {
    const token = this.peek();
    return token?.type === 'paren' && token.value === paren;
  }

  private matchParen(paren: '(' | ')') {
    if (this.checkParen(paren)) {
      this.position += 1;
      return true;
    }
    return false;
  }

  private matchComma() {
    const token = this.peek();
    if (token?.type === 'comma') {
      this.position += 1;
      return true;
    }
    return false;
  }
}

const evaluateFormula = (expression: string, values: Record<string, number>) => {
  const result = new FormulaParser(tokenizeFormula(expression), values).parse();
  if (!Number.isFinite(result)) throw new Error('A fórmula não retornou um número válido.');
  return result;
};

const AutoSizeTextarea = ({
  value,
  className,
  rows = 3,
  onChange,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const resize = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    if (ref.current) resize(ref.current);
  }, [value]);

  return (
    <textarea
      {...props}
      ref={ref}
      value={value}
      rows={rows}
      onChange={(event) => {
        onChange?.(event);
        resize(event.currentTarget);
      }}
      className={cn('overflow-hidden resize-none', className)}
    />
  );
};

const SmallLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">{children}</label>
);

const notesToArray = (notes?: string | string[]) => {
  if (!notes) return [];
  return Array.isArray(notes) ? notes.filter(Boolean) : notes.split('\n').map(item => item.trim()).filter(Boolean);
};

const formatResultNumber = (value: number, decimals?: number) => {
  if (decimals === undefined) return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return value.toFixed(decimals);
};

const ResultBox = ({
  label,
  value,
  unit,
  result
}: {
  label: string;
  value?: string;
  unit?: string;
  result?: ClinicalResourceResult;
}) => (
  <div className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">Resultado</p>
    <div className="mt-2 flex flex-wrap items-baseline gap-2">
      <span className="text-2xl font-bold text-gray-900">{value || label}</span>
      {unit && <span className="text-sm font-semibold text-gray-500">{unit}</span>}
    </div>
    {result && (
      <div className="mt-4 space-y-2 text-sm text-gray-700">
        {(result.title || result.label || result.classification) && (
          <p className="font-bold text-red-800">{result.title || result.label || result.classification}</p>
        )}
        {result.description && <p>{result.description}</p>}
        {result.interpretation && <p>{result.interpretation}</p>}
        {result.guidance && <p className="font-medium text-gray-900">{result.guidance}</p>}
        {result.note && <p className="text-xs text-gray-500">{result.note}</p>}
      </div>
    )}
  </div>
);

export function ClinicalResourceRenderer({ resource }: { resource: ClinicalResource }) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [error, setError] = useState('');
  const [calculated, setCalculated] = useState<{
    value?: number;
    label?: string;
    unit?: string;
    result?: ClinicalResourceResult;
  } | null>(null);
  const mode = resource.mode;
  const notes = notesToArray(resource.notes);

  const updateAnswer = (inputId: string, value: AnswerValue) => {
    setAnswers(prev => ({ ...prev, [inputId]: value }));
    setError('');
    if (mode !== 'direct_classification' && mode !== 'classification_scale') {
      setCalculated(null);
    }
  };

  const clear = () => {
    setAnswers({});
    setCalculated(null);
    setError('');
  };

  const handleCalculate = () => {
    const requiredError = getRequiredError(resource, answers);
    if (requiredError) {
      setError(requiredError);
      setCalculated(null);
      return;
    }

    try {
      if (mode === 'sum_points') {
        const score = calculateScore(resource, answers);
        setCalculated({
          value: score,
          label: 'Pontuação total',
          unit: 'pontos',
          result: getRangeResult(resource, score)
        });
      }

      if (mode === 'formula') {
        const expression = getFormulaExpression(resource);
        const numericAnswers = getNumericAnswers(resource, answers);
        const value = evaluateFormula(expression, numericAnswers);
        const decimals = getFormulaDecimals(resource);
        setCalculated({
          value,
          label: 'Valor calculado',
          unit: getFormulaUnit(resource),
          result: getRangeResult(resource, value)
        });
      }

      if (mode === 'rule_based') {
        const result = evaluateRules(resource, answers);
        if (!result) {
          setError('Nenhuma regra definida no JSON corresponde às respostas.');
          setCalculated(null);
          return;
        }
        setCalculated({
          label: result.title || result.label || result.classification || 'Regra aplicada',
          result
        });
      }
    } catch (calculationError) {
      setError(calculationError instanceof Error ? calculationError.message : 'Não foi possível calcular.');
      setCalculated(null);
    }
  };

  const renderInput = (input: ClinicalResourceInput, inputIndex: number) => {
    const answer = answers[input.id];

    if (input.type === 'number') {
      return (
        <div key={input.id || inputIndex} className="rounded-2xl border border-gray-100 bg-white p-4">
          <SmallLabel>{input.label}</SmallLabel>
          {input.description && <p className="mb-3 text-xs text-gray-500">{input.description}</p>}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={answer === undefined ? '' : String(answer)}
              min={input.min}
              max={input.max}
              placeholder={input.placeholder}
              onChange={event => updateAnswer(input.id, event.target.value)}
              className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
            />
            {input.unit && <span className="text-xs font-bold text-gray-400">{input.unit}</span>}
          </div>
        </div>
      );
    }

    if (input.type === 'text') {
      return (
        <div key={input.id || inputIndex} className="rounded-2xl border border-gray-100 bg-white p-4">
          <SmallLabel>{input.label}</SmallLabel>
          {input.description && <p className="mb-3 text-xs text-gray-500">{input.description}</p>}
          <AutoSizeTextarea
            value={typeof answer === 'string' ? answer : ''}
            onChange={event => updateAnswer(input.id, event.target.value)}
            placeholder={input.placeholder}
            className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
          />
        </div>
      );
    }

    if (input.type === 'select') {
      return (
        <div key={input.id || inputIndex} className="rounded-2xl border border-gray-100 bg-white p-4">
          <SmallLabel>{input.label}</SmallLabel>
          {input.description && <p className="mb-3 text-xs text-gray-500">{input.description}</p>}
          <select
            value={answer === undefined ? '' : String(answer)}
            onChange={event => updateAnswer(input.id, event.target.value)}
            className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
          >
            <option value="">Selecionar</option>
            {(input.options || []).map((option, optionIndex) => (
              <option key={answerKey(optionValue(option, optionIndex))} value={String(optionValue(option, optionIndex))}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={input.id || inputIndex} className="rounded-2xl border border-gray-100 bg-white p-4">
        <SmallLabel>{input.label}</SmallLabel>
        {input.description && <p className="mb-3 text-xs text-gray-500">{input.description}</p>}
        <div className="grid gap-2">
          {(input.options || []).map((option, optionIndex) => {
            const value = optionValue(option, optionIndex);
            const selectedValues = Array.isArray(answer) ? answer.map(answerKey) : [];
            const isSelected = input.type === 'multiple_choice'
              ? selectedValues.includes(answerKey(value))
              : answerKey(answer) === answerKey(value);

            return (
              <button
                key={answerKey(value)}
                type="button"
                onClick={() => {
                  if (input.type === 'multiple_choice') {
                    const previous = Array.isArray(answer) ? answer : [];
                    const exists = previous.map(answerKey).includes(answerKey(value));
                    updateAnswer(input.id, exists ? previous.filter(item => answerKey(item) !== answerKey(value)) : [...previous, value]);
                    return;
                  }
                  updateAnswer(input.id, value);
                }}
                className={cn(
                  'rounded-xl border px-4 py-3 text-left transition-colors',
                  isSelected ? 'border-red-300 bg-red-50 text-red-900' : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-red-100 hover:bg-white'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">{option.label}</p>
                    {option.description && <p className="mt-1 text-xs opacity-80">{option.description}</p>}
                  </div>
                  {option.score !== undefined && <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{option.score} pts</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const selectedDirectOption = useMemo(() => {
    const categories = getDirectClassificationOptions(resource);
    const selectedValue = answers.__direct_category;
    return getOptionByValue(categories, selectedValue);
  }, [answers.__direct_category, resource]);

  if (mode === 'external_link') {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-red-50 p-3 text-red-600">
            <Link2 size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">Escore / Calculadora / Link</p>
            <h4 className="mt-1 text-lg font-bold text-gray-900">{resource.title}</h4>
            {resource.subtitle && <p className="mt-1 text-sm font-medium text-gray-500">{resource.subtitle}</p>}
            {resource.description && <p className="mt-3 text-sm leading-relaxed text-gray-600">{resource.description}</p>}
            {resource.source && <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">{resource.source}</p>}
          </div>
        </div>
        <a
          href={resource.externalUrl || resource.link}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-black"
        >
          Abrir calculadora
          <ExternalLink size={14} />
        </a>
      </div>
    );
  }

  const directOptions = getDirectClassificationOptions(resource);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start gap-4">
        <div className="rounded-xl bg-red-50 p-3 text-red-600">
          <Calculator size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">{MODE_LABELS[mode]}</p>
          <h4 className="mt-1 text-lg font-bold text-gray-900">{resource.title}</h4>
          {resource.subtitle && <p className="mt-1 text-sm font-medium text-gray-500">{resource.subtitle}</p>}
          {resource.description && <p className="mt-3 text-sm leading-relaxed text-gray-600">{resource.description}</p>}
          {resource.source && <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">{resource.source}</p>}
        </div>
      </div>

      {mode === 'direct_classification' || mode === 'classification_scale' ? (
        <div className="space-y-3">
          {directOptions.map((option, optionIndex) => {
            const value = optionValue(option, optionIndex);
            const selected = answerKey(answers.__direct_category) === answerKey(value);

            return (
              <button
                key={answerKey(value)}
                type="button"
                onClick={() => {
                  updateAnswer('__direct_category', value);
                  setCalculated({
                    label: option.label,
                    result: option.result || {
                      title: option.label,
                      value: typeof option.value === 'string' || typeof option.value === 'number' ? option.value : undefined,
                      description: option.description,
                      interpretation: option.interpretation,
                      guidance: option.guidance
                    }
                  });
                }}
                className={cn(
                  'w-full rounded-2xl border px-5 py-4 text-left transition-colors',
                  selected ? 'border-red-300 bg-red-50 text-red-950' : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-red-100 hover:bg-white'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('mt-1 h-4 w-4 rounded-full border-2', selected ? 'border-red-600 bg-red-600' : 'border-gray-200 bg-white')} />
                  <div>
                    <p className="font-bold">{option.label}</p>
                    {option.description && <p className="mt-1 text-sm opacity-80">{option.description}</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4">
          {(resource.inputs || []).map(renderInput)}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {mode !== 'direct_classification' && mode !== 'classification_scale' && (
          <button
            type="button"
            onClick={handleCalculate}
            className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-black"
          >
            <Check size={14} />
            Calcular
          </button>
        )}
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
        >
          <RotateCcw size={14} />
          Limpar
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {error}
        </div>
      )}

      {calculated && (
        <div className="mt-5">
          <ResultBox
            label={calculated.label || 'Resultado'}
            value={calculated.value !== undefined ? formatResultNumber(calculated.value, mode === 'formula' ? getFormulaDecimals(resource) : undefined) : calculated.label}
            unit={calculated.unit}
            result={calculated.result}
          />
        </div>
      )}

      {notes.length > 0 && (
        <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-xs leading-relaxed text-gray-500">
          {notes.map((note, index) => <p key={index}>{note}</p>)}
        </div>
      )}
    </div>
  );
}

const updateArrayItem = <T,>(items: T[] | undefined, index: number, updater: (item: T) => T) => {
  return (items || []).map((item, itemIndex) => itemIndex === index ? updater(item) : item);
};

const removeArrayItem = <T,>(items: T[] | undefined, index: number) => {
  return (items || []).filter((_, itemIndex) => itemIndex !== index);
};

const emptyOption = (index: number): ClinicalResourceOption => ({
  value: `opcao_${index + 1}`,
  label: '',
  score: 0
});

const emptyInput = (index: number): ClinicalResourceInput => ({
  id: `item_${index + 1}`,
  label: '',
  type: 'single_choice',
  required: true,
  options: [emptyOption(0), emptyOption(1)]
});

const emptyResult = (): ClinicalResourceResult => ({
  min: 0,
  max: 0,
  title: '',
  interpretation: ''
});

interface ClinicalResourceEditorProps {
  resource?: ClinicalResource;
  editorMode?: ClinicalResourceEditorMode;
  jsonDraft?: string;
  validationError?: string;
  onChange: (next: {
    resource?: ClinicalResource;
    resourceEditorMode?: ClinicalResourceEditorMode;
    resourceJsonDraft?: string;
    resourceValidationError?: string;
  }) => void;
}

export function ClinicalResourceEditor({
  resource,
  editorMode = 'external_link',
  jsonDraft,
  validationError,
  onChange
}: ClinicalResourceEditorProps) {
  const currentResource = resource || createEmptyClinicalResource(editorMode === 'external_link' ? 'external_link' : 'sum_points');
  const currentMode = currentResource.mode;
  const [rulesDraft, setRulesDraft] = useState(() => JSON.stringify(currentResource.rules || [], null, 2));

  useEffect(() => {
    if (currentMode === 'rule_based') {
      setRulesDraft(JSON.stringify(currentResource.rules || [], null, 2));
    }
  }, [currentMode, currentResource.id]);

  const setEditorMode = (nextMode: ClinicalResourceEditorMode) => {
    let nextResource = currentResource;

    if (nextMode === 'manual' && currentResource.mode === 'external_link') {
      nextResource = {
        ...createEmptyClinicalResource('sum_points'),
        title: currentResource.title,
        subtitle: currentResource.subtitle,
        description: currentResource.description,
        source: currentResource.source,
        notes: currentResource.notes
      };
    }

    if (nextMode === 'external_link' && currentResource.mode !== 'external_link') {
      nextResource = {
        ...createEmptyClinicalResource('external_link'),
        title: currentResource.title,
        subtitle: currentResource.subtitle,
        description: currentResource.description,
        source: currentResource.source,
        notes: currentResource.notes
      };
    }

    onChange({
      resource: nextResource,
      resourceEditorMode: nextMode,
      resourceJsonDraft: nextMode === 'json' ? JSON.stringify(nextResource, null, 2) : undefined,
      resourceValidationError: undefined
    });
  };

  const updateResource = (updater: (resource: ClinicalResource) => ClinicalResource) => {
    const nextResource = updater(currentResource);
    onChange({
      resource: nextResource,
      resourceEditorMode: editorMode,
      resourceJsonDraft: undefined,
      resourceValidationError: undefined
    });
  };

  const updateMode = (mode: ClinicalResourceMode) => {
    updateResource((previous) => ({
      ...createEmptyClinicalResource(mode),
      id: previous.id || createResourceEntityId('resource'),
      title: previous.title,
      subtitle: previous.subtitle,
      description: previous.description,
      source: previous.source,
      mode
    }));
  };

  const handleJsonChange = (value: string) => {
    const result = parseClinicalResourceJson(value);
    onChange({
      resource: result.resource || currentResource,
      resourceEditorMode: 'json',
      resourceJsonDraft: value,
      resourceValidationError: result.errors[0]
    });
  };

  const validateCurrent = () => {
    const result = editorMode === 'json' && jsonDraft
      ? parseClinicalResourceJson(jsonDraft)
      : validateClinicalResource(currentResource);

    onChange({
      resource: result.resource || currentResource,
      resourceEditorMode: editorMode,
      resourceJsonDraft: jsonDraft,
      resourceValidationError: result.errors[0]
    });
  };

  const renderMetadata = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <SmallLabel>Título</SmallLabel>
        <input
          type="text"
          value={currentResource.title}
          onChange={event => updateResource(resource => ({ ...resource, title: event.target.value }))}
          className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
        />
      </div>
      <div>
        <SmallLabel>Fonte</SmallLabel>
        <input
          type="text"
          value={currentResource.source || ''}
          onChange={event => updateResource(resource => ({ ...resource, source: event.target.value }))}
          className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
        />
      </div>
      <div className="md:col-span-2">
        <SmallLabel>Subtítulo</SmallLabel>
        <input
          type="text"
          value={currentResource.subtitle || ''}
          onChange={event => updateResource(resource => ({ ...resource, subtitle: event.target.value }))}
          className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
        />
      </div>
      <div className="md:col-span-2">
        <SmallLabel>Descrição curta</SmallLabel>
        <AutoSizeTextarea
          value={currentResource.description || ''}
          onChange={event => updateResource(resource => ({ ...resource, description: event.target.value }))}
          rows={2}
          className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
        />
      </div>
    </div>
  );

  const renderOptionsEditor = (input: ClinicalResourceInput, inputIndex: number) => (
    <div className="space-y-3">
      {(input.options || []).map((option, optionIndex) => (
        <div key={optionIndex} className="grid gap-2 rounded-xl border border-gray-100 bg-white p-3 md:grid-cols-[1fr_1fr_90px_auto]">
          <input
            type="text"
            value={String(option.value ?? '')}
            placeholder="valor"
            onChange={event => updateResource(resource => ({
              ...resource,
              inputs: updateArrayItem(resource.inputs, inputIndex, currentInput => ({
                ...currentInput,
                options: updateArrayItem(currentInput.options, optionIndex, currentOption => ({
                  ...currentOption,
                  value: event.target.value
                }))
              }))
            }))}
            className="rounded-lg border-none bg-gray-50 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-100"
          />
          <input
            type="text"
            value={option.label}
            placeholder="rótulo"
            onChange={event => updateResource(resource => ({
              ...resource,
              inputs: updateArrayItem(resource.inputs, inputIndex, currentInput => ({
                ...currentInput,
                options: updateArrayItem(currentInput.options, optionIndex, currentOption => ({
                  ...currentOption,
                  label: event.target.value
                }))
              }))
            }))}
            className="rounded-lg border-none bg-gray-50 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-100"
          />
          <input
            type="number"
            value={option.score ?? ''}
            placeholder="pts"
            onChange={event => updateResource(resource => ({
              ...resource,
              inputs: updateArrayItem(resource.inputs, inputIndex, currentInput => ({
                ...currentInput,
                options: updateArrayItem(currentInput.options, optionIndex, currentOption => ({
                  ...currentOption,
                  score: event.target.value === '' ? undefined : Number(event.target.value)
                }))
              }))
            }))}
            className="rounded-lg border-none bg-gray-50 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-100"
          />
          <button
            type="button"
            onClick={() => updateResource(resource => ({
              ...resource,
              inputs: updateArrayItem(resource.inputs, inputIndex, currentInput => ({
                ...currentInput,
                options: removeArrayItem(currentInput.options, optionIndex)
              }))
            }))}
            className="text-gray-300 hover:text-red-500"
          >
            <X size={14} />
          </button>
          <div className="md:col-span-4">
            <input
              type="text"
              value={option.description || ''}
              placeholder="descrição opcional"
              onChange={event => updateResource(resource => ({
                ...resource,
                inputs: updateArrayItem(resource.inputs, inputIndex, currentInput => ({
                  ...currentInput,
                  options: updateArrayItem(currentInput.options, optionIndex, currentOption => ({
                    ...currentOption,
                    description: event.target.value
                  }))
                }))
              }))}
              className="w-full rounded-lg border-none bg-gray-50 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-100"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => updateResource(resource => ({
          ...resource,
          inputs: updateArrayItem(resource.inputs, inputIndex, currentInput => ({
            ...currentInput,
            options: [...(currentInput.options || []), emptyOption(currentInput.options?.length || 0)]
          }))
        }))}
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-200 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:border-red-200 hover:text-red-500"
      >
        <Plus size={13} />
        Opção
      </button>
    </div>
  );

  const renderInputsEditor = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">Itens de entrada</p>
        <button
          type="button"
          onClick={() => updateResource(resource => ({
            ...resource,
            inputs: [...(resource.inputs || []), emptyInput(resource.inputs?.length || 0)]
          }))}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:border-red-200 hover:text-red-500"
        >
          <Plus size={13} />
          Item
        </button>
      </div>

      {(currentResource.inputs || []).map((input, inputIndex) => (
        <div key={inputIndex} className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_180px_auto]">
            <input
              type="text"
              value={input.id}
              placeholder="id"
              onChange={event => updateResource(resource => ({
                ...resource,
                inputs: updateArrayItem(resource.inputs, inputIndex, currentInput => ({ ...currentInput, id: event.target.value }))
              }))}
              className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100"
            />
            <input
              type="text"
              value={input.label}
              placeholder="pergunta / rótulo"
              onChange={event => updateResource(resource => ({
                ...resource,
                inputs: updateArrayItem(resource.inputs, inputIndex, currentInput => ({ ...currentInput, label: event.target.value }))
              }))}
              className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100"
            />
            <select
              value={input.type}
              onChange={event => updateResource(resource => ({
                ...resource,
                inputs: updateArrayItem(resource.inputs, inputIndex, currentInput => ({
                  ...currentInput,
                  type: event.target.value as ClinicalResourceInputType,
                  options: ['number', 'text'].includes(event.target.value) ? undefined : currentInput.options || [emptyOption(0), emptyOption(1)]
                }))
              }))}
              className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100"
            >
              {RESOURCE_INPUT_TYPES.map(type => (
                <option key={type} value={type}>{INPUT_TYPE_LABELS[type]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => updateResource(resource => ({ ...resource, inputs: removeArrayItem(resource.inputs, inputIndex) }))}
              className="text-gray-300 hover:text-red-500"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
            <input
              type="text"
              value={input.description || ''}
              placeholder="descrição opcional"
              onChange={event => updateResource(resource => ({
                ...resource,
                inputs: updateArrayItem(resource.inputs, inputIndex, currentInput => ({ ...currentInput, description: event.target.value }))
              }))}
              className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100"
            />
            <input
              type="text"
              value={input.unit || ''}
              placeholder="unidade"
              onChange={event => updateResource(resource => ({
                ...resource,
                inputs: updateArrayItem(resource.inputs, inputIndex, currentInput => ({ ...currentInput, unit: event.target.value }))
              }))}
              className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100"
            />
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <input
                type="checkbox"
                checked={Boolean(input.required)}
                onChange={event => updateResource(resource => ({
                  ...resource,
                  inputs: updateArrayItem(resource.inputs, inputIndex, currentInput => ({ ...currentInput, required: event.target.checked }))
                }))}
                className="accent-red-600"
              />
              Obrigatório
            </label>
          </div>

          {!['number', 'text'].includes(input.type) && renderOptionsEditor(input, inputIndex)}
        </div>
      ))}
    </div>
  );

  const renderCategoriesEditor = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">Categorias da escala</p>
        <button
          type="button"
          onClick={() => updateResource(resource => ({
            ...resource,
            categories: [...(resource.categories || []), { value: `classe_${(resource.categories?.length || 0) + 1}`, label: '', description: '' }]
          }))}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:border-red-200 hover:text-red-500"
        >
          <Plus size={13} />
          Categoria
        </button>
      </div>
      {(currentResource.categories || []).map((category, categoryIndex) => (
        <div key={categoryIndex} className="grid gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 md:grid-cols-[120px_1fr_auto]">
          <input
            type="text"
            value={String(category.value ?? '')}
            placeholder="valor"
            onChange={event => updateResource(resource => ({
              ...resource,
              categories: updateArrayItem(resource.categories, categoryIndex, current => ({ ...current, value: event.target.value }))
            }))}
            className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100"
          />
          <input
            type="text"
            value={category.label}
            placeholder="título da categoria"
            onChange={event => updateResource(resource => ({
              ...resource,
              categories: updateArrayItem(resource.categories, categoryIndex, current => ({ ...current, label: event.target.value }))
            }))}
            className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100"
          />
          <button
            type="button"
            onClick={() => updateResource(resource => ({ ...resource, categories: removeArrayItem(resource.categories, categoryIndex) }))}
            className="text-gray-300 hover:text-red-500"
          >
            <X size={16} />
          </button>
          <AutoSizeTextarea
            value={category.description || ''}
            placeholder="descrição"
            rows={2}
            onChange={event => updateResource(resource => ({
              ...resource,
              categories: updateArrayItem(resource.categories, categoryIndex, current => ({ ...current, description: event.target.value }))
            }))}
            className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100 md:col-span-3"
          />
          <input
            type="text"
            value={category.interpretation || ''}
            placeholder="interpretação opcional"
            onChange={event => updateResource(resource => ({
              ...resource,
              categories: updateArrayItem(resource.categories, categoryIndex, current => ({ ...current, interpretation: event.target.value }))
            }))}
            className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100 md:col-span-3"
          />
        </div>
      ))}
    </div>
  );

  const renderResultsEditor = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">Faixas / interpretações</p>
        <button
          type="button"
          onClick={() => updateResource(resource => ({ ...resource, results: [...(resource.results || []), emptyResult()] }))}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:border-red-200 hover:text-red-500"
        >
          <Plus size={13} />
          Faixa
        </button>
      </div>
      {(currentResource.results || []).map((result, resultIndex) => (
        <div key={resultIndex} className="grid gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 md:grid-cols-[100px_100px_1fr_auto]">
          <input
            type="number"
            value={result.min ?? ''}
            placeholder="mín"
            onChange={event => updateResource(resource => ({
              ...resource,
              results: updateArrayItem(resource.results, resultIndex, current => ({ ...current, min: event.target.value === '' ? undefined : Number(event.target.value) }))
            }))}
            className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100"
          />
          <input
            type="number"
            value={result.max ?? ''}
            placeholder="máx"
            onChange={event => updateResource(resource => ({
              ...resource,
              results: updateArrayItem(resource.results, resultIndex, current => ({ ...current, max: event.target.value === '' ? undefined : Number(event.target.value) }))
            }))}
            className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100"
          />
          <input
            type="text"
            value={result.title || ''}
            placeholder="classificação"
            onChange={event => updateResource(resource => ({
              ...resource,
              results: updateArrayItem(resource.results, resultIndex, current => ({ ...current, title: event.target.value }))
            }))}
            className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100"
          />
          <button
            type="button"
            onClick={() => updateResource(resource => ({ ...resource, results: removeArrayItem(resource.results, resultIndex) }))}
            className="text-gray-300 hover:text-red-500"
          >
            <X size={16} />
          </button>
          <AutoSizeTextarea
            value={result.interpretation || ''}
            placeholder="interpretação opcional"
            rows={2}
            onChange={event => updateResource(resource => ({
              ...resource,
              results: updateArrayItem(resource.results, resultIndex, current => ({ ...current, interpretation: event.target.value }))
            }))}
            className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100 md:col-span-4"
          />
          <input
            type="text"
            value={result.guidance || ''}
            placeholder="conduta / observação opcional"
            onChange={event => updateResource(resource => ({
              ...resource,
              results: updateArrayItem(resource.results, resultIndex, current => ({ ...current, guidance: event.target.value }))
            }))}
            className="rounded-xl border-none bg-white px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-red-100 md:col-span-4"
          />
        </div>
      ))}
    </div>
  );

  const renderRulesEditor = () => (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">Regras</p>
      <AutoSizeTextarea
        value={rulesDraft}
        rows={6}
        spellCheck={false}
        onChange={event => {
          const value = event.target.value;
          setRulesDraft(value);

          try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed)) {
              throw new Error('as regras precisam estar em uma lista.');
            }

            onChange({
              resource: {
                ...currentResource,
                rules: parsed as ClinicalResourceRule[]
              },
              resourceEditorMode: editorMode,
              resourceJsonDraft: undefined,
              resourceValidationError: undefined
            });
          } catch (error) {
            onChange({
              resource: currentResource,
              resourceEditorMode: editorMode,
              resourceJsonDraft: undefined,
              resourceValidationError: `Regras inválidas: ${error instanceof Error ? error.message : 'JSON não reconhecido.'}`
            });
          }
        }}
        className="w-full rounded-2xl border border-gray-100 bg-gray-950 px-4 py-4 font-mono text-xs leading-relaxed text-gray-100 outline-none focus:ring-2 focus:ring-red-100"
      />
      <p className="text-xs text-gray-500">
        Use uma lista de objetos com "when" e "result". Ex: <code>{'[{"when":{"criterio":"a"},"result":{"title":"Classe A"}}]'}</code>
      </p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {([
          ['external_link', 'Link externo'],
          ['manual', 'Criar manualmente'],
          ['json', 'Colar JSON']
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setEditorMode(mode)}
            className={cn(
              'rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors',
              editorMode === mode ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 bg-white text-gray-400 hover:border-red-200 hover:text-red-500'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {editorMode === 'json' ? (
        <div className="space-y-3">
          <AutoSizeTextarea
            value={jsonDraft ?? JSON.stringify(currentResource, null, 2)}
            onChange={event => handleJsonChange(event.target.value)}
            rows={12}
            spellCheck={false}
            className="w-full rounded-2xl border border-gray-100 bg-gray-950 px-4 py-4 font-mono text-xs leading-relaxed text-gray-100 outline-none focus:ring-2 focus:ring-red-100"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={validateCurrent}
              className="rounded-full bg-gray-900 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-black"
            >
              Validar JSON
            </button>
            <button
              type="button"
              onClick={() => handleJsonChange(createClinicalResourceExampleJson())}
              className="rounded-full border border-gray-200 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:border-red-200 hover:text-red-500"
            >
              Inserir exemplo
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {editorMode === 'external_link' && currentResource.mode !== 'external_link' && (
            <button
              type="button"
              onClick={() => updateMode('external_link')}
              className="rounded-full border border-red-100 bg-red-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-red-500"
            >
              Converter para link externo
            </button>
          )}

          {renderMetadata()}

          {editorMode === 'manual' && (
            <div>
              <SmallLabel>Modo de funcionamento</SmallLabel>
              <select
                value={currentMode}
                onChange={event => updateMode(event.target.value as ClinicalResourceMode)}
                className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
              >
                {RESOURCE_MODES.filter(mode => mode !== 'external_link').map(mode => (
                  <option key={mode} value={mode}>{MODE_LABELS[mode]}</option>
                ))}
              </select>
            </div>
          )}

          {currentMode === 'external_link' && (
            <div>
              <SmallLabel>Link externo</SmallLabel>
              <input
                type="url"
                value={currentResource.externalUrl || currentResource.link || ''}
                onChange={event => updateResource(resource => ({ ...resource, mode: 'external_link', externalUrl: event.target.value }))}
                placeholder="https://..."
                className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
              />
            </div>
          )}

          {editorMode === 'manual' && currentMode !== 'external_link' && (
            <>
              {currentMode === 'formula' && (
                <div className="grid gap-4 md:grid-cols-[1fr_120px_120px]">
                  <div>
                    <SmallLabel>Fórmula</SmallLabel>
                    <input
                      type="text"
                      value={getFormulaExpression(currentResource)}
                      onChange={event => updateResource(resource => ({
                        ...resource,
                        formula: {
                          expression: event.target.value,
                          unit: getFormulaUnit(resource) || '',
                          decimals: getFormulaDecimals(resource) ?? 2
                        }
                      }))}
                      placeholder="Ex: peso / (altura ^ 2)"
                      className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
                    />
                  </div>
                  <div>
                    <SmallLabel>Unidade</SmallLabel>
                    <input
                      type="text"
                      value={getFormulaUnit(currentResource) || ''}
                      onChange={event => updateResource(resource => ({
                        ...resource,
                        formula: {
                          expression: getFormulaExpression(resource),
                          unit: event.target.value,
                          decimals: getFormulaDecimals(resource) ?? 2
                        }
                      }))}
                      className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
                    />
                  </div>
                  <div>
                    <SmallLabel>Casas</SmallLabel>
                    <input
                      type="number"
                      value={getFormulaDecimals(currentResource) ?? ''}
                      onChange={event => updateResource(resource => ({
                        ...resource,
                        formula: {
                          expression: getFormulaExpression(resource),
                          unit: getFormulaUnit(resource) || '',
                          decimals: event.target.value === '' ? undefined : Number(event.target.value)
                        }
                      }))}
                      className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
                    />
                  </div>
                </div>
              )}

              {(currentMode === 'sum_points' || currentMode === 'formula' || currentMode === 'rule_based') && renderInputsEditor()}
              {(currentMode === 'direct_classification' || currentMode === 'classification_scale') && renderCategoriesEditor()}
              {(currentMode === 'sum_points' || currentMode === 'formula') && renderResultsEditor()}
              {currentMode === 'rule_based' && renderRulesEditor()}
            </>
          )}

          <div>
            <SmallLabel>Observações gerais</SmallLabel>
            <AutoSizeTextarea
              value={Array.isArray(currentResource.notes) ? currentResource.notes.join('\n') : currentResource.notes || ''}
              onChange={event => updateResource(resource => ({
                ...resource,
                notes: event.target.value.includes('\n') ? event.target.value.split('\n') : event.target.value
              }))}
              rows={3}
              className="w-full rounded-xl border-none bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-red-100"
            />
          </div>
        </div>
      )}

      {validationError ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {validationError}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500">
          O site renderiza apenas dados presentes no JSON. Interpretações, condutas e descrições clínicas só aparecem quando forem cadastradas.
        </div>
      )}
    </div>
  );
}
