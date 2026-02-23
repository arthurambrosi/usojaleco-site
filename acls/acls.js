const SCENARIOS = [
  {
    id: "cenario1",
    titulo: "BRADICARDIA SINTOMÁTICA",
    observacao: "Roteiro ACLS determinístico. Referências [1], [1-2] ficam internas.",
    resumo:
      "Bradicardia instável com segunda linha, transição para PCR chocável, AESP e pós-RCE.",
    paciente: {
      apresentacao: "Paciente consciente, mas confuso no início.",
      foco: "Treino completo de resposta ACLS sem IA."
    },
    steps: [
      {
        id: "c1_s01",
        tipo: "início",
        texto_instrutor:
          "Paciente consciente, mas confuso. FC 38 bpm. PA 78/50. SpO₂ 88% em ar ambiente.",
        respostas_esperadas: [
          "Verbalizar: bradicardia sintomática instável",
          "Aplicar oxigênio suplementar (meta SpO₂ ≥ 94%)",
          "Confirmar eletrodos bem posicionados no monitor",
          "Estabelecer acesso IV periférico calibroso",
          "Identificar sinais de instabilidade"
        ],
        vitals: { fc: 38, pa: "78/50", spo2: 88, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s02"
      },
      {
        id: "c1_s02",
        tipo: "oxigenação",
        texto_instrutor:
          "Após: O₂ a 15 L/min em máscara não-reinalante. SpO₂ 96%. Paciente mantém hipotensão e confusão.",
        respostas_esperadas: [
          "Manter monitorização contínua",
          "Reavaliar perfusão e estado mental"
        ],
        vitals: { fc: 38, pa: "78/50", spo2: 96, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s03"
      },
      {
        id: "c1_s03",
        tipo: "atropina",
        texto_instrutor:
          "Dose 1: atropina 1 mg IV em bolus, aguardar 3–5 min. Após 3 min: FC 40, PA 80/52, confuso.",
        respostas_esperadas: [
          "Administrar atropina 1 mg IV em bolus",
          "Aguardar 3–5 min",
          "Reconhecer resposta insuficiente"
        ],
        vitals: { fc: 40, pa: "80/52", spo2: 96, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s04"
      },
      {
        id: "c1_s04",
        tipo: "atropina",
        texto_instrutor:
          "Dose 2: atropina 1 mg. Após 3 min: FC 42, PA 82/50. Sem melhora significativa.",
        respostas_esperadas: [
          "Administrar atropina 1 mg",
          "Reavaliar sinais de instabilidade"
        ],
        vitals: { fc: 42, pa: "82/50", spo2: 96, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s05"
      },
      {
        id: "c1_s05",
        tipo: "atropina",
        texto_instrutor:
          "Dose 3: atropina 1 mg (última). Após 3 min: FC 38, PA 76/48, piora clínica.",
        respostas_esperadas: [
          "Administrar atropina 1 mg (última dose)",
          "Escalar para segunda linha imediatamente"
        ],
        vitals: { fc: 38, pa: "76/48", spo2: 96, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s06"
      },
      {
        id: "c1_s06",
        tipo: "segunda_linha",
        texto_instrutor:
          "Escolha A: marcapasso transcutâneo (pás, 60–80 bpm, subir mA até captura, confirmar pulso, considerar sedação) OU Escolha B: dopamina 5–20 mcg/kg/min (iniciar 5 e titular).",
        respostas_esperadas: ["Definir estratégia de segunda linha (A ou B)"],
        vitals: { fc: 38, pa: "76/48", spo2: 96, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        branch: {
          default_choice: "A",
          prompt:
            "Selecione a conduta de segunda linha. Se nada for marcado, segue a Opção A.",
          choices: [
            {
              value: "A",
              label:
                "Opção A: marcapasso transcutâneo (60–80 bpm, subir mA até captura, confirmar pulso, considerar sedação).",
              next: "c1_s07a"
            },
            {
              value: "B",
              label:
                "Opção B: dopamina 5–20 mcg/kg/min (iniciar 5 e titular).",
              next: "c1_s07b"
            }
          ]
        }
      },
      {
        id: "c1_s07a",
        tipo: "segunda_linha_a",
        texto_instrutor:
          "Opção A: marcapasso transcutâneo (pás, 60–80 bpm, subir mA até captura, confirmar pulso, considerar sedação/analgesia se consciente).",
        respostas_esperadas: [
          "Aplicar pás adesivas de marcapasso",
          "Iniciar com frequência de 60–80 bpm",
          "Aumentar corrente (mA) até obter captura",
          "Confirmar captura com palpação de pulso",
          "Considerar sedação/analgesia se paciente consciente"
        ],
        vitals: { fc: 65, pa: "86/54", spo2: 96, etco2: null, pulso: true },
        waveform: "ritmo_organizado",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s08"
      },
      {
        id: "c1_s07b",
        tipo: "segunda_linha_b",
        texto_instrutor:
          "Opção B: iniciar infusão de dopamina 5–20 mcg/kg/min (iniciar 5 e titular conforme resposta).",
        respostas_esperadas: [
          "Iniciar dopamina 5 mcg/kg/min",
          "Titular conforme resposta hemodinâmica"
        ],
        vitals: { fc: 42, pa: "82/50", spo2: 96, etco2: null, pulso: true },
        waveform: "sinus_bradicardia",
        ecg_image: "/assets/ecg/cenario1_bradicardia.png",
        next: "c1_s08"
      },
      {
        id: "c1_s08",
        tipo: "pcr_chocável",
        texto_instrutor:
          "Instrutor: perdeu a consciência. Monitor: taquicardia ventricular monomórfica. Sem pulso carotídeo. Entrar em algoritmo chocável: iniciar RCP de alta qualidade, delegar funções, preparar desfibrilador (200 J bifásico).",
        respostas_esperadas: [
          "Reconhecer TV sem pulso (ritmo chocável)",
          "Iniciar RCP de alta qualidade imediatamente",
          "Delegar funções da equipe",
          "Carregar desfibrilador (200 J bifásico)"
        ],
        vitals: { fc: 180, pa: "0/0", spo2: "-", etco2: 12, pulso: false },
        waveform: "tv_monomorfica",
        evento: "SEM PULSO",
        ecg_image: "/assets/ecg/cenario1_tv.png",
        next: "c1_s09"
      },
      {
        id: "c1_s09",
        tipo: "choque",
        texto_instrutor:
          "Choque 1: análise rápida (pausa <10s), choque, retomar RCP imediatamente. Via aérea: 30:2 até via aérea avançada. Após IOT: compressões contínuas + ventilações 10/min. ETCO₂ inicial 12 mmHg.",
        respostas_esperadas: [
          "Realizar choque 1",
          "Retomar RCP imediatamente após o choque",
          "Manter 30:2 até via aérea avançada",
          "Após IOT: compressões contínuas + 10 ventilações/min"
        ],
        vitals: { fc: 180, pa: "0/0", spo2: "-", etco2: 12, pulso: false },
        waveform: "tv_monomorfica",
        evento: "SEM PULSO",
        ecg_image: "/assets/ecg/cenario1_tv.png",
        next: "c1_s10"
      },
      {
        id: "c1_s10",
        tipo: "análise",
        texto_instrutor:
          "Análise 2 min: TV sem pulso. Choque 2 + epinefrina 1 mg IV/IO.",
        respostas_esperadas: ["Realizar choque 2", "Administrar epinefrina 1 mg IV/IO"],
        vitals: { fc: 180, pa: "0/0", spo2: "-", etco2: 18, pulso: false },
        waveform: "tv_monomorfica",
        evento: "SEM PULSO",
        ecg_image: "/assets/ecg/cenario1_tv.png",
        next: "c1_s11"
      },
      {
        id: "c1_s11",
        tipo: "análise",
        texto_instrutor:
          "Análise 4 min: TV sem pulso. Choque 3 + amiodarona 300 mg IV/IO em bolus + troca de compressor.",
        respostas_esperadas: [
          "Realizar choque 3",
          "Administrar amiodarona 300 mg IV/IO",
          "Trocar compressor"
        ],
        vitals: { fc: 180, pa: "0/0", spo2: "-", etco2: 22, pulso: false },
        waveform: "tv_monomorfica",
        evento: "SEM PULSO",
        ecg_image: "/assets/ecg/cenario1_tv.png",
        next: "c1_s12"
      },
      {
        id: "c1_s12",
        tipo: "análise",
        texto_instrutor:
          "Análise 6 min: TV sem pulso. Choque 4 + epinefrina 1 mg IV/IO (intervalo 3–5 min).",
        respostas_esperadas: ["Realizar choque 4", "Administrar epinefrina 1 mg IV/IO"],
        vitals: { fc: 180, pa: "0/0", spo2: "-", etco2: 24, pulso: false },
        waveform: "tv_monomorfica",
        evento: "SEM PULSO",
        ecg_image: "/assets/ecg/cenario1_tv.png",
        next: "c1_s13"
      },
      {
        id: "c1_s13",
        tipo: "aesp",
        texto_instrutor:
          "Análise 8 min: ritmo organizado ~70, SEM pulso ⇒ AESP. Retomar RCP (sem choque). Investigar Hs e Ts. Epinefrina (3ª dose) no timing adequado. Análise 10 min: AESP persiste.",
        respostas_esperadas: [
          "Reconhecer AESP",
          "Retomar RCP sem choque",
          "Investigar e tratar Hs e Ts",
          "Administrar epinefrina (3ª dose) no intervalo correto"
        ],
        vitals: { fc: 70, pa: "0/0", spo2: "-", etco2: 28, pulso: false },
        waveform: "ritmo_organizado",
        evento: "SEM PULSO",
        ecg_image: "/assets/ecg/cenario1_ritmo_organizado.png",
        next: "c1_s14"
      },
      {
        id: "c1_s14",
        tipo: "rce",
        texto_instrutor:
          "Análise 12 min: movimento espontâneo, ETCO₂ 42 mmHg, pulso presente ⇒ RCE.",
        respostas_esperadas: ["Reconhecer retorno da circulação espontânea (RCE)"],
        vitals: { fc: 85, pa: "88/55", spo2: 94, etco2: 42, pulso: true },
        waveform: "ritmo_organizado",
        evento: "RCE",
        ecg_image: "/assets/ecg/cenario1_ritmo_organizado.png",
        next: "c1_s15"
      },
      {
        id: "c1_s15",
        tipo: "pós_rce",
        texto_instrutor:
          "Pós-RCE: monitorização completa (meta PAS ≥ 90, SpO₂ 92–98, ETCO₂ 35–45, ECG 12 derivações). Ventilação: FR 10/min, evitar hiperventilação, titular FiO₂. Exames: gasometria, hemograma, eletrólitos, função renal, troponina, lactato e glicemia.",
        respostas_esperadas: [
          "Monitorização completa",
          "Meta PAS ≥ 90",
          "Meta SpO₂ 92–98",
          "Meta ETCO₂ 35–45",
          "FR 10/min sem hiperventilação",
          "Solicitar gasometria, hemograma, eletrólitos, função renal, troponina, lactato e glicemia"
        ],
        vitals: { fc: 84, pa: "90/58", spo2: 96, etco2: 40, pulso: true },
        waveform: "ritmo_organizado",
        ecg_image: "/assets/ecg/cenario1_ritmo_organizado.png",
        next: "c1_s16"
      },
      {
        id: "c1_s16",
        tipo: "pós_rce",
        texto_instrutor:
          "Neurológico: comatoso, indicar controle de temperatura (32°C a 37,5°C) por no mínimo 36 h; evitar hipertermia; reaquecer ≤ 0,5°C/h. Investigar causa: ECG 12D, IAMCSST ⇒ cateterismo emergente; se não, estratégia seletiva/tardia; RX de tórax; TC de crânio se indicado.",
        respostas_esperadas: [
          "Controle de temperatura 32°C a 37,5°C por no mínimo 36 h",
          "Evitar hipertermia",
          "Reaquecer ≤ 0,5°C/h",
          "Investigar causa com ECG 12D, estratégia coronariana, RX de tórax e TC de crânio se indicado"
        ],
        vitals: { fc: 84, pa: "94/62", spo2: 96, etco2: 37, pulso: true },
        waveform: "ritmo_organizado",
        ecg_image: null,
        next: "c1_s17"
      },
      {
        id: "c1_s17",
        tipo: "pós_rce",
        texto_instrutor:
          "Hemodinâmica: PA 88/55 ⇒ norepinefrina para PAS ≥ 90. Prognóstico: evitar prognosticação <72 h; considerar EEG; transferir para UTI.",
        respostas_esperadas: [
          "Iniciar norepinefrina para PAS ≥ 90",
          "Evitar prognosticação <72 h",
          "Considerar EEG",
          "Transferir para UTI"
        ],
        vitals: { fc: 85, pa: "96/62", spo2: 95, etco2: 36, pulso: true },
        waveform: "ritmo_organizado",
        evento: "Fim do cenário",
        ecg_image: null,
        next: null
      }
    ]
  }
];

const state = {
  scenarioId: null,
  currentStepId: null,
  history: [],
  mode: "treino",
  showAnswers: false,
  isPaused: false,
  startTimeMs: 0,
  logs: [],
  branchSelections: {},
  checklistMarks: {},
  uploadedEcgUrl: null,
  currentEcgSrc: null,
  ecgLoadError: false,
  ecgZoom: 1
};

const monitorState = {
  ctx: null,
  lastTs: 0,
  simTime: 0,
  waveform: "idle",
  transitionFlash: 0,
  rafId: 0
};

const dom = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheDom();
  bindEvents();
  renderScenarioCollections();
  renderQuickList();
  renderIdleState();
  resizeMonitorCanvas();
  startMonitorLoop();
  window.addEventListener("resize", resizeMonitorCanvas);
}

function cacheDom() {
  const ids = [
    "scenario-grid",
    "scenario-quick-list",
    "side-status",
    "scenario-picker",
    "simulation-shell",
    "btn-back-to-picker",
    "btn-top-restart",
    "scenario-title",
    "scenario-select",
    "mode-treino",
    "mode-instrutor",
    "progress-text",
    "step-kind-badge",
    "step-id-text",
    "btn-prev-step",
    "btn-next-step",
    "btn-pause",
    "btn-restart",
    "btn-toggle-respostas",
    "branch-box",
    "branch-prompt",
    "branch-choices",
    "user-note",
    "btn-add-note",
    "log-list",
    "step-position",
    "step-title",
    "instrutor-text",
    "event-banner",
    "respostas-subtitle",
    "respostas-hidden-msg",
    "respostas-list",
    "timeline-list",
    "monitor-canvas",
    "monitor-warning",
    "monitor-phase",
    "vital-fc",
    "vital-spo2",
    "vital-pa",
    "vital-etco2",
    "ecg-source",
    "ecg-image",
    "ecg-placeholder",
    "ecg-upload-input",
    "btn-ecg-upload",
    "btn-ecg-clear-upload",
    "btn-ecg-zoom-out",
    "btn-ecg-zoom-reset",
    "btn-ecg-zoom-in",
    "btn-ecg-full",
    "patient-title",
    "patient-note",
    "ecg-modal",
    "ecg-modal-close",
    "ecg-modal-image"
  ];
  ids.forEach((id) => {
    dom[toCamel(id)] = document.getElementById(id);
  });
}

function bindEvents() {
  dom.btnBackToPicker.addEventListener("click", showPicker);
  dom.btnTopRestart.addEventListener("click", restartScenario);
  dom.scenarioSelect.addEventListener("change", () =>
    startScenario(dom.scenarioSelect.value, { keepMode: true })
  );
  dom.modeTreino.addEventListener("click", () => setMode("treino"));
  dom.modeInstrutor.addEventListener("click", () => setMode("instrutor"));
  dom.btnPrevStep.addEventListener("click", goPrevStep);
  dom.btnNextStep.addEventListener("click", goNextStep);
  dom.btnPause.addEventListener("click", togglePause);
  dom.btnRestart.addEventListener("click", restartScenario);
  dom.btnToggleRespostas.addEventListener("click", toggleRespostas);
  dom.branchChoices.addEventListener("change", onBranchChoiceChanged);
  dom.respostasList.addEventListener("change", onChecklistChanged);
  dom.btnAddNote.addEventListener("click", saveUserNote);
  dom.userNote.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "enter") {
      event.preventDefault();
      saveUserNote();
    }
  });
  dom.btnEcgUpload.addEventListener("click", () => dom.ecgUploadInput.click());
  dom.ecgUploadInput.addEventListener("change", onEcgUploadSelected);
  dom.btnEcgClearUpload.addEventListener("click", clearUploadedEcg);
  dom.btnEcgZoomIn.addEventListener("click", () => setEcgZoom(state.ecgZoom + 0.15));
  dom.btnEcgZoomOut.addEventListener("click", () => setEcgZoom(state.ecgZoom - 0.15));
  dom.btnEcgZoomReset.addEventListener("click", () => setEcgZoom(1));
  dom.btnEcgFull.addEventListener("click", openEcgModal);
  dom.ecgImage.addEventListener("load", () => {
    state.ecgLoadError = false;
    dom.ecgPlaceholder.classList.add("is-hidden");
    dom.ecgImage.classList.remove("is-hidden");
    updateEcgControls();
  });
  dom.ecgImage.addEventListener("error", () => {
    state.ecgLoadError = true;
    dom.ecgImage.classList.add("is-hidden");
    dom.ecgPlaceholder.textContent = "ECG nao encontrado para este passo.";
    dom.ecgPlaceholder.classList.remove("is-hidden");
    updateEcgControls();
  });
  dom.ecgModalClose.addEventListener("click", closeEcgModal);
  dom.ecgModal.addEventListener("click", (event) => {
    if (event.target === dom.ecgModal) closeEcgModal();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeEcgModal();
  });
  window.addEventListener("beforeunload", clearUploadedEcg);
}

function renderScenarioCollections() {
  dom.scenarioGrid.innerHTML = "";
  dom.scenarioSelect.innerHTML = "";
  SCENARIOS.forEach((scenario) => {
    const card = document.createElement("article");
    card.className = "scenarioCard";
    card.innerHTML =
      "<h3>" +
      scenario.titulo +
      "</h3><p>" +
      scenario.resumo +
      "</p><p>" +
      scenario.observacao +
      "</p>";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "headBtn headBtnPrimary";
    btn.textContent = "Iniciar cenario";
    btn.addEventListener("click", () => startScenario(scenario.id, { keepMode: true }));
    card.appendChild(btn);
    dom.scenarioGrid.appendChild(card);

    const opt = document.createElement("option");
    opt.value = scenario.id;
    opt.textContent = scenario.titulo;
    dom.scenarioSelect.appendChild(opt);
  });
}

function renderQuickList() {
  dom.scenarioQuickList.innerHTML = "";
  SCENARIOS.forEach((scenario) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quickBtn" + (state.scenarioId === scenario.id ? " active" : "");
    button.textContent = scenario.titulo;
    button.addEventListener("click", () => startScenario(scenario.id, { keepMode: true }));
    dom.scenarioQuickList.appendChild(button);
  });
}

function showPicker() {
  dom.scenarioPicker.classList.remove("is-hidden");
  dom.simulationShell.classList.add("is-hidden");
}

function showSimulation() {
  dom.scenarioPicker.classList.add("is-hidden");
  dom.simulationShell.classList.remove("is-hidden");
}

function renderIdleState() {
  dom.scenarioTitle.textContent = "-";
  dom.progressText.textContent = "Passo 0/0";
  dom.stepKindBadge.textContent = "-";
  dom.stepIdText.textContent = "Step: -";
  dom.stepPosition.textContent = "-";
  dom.stepTitle.textContent = "-";
  dom.instrutorText.textContent = "Selecione um cenario para comecar.";
  dom.eventBanner.classList.add("is-hidden");
  dom.respostasList.innerHTML = "";
  dom.timelineList.innerHTML = "";
  dom.logList.innerHTML = "";
  [dom.vitalFc, dom.vitalSpo2, dom.vitalPa, dom.vitalEtco2].forEach((el) => (el.textContent = "-"));
  dom.monitorWarning.classList.add("is-hidden");
  dom.monitorPhase.textContent = "-";
  dom.patientTitle.textContent = "-";
  dom.patientNote.textContent = "Selecione um cenario para iniciar.";
  [dom.btnPrevStep, dom.btnNextStep, dom.btnPause, dom.btnRestart, dom.btnTopRestart].forEach(
    (btn) => (btn.disabled = true)
  );
  dom.btnToggleRespostas.classList.add("is-hidden");
  renderEcg(null);
  updateModeButtons();
  updateSideStatus();
}

function getScenarioById(id) {
  return SCENARIOS.find((scenario) => scenario.id === id) || null;
}
function getActiveScenario() {
  return getScenarioById(state.scenarioId);
}
function getCurrentStep() {
  const scenario = getActiveScenario();
  return scenario ? scenario.steps.find((step) => step.id === state.currentStepId) || null : null;
}
function getStepIndex(scenario, stepId) {
  return scenario ? scenario.steps.findIndex((step) => step.id === stepId) : -1;
}

function startScenario(scenarioId, options = {}) {
  const scenario = getScenarioById(scenarioId);
  if (!scenario || !scenario.steps.length) return;
  clearUploadedEcg();
  state.scenarioId = scenario.id;
  state.currentStepId = scenario.steps[0].id;
  state.history = [scenario.steps[0].id];
  state.branchSelections = {};
  state.checklistMarks = {};
  state.logs = [];
  state.startTimeMs = performance.now();
  state.isPaused = false;
  state.ecgZoom = 1;
  state.ecgLoadError = false;
  if (!options.keepMode) state.mode = "treino";
  state.showAnswers = state.mode === "instrutor";
  monitorState.simTime = 0;
  applyWaveformFromCurrentStep(true);
  dom.userNote.value = "";
  showSimulation();
  addLog("Cenario iniciado: " + scenario.titulo);
  addStepLog("Passo atingido");
  renderAll();
}

function restartScenario() {
  if (state.scenarioId) startScenario(state.scenarioId, { keepMode: true });
}

function setMode(mode) {
  if (!["treino", "instrutor"].includes(mode)) return;
  state.mode = mode;
  if (mode === "treino") state.showAnswers = false;
  if (mode === "instrutor" && !state.showAnswers) state.showAnswers = true;
  addLog("Modo alterado para: " + (mode === "treino" ? "Treino" : "Instrutor"));
  renderAll();
}

function toggleRespostas() {
  if (state.mode !== "instrutor") return;
  state.showAnswers = !state.showAnswers;
  renderAll();
}

function togglePause() {
  if (!state.scenarioId) return;
  state.isPaused = !state.isPaused;
  addLog(state.isPaused ? "Simulacao pausada" : "Simulacao retomada");
  renderAll();
}

function resolveNextStepId(step) {
  const scenario = getActiveScenario();
  if (!scenario || !step) return null;
  if (step.branch?.choices) {
    const selected = state.branchSelections[step.id] || step.branch.default_choice;
    const match = step.branch.choices.find((choice) => choice.value === selected);
    return match && scenario.steps.some((item) => item.id === match.next) ? match.next : null;
  }
  return step.next && scenario.steps.some((item) => item.id === step.next) ? step.next : null;
}

function goNextStep() {
  const step = getCurrentStep();
  if (!step) return;
  if (step.branch && !state.branchSelections[step.id]) {
    addLog("Sem escolha explicita no selector. Opcao A aplicada por padrao.");
  }
  const nextStepId = resolveNextStepId(step);
  if (!nextStepId) {
    addLog("Fim do cenario atingido.");
    renderAll();
    return;
  }
  state.history.push(nextStepId);
  state.currentStepId = nextStepId;
  state.ecgZoom = 1;
  state.ecgLoadError = false;
  applyWaveformFromCurrentStep(true);
  addStepLog("Passo atingido");
  renderAll();
}

function goPrevStep() {
  if (state.history.length <= 1) return;
  state.history.pop();
  state.currentStepId = state.history[state.history.length - 1];
  state.ecgZoom = 1;
  state.ecgLoadError = false;
  applyWaveformFromCurrentStep(true);
  addStepLog("Retorno para");
  renderAll();
}
function addStepLog(prefix) {
  const scenario = getActiveScenario();
  const step = getCurrentStep();
  if (!scenario || !step) return;
  const idx = getStepIndex(scenario, step.id) + 1;
  addLog(prefix + " passo " + idx + "/" + scenario.steps.length + " (" + humanize(step.tipo) + ")");
}

function saveUserNote() {
  const text = (dom.userNote.value || "").trim();
  if (!text) return;
  const scenario = getActiveScenario();
  const step = getCurrentStep();
  if (!scenario || !step) return;
  addLog("Anotacao no passo " + (getStepIndex(scenario, step.id) + 1) + ": " + text);
  dom.userNote.value = "";
}

function addLog(message) {
  state.logs.unshift({ timestamp: formatElapsed(), message });
  if (state.logs.length > 200) state.logs.length = 200;
  renderLog();
}

function renderLog() {
  dom.logList.innerHTML = "";
  if (!state.logs.length) {
    const empty = document.createElement("li");
    empty.textContent = "Sem eventos no log ainda.";
    dom.logList.appendChild(empty);
    return;
  }
  state.logs.forEach((entry) => {
    const li = document.createElement("li");
    li.innerHTML = "<span class='logStamp'>[" + entry.timestamp + "]</span> " + escapeHtml(entry.message);
    dom.logList.appendChild(li);
  });
}

function formatElapsed() {
  if (!state.startTimeMs) return "00:00";
  const sec = Math.max(0, Math.floor((performance.now() - state.startTimeMs) / 1000));
  return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
}

function onBranchChoiceChanged(event) {
  const step = getCurrentStep();
  if (!step?.branch) return;
  const target = event.target;
  if (!target || target.name !== "branch-" + step.id) return;
  state.branchSelections[step.id] = target.value;
  addLog("Conduta selecionada: " + target.value);
}

function onChecklistChanged(event) {
  const target = event.target;
  if (!target || target.type !== "checkbox") return;
  const step = getCurrentStep();
  if (!step) return;
  const idx = Number(target.getAttribute("data-check-index"));
  if (!Number.isFinite(idx)) return;
  if (!state.checklistMarks[step.id]) state.checklistMarks[step.id] = {};
  if (target.checked) state.checklistMarks[step.id][idx] = true;
  else delete state.checklistMarks[step.id][idx];
}

function renderAll() {
  renderQuickList();
  updateModeButtons();
  const scenario = getActiveScenario();
  const step = getCurrentStep();
  if (!scenario || !step) {
    renderIdleState();
    return;
  }
  showSimulation();
  dom.scenarioSelect.value = scenario.id;
  dom.scenarioTitle.textContent = scenario.titulo;

  const idx = getStepIndex(scenario, step.id) + 1;
  dom.progressText.textContent = "Passo " + idx + "/" + scenario.steps.length;
  dom.stepKindBadge.textContent = humanize(step.tipo);
  dom.stepIdText.textContent = "Step: " + step.id;
  dom.stepPosition.textContent = "Passo " + idx + " de " + scenario.steps.length;
  dom.stepTitle.textContent = "Instrucao do passo " + idx;
  dom.instrutorText.textContent = step.texto_instrutor;
  dom.monitorPhase.textContent = "Ritmo: " + humanize(step.waveform || "idle");

  if (step.evento) {
    dom.eventBanner.classList.remove("is-hidden");
    dom.eventBanner.textContent = step.evento;
  } else {
    dom.eventBanner.classList.add("is-hidden");
    dom.eventBanner.textContent = "";
  }

  renderBranchSelector(step);
  renderRespostas(step);
  renderTimeline(scenario, step);
  renderVitals(step);
  renderPatientSummary(scenario, step);
  renderEcg(step);
  renderLog();

  dom.btnPrevStep.disabled = state.history.length <= 1;
  dom.btnPause.disabled = false;
  dom.btnRestart.disabled = false;
  dom.btnTopRestart.disabled = false;
  dom.btnPause.textContent = state.isPaused ? "Retomar" : "Pausar";
  dom.btnNextStep.disabled = resolveNextStepId(step) === null;

  if (state.mode === "instrutor") {
    dom.btnToggleRespostas.classList.remove("is-hidden");
    dom.btnToggleRespostas.textContent = state.showAnswers ? "Ocultar respostas" : "Mostrar respostas";
  } else {
    dom.btnToggleRespostas.classList.add("is-hidden");
  }

  updateSideStatus();
}

function renderBranchSelector(step) {
  dom.branchChoices.innerHTML = "";
  if (!step.branch?.choices?.length) {
    dom.branchBox.classList.add("is-hidden");
    return;
  }
  dom.branchBox.classList.remove("is-hidden");
  dom.branchPrompt.textContent = step.branch.prompt || "Escolha uma opcao.";
  step.branch.choices.forEach((choice) => {
    const label = document.createElement("label");
    label.className = "branchChoice";
    const checked = state.branchSelections[step.id] === choice.value ? "checked" : "";
    label.innerHTML =
      "<input type='radio' name='branch-" +
      step.id +
      "' value='" +
      choice.value +
      "' " +
      checked +
      ">" +
      "<span>" +
      escapeHtml(choice.label) +
      "</span>";
    dom.branchChoices.appendChild(label);
  });
}

function renderRespostas(step) {
  dom.respostasList.innerHTML = "";
  const answers = Array.isArray(step.respostas_esperadas) ? step.respostas_esperadas : [];
  if (state.mode === "treino") {
    dom.respostasHiddenMsg.classList.remove("is-hidden");
    dom.respostasHiddenMsg.textContent = "Respostas ocultas no modo treino.";
    dom.respostasSubtitle.textContent = "Mude para Modo Instrutor para exibir checklist.";
    return;
  }
  if (!state.showAnswers) {
    dom.respostasHiddenMsg.classList.remove("is-hidden");
    dom.respostasHiddenMsg.textContent = "Respostas ocultas. Use o botao Mostrar respostas.";
    dom.respostasSubtitle.textContent = "Checklist manual (sem validacao automatica).";
    return;
  }
  dom.respostasHiddenMsg.classList.add("is-hidden");
  dom.respostasSubtitle.textContent = "Checklist manual (sem validacao automatica).";
  if (!answers.length) {
    const item = document.createElement("li");
    item.className = "checkItem";
    item.textContent = "Sem respostas esperadas registradas neste passo.";
    dom.respostasList.appendChild(item);
    return;
  }
  if (!state.checklistMarks[step.id]) state.checklistMarks[step.id] = {};
  answers.forEach((answer, index) => {
    const item = document.createElement("li");
    item.className = "checkItem";
    item.innerHTML =
      "<input type='checkbox' data-check-index='" +
      index +
      "' " +
      (state.checklistMarks[step.id][index] ? "checked" : "") +
      "><label>" +
      escapeHtml(answer) +
      "</label>";
    dom.respostasList.appendChild(item);
  });
}

function renderTimeline(scenario, step) {
  dom.timelineList.innerHTML = "";
  const done = new Set(state.history);
  scenario.steps.forEach((item, idx) => {
    const li = document.createElement("li");
    li.textContent = `${idx + 1}. ${humanize(item.tipo)} - ${truncate(item.texto_instrutor, 90)}`;
    if (item.id === step.id) li.classList.add("current");
    else if (done.has(item.id)) li.classList.add("done");
    dom.timelineList.appendChild(li);
  });
}

function renderVitals(step) {
  const v = step.vitals || {};
  dom.vitalFc.textContent = formatFc(v.fc);
  dom.vitalSpo2.textContent = formatSpo2(v.spo2);
  dom.vitalPa.textContent = formatPa(v.pa);
  dom.vitalEtco2.textContent = formatEtco2(v.etco2);
  dom.monitorWarning.classList.toggle("is-hidden", v.pulso !== false);
  applyWaveformFromCurrentStep(false);
}

function renderPatientSummary(scenario, step) {
  const v = step.vitals || {};
  dom.patientTitle.textContent = scenario.titulo;
  dom.patientNote.textContent =
    (v.pulso === false ? "Sem pulso" : "Pulso presente") +
    " | " +
    scenario.paciente.apresentacao +
    " | " +
    scenario.paciente.foco;
}

function updateModeButtons() {
  dom.modeTreino.classList.toggle("active", state.mode === "treino");
  dom.modeInstrutor.classList.toggle("active", state.mode === "instrutor");
}

function updateSideStatus() {
  if (!state.scenarioId) {
    dom.sideStatus.textContent = "Escolha um cenario para iniciar.";
    return;
  }
  const scenario = getActiveScenario();
  const step = getCurrentStep();
  if (!scenario || !step) return;
  dom.sideStatus.textContent =
    scenario.titulo +
    " | Passo " +
    (getStepIndex(scenario, step.id) + 1) +
    "/" +
    scenario.steps.length +
    " | " +
    (state.mode === "treino" ? "Treino" : "Instrutor") +
    (state.isPaused ? " | Pausado" : "");
}
function onEcgUploadSelected(event) {
  const file = event.target?.files?.[0];
  if (!file || !file.type.startsWith("image/")) return;
  clearUploadedEcg();
  state.uploadedEcgUrl = URL.createObjectURL(file);
  addLog("Upload ECG de teste ativo: " + file.name);
  event.target.value = "";
  renderAll();
}

function clearUploadedEcg() {
  if (state.uploadedEcgUrl) {
    URL.revokeObjectURL(state.uploadedEcgUrl);
    state.uploadedEcgUrl = null;
  }
}

function renderEcg(step) {
  const source = state.uploadedEcgUrl || step?.ecg_image || null;
  state.currentEcgSrc = source;
  dom.ecgSource.textContent = state.uploadedEcgUrl ? "Upload de teste ativo" : source || "Sem ECG neste passo.";
  if (!source) {
    dom.ecgImage.classList.add("is-hidden");
    dom.ecgPlaceholder.textContent = "Sem ECG neste passo.";
    dom.ecgPlaceholder.classList.remove("is-hidden");
    dom.ecgImage.removeAttribute("src");
    state.ecgLoadError = false;
    setEcgZoom(1, true);
    updateEcgControls();
    return;
  }
  if (dom.ecgImage.dataset.source !== source) {
    dom.ecgImage.dataset.source = source;
    dom.ecgPlaceholder.textContent = "Carregando ECG...";
    dom.ecgPlaceholder.classList.remove("is-hidden");
    dom.ecgImage.classList.add("is-hidden");
    dom.ecgImage.src = source;
  }
  setEcgZoom(state.ecgZoom, true);
  updateEcgControls();
}

function setEcgZoom(value, silent = false) {
  state.ecgZoom = clamp(value, 0.5, 3);
  dom.ecgImage.style.transform = `scale(${state.ecgZoom.toFixed(2)})`;
  dom.btnEcgZoomReset.textContent = Math.round(state.ecgZoom * 100) + "%";
  if (!silent) updateEcgControls();
}

function updateEcgControls() {
  const hasImage = !!state.currentEcgSrc && !state.ecgLoadError;
  [dom.btnEcgZoomIn, dom.btnEcgZoomOut, dom.btnEcgZoomReset, dom.btnEcgFull].forEach(
    (btn) => (btn.disabled = !hasImage)
  );
  dom.btnEcgClearUpload.disabled = !state.uploadedEcgUrl;
}

function openEcgModal() {
  if (!state.currentEcgSrc || state.ecgLoadError) return;
  dom.ecgModalImage.src = state.currentEcgSrc;
  dom.ecgModal.classList.remove("is-hidden");
}

function closeEcgModal() {
  dom.ecgModal.classList.add("is-hidden");
}

function resizeMonitorCanvas() {
  const rect = dom.monitorCanvas.getBoundingClientRect();
  const w = Math.max(300, Math.floor(rect.width));
  const h = Math.max(160, Math.floor(rect.height));
  const dpr = window.devicePixelRatio || 1;
  dom.monitorCanvas.width = Math.floor(w * dpr);
  dom.monitorCanvas.height = Math.floor(h * dpr);
  monitorState.ctx = dom.monitorCanvas.getContext("2d");
  monitorState.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startMonitorLoop() {
  if (monitorState.rafId) cancelAnimationFrame(monitorState.rafId);
  monitorState.lastTs = 0;
  const frame = (ts) => {
    if (!monitorState.lastTs) monitorState.lastTs = ts;
    const dt = Math.min(0.05, (ts - monitorState.lastTs) / 1000);
    monitorState.lastTs = ts;
    if (!state.isPaused) {
      monitorState.simTime += dt;
      monitorState.transitionFlash = Math.max(0, monitorState.transitionFlash - dt);
    }
    drawMonitorFrame();
    monitorState.rafId = requestAnimationFrame(frame);
  };
  monitorState.rafId = requestAnimationFrame(frame);
}

function applyWaveformFromCurrentStep(forceReset) {
  const wave = getCurrentStep()?.waveform || "idle";
  if (forceReset || monitorState.waveform !== wave) {
    monitorState.waveform = wave;
    monitorState.simTime = 0;
    monitorState.transitionFlash = 0.16;
  }
}

function drawMonitorFrame() {
  if (!monitorState.ctx) return;
  const ctx = monitorState.ctx;
  const w = dom.monitorCanvas.clientWidth;
  const h = dom.monitorCanvas.clientHeight;
  drawMonitorGrid(ctx, w, h);
  drawWaveform(ctx, w, h, monitorState.waveform, monitorState.simTime);
  if (state.isPaused) {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 16px Montserrat";
    ctx.textAlign = "center";
    ctx.fillText("PAUSADO", w / 2, h / 2 + 6);
  }
  if (monitorState.transitionFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.12, monitorState.transitionFlash * 0.6)})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawMonitorGrid(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#04150d";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(41,114,79,.18)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(84,176,124,.24)";
  for (let x = 0; x <= w; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawWaveform(ctx, w, h, type, t0) {
  const baseY = h * 0.5;
  const amp = h * 0.32;
  const sec = 6;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 1) {
    const t = t0 - sec + (x / w) * sec;
    const y = baseY - sampleWave(type, t) * amp;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#65ff96";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(102,255,170,.65)";
  ctx.shadowBlur = 7;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function sampleWave(type, t) {
  if (type === "tv_monomorfica") return waveTv(t, 180);
  if (type === "ritmo_organizado") return waveSinus(t, 70, 0.82);
  if (type === "sinus_bradicardia") return waveSinus(t, 40, 1);
  return 0.02 * Math.sin(2 * Math.PI * 0.7 * t);
}

function waveSinus(t, hr, gain) {
  const p = phase01(t, 60 / hr);
  let v = 0;
  if (p < 0.08) v = 0.1 * Math.sin(Math.PI * (p / 0.08));
  else if (p < 0.14) v = -0.18 * ((p - 0.12) / 0.02);
  else if (p < 0.16) v = -0.18 + 1.35 * ((p - 0.14) / 0.02);
  else if (p < 0.19) v = 1.17 - 1.42 * ((p - 0.16) / 0.03);
  else if (p < 0.32) v = -0.25 + 0.25 * ((p - 0.19) / 0.13);
  else if (p < 0.52) v = 0.24 * Math.sin(Math.PI * ((p - 0.32) / 0.2));
  const wander = 0.02 * Math.sin(2 * Math.PI * t * 0.25);
  const noise = 0.01 * Math.sin(2 * Math.PI * t * 13 + 0.3);
  return (v + wander + noise) * gain;
}

function waveTv(t, hr) {
  const p = phase01(t, 60 / hr);
  let v = 0;
  if (p < 0.16) v = (p / 0.16) * 1.25;
  else if (p < 0.34) v = 1.25 - ((p - 0.16) / 0.18) * 2.25;
  else if (p < 0.62) v = -1 + ((p - 0.34) / 0.28) * 0.62;
  else v = -0.38 + ((p - 0.62) / 0.38) * 0.38;
  return v + 0.02 * Math.sin(2 * Math.PI * t * 10.2);
}

function phase01(t, cycle) {
  const r = t % cycle;
  return (r < 0 ? r + cycle : r) / cycle;
}

function formatFc(v) {
  if (v == null) return "--";
  if (typeof v === "number") return `${v} bpm`;
  return String(v).trim() === "-" ? "--" : String(v);
}
function formatSpo2(v) {
  if (v == null) return "n/a";
  if (typeof v === "number") return `${v}%`;
  return String(v).trim() === "-" ? "--" : String(v);
}
function formatPa(v) {
  if (v == null) return "--";
  return String(v);
}
function formatEtco2(v) {
  if (v == null) return "n/a";
  if (typeof v === "number") return `${v} mmHg`;
  return String(v).trim() === "-" ? "--" : String(v);
}

function humanize(v) {
  return String(v || "-")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function truncate(v, len) {
  const s = String(v || "");
  return s.length <= len ? s : s.slice(0, len - 1) + "...";
}
function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
function toCamel(id) {
  return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
