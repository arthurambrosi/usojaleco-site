/*
 * Uso Jaleco — configuração geral do site.
 * Edite aqui contatos, números e links. Nada mais precisa mudar.
 */
window.UJ = window.UJ || {};
window.UJ.config = {
  marca: "Uso Jaleco",
  dominio: "https://www.usojaleco.com.br",
  cidade: "Salvador, Bahia",

  whatsapp: "5571981577908",          // só números, com DDI e DDD
  email: "usojaleco@gmail.com",
  instagram: "usojaleco_",

  // Opcional: endpoint de formulário (Formspree, Getform, Google Apps Script…).
  // Vazio = o pedido de orçamento é enviado pelo WhatsApp ou por e-mail.
  formEndpoint: "",

  // Google Analytics 4 (o mesmo ID usado hoje em analytics-config.js)
  ga4: "G-4E6S9EHGF6",

  // Cena da home: "auditorio" ou "tutoria" ao abrir. Para trocar o desenho por
  // uma foto (ex.: gerada por IA), informe fundo e a posição da tela em %:
  // auditorio: { fundo: "assets/img/cena/auditorio.webp", tela: { x: 25, y: 12, w: 50, h: 50 } }
  cena: { inicial: "auditorio" },

  numeros: [],

  // Instituições e eventos onde trabalhos do Uso Jaleco já foram apresentados
  apresentadoEm: [
    "Jornada de Neurologia da Bahia",
    "Jornada de Cardiologia",
    "Hospital Geral Ernesto Simões Filho",
    "COT Hospital",
    "Hospital Português",
    "Hospital Santo Amaro",
    "Hospital Teresa de Lisieux",
    "UNIFACS"
  ],

  pagamento: ["Pix", "Transferência bancária", "Cartão e outras opções: consulte o checkout"],

  // Menu principal (rótulo, caminho a partir da raiz do site)
  menu: [
    { rotulo: "Serviços", href: "servicos/" },
    { rotulo: "Slides prontos", href: "loja/" },
    { rotulo: "Portfólio", href: "portfolio/" },
    { rotulo: "Conteúdos", href: "conteudos/" },
    { rotulo: "Sobre", href: "sobre/" }
  ]
};
