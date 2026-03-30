/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TranscreveAI — script.js
 * Transcrição de áudio no navegador usando Transformers.js + OpenAI Whisper
 *
 * Arquitetura:
 *   1. Importa @huggingface/transformers via CDN (ESM)
 *   2. Detecta WebGPU → usa fp16. Sem suporte → usa WASM com quantização q8
 *   3. Carrega modelo Whisper preguiçosamente (somente ao clicar "Transcrever")
 *   4. Suporta gravação via MediaRecorder e upload de arquivo
 *   5. Exibe progresso de download do modelo e de transcrição
 *
 * Modelos usados:
 *   - Modo Rápido   → Xenova/whisper-tiny    (~77  MB quantizado)
 *   - Melhor Qualidade → Xenova/whisper-small (~244 MB quantizado)
 *
 * Os modelos são baixados do HuggingFace Hub e cacheados pelo navegador (IndexedDB).
 * Na segunda execução, a transcrição começa em segundos.
 *
 * ⚠️  Limitações conhecidas:
 *   - Primeira execução requer download do modelo (pode ser lento em conexões lentas).
 *   - Arquivos muito grandes (>30min) podem exceder a memória disponível.
 *   - WebGPU ainda não está disponível em Firefox estável (usa WASM automaticamente).
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/* ─────────────────────────────────────────────────────────────────────────────
   IMPORTAÇÕES
   Usamos a versão 3 do @huggingface/transformers diretamente do CDN jsDelivr.
   O pacote já inclui os binários WASM do onnxruntime-web e lida com o fallback.
   ───────────────────────────────────────────────────────────────────────────── */
import {
  pipeline,
  env,
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js';

/* ─────────────────────────────────────────────────────────────────────────────
   CONFIGURAÇÃO DO AMBIENTE TRANSFORMERS.JS
   ───────────────────────────────────────────────────────────────────────────── */
const canUseBrowserCache =
  typeof window !== 'undefined' &&
  typeof window.caches !== 'undefined';

// Não tentamos carregar modelos locais (tudo vem do HuggingFace Hub via CDN)
env.allowLocalModels = false;

// Usa o Cache API quando disponível (HTTPS/localhost). Em HTTP comum, o
// navegador costuma bloquear esse recurso.
env.useBrowserCache = canUseBrowserCache;

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTES
   ───────────────────────────────────────────────────────────────────────────── */
const MODELS = {
  fast:    'Xenova/whisper-tiny',   // ~77 MB
  quality: 'Xenova/whisper-small',  // ~244 MB
};

const AUDIO_SAMPLE_RATE = 16000;
const LIVE_PREVIEW_INTERVAL_MS = 2200;
const LIVE_PREVIEW_MIN_SEC = 2.4;
const LIVE_PREVIEW_WINDOW_SEC = 6;
const LIVE_PREVIEW_COMMIT_LAG_SEC = 1.4;
const LIVE_PREVIEW_CPU_MODEL_KEY = 'fast';

// Mapeamento de idioma amigável → código aceito pelo Whisper
const LANG_MAP = {
  portuguese: 'pt',
  english:    'en',
  spanish:    'es',
  french:     'fr',
  german:     'de',
  italian:    'it',
  japanese:   'ja',
  chinese:    'zh',
  auto:       null, // null = detecção automática
};

/* ─────────────────────────────────────────────────────────────────────────────
   ESTADO GLOBAL DA APLICAÇÃO
   ───────────────────────────────────────────────────────────────────────────── */
const state = {
  audioBlob:       null,   // Blob do áudio (gravado ou carregado)
  audioDataFloat32: null,  // PCM 16 kHz já pronto para o Whisper
  audioObjectUrl:  null,   // URL de objeto para o blob
  isRecording:     false,  // Se está gravando agora
  mediaRecorder:   null,   // Instância do MediaRecorder
  mediaRecorderMimeType: '',
  recordedChunks:  [],     // Chunks coletados durante a gravação
  micStream:       null,   // Stream do microfone (para liberar depois)
  transcribers:    {},     // Pipelines carregados por modelo
  transcriberLoads:{},     // Promises de carga por modelo
  isTranscribing:  false,  // Evita execuções paralelas
  device:          'wasm', // 'webgpu' ou 'wasm'
  liveAudioContext: null,
  liveSourceNode: null,
  liveProcessorNode: null,
  liveSilenceNode: null,
  livePcmChunks: [],
  livePcmLength: 0,
  livePreviewTimer: null,
  livePreviewInFlight: false,
  liveCommittedWords: [],
  livePreviewWords: [],
  livePreviewFallbackText: '',
  livePreviewModelKey: null,
};

/* ─────────────────────────────────────────────────────────────────────────────
   REFERÊNCIAS AOS ELEMENTOS DO DOM
   ───────────────────────────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const ui = {
  btnRecord:       $('btn-record'),
  btnRecordLabel:  $('btn-record-label'),
  fileInput:       $('file-input'),
  audioPreview:    $('audio-preview'),
  previewName:     $('preview-name'),
  previewDur:      $('preview-dur'),
  audioPlayer:     $('audio-player'),
  btnClearAudio:   $('btn-clear-audio'),
  btnTranscribe:   $('btn-transcribe'),
  btnClear:        $('btn-clear'),
  liveToggle:      $('live-toggle'),
  liveTogglePill:  $('live-toggle-pill'),
  liveNote:        $('live-note'),
  statusBar:       $('status-bar'),
  statusText:      $('status-text'),
  statusIconWrap:  $('status-icon-wrap'),
  progressWrap:    $('progress-wrap'),
  progressBar:     $('progress-bar'),    // ← estava faltando esta linha (causa do erro)
  progressFill:    $('progress-fill'),
  progressLabel:   $('progress-label'),
  transcriptPlaceholder: $('transcript-placeholder'),
  transcriptText:  $('transcript-text'),
  transcriptMeta:  $('transcript-meta'),
  wordCount:       $('word-count'),
  charCount:       $('char-count'),
  btnCopy:         $('btn-copy'),
  btnDownload:     $('btn-download'),
  hwDot:           $('hw-icon'),
  hwText:          $('hw-text'),
  compatWarning:   $('compat-warning'),
  compatMsg:       $('compat-msg'),
};

/* ═══════════════════════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
   ═══════════════════════════════════════════════════════════════════════════════ */
async function initApp() {
  // 1. Verifica suporte básico do navegador
  checkBrowserSupport();

  // 2. Detecta WebGPU
  await detectHardware();

  // 3. Registra event listeners
  registerEvents();

  // 4. Ajusta o texto do modo ao vivo conforme o hardware/modo selecionado
  updateLiveModeUI();

  // 5. Pré-carrega o modelo inicial assim que a página abre.
  void preloadModelsForCurrentSelection({ initial: true });
}

/* ─────────────────────────────────────────────────────────────────────────────
   VERIFICAÇÃO DE SUPORTE DO NAVEGADOR
   ───────────────────────────────────────────────────────────────────────────── */
function checkBrowserSupport() {
  const issues = [];

  if (!window.MediaRecorder) {
    issues.push('MediaRecorder (gravação de áudio) não é suportado.');
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    issues.push('Acesso ao microfone requer HTTPS ou localhost.');
  }
  if (!window.AudioContext && !window.webkitAudioContext) {
    issues.push('Web Audio API não é suportada.');
  }
  if (!window.Worker) {
    issues.push('Web Workers não são suportados (necessário para Transformers.js).');
  }
  if (!window.isSecureContext) {
    issues.push('Esta página está em HTTP. Cache do modelo e WebGPU podem ficar indisponíveis.');
  }

  if (issues.length > 0) {
    ui.compatWarning.hidden = false;
    ui.compatMsg.textContent = issues.join(' ') +
      ' Use Chrome 113+, Edge 113+ ou Firefox 118+.';
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   DETECÇÃO DE HARDWARE (WebGPU vs WASM)
   ───────────────────────────────────────────────────────────────────────────── */
async function detectHardware() {
  ui.hwDot.className = 'hw-dot';
  ui.hwText.textContent = 'Detectando suporte a WebGPU…';

  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        state.device = 'webgpu';
        ui.hwDot.className = 'hw-dot webgpu';
        ui.hwText.textContent = '✓ WebGPU detectado — aceleração de GPU ativa';
        return;
      }
    } catch (e) {
      // WebGPU disponível mas sem adapter (comum em VMs)
    }
  }

  // Fallback: WASM
  state.device = 'wasm';
  ui.hwDot.className = 'hw-dot wasm';
  ui.hwText.textContent = '⚡ Usando WASM (CPU) — WebGPU não disponível neste navegador';
}

/* ─────────────────────────────────────────────────────────────────────────────
   REGISTRO DE EVENTOS
   ───────────────────────────────────────────────────────────────────────────── */
function registerEvents() {
  // Gravação de microfone
  ui.btnRecord.addEventListener('click', handleRecordToggle);

  // Upload de arquivo
  ui.fileInput.addEventListener('change', handleFileChange);

  // Drag & drop na label de upload
  const uploadLabel = document.querySelector('.btn-upload');
  uploadLabel.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadLabel.classList.add('drag-over');
  });
  uploadLabel.addEventListener('dragleave', () => {
    uploadLabel.classList.remove('drag-over');
  });
  uploadLabel.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadLabel.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) loadAudioFile(file);
  });

  // Limpar áudio
  ui.btnClearAudio.addEventListener('click', clearAudio);

  // Transcrever
  ui.btnTranscribe.addEventListener('click', handleTranscribe);

  // Limpar tudo
  ui.btnClear.addEventListener('click', clearAll);

  // Copiar transcrição
  ui.btnCopy.addEventListener('click', copyTranscript);

  // Baixar transcrição
  ui.btnDownload.addEventListener('click', downloadTranscript);

  // Atualiza o aviso do modo ao vivo
  ui.liveToggle.addEventListener('change', handleSelectionChange);
  document.querySelectorAll('input[name="mode"]').forEach((node) => {
    node.addEventListener('change', handleSelectionChange);
  });
}

/* ═══════════════════════════════════════════════════════════════════════════════
   GRAVAÇÃO DE MICROFONE
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Alterna entre iniciar e parar a gravação.
 * Pede permissão de microfone na primeira vez.
 */
async function handleRecordToggle() {
  if (state.isTranscribing) {
    setStatus('error', 'Aguarde a transcrição atual terminar antes de iniciar uma nova gravação.');
    return;
  }

  if (state.isRecording) {
    await stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microfone indisponível neste navegador. Use HTTPS e permita acesso ao microfone.');
    }

    clearAudio();
    clearTranscript();
    resetLiveTranscriptState();

    // Solicita acesso ao microfone com fallbacks de constraints.
    const stream = await requestMicrophoneStream();

    state.micStream = stream;
    state.recordedChunks = [];
    state.mediaRecorderMimeType = '';

    await startLiveCapture(stream);

    // Tenta usar MediaRecorder quando disponível. Se falhar, mantemos um backup WAV via PCM.
    const recorder = createMediaRecorderSafely(stream);
    state.mediaRecorder = recorder;

    if (recorder) {
      state.mediaRecorderMimeType = recorder.mimeType || '';

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          state.recordedChunks.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error('[TranscreveAI] Erro do MediaRecorder:', event);
      };

      recorder.onstop = async () => {
        await finalizeRecording();
      };

      recorder.start(1000);
    }

    state.isRecording = true;
    updateRecordButtonUI();
    updateLiveModeUI();

    if (isLivePreviewEnabled()) {
      void runLivePreview();
      state.livePreviewTimer = window.setInterval(() => {
        void runLivePreview();
      }, LIVE_PREVIEW_INTERVAL_MS);
    }

    setStatus('recording', getRecordingStatusMessage());

  } catch (err) {
    let msg = 'Não foi possível acessar o microfone.';
    if (err.name === 'NotAllowedError')   msg = 'Permissão de microfone negada. Verifique as configurações do navegador.';
    if (err.name === 'NotFoundError')     msg = 'Nenhum microfone encontrado no dispositivo.';
    if (err.name === 'NotSupportedError') msg = 'Microfone não suportado neste navegador.';
    if (err.name === 'OverconstrainedError') msg = 'O navegador recusou as configurações do microfone. Tente outro dispositivo ou navegador.';
    if (err.message) msg = err.message;
    await teardownLiveCapture();
    releaseMicrophoneStream();
    updateRecordButtonUI();
    setStatus('error', msg);
    console.error('[TranscreveAI] Erro ao acessar microfone:', err);
  }
}

async function stopRecording() {
  if (!state.isRecording) return;

  state.isRecording = false;
  clearIntervalSafe(state.livePreviewTimer);
  state.livePreviewTimer = null;
  updateRecordButtonUI();

  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  } else {
    await finalizeRecording();
  }
}

/**
 * Retorna o melhor MIME type suportado pelo MediaRecorder neste navegador.
 */
function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

async function requestMicrophoneStream() {
  const attempts = [
    {
      audio: {
        channelCount: { ideal: 1 },
        sampleRate: { ideal: AUDIO_SAMPLE_RATE },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    },
    {
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    },
    { audio: true },
  ];

  let lastError = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Não foi possível iniciar o microfone.');
}

function createMediaRecorderSafely(stream) {
  if (!window.MediaRecorder) return null;

  const mimeType = getSupportedMimeType();
  const tries = mimeType ? [{ mimeType }, {}] : [{}];

  for (const options of tries) {
    try {
      return Object.keys(options).length > 0
        ? new MediaRecorder(stream, options)
        : new MediaRecorder(stream);
    } catch (error) {
      console.warn('[TranscreveAI] Falha ao criar MediaRecorder com opções:', options, error);
    }
  }

  return null;
}

async function startLiveCapture(stream) {
  await teardownLiveCapture();

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx({ sampleRate: AUDIO_SAMPLE_RATE });
  await ctx.resume();

  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const silence = ctx.createGain();
  silence.gain.value = 0;

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    enqueueLiveChunk(input, event.inputBuffer.sampleRate || ctx.sampleRate || AUDIO_SAMPLE_RATE);
  };

  source.connect(processor);
  processor.connect(silence);
  silence.connect(ctx.destination);

  state.liveAudioContext = ctx;
  state.liveSourceNode = source;
  state.liveProcessorNode = processor;
  state.liveSilenceNode = silence;
}

async function teardownLiveCapture() {
  clearIntervalSafe(state.livePreviewTimer);
  state.livePreviewTimer = null;

  if (state.liveProcessorNode) {
    state.liveProcessorNode.disconnect();
    state.liveProcessorNode.onaudioprocess = null;
  }
  if (state.liveSourceNode) state.liveSourceNode.disconnect();
  if (state.liveSilenceNode) state.liveSilenceNode.disconnect();

  if (state.liveAudioContext) {
    try {
      await state.liveAudioContext.close();
    } catch (error) {
      console.warn('[TranscreveAI] Falha ao fechar AudioContext:', error);
    }
  }

  state.liveAudioContext = null;
  state.liveSourceNode = null;
  state.liveProcessorNode = null;
  state.liveSilenceNode = null;
}

function releaseMicrophoneStream() {
  if (state.micStream) {
    state.micStream.getTracks().forEach((track) => track.stop());
    state.micStream = null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   UPLOAD / CARREGAMENTO DE ARQUIVO
   ═══════════════════════════════════════════════════════════════════════════════ */

function handleFileChange(event) {
  const file = event.target.files?.[0];
  if (file) loadAudioFile(file);
  // Limpa o input para permitir selecionar o mesmo arquivo novamente
  event.target.value = '';
}

function loadAudioFile(file) {
  // Valida tipo de arquivo
  if (!file.type.startsWith('audio/') && !isAudioExtension(file.name)) {
    setStatus('error', `Arquivo inválido: "${file.name}". Use mp3, wav, m4a, webm, ogg, flac ou aac.`);
    return;
  }

  loadAudioBlob(file, file.name, { audioDataFloat32: null });
}

function loadAudioBlob(blob, filename, options = {}) {
  // Libera URL anterior se existir
  if (state.audioObjectUrl) {
    URL.revokeObjectURL(state.audioObjectUrl);
  }

  state.audioBlob      = blob;
  state.audioDataFloat32 = options.audioDataFloat32 ?? null;
  state.audioObjectUrl = URL.createObjectURL(blob);

  // Configura player
  ui.audioPlayer.src   = state.audioObjectUrl;
  ui.previewName.textContent = filename || 'audio';

  // Tenta obter duração
  ui.previewDur.textContent = '…';
  ui.audioPlayer.onloadedmetadata = () => {
    const dur = ui.audioPlayer.duration;
    ui.previewDur.textContent = isFinite(dur) ? formatDuration(dur) : 'duração desconhecida';
  };

  // Mostra preview e habilita botão
  ui.audioPreview.hidden = false;
  ui.btnTranscribe.disabled = false;

  setStatus('idle', `Áudio carregado: "${filename}". Clique em "Iniciar transcrição".`);
}

function isAudioExtension(name) {
  return /\.(mp3|wav|m4a|webm|ogg|flac|aac|opus|wma)$/i.test(name);
}

function clearAudio() {
  if (state.isRecording) {
    void stopRecording();
  }
  if (state.audioObjectUrl) URL.revokeObjectURL(state.audioObjectUrl);

  state.audioBlob      = null;
  state.audioDataFloat32 = null;
  state.audioObjectUrl = null;
  state.mediaRecorder = null;
  state.mediaRecorderMimeType = '';
  state.recordedChunks = [];
  resetLiveTranscriptState();

  ui.audioPlayer.src   = '';
  ui.audioPreview.hidden = true;
  ui.btnTranscribe.disabled = true;

  setStatus('idle', 'Áudio removido. Grave ou envie um novo arquivo.');
}

/* ═══════════════════════════════════════════════════════════════════════════════
   CARREGAMENTO DO MODELO WHISPER
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Carrega o pipeline de ASR com o modelo Whisper escolhido.
 * Se já está carregado com o mesmo modelo, reutiliza.
 * Exibe progresso de download dos pesos do modelo.
 */
async function loadModel(modelKey) {
  // Reutiliza se já carregado
  if (state.transcribers[modelKey]) {
    return state.transcribers[modelKey];
  }
  if (state.transcriberLoads[modelKey]) {
    return state.transcriberLoads[modelKey];
  }

  const modelId = MODELS[modelKey];
  const device   = state.device;
  // fp16 para WebGPU (rápido), q8 para WASM (menor tamanho na memória)
  const dtype    = device === 'webgpu' ? 'fp16' : 'q8';

  setStatus('loading', `Carregando modelo ${modelKey === 'fast' ? 'Rápido (whisper-tiny)' : 'Qualidade (whisper-small)'}…`);
  showProgress(0);

  let lastFile  = '';
  let totalFiles = 0;
  let loadedFiles = 0;

  /**
   * Callback de progresso chamado pelo Transformers.js durante o download.
   * Cada arquivo do modelo (encoder, decoder, tokenizer…) gera eventos separados.
   */
  const onProgress = (progressItem) => {
    // progressItem: { status, file, loaded, total, progress }
    if (progressItem.status === 'initiate') {
      totalFiles++;
      lastFile = progressItem.file?.split('/').pop() || '';
      setStatus('loading', `Baixando modelo… (${lastFile})`);
    } else if (progressItem.status === 'progress') {
      const pct = Math.round(progressItem.progress ?? 0);
      showProgress(pct, `${lastFile} — ${pct}%`);
    } else if (progressItem.status === 'done') {
      loadedFiles++;
      const overall = Math.round((loadedFiles / Math.max(totalFiles, 1)) * 100);
      showProgress(overall, `Carregado ${loadedFiles}/${totalFiles} arquivos`);
    } else if (progressItem.status === 'ready') {
      showProgress(100);
    }
  };

  const loadPromise = pipeline(
      'automatic-speech-recognition',
      modelId,
      {
        device,
        dtype,
        progress_callback: onProgress,
      }
    )
    .then((transcriber) => {
      state.transcribers[modelKey] = transcriber;
      hideProgress();
      return transcriber;
    })
    .catch((err) => {
      hideProgress();
      throw new Error(`Falha ao carregar o modelo "${modelId}": ${err.message}`);
    })
    .finally(() => {
      delete state.transcriberLoads[modelKey];
    });

  state.transcriberLoads[modelKey] = loadPromise;
  return loadPromise;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DECODIFICAÇÃO DE ÁUDIO → Float32Array 16kHz
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Lê o Blob de áudio, decodifica com a Web Audio API e reamosteia para 16 kHz.
 * Whisper espera um Float32Array mono a 16 000 Hz — independente do formato original.
 *
 * Ao decodificar aqui (em vez de deixar para o Transformers.js), suportamos
 * qualquer formato que o navegador consiga decodificar:
 * mp3, wav, ogg/vorbis, ogg/opus, webm, m4a/aac, flac…
 *
 * @param {Blob} blob  — blob de áudio em qualquer formato
 * @returns {Float32Array}
 */
async function decodeAudioToFloat32(blob) {
  const arrayBuffer = await blob.arrayBuffer();

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('Web Audio API não suportada neste navegador.');

  // Pedimos 16kHz direto — alguns navegadores honram isso e poupam reamostragem
  const ctx = new AudioCtx({ sampleRate: AUDIO_SAMPLE_RATE });

  let audioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  } catch (e) {
    await ctx.close();
    throw new Error(
      `Não foi possível decodificar o áudio. ` +
      `Formato talvez não suportado pelo navegador. (${e.message})`
    );
  }

  // Sempre usa o canal 0 (mono ou canal esquerdo de estéreo)
  const raw     = audioBuffer.getChannelData(0);
  const srcRate = audioBuffer.sampleRate;
  await ctx.close();

  return srcRate === AUDIO_SAMPLE_RATE
    ? new Float32Array(raw)
    : resampleFloat32(raw, srcRate, AUDIO_SAMPLE_RATE);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TRANSCRIÇÃO
   ═══════════════════════════════════════════════════════════════════════════════ */

async function finalizeRecording() {
  clearIntervalSafe(state.livePreviewTimer);
  state.livePreviewTimer = null;

  await teardownLiveCapture();
  releaseMicrophoneStream();

  const pcmData = mergeFloat32Chunks(state.livePcmChunks);
  const stamp = formatDateForFilename();
  let blob = null;
  let filename = `gravacao_${stamp}.wav`;

  if (pcmData.length > 0) {
    blob = encodeWaveBlob(pcmData, AUDIO_SAMPLE_RATE);
  } else if (state.recordedChunks.length > 0) {
    blob = new Blob(state.recordedChunks, {
      type: state.mediaRecorderMimeType || 'audio/webm',
    });
    filename = `gravacao_${stamp}.${getExtensionFromMimeType(state.mediaRecorderMimeType)}`;
  }

  state.mediaRecorder = null;
  state.mediaRecorderMimeType = '';
  updateRecordButtonUI();

  if (!blob) {
    setStatus('error', 'Nenhum áudio foi capturado. Tente gravar novamente.');
    return;
  }

  loadAudioBlob(blob, filename, {
    audioDataFloat32: pcmData.length > 0 ? pcmData : null,
  });

  if (isLivePreviewEnabled()) {
    await finalizeLiveAfterRecording();
  } else {
    setStatus('idle', 'Gravação concluída. Clique em "Iniciar transcrição" para continuar.');
  }
}

async function finalizeLiveAfterRecording() {
  await settleLivePreview();
  await runLivePreview({ force: true });

  const selectedModelKey = getSelectedModelKey();
  const liveModelKey = getLivePreviewModelKey(selectedModelKey);
  const refiningFinal = selectedModelKey !== liveModelKey;

  await handleTranscribe({
    audioData: state.audioDataFloat32,
    modelKey: selectedModelKey,
    preStatus: refiningFinal
      ? 'Refinando a transcrição final em alta qualidade…'
      : 'Finalizando a transcrição…',
    successMessage: refiningFinal
      ? '✓ Transcrição em tempo real refinada em alta qualidade.'
      : '✓ Transcrição em tempo real concluída com sucesso.',
  });
}

async function settleLivePreview() {
  let attempts = 0;
  while (state.livePreviewInFlight && attempts < 80) {
    await wait(100);
    attempts++;
  }
}

async function runLivePreview({ force = false } = {}) {
  if (!isLivePreviewEnabled() || state.livePreviewInFlight) return;
  if (state.livePcmLength <= 0) return;

  const totalSec = state.livePcmLength / AUDIO_SAMPLE_RATE;
  if (!force && totalSec < LIVE_PREVIEW_MIN_SEC) return;

  const selectedModelKey = getSelectedModelKey();
  const liveModelKey = getLivePreviewModelKey(selectedModelKey);

  state.livePreviewInFlight = true;
  state.livePreviewModelKey = liveModelKey;

  try {
    const transcriber = await loadModel(liveModelKey);
    const endSample = state.livePcmLength;
    const startSample = force
      ? 0
      : Math.max(0, endSample - Math.round(LIVE_PREVIEW_WINDOW_SEC * AUDIO_SAMPLE_RATE));

    const audioData = getAudioSliceFromChunks(state.livePcmChunks, startSample, endSample);
    const result = await transcriber(
      audioData,
      buildTranscriptionOptions({
        languageCode: getSelectedLanguageCode(),
        chunkLength: Math.min(LIVE_PREVIEW_WINDOW_SEC, Math.max(3, totalSec)),
        strideLength: 1,
        returnTimestamps: 'word',
        useProgressCallback: false,
      })
    );

    const words = normalizeWordChunks(result, startSample / AUDIO_SAMPLE_RATE);
    const previewText = (result?.text ?? '').trim();
    const commitCutoff = force ? Number.POSITIVE_INFINITY : totalSec - LIVE_PREVIEW_COMMIT_LAG_SEC;

    if (words.length > 0) {
      state.livePreviewFallbackText = '';
      updateLiveWords(words, commitCutoff);
    } else {
      state.livePreviewFallbackText = previewText;
      state.livePreviewWords = [];
    }

    renderLiveTranscript();

    if (state.isRecording) {
      setStatus('recording', getRecordingStatusMessage());
    }
  } catch (err) {
    console.error('[TranscreveAI] Falha na transcrição ao vivo:', err);
    if (force) throw err;
    if (state.isRecording) {
      setStatus(
        'recording',
        'Gravação iniciada. A prévia ao vivo falhou, mas o refino final continuará disponível ao parar.'
      );
    }
  } finally {
    state.livePreviewInFlight = false;
  }
}

async function handleTranscribe(runtimeOptions = {}) {
  if (state.isTranscribing) return;
  const audioDataFromState = runtimeOptions.audioData ?? state.audioDataFloat32;
  if (!state.audioBlob && !audioDataFromState) {
    setStatus('error', 'Nenhum áudio carregado. Grave ou envie um arquivo primeiro.');
    return;
  }

  state.isTranscribing = true;
  ui.btnTranscribe.disabled = true;
  clearIntervalSafe(state.livePreviewTimer);
  state.livePreviewTimer = null;
  resetLiveTranscriptState({ preservePCM: true });
  clearTranscript();

  try {
    const modelKey = runtimeOptions.modelKey || getSelectedModelKey();
    const langCode = runtimeOptions.languageCode ?? getSelectedLanguageCode();

    // 1. Carrega (ou reutiliza) o modelo
    const transcriber = await loadModel(modelKey);

    // 2. Obtém o áudio em PCM 16kHz.
    const audioData = audioDataFromState ?? await decodeAudioToFloat32(state.audioBlob);
    state.audioDataFloat32 = audioData;

    setStatus('progress', runtimeOptions.preStatus || 'Transcrevendo…');
    showProgress(null); // indeterminate

    const options = buildTranscriptionOptions({
      languageCode: langCode,
      chunkLength: 30,
      strideLength: 5,
      returnTimestamps: false,
      useProgressCallback: true,
    });
    let chunkCount = 0;
    options.callback_function = () => {
      chunkCount++;
      setStatus('progress', `Transcrevendo… (${chunkCount} segmentos processados)`);
    };

    // Passa o Float32Array diretamente — funciona com qualquer formato
    const result = await transcriber(audioData, options);

    // 3. Exibe resultado
    const text = (result?.text ?? '').trim();
    if (text) {
      showTranscript(text);
      setStatus('success', runtimeOptions.successMessage || '✓ Transcrição concluída com sucesso.');
    } else {
      setStatus('error', 'Nenhum texto detectado no áudio. Verifique o idioma e o volume do áudio.');
    }

  } catch (err) {
    console.error('[TranscreveAI] Erro na transcrição:', err);
    setStatus('error', mapTranscriptionError(err));
  } finally {
    hideProgress();
    state.isTranscribing = false;
    ui.btnTranscribe.disabled = !state.audioBlob;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   UI: STATUS, PROGRESSO, TRANSCRIPT
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Atualiza o bloco de status com tipo visual e mensagem.
 * @param {'idle'|'loading'|'progress'|'recording'|'success'|'error'} type
 * @param {string} message
 */
function setStatus(type, message) {
  ui.statusText.textContent = message;

  // Remove todas as classes de estado
  ui.statusBar.className = 'status-bar';
  if (type !== 'idle') ui.statusBar.classList.add(type);

  // Atualiza ícone
  const icons = {
    idle:      iconClock(),
    loading:   iconSpinner(),
    progress:  iconSpinner(),
    recording: iconMic(),
    success:   iconCheck(),
    error:     iconAlert(),
  };

  ui.statusIconWrap.innerHTML = icons[type] || icons.idle;
}

function showProgress(percent, label) {
  ui.progressWrap.hidden = false;

  if (percent === null) {
    // Indeterminate: barra animada
    ui.progressFill.style.width = '100%';
    ui.progressFill.style.animation = 'indeterminate 1.5s ease-in-out infinite';
    ui.progressLabel.textContent = '…';
    ui.progressBar.removeAttribute('aria-valuenow');
  } else {
    ui.progressFill.style.animation = '';
    ui.progressFill.style.width = `${percent}%`;
    ui.progressLabel.textContent = label ?? `${percent}%`;
    ui.progressBar.setAttribute('aria-valuenow', percent);
  }
}

function hideProgress() {
  ui.progressWrap.hidden = true;
  ui.progressFill.style.width = '0%';
  ui.progressFill.style.animation = '';
}

function showTranscript(text) {
  renderTranscript(text, '');
}

function renderLiveTranscript() {
  const committed = wordsToText(state.liveCommittedWords);
  const preview = state.livePreviewFallbackText || wordsToText(state.livePreviewWords);
  renderTranscript(committed, preview);
}

function renderTranscript(committedText = '', previewText = '') {
  const finalText = `${committedText}${previewText}`.trim();
  ui.transcriptText.innerHTML = '';

  if (!finalText) {
    ui.transcriptPlaceholder.hidden = false;
    ui.transcriptMeta.hidden = true;
    ui.wordCount.textContent = '0 palavras';
    ui.charCount.textContent = '0 caracteres';
    return;
  }

  ui.transcriptPlaceholder.hidden = true;
  ui.transcriptMeta.hidden = false;

  if (committedText) {
    const committedNode = document.createElement('span');
    committedNode.className = 'committed';
    committedNode.textContent = committedText;
    ui.transcriptText.appendChild(committedNode);
  }

  if (previewText) {
    const previewNode = document.createElement('span');
    previewNode.className = 'partial';
    previewNode.textContent = previewText;
    ui.transcriptText.appendChild(previewNode);
  }

  const words = finalText.split(/\s+/).filter(Boolean).length;
  const chars = finalText.length;
  ui.wordCount.textContent = `${words} palavra${words !== 1 ? 's' : ''}`;
  ui.charCount.textContent = `${chars} caractere${chars !== 1 ? 's' : ''}`;
}

function clearTranscript() {
  ui.transcriptPlaceholder.hidden = false;
  ui.transcriptText.innerHTML     = '';
  ui.transcriptMeta.hidden        = true;
  ui.wordCount.textContent        = '0 palavras';
  ui.charCount.textContent        = '0 caracteres';
}

/* ─────────────────────────────────────────────────────────────────────────────
   COPIAR / BAIXAR TRANSCRIÇÃO
   ───────────────────────────────────────────────────────────────────────────── */

async function copyTranscript() {
  const text = ui.transcriptText.textContent.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);

    // Feedback visual no botão
    ui.btnCopy.classList.add('copied');
    const originalHTML = ui.btnCopy.innerHTML;
    ui.btnCopy.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <polyline points="20 6 9 17 4 12"/>
      </svg> Copiado!`;

    setTimeout(() => {
      ui.btnCopy.classList.remove('copied');
      ui.btnCopy.innerHTML = originalHTML;
    }, 2000);

  } catch (err) {
    // Fallback: seleciona o texto para copiar manualmente
    const range = document.createRange();
    range.selectNode(ui.transcriptText);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    setStatus('idle', 'Texto selecionado — pressione Ctrl+C (ou Cmd+C) para copiar.');
  }
}

function downloadTranscript() {
  const text = ui.transcriptText.textContent.trim();
  if (!text) return;

  const filename = `transcricao_${formatDateForFilename()}.txt`;
  const blob     = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url      = URL.createObjectURL(blob);

  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();

  // Libera a URL após um instante
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ─────────────────────────────────────────────────────────────────────────────
   LIMPAR TUDO
   ───────────────────────────────────────────────────────────────────────────── */

function clearAll() {
  if (state.isRecording) {
    void stopRecording();
  }
  clearAudio();
  clearTranscript();
  hideProgress();
  resetLiveTranscriptState();
  setStatus('idle', 'Aguardando áudio…');
}

function updateRecordButtonUI() {
  ui.btnRecord.classList.toggle('recording', state.isRecording);
  ui.btnRecordLabel.textContent = state.isRecording
    ? (isLivePreviewEnabled() ? 'Parar e finalizar' : 'Parar gravação')
    : 'Gravar';
}

function updateLiveModeUI() {
  const enabled = isLivePreviewEnabled();
  const selectedModelKey = getSelectedModelKey();
  const liveModelKey = getLivePreviewModelKey(selectedModelKey);
  const toggleCard = ui.liveToggle.closest('.live-toggle');

  if (toggleCard) {
    toggleCard.classList.toggle('is-off', !enabled);
  }

  ui.liveTogglePill.textContent = enabled ? 'Ativo' : 'Desligado';

  if (!enabled) {
    ui.liveNote.textContent = 'Ao desligar o modo ao vivo, a gravação continua normal e a transcrição acontece só no final.';
  } else if (selectedModelKey === 'quality' && liveModelKey !== 'quality') {
    ui.liveNote.textContent = 'Sem WebGPU, a prévia usa modo rápido para acompanhar sua fala e refina em alta qualidade ao parar.';
  } else if (selectedModelKey === 'quality') {
    ui.liveNote.textContent = 'Prévia ao vivo e refino final usam o modo de alta qualidade. Ideal para desktop com WebGPU.';
  } else {
    ui.liveNote.textContent = 'Prévia e resultado final usam o modo rápido para priorizar velocidade e resposta imediata.';
  }

  updateRecordButtonUI();
}

function handleSelectionChange() {
  updateLiveModeUI();
  if (!state.isRecording && !state.isTranscribing) {
    void preloadModelsForCurrentSelection();
  }
}

function isLivePreviewEnabled() {
  return Boolean(ui.liveToggle?.checked);
}

function getSelectedModelKey() {
  const modeEl = document.querySelector('input[name="mode"]:checked');
  return modeEl?.value === 'quality' ? 'quality' : 'fast';
}

function getSelectedLanguageCode() {
  const langKey = document.getElementById('lang-select')?.value || 'portuguese';
  return LANG_MAP[langKey] ?? null;
}

function getLivePreviewModelKey(selectedModelKey) {
  if (selectedModelKey === 'quality' && state.device !== 'webgpu') {
    return LIVE_PREVIEW_CPU_MODEL_KEY;
  }
  return selectedModelKey;
}

function getRecordingStatusMessage() {
  if (!isLivePreviewEnabled()) {
    return 'Gravando… Clique em "Parar gravação" quando terminar.';
  }

  const selectedModelKey = getSelectedModelKey();
  const liveModelKey = getLivePreviewModelKey(selectedModelKey);
  if (selectedModelKey === 'quality' && liveModelKey !== 'quality') {
    return 'Gravando com prévia ao vivo. A prévia usa modo rápido e o texto final será refinado em alta qualidade ao parar.';
  }

  return 'Gravando com transcrição em tempo real. A prévia aparece enquanto você fala e será finalizada ao parar.';
}

function buildTranscriptionOptions({
  languageCode,
  chunkLength = 30,
  strideLength = 5,
  returnTimestamps = false,
  useProgressCallback = true,
} = {}) {
  const options = {
    task: 'transcribe',
    chunk_length_s: chunkLength,
    stride_length_s: strideLength,
    return_timestamps: returnTimestamps,
  };

  if (languageCode) {
    options.language = languageCode;
  }

  if (!useProgressCallback) {
    delete options.callback_function;
  }

  return options;
}

async function preloadModelsForCurrentSelection({ initial = false } = {}) {
  if (state.isRecording || state.isTranscribing) return;

  const selectedModelKey = getSelectedModelKey();
  const preloadKeys = [getLivePreviewModelKey(selectedModelKey)];
  if (selectedModelKey !== preloadKeys[0]) {
    preloadKeys.push(selectedModelKey);
  }

  try {
    for (const key of preloadKeys) {
      await loadModel(key);
    }

    if (!state.audioBlob && !state.isRecording && !state.isTranscribing) {
      const summary = describePreloadedModels(preloadKeys);
      setStatus('idle', initial
        ? `${summary} pronto. Grave ou envie um áudio para começar.`
        : `${summary} pronto para uso.`);
    }
  } catch (err) {
    console.error('[TranscreveAI] Falha no pré-carregamento:', err);
    setStatus('error', mapTranscriptionError(err));
  }
}

function describePreloadedModels(modelKeys) {
  const uniqueKeys = [...new Set(modelKeys)];
  if (uniqueKeys.length === 1) {
    return `Modelo ${modelLabel(uniqueKeys[0])}`;
  }
  return `Modelos ${uniqueKeys.map(modelLabel).join(' + ')}`;
}

function modelLabel(modelKey) {
  return modelKey === 'quality' ? 'Qualidade' : 'Rápido';
}

function mapTranscriptionError(err) {
  let msg = `Erro na transcrição: ${err.message}`;

  if (err.message.includes('fetch')) {
    msg = 'Erro ao baixar o modelo. Verifique sua conexão com a internet e tente novamente.';
  } else if (err.message.includes('memory') || err.message.includes('Memory')) {
    msg = 'Memória insuficiente. Tente o Modo Rápido ou use um arquivo de áudio menor.';
  } else if (err.message.includes('WebGPU') || err.message.includes('webgpu')) {
    msg = 'Erro com WebGPU. O sistema voltará para WASM automaticamente na próxima tentativa.';
    state.device = 'wasm';
    state.transcribers = {};
    state.transcriberLoads = {};
  }

  return msg;
}

function clearIntervalSafe(timerId) {
  if (timerId) window.clearInterval(timerId);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function resetLiveTranscriptState({ preservePCM = false } = {}) {
  clearIntervalSafe(state.livePreviewTimer);
  state.livePreviewTimer = null;
  state.livePreviewInFlight = false;
  state.liveCommittedWords = [];
  state.livePreviewWords = [];
  state.livePreviewFallbackText = '';
  state.livePreviewModelKey = null;

  if (!preservePCM) {
    state.livePcmChunks = [];
    state.livePcmLength = 0;
  }
}

function enqueueLiveChunk(float32Data, sampleRate) {
  const copied = new Float32Array(float32Data);
  const normalized = sampleRate === AUDIO_SAMPLE_RATE
    ? copied
    : resampleFloat32(copied, sampleRate, AUDIO_SAMPLE_RATE);

  state.livePcmChunks.push(normalized);
  state.livePcmLength += normalized.length;
}

function mergeFloat32Chunks(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function getAudioSliceFromChunks(chunks, startSample, endSample) {
  const output = new Float32Array(Math.max(0, endSample - startSample));
  let writeOffset = 0;
  let currentOffset = 0;

  for (const chunk of chunks) {
    const chunkEnd = currentOffset + chunk.length;
    if (chunkEnd <= startSample) {
      currentOffset = chunkEnd;
      continue;
    }
    if (currentOffset >= endSample) break;

    const localStart = Math.max(0, startSample - currentOffset);
    const localEnd = Math.min(chunk.length, endSample - currentOffset);
    if (localEnd > localStart) {
      output.set(chunk.subarray(localStart, localEnd), writeOffset);
      writeOffset += localEnd - localStart;
    }

    currentOffset = chunkEnd;
  }

  return writeOffset === output.length ? output : output.subarray(0, writeOffset);
}

function resampleFloat32(raw, srcRate, targetRate) {
  if (srcRate === targetRate) return new Float32Array(raw);

  const ratio = srcRate / targetRate;
  const newLength = Math.max(1, Math.round(raw.length / ratio));
  const resampled = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const a = raw[idx] ?? 0;
    const b = raw[idx + 1] ?? 0;
    resampled[i] = a + (pos - idx) * (b - a);
  }
  return resampled;
}

function encodeWaveBlob(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeAscii(view, offset, value) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function normalizeWordChunks(result, offsetSec = 0) {
  if (!Array.isArray(result?.chunks)) return [];

  return result.chunks
    .map((chunk) => {
      const timestamp = chunk?.timestamp;
      let start = 0;
      let end = 0;

      if (Array.isArray(timestamp)) {
        [start, end] = timestamp;
      } else if (timestamp && typeof timestamp === 'object') {
        start = timestamp.start ?? timestamp[0] ?? 0;
        end = timestamp.end ?? timestamp[1] ?? start;
      }

      const safeStart = Number.isFinite(start) ? start : 0;
      const safeEnd = Number.isFinite(end) ? end : safeStart;

      return {
        text: chunk?.text || '',
        start: offsetSec + safeStart,
        end: offsetSec + safeEnd,
      };
    })
    .filter((chunk) => chunk.text);
}

function updateLiveWords(words, commitCutoffSec) {
  let lastCommittedEnd = state.liveCommittedWords.length
    ? state.liveCommittedWords[state.liveCommittedWords.length - 1].end
    : -Infinity;

  for (const word of words) {
    if (word.end > commitCutoffSec) continue;
    if (word.end <= lastCommittedEnd + 0.04) continue;
    state.liveCommittedWords.push(word);
    lastCommittedEnd = word.end;
  }

  state.livePreviewWords = words.filter((word) => word.end > lastCommittedEnd + 0.04);
}

function wordsToText(words) {
  return words.map((word) => word.text).join('').replace(/^\s+/, '');
}

function getExtensionFromMimeType(mimeType) {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

/* ═══════════════════════════════════════════════════════════════════════════════
   ÍCONES SVG INLINE (para injeção dinâmica no status bar)
   ═══════════════════════════════════════════════════════════════════════════════ */

function iconClock() {
  return `<svg class="status-icon status-icon--idle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>`;
}

function iconSpinner() {
  return `<svg class="status-icon status-icon--spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>`;
}

function iconMic() {
  return `<svg class="status-icon status-icon--recording" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>`;
}

function iconCheck() {
  return `<svg class="status-icon status-icon--success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>`;
}

function iconAlert() {
  return `<svg class="status-icon status-icon--error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>`;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   UTILIDADES
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Formata segundos em mm:ss ou hh:mm:ss.
 */
function formatDuration(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '–';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

/**
 * Gera string de data/hora para nomes de arquivo: 20241215_143022
 */
function formatDateForFilename() {
  const d  = new Date();
  const yy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yy}${mm}${dd}_${hh}${mi}${ss}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   ANIMAÇÃO INDETERMINATE DA BARRA DE PROGRESSO
   Adicionamos o keyframe dinamicamente pois não podemos usar @keyframes
   em CSS externo referenciado via style="" inline.
   ───────────────────────────────────────────────────────────────────────────── */
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes indeterminate {
    0%   { transform: translateX(-100%) scaleX(0.5); }
    50%  { transform: translateX(0%)    scaleX(0.8); }
    100% { transform: translateX(100%) scaleX(0.5); }
  }
`;
document.head.appendChild(styleTag);

/* ═══════════════════════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════════════════════ */
initApp().catch(console.error);
