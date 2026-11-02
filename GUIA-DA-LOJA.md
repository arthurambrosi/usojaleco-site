# Como cadastrar e atualizar seus slides

A vitrine e as páginas de produto leem a planilha de vendas que você já usa em `comprar-slide/`. Você edita a planilha no Google Sheets, sem mexer no GitHub. Cada linha é um produto. As alterações aparecem quando o visitante recarrega a página, após o Google atualizar a versão publicada (pode levar alguns minutos).

## Colunas da planilha

Mantenha as colunas existentes; acrescente as novas na primeira linha, à direita. Não substitua a planilha por outra.

| Coluna | O que preencher |
| --- | --- |
| `id` | Código único e permanente, como `itu-na-pediatria`. Não altere depois de divulgar o link. Para produtos existentes, use o código que já aparece após `?id=` no endereço. |
| `titulo` | Nome da apresentação. |
| `area` | A área define a vitrine: matérias escolares vão para Escola; todas as outras vão para Medicina. |
| `preco` | Valor como `99,00`. Atualize também o valor no provedor de pagamento: a planilha não altera o checkout. |
| `descricao` | Conteúdo, o que o cliente recebe e informações relevantes. Aceita quebras de linha. |
| `imagem` | Link HTTPS da capa, ou link de imagem do Google Drive compartilhada para visualização. Prefira uma imagem horizontal 16:9. |
| `pdf` | Link de uma prévia pública em PDF, opcional. Não coloque aqui o arquivo completo pago. |
| `video` | Link de vídeo YouTube, Vimeo ou arquivo MP4/WebM em HTTPS. Pode coexistir com o PDF. |
| `link_compra` | Link do checkout do produto (ex.: Greenn). Sem ele, a compra é encaminhada ao WhatsApp. |
| `numero_slides` | Quantidade de slides, opcional. |
| `formato` | Ex.: `PowerPoint editável`, apenas se for o formato entregue. |
| `ativo` | `sim` para mostrar, `não` para esconder da vitrine. |

Não use a coluna `slides` para quantidade se ela já contém o nome do produto; use `numero_slides`.

## Vídeos

No YouTube, envie uma prévia como **não listado**, com incorporação permitida, e cole o link na coluna `video`. O vídeo é exibido dentro da página do produto, sem reprodução automática. “Não listado” não protege o vídeo: qualquer pessoa com o link pode assistir. Use apenas uma demonstração, não material que precisa ficar restrito a compradores.

Links do Vimeo também podem ser incorporados, conforme as permissões configuradas no Vimeo. MP4/WebM precisa ser um link direto ao arquivo. Outros links HTTPS aparecem como botão para assistir em outra aba. Links do Google Drive normalmente abrem em outra aba; para reprodução dentro da página, prefira YouTube ou Vimeo. Se o provedor bloquear a incorporação, o visitante ainda tem o link externo abaixo do vídeo.

## Para adicionar um produto

1. Cadastre o produto e sua entrega no provedor de pagamento.
2. Adicione uma linha à planilha com ID, título, preço, descrição, capa e link de compra. Preencha vídeo e PDF se desejar.
3. Confirme que a mesma aba continua publicada como CSV no Google Sheets (Arquivo → Compartilhar → Publicar na Web).
4. Recarregue `/loja/`, abra o produto e confira capa, preço, prévias e destino do botão de compra no celular.
5. Compartilhe o endereço `/loja/slide/?id=SEU-ID`.

O site não exige um novo arquivo HTML para cada produto. Não coloque senhas, dados de clientes ou arquivos pagos na planilha pública.

## Onde está a configuração

A URL pública atual fica em `assets/data/loja.js`, campo `planilhaCSV`. Ela permite ler os dados; não é um link de edição. Abra no seu Google Drive a planilha original usada na antiga página `comprar-slide/`. A configuração continua usando essa mesma fonte, sem migrar seus dados.

O catálogo antigo de `/slides/`, que usava outra planilha, continua em `/slides/catalogo-anterior.html`. A página central atual é `/slides/`; `/apresentacoes/` redireciona para ela, preservando parâmetros e âncoras.

## Medicina e Escola

A coluna `area` separa automaticamente as vitrines. Biologia, Geografia, História, Matemática, Física, Química, Ciências, Português, Literatura, Redação, Gramática, Inglês, Espanhol, Francês, Arte, Educação Física, Filosofia, Sociologia, Ensino Religioso, Informática, Robótica e outras matérias reconhecidas vão para Escola. Acentos e maiúsculas não interferem. As demais áreas, inclusive áreas vazias, vão para Medicina. A lista reconhecida está na função `segmento` em `assets/js/loja.js`; uma matéria nova fora dessa lista pode ser acrescentada.

- Medicina: `/loja/?vitrine=medicina`
- Escola: `/loja/?vitrine=escola`
- Link para a bio: `/menu/`

A coluna `ativo` aceita `x`, `sim` ou vazio para exibir, mantendo a compatibilidade com sua planilha. Use `não`, `false`, `0` ou `inativo` para esconder.
