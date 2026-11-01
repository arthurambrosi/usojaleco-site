/*
 * Uso Jaleco — vitrine de slides à venda.
 *
 * A vitrine lê a mesma planilha publicada que você já usa em /comprar-slide.
 * Colunas reconhecidas (pelo nome do cabeçalho, sem acento ou maiúsculas):
 *   ativo | titulo | preco | descricao | imagem | pdf (prévia) | link_compra | area
 * Linhas com "ativo" igual a não/false/0 ficam escondidas.
 *
 * "imagem" aceita link direto de imagem ou link de arquivo do Google Drive
 * (compartilhado como "qualquer pessoa com o link").
 * Sem "link_compra", o botão Comprar abre o WhatsApp com o nome do slide.
 */
window.UJ = window.UJ || {};
window.UJ.loja = {
  // Capas extraídas dos PDFs públicos, sem alterar o material de venda.
  capasPDF: { "ITU na pediatria.pdf": "assets/img/loja/itu-na-pediatria.webp" },
  planilhaCSV: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRH5f6s53rGIEkciJUr_uo7ShCYp8JBUOrd3Y2O4TBaaEAQdzNxUAHsA1CAlptPj1HXyDaARWUfS3Tx/pub?gid=0&single=true&output=csv",

  // Itens que aparecem em toda página de produto. Ajuste ao seu modelo de venda.
  inclui: [
    "Arquivo PowerPoint aberto e editável",
    "Prévia em PDF antes de comprar",
    "Design no padrão visual Uso Jaleco"
  ],

  // Usados só fora do site oficial (prévias e testes locais) ou se a planilha
  // estiver vazia. Não aparecem para clientes quando a planilha carrega.
  exemplos: [
    { titulo: "Semiologia abdominal", area: "Semiologia", preco: "", descricao: "Aula completa de exame físico do abdome, com inspeção, ausculta, percussão e palpação.", imagem: "assets/img/portfolio/slide-14.webp" },
    { titulo: "Semiologia neurológica", area: "Semiologia", preco: "", descricao: "Roteiro do exame neurológico para aulas de graduação e internato.", imagem: "assets/img/portfolio/slide-11.webp" },
    { titulo: "Semiologia osteomuscular", area: "Semiologia", preco: "", descricao: "Exame físico do sistema osteomuscular, articulação por articulação.", imagem: "assets/img/portfolio/slide-04.webp" },
    { titulo: "Pancreatite aguda", area: "Gastroenterologia", preco: "", descricao: "Diagnóstico, classificação de gravidade e manejo inicial.", imagem: "assets/img/portfolio/slide-09.webp" },
    { titulo: "Hipertireoidismo", area: "Endocrinologia", preco: "", descricao: "Causas, diagnóstico laboratorial e opções de tratamento.", imagem: "assets/img/portfolio/slide-08.webp" },
    { titulo: "Tabagismo e cigarro eletrônico", area: "Clínica médica", preco: "", descricao: "Epidemiologia, riscos e abordagem da cessação.", imagem: "assets/img/portfolio/slide-13.webp" }
  ]
};
