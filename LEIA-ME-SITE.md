# Novo site do Uso Jaleco

Site estático, sem build e sem dependências, pronto para o GitHub Pages do repositório `usojaleco-site` (domínio www.usojaleco.com.br).

## Como publicar

O projeto já está integrado ao repositório na branch `organizacao`. Veja `README.md` e `CLAUDE.md`.

A publicação no domínio principal acontece somente após revisão e merge do Pull Request para `main`. Não copie arquivos diretamente para `main`.

O menu anterior está em `/links/`; os endereços das ferramentas continuam preservados. O login local foi removido porque não oferecia proteção real. Consulte o Google Analytics com sua conta Google para relatórios privados.

## Estrutura

```
index.html                 Home
servicos/                  Lista de serviços (e servicos/?s=<id> para qualquer serviço)
servicos/<id>/             Página própria de cada serviço
portfolio/                 Galeria com filtros e ampliação
conteudos/                 Ferramentas de estudo e prática
sobre/                     Institucional e fundador
orcamento/                 Pedido de orçamento (envia pelo WhatsApp ou e-mail)
loja/                      Vitrine de slides à venda (lê a planilha de vendas)
loja/slide/?id=<tema>      Página de cada slide, com prévia e botão de compra
404.html                   Página de erro
links/                     Menu antigo, para a bio do Instagram
assets/data/               TUDO que muda com frequência mora aqui
assets/css/site.css        Estilo único do site
assets/js/site.js          Monta menu, rodapé e seções a partir dos dados
assets/img/, assets/fonts/ Imagens otimizadas e fontes hospedadas no próprio site
```

## Como fazer as mudanças mais comuns

| Quero… | Arquivo |
| --- | --- |
| Trocar WhatsApp, e-mail, Instagram, números da home, formas de pagamento | `assets/data/config.js` |
| Criar, editar ou esconder um serviço, preços e perguntas frequentes | `assets/data/servicos.js` |
| Adicionar um trabalho ao portfólio | `assets/data/portfolio.js` + imagens em `assets/img/portfolio/` |
| Adicionar ou liberar uma ferramenta de estudo | `assets/data/ferramentas.js` |
| Colocar um slide à venda, mudar preço ou link de pagamento | A planilha de vendas (a mesma de /comprar-slide) |
| Trocar a planilha ou os itens "o que está incluído" da vitrine | `assets/data/loja.js` |
| Abrir a home na sala de tutoria ou usar uma foto no lugar do desenho | `cena` em `assets/data/config.js` |

**Serviço novo:** copie um bloco em `servicos.js` e troque o `id`. Ele aparece sozinho no menu, na home, na lista de serviços, no rodapé e no formulário de orçamento. Para ter endereço próprio e melhor posição no Google, copie a pasta `servicos/sites/` com o nome do novo `id` e troque `data-servico`, `<title>` e `description` no `index.html` dela. Sem a pasta, o endereço `/servicos/<id>/` redireciona para `servicos/?s=<id>`.

**Imagens do portfólio:** cada trabalho usa duas versões WebP: `slide-XX.webp` (1600×900) e `slide-XX-sm.webp` (720×405). Os 14 slides originais em 4K somavam 46 MB; as versões otimizadas somam cerca de 1 MB.

**Vitrine:** cada linha ativa da planilha vira um card e uma página própria. Colunas lidas: ativo, titulo, preco, descricao, imagem, pdf, link_compra e area. A imagem pode ser um link do Google Drive compartilhado. Sem link de compra, o botão abre o WhatsApp com o nome do slide.

**Cena da home:** o auditório e a sala de tutoria são desenhados em código, então ficam nítidos em qualquer tela e pesam poucos KB. As capas do portfólio entram na tela com quatro transições em sequência (foco, persiana, varredura de luz e mosaico), e a luz da sala muda para a cor de cada slide. Para usar uma foto gerada por IA, salve a imagem em 16:9 e informe o caminho e a posição da tela em `config.js`.

**Formulário de orçamento:** hoje monta a mensagem e abre o WhatsApp ou o e-mail já preenchidos. Para também receber os pedidos numa planilha ou caixa de entrada, crie um endpoint (Formspree, Getform ou Google Apps Script) e cole a URL em `formEndpoint` no `config.js`.

## Testar no computador

Abra um terminal na pasta e rode `python -m http.server 8000`, depois acesse http://localhost:8000. Use o servidor HTTP: leitura de planilhas e JSON precisa desse contexto.
