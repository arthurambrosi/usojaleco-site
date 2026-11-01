# Uso Jaleco: guia para continuar o trabalho

## Publicação e segurança

- Site estático no GitHub Pages. A branch publicada é `main`; o domínio é `www.usojaleco.com.br`, definido em `CNAME`.
- Trabalhar em branches e abrir Pull Request. Nunca enviar alterações diretamente à `main` nem fazer merge sem autorização explícita.
- A tag `antes-da-limpeza` guarda a versão anterior à organização, commit `7be7c6e`.
- Nunca quebrar endereços antigos. Ao substituir uma página, manter `index.html` no caminho anterior com redirecionamento, link clicável e preservação de parâmetros quando aplicável. Não apagar imagens ou downloads divulgados sem solução de compatibilidade.
- GitHub Pages não executa Python/Node de servidor e não protege arquivos públicos com senha. Nunca colocar senhas, tokens, prontuários, dados de pacientes ou arquivos pagos completos no repositório público.
- O login local antigo foi removido: era uma interface no navegador, não autenticação segura. Os relatórios privados ficam no Google Analytics, protegidos pela conta Google. Uma área privada futura exige validação no servidor/serviço de autenticação e proteção dos dados, não só da tela.

## Estrutura

- `index.html`: nova home de vendas. Base importada de `Downloads/usojaleco-novo-site`.
- `loja/`: catálogo de slides; `loja/slide/?id=...`: detalhe e checkout externo.
- `servicos/`: apresentações, currículo, sites, identidade visual e outros serviços. `portfolio/`, `sobre/`, `orcamento/`, `privacidade/`: páginas institucionais e comerciais.
- `assets/data/`: configuração, serviços, produtos/planilha, portfólio e ferramentas. `assets/js/`: renderização e interações. `assets/css/site.css`: identidade e responsividade. `assets/img/`: imagens WebP. `assets/fonts/`: fontes locais.
- `links/`: menu antigo, adequado para link da bio. `inicio/`: portal antigo alimentado por outra planilha.
- `comprar-slide/`, `slides/`, `templates/`, `apresentações/`, `curriculo/`, `powerpoint/`: páginas comerciais anteriores, preservadas.
- `eventos/`, `diretrizes/`, `questoes/`, `receita/`, `scores/`, `flashcard/`, `gasometria/`, `prescrever/`, `prescrição/`, `atendimento/`, `transcreve/`: ferramentas mantidas nos seus endereços.
- `criarsolicitacao/`: preenchimento de documentos médicos; `editarsolicitacao/`: editor de modelos.
- `editor/`: editor local de eventos/diretrizes; o servidor Python não funciona no GitHub Pages. `prompt/`: apoio à elaboração de conteúdo; `cronograma/`: planejamento de estudos; `data/`: bases JSON.
- `teste/`, `agoravai/`, `prescrição-teste/`, `prescrever/teste/`: entradas antigas redirecionadas. Conteúdos descartados continuam no histórico.
- `comprar-slides/`, `duvidas-curriculo/`, `prescricao/`, `apresentacoes/`, `acls/`: compatibilidade para endereços antigos/incorretos; ACLS encaminha ao banco de questões, sem afirmar que existe simulador ACLS.
- `analytics-config.js` e `analytics.js`: medição no domínio oficial, sem login nem senhas. `metricas/`: estado público da configuração, não relatório privado.
- `scripts/verificar_links.py`: checagem de páginas, referências HTML, recursos CSS, caminhos literais de fetch e dados de navegação. Chamadas montadas em tempo de execução também precisam de teste no navegador.

## Contatos, planilhas e Analytics

- WhatsApp: **5571981577908**. E-mail: **usojaleco@gmail.com**. Configuração principal: `assets/data/config.js`. Páginas antigas também têm cópias; pesquisar no repositório ao atualizar.
- Google Analytics: **G-4E6S9EHGF6**, em `assets/data/config.js` e `analytics-config.js`. Prévias e localhost não enviam visitas. Não enviar dados de formulário, textos de mensagens ou parâmetros pessoais em eventos. Rever a medição avançada no painel GA antes de campanhas.
- Planilha de vendas: URL em `assets/data/loja.js` (`planilhaCSV`), a mesma publicada usada em `comprar-slide/index.html`:
  `https://docs.google.com/spreadsheets/d/e/2PACX-1vRH5f6s53rGIEkciJUr_uo7ShCYp8JBUOrd3Y2O4TBaaEAQdzNxUAHsA1CAlptPj1HXyDaARWUfS3Tx/pub?gid=0&single=true&output=csv`
- Colunas: `ativo`, `titulo`, `preco`, `descricao`, `imagem`, `pdf`/`video` (prévia), `link_compra`, `area`. Recomenda-se adicionar `id` estável para que mudar o título não altere o endereço do produto. Sem ID, o título determina o endereço.
- Não publicar segredos na planilha pública. O PDF deve ser uma prévia; a entrega do arquivo pago precisa ser configurada no provedor de pagamento.
- A planilha atual oferece ITU na pediatria com checkout Greenn. Não inventar produtos, avaliações, disponibilidade, prazos ou garantias. Falha da planilha mostra um aviso e contato, nunca estoque fictício.
- `slides/` e `templates/` usam outra planilha. `inicio/` tem sua própria planilha de ferramentas; alterações feitas no código não editam essas planilhas.

## Identidade e imagens

- Preto, branco e laranja **#ff6b1a**. Logo **uso** + **jaleco em negrito** + ponto, em **Montserrat**: `uso**jaleco**.`.
- Manter contraste adequado, navegação por teclado e layout de celular. O projeto usa Barlow Condensed nos títulos e Instrument Sans no corpo.
- Exibição: WebP com até 1600 px de largura. Miniaturas: WebP com até 720 px. Evitar imagens 4K na página.
- PNGs antigos de `apresentações/data/` e `imagens/` foram reduzidos a até 720 px para manter os caminhos funcionando. Os originais 4K continuam na tag.

## Testar e publicar

1. Na raiz: `python -m http.server 8000 --bind 127.0.0.1` (ou `python3` onde disponível).
2. Abrir `http://127.0.0.1:8000/`.
3. Rodar `python scripts/verificar_links.py`; a lista `broken` deve ficar vazia.
4. Testar home, loja, produto, formulário, portfólio, `comprar-slide/`, `eventos/` e `questoes/`; verificar console e celular. Não concluir compras nem enviar formulários reais durante testes.
5. Commit e push na branch de trabalho; abrir PR para `main`. Só após revisão e merge autorizado o Pages publica no domínio principal.

## Ações do proprietário

- Trocar a antiga senha do usuário local `arthurambrosi` em qualquer outro serviço onde tenha sido reutilizada. A credencial foi removida desta versão, mas ainda está no histórico público.
- Confirmar no checkout preço, entrega, arquivo oferecido e condições. Não houve compra de teste.
- Validar textos comerciais, preços de currículo e instituições citadas no material importado antes de anunciar. A retirada de prazos garantidos evita prometer uma agenda que não foi confirmada.
- Conferir a planilha de `inicio/`: corrigir o item ACLS ou escondê-lo até existir uma ferramenta própria.
