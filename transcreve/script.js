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
// Não tentamos carregar modelos locais (tudo vem do HuggingFace Hub via CDN)
env.allowLocalModels = false;

// Usa cache do navegador (IndexedDB) para não baixar o modelo toda vez
env.useBrowserCache = true;

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTES
   ───────────────────────────────────────────────────────────────────────────── */
const MODELS = {
  fast:    'Xenova/whisper-tiny',   // ~77 MB
  quality: 'Xenova/whisper-small',  // ~244 MB
};

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
  audioObjectUrl:  null,   // URL de objeto para o blob
  isRecording:     false,  // Se está gravando agora
  mediaRecorder:   null,   // Instância do MediaRecorder
  recordedChunks:  [],     // Chunks coletados durante a gravação
  micStream:       null,   // Stream do microfone (para liberar depois)
  transcriber:     null,   // Pipeline carregado (reutilizado entre transcrições)
  lastModelKey:    null,   // Modelo atualmente carregado ('fast' | 'quality')
  isTranscribing:  false,  // Evita execuções paralelas
  device:          'wasm', // 'webgpu' ou 'wasm'
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
}

/* ─────────────────────────────────────────────────────────────────────────────
   VERIFICAÇÃO DE SUPORTE DO NAVEGADOR
   ───────────────────────────────────────────────────────────────────────────── */
function checkBrowserSupport() {
  const issues = [];

  if (!window.MediaRecorder) {
    issues.push('MediaRecorder (gravação de áudio) não é suportado.');
  }
  if (!window.AudioContext && !window.webkitAudioContext) {
    issues.push('Web Audio API não é suportada.');
  }
  if (!window.Worker) {
    issues.push('Web Workers não são suportados (necessário para Transformers.js).');
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
}

/* ═══════════════════════════════════════════════════════════════════════════════
   GRAVAÇÃO DE MICROFONE
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Alterna entre iniciar e parar a gravação.
 * Pede permissão de microfone na primeira vez.
 */
async function handleRecordToggle() {
  if (state.isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    // Solicita acesso ao microfone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,     // Mono: necessário para Whisper
        sampleRate: 16000,   // Taxa ideal para Whisper
        echoCancellation: true,
        noiseSuppression: true,
      }
    });

    state.micStream    = stream;
    state.recordedChunks = [];

    // Cria o MediaRecorder. Prefere webm/opus, cai para padrão do navegador
    const mimeType = getSupportedMimeType();
    state.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

    // Coleta chunks de dados
    state.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        state.recordedChunks.push(event.data);
      }
    };

    // Quando para: processa o áudio gravado
    state.mediaRecorder.onstop = () => {
      const blob = new Blob(state.recordedChunks, {
        type: state.mediaRecorder.mimeType || 'audio/webm',
      });
      const filename = `gravacao_${formatDateForFilename()}.webm`;
      loadAudioBlob(blob, filename);
    };

    // Inicia gravação, solicitando chunks a cada 250ms
    state.mediaRecorder.start(250);
    state.isRecording = true;

    // Atualiza UI
    ui.btnRecord.classList.add('recording');
    ui.btnRecordLabel.textContent = 'Parar gravação';
    setStatus('recording', '🔴 Gravando… Clique em "Parar gravação" quando terminar.');

  } catch (err) {
    let msg = 'Não foi possível acessar o microfone.';
    if (err.name === 'NotAllowedError')  msg = 'Permissão de microfone negada. Verifique as configurações do navegador.';
    if (err.name === 'NotFoundError')    msg = 'Nenhum microfone encontrado no dispositivo.';
    if (err.name === 'NotSupportedError') msg = 'Microfone não suportado neste navegador.';
    setStatus('error', msg);
    console.error('[TranscreveAI] Erro ao acessar microfone:', err);
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }

  // Libera o stream do microfone (apaga o ícone de gravação no navegador)
  if (state.micStream) {
    state.micStream.getTracks().forEach(track => track.stop());
    state.micStream = null;
  }

  state.isRecording = false;

  // Restaura UI do botão
  ui.btnRecord.classList.remove('recording');
  ui.btnRecordLabel.textContent = 'Gravar';
  setStatus('idle', 'Gravação concluída. Clique em "Iniciar transcrição" para continuar.');
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

  loadAudioBlob(file, file.name);
}

function loadAudioBlob(blob, filename) {
  // Libera URL anterior se existir
  if (state.audioObjectUrl) {
    URL.revokeObjectURL(state.audioObjectUrl);
  }

  state.audioBlob      = blob;
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
  if (state.isRecording) stopRecording();
  if (state.audioObjectUrl) URL.revokeObjectURL(state.audioObjectUrl);

  state.audioBlob      = null;
  state.audioObjectUrl = null;

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
  if (state.transcriber && state.lastModelKey === modelKey) {
    return state.transcriber;
  }

  // Libera modelo anterior (se houver)
  state.transcriber = null;
  state.lastModelKey = null;

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

  try {
    state.transcriber = await pipeline(
      'automatic-speech-recognition',
      modelId,
      {
        device,
        dtype,
        progress_callback: onProgress,
      }
    );

    state.lastModelKey = modelKey;
    hideProgress();
    return state.transcriber;

  } catch (err) {
    hideProgress();
    throw new Error(`Falha ao carregar o modelo "${modelId}": ${err.message}`);
  }
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
  const ctx = new AudioCtx({ sampleRate: 16000 });

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

  if (srcRate === 16000) return raw; // já no rate correto

  // Reamostragem linear quando o navegador ignorou o sampleRate do construtor
  const ratio     = srcRate / 16000;
  const newLength = Math.round(raw.length / ratio);
  const resampled = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const a   = raw[idx]     ?? 0;
    const b   = raw[idx + 1] ?? 0;
    resampled[i] = a + (pos - idx) * (b - a);
  }
  return resampled;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TRANSCRIÇÃO
   ═══════════════════════════════════════════════════════════════════════════════ */

async function handleTranscribe() {
  if (state.isTranscribing) return;
  if (!state.audioBlob) {
    setStatus('error', 'Nenhum áudio carregado. Grave ou envie um arquivo primeiro.');
    return;
  }

  state.isTranscribing = true;
  ui.btnTranscribe.disabled = true;
  clearTranscript();

  try {
    // Identifica o modo escolhido pelo usuário
    const modeEl  = document.querySelector('input[name="mode"]:checked');
    const modelKey = modeEl?.value === 'quality' ? 'quality' : 'fast';

    // Identifica o idioma
    const langSel  = document.getElementById('lang-select');
    const langKey  = langSel?.value || 'portuguese';
    const langCode = LANG_MAP[langKey] ?? null; // null = detecção automática

    // 1. Carrega (ou reutiliza) o modelo
    const transcriber = await loadModel(modelKey);

    // 2. Decodifica o áudio manualmente via Web Audio API → Float32Array 16kHz
    //    Isso garante suporte a ogg, mp3, wav, webm, m4a, flac, etc.
    //    e evita que o Transformers.js tente fazer fetch/decode interno (que falha
    //    em alguns formatos/navegadores).
    setStatus('progress', 'Decodificando áudio…');
    showProgress(null); // indeterminate

    const audioData = await decodeAudioToFloat32(state.audioBlob);

    // 3. Roda a transcrição com o Float32Array já decodificado
    setStatus('progress', 'Transcrevendo…');

    /**
     * Opções do pipeline Whisper:
     *  - language:       código ISO 639-1 ou null para autodetecção
     *  - task:           'transcribe' (manter idioma)
     *  - chunk_length_s: divide o áudio em chunks para não esgotar memória
     *  - stride_length_s: sobreposição entre chunks para continuidade
     *  - return_timestamps: desabilitado para saída limpa
     *  - callback_function: chamada a cada chunk gerado
     */
    const options = {
      task: 'transcribe',
      chunk_length_s:    30,
      stride_length_s:    5,
      return_timestamps:  false,
    };

    if (langCode) options.language = langCode;

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
      setStatus('success', `✓ Transcrição concluída com sucesso.`);
    } else {
      setStatus('error', 'Nenhum texto detectado no áudio. Verifique o idioma e o volume do áudio.');
    }

  } catch (err) {
    console.error('[TranscreveAI] Erro na transcrição:', err);

    let msg = `Erro na transcrição: ${err.message}`;

    // Mensagens de erro amigáveis para casos comuns
    if (err.message.includes('fetch')) {
      msg = 'Erro ao baixar o modelo. Verifique sua conexão com a internet e tente novamente.';
    } else if (err.message.includes('memory') || err.message.includes('Memory')) {
      msg = 'Memória insuficiente. Tente o Modo Rápido ou use um arquivo de áudio menor.';
    } else if (err.message.includes('WebGPU') || err.message.includes('webgpu')) {
      msg = 'Erro com WebGPU. Recarregue a página — o sistema tentará usar WASM automaticamente.';
      // Força fallback para WASM na próxima tentativa
      state.device = 'wasm';
      state.transcriber = null;
      state.lastModelKey = null;
    }

    setStatus('error', msg);
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
  ui.transcriptPlaceholder.hidden = true;
  ui.transcriptText.textContent   = text;
  ui.transcriptMeta.hidden        = false;

  // Conta palavras e caracteres
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars  = text.length;
  ui.wordCount.textContent = `${words} palavra${words !== 1 ? 's' : ''}`;
  ui.charCount.textContent = `${chars} caractere${chars !== 1 ? 's' : ''}`;
}

function clearTranscript() {
  ui.transcriptPlaceholder.hidden = false;
  ui.transcriptText.textContent   = '';
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
  clearAudio();
  clearTranscript();
  hideProgress();
  setStatus('idle', 'Aguardando áudio…');
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
