# Prescrever

Editor web 100% client-side para organizar protocolos e prescricoes medicas em JSON estruturado, pronto para site estatico no GitHub Pages.

## Estrutura

```text
/index.html
/prescricoes.css
/prescricoes.js
/editor/index.html
/editor/editor.css
/editor/editor.js
/data/index.json
/data/infectologia.json
/data/cardiologia.json
/data/pneumologia.json
```

## Schema JSON (versao 1.2.0)

Cada area em `/data/*.json`:

- `schemaVersion`: string (`"1.2.0"`)
- `area`: string (nome exibivel)
- `slug`: string (`kebab-case`)
- `assuntos`: array

Cada assunto:

- `titulo`: string
- `slug`: string (`kebab-case`)
- `descricaoCurta`: string opcional
- `meta`: `{ orientacoes, alertas, notas }`
- `tabs`: array

Cada tab:

- `titulo`: string
- `slug`: string (`kebab-case`)
- `mode`: `"free"` ou `"structured"`
- `meta`: `{ orientacoes, alertas, notas }`
- `blocks`: array de blocos (modo `free`)
- `structured.groups`: array de blocos estruturados (modo `structured`)
- `children`: array opcional de subsecoes, permitindo hierarquia como `1`, `1.1`, `1.1.1`

Cada `structured.groups[]`:

- `type`: `"or"` ou `"add"`
- `titulo`: string
- `items`: array

Cada `item`:

- `id`, `nome`, `apresentacao`, `posologia`
- `meta`: `{ contraindicacoes, orientacoes, alertas }`

### Blocos suportados

- `heading`
  - `{ "type": "heading", "level": 2|3, "content": InlineSpan[] }`
- `paragraph`
  - `{ "type": "paragraph", "content": InlineSpan[] }`
- `list`
  - `{ "type": "list", "style": "unordered"|"ordered", "items": [{ "content": InlineSpan[] }] }`
- `callout`
  - `{ "type": "callout", "tone": "info"|"warning"|"danger"|"success", "title": "...", "blocks": Block[] }`
- `divider`
  - `{ "type": "divider" }`
- `table`
  - `{ "type": "table", "headers": string[], "rows": string[][] }`

`InlineSpan`:

- `{ "text": "...", "marks": ["bold"|"italic"|"underline"] }`
- `marks` e opcional.

## Modo estruturado (novo)

- Alternancia por secao entre `Modo Estruturado` e `Texto Livre`.
- Bloco `OU`: \"Escolha uma das opcoes\" com itens reutilizaveis.
- Bloco `ASSOCIAR / ADICIONAR`: itens complementares (E).
- Cada item tem menu `⋯` para metadados nativos:
  - `Contraindicacoes`
  - `Orientacoes`
  - `Alertas / precaucoes`
- Metadados tambem em nivel de assunto e secao, em caixas proprias na interface.

## Exemplo completo (Infectologia > Sifilis)

Arquivo: `/data/infectologia.json`

- Assunto: `Sifilis`
- Tabs: `Primaria`, `Secundaria`, `Neuro`
- Usa `heading`, `paragraph`, `list`, `callout`, `divider` e `table`.

## Decisoes tecnicas

- Editor base: **TipTap (ProseMirror)** via ESM CDN (`esm.sh`).
- Motivo: comandos de lista/marks/undo/redo confiaveis, sem depender de `contenteditable` manual.
- Persistencia: em memoria no browser + export/download JSON.
- Sanitizacao de cola: plugin customizado intercepta `paste` e insere somente texto plano estruturado (paragrafos e listas), removendo estilos externos.
- Serializacao: conversao bidirecional entre documento TipTap e `blocks[]` do schema. Nenhum HTML bruto e salvo no JSON.
- Validacao: painel lateral valida slug, blocos obrigatorios e tipos permitidos.

## Visualizador (home)

- A raiz (`/index.html`) agora abre um painel de **Protocolos e Prescricoes Rapidas**.
- Le os arquivos listados em `/data/index.json` e monta os cards automaticamente.
- Filtros por `Favoritos`, `Todos` e por `Area`.
- Busca textual e detalhe expandido por protocolo.
- Favoritos sao salvos no navegador (`localStorage`).

## Como usar

1. Abra em servidor estatico (recomendado):

```bash
cd "C:\Users\Arthur\Desktop\Prescrever"
python -m http.server 8080
```

2. Acesse:

- `http://localhost:8080/` (visualizador)
- `http://localhost:8080/editor/` (editor)

3. Fluxo principal:

- `Nova Area`: cria um JSON de area em memoria.
- `Novo Assunto`: cria assunto na area atual.
- `+ Nova Secao`: cria mini-secao no assunto atual.
- `+ Subseção`: cria uma secao filha dentro da secao ativa.
- `Virar subseção` / `Subir nível`: reorganizam uma secao existente dentro da hierarquia.
- `Modo Estruturado`: construtor por itens (OU/ASSOCIAR + metadados por item).
- `Texto Livre`: editor TipTap para casos fora do padrao.
- Toolbar: negrito/italico/sublinhado, listas, H2/H3, callout, divisor, tabela, undo/redo.
- `Importar JSON existente`: carrega arquivo de area (`{ area, slug, assuntos }`).
- `Download Area JSON`: exporta area atual completa.
- `Exportar Tab Atual`: exporta payload minimo da tab ativa.

## Publicacao no GitHub Pages

- Projeto nao requer build.
- Suba as pastas `editor/` e `data/` para o repositorio.
- Garanta que `data/index.json` lista todos os arquivos de area.

## Como adicionar novos tipos de bloco no futuro

1. No arquivo `editor/editor.js`, adicione o novo tipo em:
   - `VALID_BLOCK_TYPES`
   - `normalizeBlock(...)`
   - `validateBlocks(...)`
   - `blockToDocNode(...)`
   - `docNodesToBlocks(...)`
2. Se o bloco precisar de representacao visual custom, crie uma extensao TipTap (`Node.create`).
3. Inclua botao/acao na toolbar para inserir o novo bloco.
4. Atualize este README com o contrato do schema.
