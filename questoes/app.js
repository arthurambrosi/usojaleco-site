const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif"];

const state = {
  dataRoot: "data",
  provas: [],
  provaAtual: null,
  respostas: new Map(),
  riscos: new Map(),
  imageMapCache: new Map(),
  imageProbeCache: new Map()
};

const dom = {
  homeView: document.getElementById("homeView"),
  examView: document.getElementById("examView"),
  homeState: document.getElementById("homeState"),
  examGrid: document.getElementById("examGrid"),
  questionList: document.getElementById("questionList"),
  examTitle: document.getElementById("examTitle"),
  examMeta: document.getElementById("examMeta"),
  examHeaderScore: document.getElementById("examHeaderScore"),
  headerHits: document.getElementById("headerHits"),
  headerMisses: document.getElementById("headerMisses"),
  backButton: document.getElementById("backButton"),
  homeShortcut: document.getElementById("homeShortcut"),
  printPdfButton: document.getElementById("printPdfButton")
};

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function multiline(text) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function pluralizeQuestoes(total) {
  return `${total} ${total === 1 ? "questão" : "questões"}`;
}

function isFileProtocol() {
  return window.location.protocol === "file:";
}

function prettifySlug(slug) {
  return String(slug || "")
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeGabarito(entry) {
  const fallback = { status: "sem_gabarito", resposta: null };
  if (!entry || typeof entry !== "object") {
    return fallback;
  }

  const rawStatus = typeof entry.status === "string" ? entry.status.trim().toLowerCase() : "sem_gabarito";
  const status = rawStatus === "normal" || rawStatus === "anulada" ? rawStatus : "sem_gabarito";
  const resposta =
    typeof entry.resposta === "string" && entry.resposta.trim()
      ? entry.resposta.trim().toUpperCase()
      : null;

  if (status !== "normal") {
    return { status, resposta: null };
  }
  return resposta ? { status: "normal", resposta } : fallback;
}

function getCrossedSet(questionKey) {
  if (!state.riscos.has(questionKey)) {
    state.riscos.set(questionKey, new Set());
  }
  return state.riscos.get(questionKey);
}

function getQuestionByKey(questionKey) {
  if (!state.provaAtual) {
    return null;
  }
  return state.provaAtual.questoes.find((question) => String(question.numero) === questionKey) || null;
}

function hasUsefulGabarito(question) {
  const normalized = normalizeGabarito(question.gabarito);
  return normalized.status === "normal" && !!normalized.resposta;
}

function computeScore() {
  if (!state.provaAtual || !state.provaAtual.temGabaritoUtil) {
    return { acertos: 0, erros: 0 };
  }

  let acertos = 0;
  let erros = 0;

  for (const question of state.provaAtual.questoes) {
    const selected = state.respostas.get(String(question.numero));
    if (!selected) {
      continue;
    }

    if (!hasUsefulGabarito(question)) {
      continue;
    }

    const resposta = normalizeGabarito(question.gabarito).resposta;
    if (selected === resposta) {
      acertos += 1;
    } else {
      erros += 1;
    }
  }

  return { acertos, erros };
}

function buildStatusChip(question) {
  const { status } = normalizeGabarito(question.gabarito);
  if (status === "anulada") {
    return '<span class="status-chip anulada">Questão anulada</span>';
  }
  return "";
}

function buildFeedback(question, selected) {
  const { status, resposta } = normalizeGabarito(question.gabarito);

  if (status === "anulada") {
    return '<div class="feedback is-neutral">Questão anulada (fora da contagem)</div>';
  }

  if (status === "sem_gabarito" || !resposta) {
    return "";
  }

  if (!selected) {
    return "";
  }

  if (selected === resposta) {
    return '<div class="feedback is-correct">Correta</div>';
  }

  return '<div class="feedback is-wrong">Incorreta</div>';
}

function buildImageBlock(question) {
  if (!question.imagem) {
    return "";
  }

  return `
    <div class="image-shell is-pinned is-open">
      <div class="image-panel">
        <div class="image-panel-head">
          <strong>Imagem da questão ${escapeHtml(question.numero)}</strong>
        </div>
        <img src="${escapeHtml(question.imagem)}" alt="Imagem vinculada à questão ${escapeHtml(question.numero)}" loading="lazy" />
      </div>
    </div>
  `;
}

function renderQuestionCard(question) {
  const questionKey = String(question.numero);
  const selected = state.respostas.get(questionKey) || null;
  const crossed = getCrossedSet(questionKey);
  const scoreVisible = !!state.provaAtual?.temGabaritoUtil;

  const alternativesHtml = question.alternativas
    .map((alternative) => {
      const letter = String(alternative.letra || "").toUpperCase();
      const isSelected = selected === letter;
      const isCrossed = crossed.has(letter);

      return `
        <div class="option-row ${isSelected ? "is-selected" : ""} ${isCrossed ? "is-crossed" : ""}">
          <button type="button" class="option-main" data-action="responder" data-question="${escapeHtml(questionKey)}" data-letter="${escapeHtml(letter)}">
            <span class="option-letter">${escapeHtml(letter)}</span>
            <span class="option-text">${multiline(alternative.texto || "")}</span>
          </button>
          <button type="button" class="option-strike" data-action="riscar" data-question="${escapeHtml(questionKey)}" data-letter="${escapeHtml(letter)}" aria-label="Riscar alternativa ${escapeHtml(letter)}">X</button>
        </div>
      `;
    })
    .join("");

  return `
    <article class="question-card" data-question-card="${escapeHtml(questionKey)}">
      <div class="question-header">
        <h3 class="question-index">Questão ${escapeHtml(question.numero)}</h3>
        ${buildStatusChip(question)}
      </div>
      <div class="question-topline">
        <div class="topline-left">
          ${
            scoreVisible
              ? `
              <div class="scoreboard">
                <span class="scoreTag hit"><strong data-score-acertos>0</strong> acertos</span>
                <span class="scoreTag miss"><strong data-score-erros>0</strong> erros</span>
              </div>
            `
              : ""
          }
          <span class="file-chip">${escapeHtml(state.provaAtual.meta.arquivoBase)}</span>
        </div>
      </div>
      <p class="question-text">${multiline(question.enunciado || "")}</p>
      ${buildImageBlock(question)}
      <div class="options">${alternativesHtml}</div>
      ${buildFeedback(question, selected)}
    </article>
  `;
}

function getGabaritoDisplay(question) {
  const gabarito = normalizeGabarito(question.gabarito);
  if (gabarito.status === "anulada") {
    return "Anulada";
  }
  if (gabarito.status === "normal" && gabarito.resposta) {
    return gabarito.resposta;
  }
  return "-";
}

function buildPrintDocumentHtml(exam) {
  const questionsHtml = exam.questoes
    .map((question) => {
      const alternativesHtml = question.alternativas
        .map((alt) => {
          return `<li><strong>${escapeHtml(alt.letra)}.</strong> ${multiline(alt.texto || "")}</li>`;
        })
        .join("");

      const imageHtml = question.imagem
        ? `<figure class="print-image"><img src="${escapeHtml(question.imagem)}" alt="Imagem da questao ${escapeHtml(
            question.numero
          )}" /></figure>`
        : "";

      return `
        <article class="print-question">
          <h3>Questao ${escapeHtml(question.numero)}</h3>
          <p class="print-statement">${multiline(question.enunciado || "")}</p>
          ${imageHtml}
          <ol class="print-options" type="A">
            ${alternativesHtml}
          </ol>
        </article>
      `;
    })
    .join("");

  const answerRows = exam.questoes
    .map((question) => {
      return `<tr><td>${escapeHtml(question.numero)}</td><td>${escapeHtml(getGabaritoDisplay(question))}</td></tr>`;
    })
    .join("");

  return `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(exam.meta.nome)} - Impressao</title>
  <style>
    @page {
      size: A4;
      margin: 14mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #0d2438;
      font-family: Manrope, Arial, sans-serif;
      line-height: 1.35;
    }

    .print-header {
      margin-bottom: 12mm;
      border-bottom: 1px solid #cfd8de;
      padding-bottom: 5mm;
    }

    .print-header h1 {
      margin: 0;
      font-size: 20px;
    }

    .print-header p {
      margin: 4px 0 0;
      color: #4f6271;
      font-size: 12px;
    }

    .print-question {
      page-break-inside: avoid;
      margin-bottom: 9mm;
      padding: 5mm;
      border: 1px solid #d6dde2;
      border-radius: 8px;
      background: #ffffff;
    }

    .print-question h3 {
      margin: 0;
      font-size: 14px;
      color: #17386a;
    }

    .print-statement {
      margin: 3mm 0 0;
      font-size: 12px;
      white-space: pre-line;
    }

    .print-image {
      margin: 4mm 0 0;
    }

    .print-image img {
      max-width: 100%;
      height: auto;
      border: 1px solid #d9e2e8;
      border-radius: 6px;
    }

    .print-options {
      margin: 4mm 0 0 18px;
      padding: 0;
      display: grid;
      gap: 2.5mm;
      font-size: 11.5px;
    }

    .gabarito-page {
      page-break-before: always;
    }

    .gabarito-page h2 {
      margin: 0 0 6mm;
      color: #17386a;
      font-size: 20px;
    }

    .gabarito-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .gabarito-table th,
    .gabarito-table td {
      border: 1px solid #cfd8de;
      padding: 8px 10px;
      text-align: left;
    }

    .gabarito-table th {
      background: #edf3f6;
    }
  </style>
</head>
<body>
  <header class="print-header">
    <h1>${escapeHtml(exam.meta.nome)}</h1>
    <p>${escapeHtml(pluralizeQuestoes(exam.questoes.length))}</p>
  </header>

  <section class="questoes-page">
    ${questionsHtml}
  </section>

  <section class="gabarito-page">
    <h2>Gabarito</h2>
    <table class="gabarito-table">
      <thead>
        <tr>
          <th>Questao</th>
          <th>Resposta</th>
        </tr>
      </thead>
      <tbody>
        ${answerRows}
      </tbody>
    </table>
  </section>

  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`;
}

function printCurrentExamPdf() {
  if (!state.provaAtual) {
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Nao foi possivel abrir a janela de impressao. Permita pop-ups para este site.");
    return;
  }

  const html = buildPrintDocumentHtml(state.provaAtual);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function updateScoreUI() {
  const score = computeScore();
  dom.headerHits.textContent = String(score.acertos);
  dom.headerMisses.textContent = String(score.erros);

  if (state.provaAtual?.temGabaritoUtil) {
    for (const node of dom.questionList.querySelectorAll("[data-score-acertos]")) {
      node.textContent = String(score.acertos);
    }
    for (const node of dom.questionList.querySelectorAll("[data-score-erros]")) {
      node.textContent = String(score.erros);
    }
  }
}

function refreshQuestion(questionKey) {
  const question = getQuestionByKey(questionKey);
  if (!question) {
    return;
  }

  const currentCard = dom.questionList.querySelector(`[data-question-card="${questionKey}"]`);
  if (!currentCard) {
    return;
  }

  currentCard.outerHTML = renderQuestionCard(question);
  updateScoreUI();
}

function toggleHome(showHome) {
  dom.homeView.classList.toggle("is-hidden", !showHome);
  dom.examView.classList.toggle("is-hidden", showHome);
}

function renderHome(exams) {
  if (!Array.isArray(exams) || exams.length === 0) {
    dom.homeState.classList.remove("is-error");
    dom.homeState.innerHTML = `
      <h2>Nenhuma prova encontrada</h2>
      <p>Verifique se existe conteúdo disponível.</p>
    `;
    dom.homeState.hidden = false;
    dom.examGrid.hidden = true;
    return;
  }

  dom.homeState.hidden = true;
  dom.examGrid.hidden = false;
  dom.examGrid.innerHTML = exams
    .map((exam) => {
      const total = Number(exam.totalQuestoes) || 0;
      return `
        <button type="button" class="exam-card" data-open-prova="${escapeHtml(exam.id)}">
          <h3>${escapeHtml(exam.nome)}</h3>
          <div class="exam-info">
            <span>${pluralizeQuestoes(total)}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function showHomeError(message) {
  const extraHelp = isFileProtocol()
    ? '<p>No modo local, clique no arquivo <strong>iniciar-site.bat</strong>.</p><p>Ou rode: <code>python -m http.server 5500 --bind 127.0.0.1</code></p>'
    : "";
  dom.homeState.classList.add("is-error");
  dom.homeState.hidden = false;
  dom.homeState.innerHTML = `
    <h2>Erro ao carregar provas</h2>
    <p>${escapeHtml(message)}</p>
    ${extraHelp}
  `;
  dom.examGrid.hidden = true;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Falha ${response.status}`);
  }
  return response.json();
}

async function fetchJsonOptional(url, fallback = {}) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return fallback;
    }
    return await response.json();
  } catch (_error) {
    return fallback;
  }
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Falha ao ler ${url}`);
  }
  return response.text();
}

function parseManifestPayload(rawText) {
  const text = String(rawText || "").trim();
  if (!text) {
    return { provas: [] };
  }

  try {
    return JSON.parse(text);
  } catch (parseError) {
    const provasBlockMatch = text.match(/"provas"\s*:\s*\[([\s\S]*?)\]/i);
    const fallbackTarget = provasBlockMatch ? provasBlockMatch[1] : text;
    const detectedExamIds = [];
    const regex = /"([^"]+)"/g;
    let match = null;

    while ((match = regex.exec(fallbackTarget))) {
      const value = match[1].trim();
      if (!value || value.toLowerCase() === "provas") {
        continue;
      }
      detectedExamIds.push(value);
    }

    if (detectedExamIds.length > 0) {
      console.warn("provas.json com JSON inválido; usando leitura tolerante de IDs.");
      return { provas: detectedExamIds };
    }

    throw parseError;
  }
}

async function fetchTextOptional(url, fallback = "") {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return fallback;
    }
    return await response.text();
  } catch (_error) {
    return fallback;
  }
}

function parseQuestionBlock(block, fallbackNumber) {
  const lines = block
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd());

  let number = fallbackNumber;
  const promptLines = [];
  const alternatives = [];
  let currentAlternative = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const altMatch = line.match(/^([A-Z])\s*[\)\.\-:]\s*(.*)$/);
    if (altMatch) {
      if (currentAlternative) {
        alternatives.push(currentAlternative);
      }
      currentAlternative = {
        letra: altMatch[1].toUpperCase(),
        texto: altMatch[2].trim()
      };
      continue;
    }

    if (currentAlternative) {
      currentAlternative.texto = `${currentAlternative.texto} ${line}`.trim();
    } else {
      promptLines.push(line);
    }
  }

  if (currentAlternative) {
    alternatives.push(currentAlternative);
  }

  if (promptLines.length > 0) {
    const numberMatch = promptLines[0].match(/^(\d+)\s*[\)\.\-:]\s*(.*)$/);
    if (numberMatch) {
      number = Number(numberMatch[1]) || fallbackNumber;
      promptLines[0] = numberMatch[2].trim();
    }
  }

  return {
    numero: number,
    enunciado: promptLines.filter(Boolean).join("\n").trim(),
    alternativas: alternatives
  };
}

function parseQuestions(rawText) {
  const blocks = String(rawText || "")
    .split("===QUESTAO===")
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => parseQuestionBlock(block, index + 1));
}

function parseGabaritoTxt(rawText) {
  const normalized = {};
  const content = String(rawText || "").replace(/\r/g, "");
  if (!content.trim()) {
    return normalized;
  }

  const lines = content.split("\n");
  lines.forEach((line, index) => {
    const key = String(index + 1);
    const letter = line.trim().toUpperCase();
    if (/^[A-Z]$/.test(letter)) {
      normalized[key] = { status: "normal", resposta: letter };
    }
  });

  return normalized;
}

function hasUsefulAnswerKey(gabaritoMap) {
  return Object.values(gabaritoMap).some((entry) => entry.status === "normal" && !!entry.resposta);
}

async function buildExamPayload({ examId, meta, questionsText, gabaritoTxt, imageResolver }) {
  const parsedQuestions = parseQuestions(questionsText);
  const normalizedGabarito = parseGabaritoTxt(gabaritoTxt);
  const images = await Promise.all(
    parsedQuestions.map((question, index) => {
      const numero = Number(question.numero) > 0 ? Number(question.numero) : index + 1;
      return imageResolver(numero);
    })
  );

  const questoes = parsedQuestions.map((question, index) => {
    const numero = Number(question.numero) > 0 ? Number(question.numero) : index + 1;
    const key = String(numero);
    return {
      numero,
      enunciado: question.enunciado || `Questão ${numero}`,
      alternativas: Array.isArray(question.alternativas) ? question.alternativas : [],
      imagem: images[index] || null,
      gabarito: normalizedGabarito[key] || { status: "sem_gabarito", resposta: null }
    };
  });

  return {
    id: examId,
    meta: {
      nome: (typeof meta.nome === "string" && meta.nome.trim()) || prettifySlug(examId),
      arquivoBase: (typeof meta.arquivoBase === "string" && meta.arquivoBase.trim()) || prettifySlug(examId),
      totalQuestoes: questoes.length
    },
    questoes,
    temGabaritoUtil: hasUsefulAnswerKey(normalizedGabarito)
  };
}

function extractExamDescriptors(payload) {
  const list = Array.isArray(payload) ? payload : Array.isArray(payload?.provas) ? payload.provas : [];
  return list
    .map((item) => {
      if (typeof item === "string") {
        return { id: item };
      }
      if (item && typeof item === "object" && typeof item.id === "string") {
        return {
          id: item.id,
          nome: typeof item.nome === "string" ? item.nome : null,
          arquivoBase: typeof item.arquivoBase === "string" ? item.arquivoBase : null
        };
      }
      return null;
    })
    .filter(Boolean);
}

async function loadExamsFromManifest() {
  const rootsToTry = ["data", "Data"];
  let payload = null;
  let resolvedRoot = null;
  let lastError = null;

  for (const root of rootsToTry) {
    try {
      const rawManifest = await fetchText(`./${root}/provas.json`);
      payload = parseManifestPayload(rawManifest);
      resolvedRoot = root;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!payload || !resolvedRoot) {
    throw lastError || new Error("Não foi possível carregar as provas.");
  }

  const descriptors = extractExamDescriptors(payload);
  const exams = await Promise.all(
    descriptors.map(async (descriptor) => {
      const examId = descriptor.id;
      const basePath = `./${resolvedRoot}/${encodeURIComponent(examId)}`;
      const questionsText = await fetchTextOptional(`${basePath}/questoes.txt`, "");
      const parsedCount = parseQuestions(questionsText).length;
      const meta = await fetchJsonOptional(`${basePath}/meta.json`, {});

      return {
        id: examId,
        nome: examId,
        arquivoBase:
          descriptor.arquivoBase ||
          (typeof meta.arquivoBase === "string" && meta.arquivoBase.trim()) ||
          prettifySlug(examId),
        totalQuestoes: parsedCount
      };
    })
  );

  return {
    root: resolvedRoot,
    exams: exams.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
  };
}

function buildImageUrl(examId, fileName) {
  const encodedExamId = encodeURIComponent(examId);
  return `./${state.dataRoot}/${encodedExamId}/${encodeURIComponent(fileName)}`;
}

async function canAccessUrl(url) {
  try {
    let response = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (response.ok) {
      return true;
    }
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, { method: "GET", cache: "no-store" });
      return response.ok;
    }
    return false;
  } catch (_error) {
    return false;
  }
}

async function probeImageUrl(examId, questionNumber) {
  const cacheKey = `${examId}::${questionNumber}`;
  if (state.imageProbeCache.has(cacheKey)) {
    return state.imageProbeCache.get(cacheKey);
  }

  const encodedExamId = encodeURIComponent(examId);
  const baseName = String(questionNumber);

  for (const extension of IMAGE_EXTENSIONS) {
    const candidate = `./${state.dataRoot}/${encodedExamId}/${baseName}.${extension}`;
    if (await canAccessUrl(candidate)) {
      state.imageProbeCache.set(cacheKey, candidate);
      return candidate;
    }
  }

  state.imageProbeCache.set(cacheKey, null);
  return null;
}

async function scanExamImages(examId) {
  if (state.imageMapCache.has(examId)) {
    return state.imageMapCache.get(examId);
  }

  const encodedExamId = encodeURIComponent(examId);
  const directoryUrl = `./${state.dataRoot}/${encodedExamId}/`;
  const imageMap = {};

  try {
    const html = await fetchTextOptional(directoryUrl, "");
    if (html) {
      const hrefRegex = /href="([^"]+)"/gi;
      let match = null;
      while ((match = hrefRegex.exec(html))) {
        const href = match[1];
        if (!href || href.endsWith("/")) {
          continue;
        }

        const cleanHref = href.split("#")[0].split("?")[0];
        const fileName = decodeURIComponent(cleanHref.split("/").pop() || "");
        const imageMatch = fileName.match(/^(\d+)\.([A-Za-z0-9]+)$/);
        if (!imageMatch) {
          continue;
        }

        const extension = imageMatch[2].toLowerCase();
        if (!IMAGE_EXTENSIONS.includes(extension)) {
          continue;
        }

        const questionKey = String(Number(imageMatch[1]));
        if (!questionKey || questionKey === "0" || imageMap[questionKey]) {
          continue;
        }

        imageMap[questionKey] = buildImageUrl(examId, fileName);
      }
    }
  } catch (_error) {
    // Sem listagem de diretório, seguimos sem imagens.
  }

  state.imageMapCache.set(examId, imageMap);
  return imageMap;
}

async function loadExam(examId) {
  const encodedExamId = encodeURIComponent(examId);
  const basePath = `./${state.dataRoot}/${encodedExamId}`;

  const [questionsText, meta, gabaritoTxt] = await Promise.all([
    fetchText(`${basePath}/questoes.txt`),
    fetchJsonOptional(`${basePath}/meta.json`, {}),
    fetchTextOptional(`${basePath}/gabarito.txt`, "")
  ]);
  const imageMap = await scanExamImages(examId);
  const shouldProbeFallback = Object.keys(imageMap).length === 0;

  return buildExamPayload({
    examId,
    meta,
    questionsText,
    gabaritoTxt,
    imageResolver: (questionNumber) => {
      const questionKey = String(questionNumber);
      const mapped = imageMap[questionKey] || null;
      if (mapped) {
        return Promise.resolve(mapped);
      }
      if (shouldProbeFallback) {
        return probeImageUrl(examId, questionNumber);
      }
      return Promise.resolve(null);
    }
  });
}

async function loadExams() {
  dom.homeState.classList.remove("is-error");
  dom.homeState.hidden = false;
  dom.homeState.innerHTML = `
    <h2>Carregando provas...</h2>
    <p>Aguarde um momento.</p>
  `;
  dom.examGrid.hidden = true;

  try {
    const result = await loadExamsFromManifest();
    state.dataRoot = result.root;
    state.provas = result.exams;
    renderHome(state.provas);
  } catch (error) {
    if (isFileProtocol()) {
      showHomeError("Não é possível carregar provas abrindo o index direto no navegador.");
      return;
    }
    showHomeError(error.message || "Não foi possível carregar as provas.");
  }
}

function renderExam() {
  const exam = state.provaAtual;
  if (!exam) {
    return;
  }

  dom.printPdfButton.disabled = false;
  dom.examTitle.textContent = exam.meta.nome;
  dom.examMeta.textContent = pluralizeQuestoes(exam.questoes.length);
  dom.examHeaderScore.hidden = !exam.temGabaritoUtil;

  if (!Array.isArray(exam.questoes) || exam.questoes.length === 0) {
    dom.questionList.innerHTML = `
      <div class="state-panel">
        <h2>Sem questões nesta prova</h2>
      </div>
    `;
    updateScoreUI();
    return;
  }

  dom.questionList.innerHTML = exam.questoes.map((question) => renderQuestionCard(question)).join("");
  updateScoreUI();
}

async function openExam(examId) {
  toggleHome(false);
  dom.printPdfButton.disabled = true;
  dom.examTitle.textContent = "Carregando prova...";
  dom.examMeta.textContent = "";
  dom.examHeaderScore.hidden = true;
  dom.questionList.innerHTML = `
    <div class="state-panel">
      <h2>Carregando questões...</h2>
      <p>Preparando a prova.</p>
    </div>
  `;

  try {
    const exam = await loadExam(examId);
    state.provaAtual = exam;
    state.respostas = new Map();
    state.riscos = new Map();
    renderExam();
  } catch (error) {
    dom.questionList.innerHTML = `
      <div class="state-panel is-error">
        <h2>Falha ao abrir a prova</h2>
        <p>${escapeHtml(error.message || "Não foi possível carregar os arquivos.")}</p>
      </div>
    `;
  }
}

function goHome() {
  toggleHome(true);
  state.provaAtual = null;
  dom.printPdfButton.disabled = true;
}

function handleQuestionAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button || !state.provaAtual) {
    return;
  }

  const action = button.dataset.action;
  const questionKey = button.dataset.question;
  if (!questionKey) {
    return;
  }

  if (action === "responder") {
    const letter = (button.dataset.letter || "").toUpperCase();
    if (!letter) {
      return;
    }
    state.respostas.set(questionKey, letter);
    refreshQuestion(questionKey);
    return;
  }

  if (action === "riscar") {
    const letter = (button.dataset.letter || "").toUpperCase();
    if (!letter) {
      return;
    }
    const crossed = getCrossedSet(questionKey);
    if (crossed.has(letter)) {
      crossed.delete(letter);
    } else {
      crossed.add(letter);
    }
    refreshQuestion(questionKey);
  }
}

function bindEvents() {
  dom.examGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-prova]");
    if (!button) {
      return;
    }
    const examId = button.dataset.openProva;
    openExam(examId);
  });

  dom.questionList.addEventListener("click", handleQuestionAction);

  dom.backButton.addEventListener("click", () => {
    goHome();
  });

  dom.homeShortcut.addEventListener("click", () => {
    goHome();
  });

  dom.printPdfButton.addEventListener("click", () => {
    printCurrentExamPdf();
  });
}

async function init() {
  bindEvents();
  dom.printPdfButton.disabled = true;
  toggleHome(true);
  await loadExams();
}

init();
