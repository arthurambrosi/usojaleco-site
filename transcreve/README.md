# 🎙️ TranscreveAI — Transcritor de Áudio no Navegador

> Transcrição de áudio gratuita, local e privada. Sem servidores. Sem APIs pagas. Tudo roda no seu navegador com o modelo Whisper da OpenAI via Transformers.js.

---

## ✨ Funcionalidades

- 🎤 **Gravação pelo microfone** com MediaRecorder
- 📁 **Upload de arquivos** — mp3, wav, m4a, webm, ogg, flac, aac
- ⚡ **Modo Rápido** (whisper-tiny, ~77 MB) e **Melhor Qualidade** (whisper-small, ~244 MB)
- 🌐 **8 idiomas** + detecção automática
- 🖥️ **WebGPU** quando disponível, com fallback automático para **WASM (CPU)**
- 📋 **Copiar** e **baixar** a transcrição em `.txt`
- 🔒 **100% local** — o áudio nunca sai do seu dispositivo
- 📱 **Responsivo** — funciona em desktop e celular

---

## 🚀 Como publicar no GitHub Pages

### Passo 1 — Crie o repositório

1. Acesse [github.com/new](https://github.com/new)
2. Nomeie o repositório (ex: `transcreveai`)
3. Marque como **Public**
4. Clique em **Create repository**

### Passo 2 — Envie os arquivos

Você pode usar a interface web ou o Git. Via interface web:

1. No repositório criado, clique em **"uploading an existing file"**
2. Arraste todos os arquivos do projeto:
   - `index.html`
   - `style.css`
   - `script.js`
   - `.nojekyll`
   - `README.md`
3. Clique em **Commit changes**

Via terminal (Git):
```bash
git init
git add .
git commit -m "feat: TranscreveAI initial commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/transcreveai.git
git push -u origin main
```

### Passo 3 — Ative o GitHub Pages

1. Vá em **Settings → Pages** no repositório
2. Em **Source**, selecione **"Deploy from a branch"**
3. Branch: **main** · Pasta: **/ (root)**
4. Clique em **Save**

Após ~1-2 minutos, o site estará disponível em:
```
https://SEU_USUARIO.github.io/transcreveai/
```

---

## ⚠️ Avisos importantes

### Arquivo `.nojekyll`
O arquivo `.nojekyll` (vazio, sem extensão) é **obrigatório** para que o GitHub Pages sirva arquivos que começam com `_` (como `_chunks/` que o Transformers.js pode gerar). Ele já está incluído no projeto.

### `type="module"` no script
O `script.js` usa `type="module"` para as importações ES6 do Transformers.js. O GitHub Pages serve os arquivos com os headers CORS corretos, então isso funciona perfeitamente. **Não funciona abrindo `index.html` diretamente no browser como arquivo local** (protocolo `file://`) — use sempre um servidor HTTP.

Para testar localmente antes de fazer deploy:
```bash
# Python 3
python3 -m http.server 8080

# Node.js (se tiver instalado)
npx serve .

# VS Code: instale a extensão "Live Server" e clique em "Go Live"
```

### Primeiro uso — download do modelo
Na primeira vez que o usuário clicar em "Iniciar transcrição", o modelo Whisper será baixado do HuggingFace Hub:
- **Modo Rápido**: ~77 MB
- **Melhor Qualidade**: ~244 MB

O navegador **cacheia automaticamente** os arquivos do modelo (IndexedDB). Nas próximas vezes, a transcrição começa em segundos.

---

## 🌐 Compatibilidade de navegadores

| Navegador | WASM | WebGPU |
|-----------|------|--------|
| Chrome 113+ | ✅ | ✅ (flags habilitadas por padrão) |
| Edge 113+ | ✅ | ✅ |
| Firefox 118+ | ✅ | ⚠️ (experimental, flags necessárias) |
| Safari 17.4+ | ✅ | ⚠️ (suporte parcial) |
| Chrome Android | ✅ | ⚠️ |

**Recomendação:** Chrome ou Edge no desktop para melhor desempenho com WebGPU.

---

## 🏗️ Estrutura do projeto

```
transcreveai/
├── index.html      # Estrutura HTML da aplicação
├── style.css       # Estilos — tema "Signal Studio" (dark, tech)
├── script.js       # Lógica completa: gravação, upload, transcrição
├── .nojekyll       # Necessário para GitHub Pages (arquivo vazio)
└── README.md       # Este arquivo
```

---

## 🛠️ Stack técnica

| Tecnologia | Uso |
|------------|-----|
| [Transformers.js v3](https://huggingface.co/docs/transformers.js) | Inferência de ML no browser |
| [OpenAI Whisper](https://openai.com/research/whisper) | Modelo de reconhecimento de fala |
| [HuggingFace Hub](https://huggingface.co/Xenova) | Pesos dos modelos quantizados |
| [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) | Gravação de microfone |
| [WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) | Aceleração de GPU (quando disponível) |
| [ONNX Runtime Web](https://onnxruntime.ai/docs/get-started/with-javascript.html) | Backend WASM (fallback de CPU) |

---

## 📝 Licença

MIT — use, modifique e distribua livremente.
