/*
 * Uso Jaleco — catálogo de serviços.
 *
 * Para criar um serviço novo, copie um bloco abaixo, troque o "id" (sem acentos
 * nem espaços) e preencha os campos. Ele aparece sozinho no menu, na home, na
 * página de serviços e no formulário de orçamento, e ganha a página
 * servicos/?s=<id>. Se quiser um endereço próprio (ex.: /servicos/podcasts/),
 * copie a pasta servicos/sites/ e troque o data-servico no index.html.
 *
 * status: "disponivel" | "em-breve"
 * icone: apresentacao | curriculo | site | identidade | ciencia | conteudo | educacao | biblioteca
 */
window.UJ = window.UJ || {};
window.UJ.servicos = [
  {
    id: "apresentacoes",
    nome: "Apresentações e slides médicos",
    curto: "Apresentações",
    icone: "apresentacao",
    status: "disponivel",
    destaque: true,
    resumo: "Slides para congressos, aulas, sessões clínicas e defesas, com design próprio e narrativa científica clara.",
    descricao: "Você envia o tema, o artigo ou o rascunho. Nós organizamos a narrativa, desenhamos cada slide e entregamos um PowerPoint aberto e 100% editável, pronto para projetar no auditório.",
    paraQuem: [
      "Residentes com sessão clínica, journal club ou apresentação de caso",
      "Palestrantes e convidados de congressos e jornadas",
      "Professores e preceptores que querem renovar aulas",
      "Estudantes em ligas acadêmicas, internato e TCC"
    ],
    entregas: [
      "Roteiro da apresentação organizado a partir do seu material",
      "Capa e identidade visual exclusivas para o tema",
      "Gráficos, tabelas e fluxogramas redesenhados para leitura à distância",
      "Imagens anatômicas e clínicas escolhidas para o tema",
      "Arquivo .pptx aberto e editável, mais PDF para backup",
      "Rodada de ajustes incluída antes da entrega final"
    ],
    processo: [
      { titulo: "Briefing", texto: "Você conta o tema, o evento, o tempo de fala e envia seus materiais." },
      { titulo: "Proposta", texto: "Você recebe uma proposta com escopo, prazo e valor." },
      { titulo: "Produção", texto: "Começamos assim que a proposta é aprovada. O prazo é combinado na proposta, conforme o volume e a agenda." },
      { titulo: "Entrega", texto: "Arquivo final editável, revisado com você antes do evento." }
    ],
    precos: [],
    faq: [
      { p: "Vocês escrevem o conteúdo científico?", r: "O conteúdo é seu. Nós organizamos a sequência, resumimos textos longos para a linguagem de slide e sinalizamos pontos que precisam da sua revisão." },
      { p: "Consigo editar depois?", r: "Sim. A entrega é em PowerPoint aberto, com fontes e imagens incluídas, para você atualizar e reutilizar quando quiser." },
      { p: "Atendem pedidos urgentes?", r: "Sim, conforme a agenda. Informe a data do evento no pedido de orçamento." },
      { p: "Quais as formas de pagamento?", r: "As opções disponíveis e eventuais parcelas aparecem no checkout ou na proposta." }
    ],
    portfolio: true
  },
  {
    id: "biblioteca",
    nome: "Biblioteca de slides e templates",
    curto: "Slides prontos",
    icone: "biblioteca",
    status: "disponivel",
    resumo: "Apresentações prontas por especialidade e templates premium para você montar a sua.",
    descricao: "Uma vitrine de apresentações já produzidas e de modelos com o padrão visual Uso Jaleco, atualizada com frequência e organizada por especialidade.",
    linkExterno: { rotulo: "Abrir a vitrine", href: "loja/" },
    paraQuem: ["Quem precisa de uma base pronta e tem pouco tempo", "Quem quer o padrão visual sem contratar o projeto completo"],
    entregas: ["Slides prontos por tema e especialidade", "Templates editáveis para congressos e aulas", "Prévia em PDF antes da compra"],
    processo: [],
    precos: [],
    faq: []
  },
  {
    id: "curriculo",
    nome: "Currículo médico",
    curto: "Currículo",
    icone: "curriculo",
    status: "disponivel",
    resumo: "Lattes e currículo vitae organizados para residência, processos seletivos e vagas.",
    descricao: "Organizamos sua trajetória acadêmica e profissional no formato que cada processo exige, com redação objetiva e visual limpo, para que a banca encontre rápido o que importa.",
    paraQuem: [
      "Candidatos a residência médica e análise curricular",
      "Médicos em processos seletivos de hospitais e clínicas",
      "Estudantes que querem começar o Lattes do jeito certo"
    ],
    entregas: [
      "Revisão e preenchimento da Plataforma Lattes",
      "Currículo vitae completo ou sintetizado em PDF",
      "Organização de comprovantes por seção",
      "Ajustes conforme o edital do processo"
    ],
    processo: [
      { titulo: "Formulário", texto: "Você preenche seus dados no nosso formulário guiado." },
      { titulo: "Organização", texto: "Estruturamos as informações e redigimos cada seção." },
      { titulo: "Entrega", texto: "Você recebe o currículo no prazo combinado na proposta." }
    ],
    // Valores de referência. Atualize aqui sempre que a tabela mudar.
    precos: [
      { item: "Currículo Lattes", valor: "R$ 159", obs: "prazo na proposta" },
      { item: "Vitae completo", valor: "R$ 149", obs: "prazo na proposta" },
      { item: "Vitae sintetizado", valor: "R$ 109", obs: "prazo na proposta" }
    ],
    linkExterno: { rotulo: "Preencher formulário do currículo", href: "curriculo/" },
    faq: [
      { p: "Vocês acessam meu Lattes?", r: "Só se você autorizar. Também podemos entregar o conteúdo pronto para você colar na plataforma." },
      { p: "Posso contratar Lattes e vitae juntos?", r: "Sim. No formulário você escolhe os dois e o desconto do pacote é aplicado." }
    ]
  },
  {
    id: "sites",
    nome: "Sites profissionais",
    curto: "Sites",
    icone: "site",
    status: "disponivel",
    resumo: "Site pessoal ou página de apresentação para médicos, com currículo, áreas de atuação e contato.",
    descricao: "Um endereço próprio na internet que reúne quem você é, onde atende, o que publica e como ser encontrado. Pensado para carregar rápido no celular e respeitar as regras de publicidade médica.",
    paraQuem: ["Médicos construindo autoridade na especialidade", "Professores e pesquisadores que querem reunir produção acadêmica", "Ligas e grupos de pesquisa"],
    entregas: [
      "Site responsivo com domínio próprio",
      "Páginas de apresentação, atuação, publicações e contato",
      "Integração com WhatsApp, Instagram e agenda",
      "Otimização para aparecer no Google",
      "Textos alinhados ao Código de Ética Médica"
    ],
    processo: [
      { titulo: "Conversa", texto: "Entendemos seu objetivo e o público que você quer alcançar." },
      { titulo: "Estrutura", texto: "Definimos páginas, textos e referências visuais." },
      { titulo: "Design e construção", texto: "Desenhamos e publicamos o site no seu domínio." },
      { titulo: "Ajustes", texto: "Revisamos juntos e entregamos o acesso." }
    ],
    precos: [],
    faq: [
      { p: "Preciso ter um domínio?", r: "Não. Ajudamos a registrar e configurar." }
    ]
  },
  {
    id: "identidade-visual",
    nome: "Identidade visual",
    curto: "Identidade visual",
    icone: "identidade",
    status: "disponivel",
    resumo: "Marca, paleta e tipografia para médicos, ligas acadêmicas, eventos e projetos de saúde.",
    descricao: "Uma identidade coerente faz seu nome ser reconhecido no slide, no site, no Instagram e no crachá do congresso. Criamos a marca e o manual para que tudo converse.",
    paraQuem: ["Médicos estruturando a marca pessoal", "Ligas acadêmicas e congressos estudantis", "Projetos e serviços de saúde"],
    entregas: ["Logotipo e variações", "Paleta de cores e tipografia", "Manual de uso", "Aplicações: template de slide, cartão, posts"],
    processo: [
      { titulo: "Imersão", texto: "Conversamos sobre você, sua área e as referências que fazem sentido." },
      { titulo: "Conceito", texto: "Apresentamos caminhos visuais para você escolher." },
      { titulo: "Refinamento", texto: "Ajustamos o caminho escolhido e montamos o manual." }
    ],
    precos: [],
    faq: []
  },
  {
    id: "materiais-cientificos",
    nome: "Materiais científicos",
    curto: "Materiais científicos",
    icone: "ciencia",
    status: "disponivel",
    resumo: "Pôsteres, e-pôsteres, banners, infográficos e figuras para artigos e congressos.",
    descricao: "Transformamos dados, tabelas e resultados em peças visuais que respeitam as normas do evento ou da revista e ficam legíveis a dois metros de distância.",
    paraQuem: ["Autores de trabalhos aprovados em congressos", "Pesquisadores preparando figuras para publicação", "Programas de residência e ligas"],
    entregas: ["Pôster e e-pôster nas medidas do edital", "Infográficos e fluxogramas", "Figuras e abstracts gráficos para artigos", "Arquivo para impressão e versão digital"],
    processo: [
      { titulo: "Edital e material", texto: "Você envia o resumo aprovado e as regras do evento." },
      { titulo: "Diagramação", texto: "Organizamos o conteúdo e desenhamos a peça." },
      { titulo: "Entrega", texto: "Arquivo pronto para impressão ou envio." }
    ],
    precos: [],
    faq: []
  },
  {
    id: "conteudo-digital",
    nome: "Conteúdo digital",
    curto: "Conteúdo digital",
    icone: "conteudo",
    status: "disponivel",
    resumo: "Posts, carrosséis e vídeos curtos para médicos que querem educar e ser lembrados.",
    descricao: "Planejamos e produzimos conteúdo educativo para Instagram e outras redes, com linguagem acessível, rigor técnico e respeito às normas do CFM.",
    paraQuem: ["Médicos que querem constância nas redes", "Especialistas que divulgam educação em saúde", "Eventos e ligas acadêmicas"],
    entregas: ["Planejamento mensal de pautas", "Carrosséis e posts com o seu padrão visual", "Roteiro e edição de vídeos curtos", "Capas e destaques de perfil"],
    processo: [
      { titulo: "Diagnóstico", texto: "Analisamos seu perfil e definimos objetivos." },
      { titulo: "Calendário", texto: "Montamos as pautas do mês para sua aprovação." },
      { titulo: "Produção contínua", texto: "Entregamos as peças prontas para publicar." }
    ],
    precos: [],
    faq: []
  },
  {
    id: "educacao",
    nome: "Educação médica",
    curto: "Educação médica",
    icone: "educacao",
    status: "em-breve",
    resumo: "Aulas, vídeos, casos clínicos e materiais interativos produzidos com o padrão Uso Jaleco.",
    descricao: "Estamos construindo uma área de estudo com aulas gravadas, casos clínicos comentados e ferramentas interativas. Algumas ferramentas já estão disponíveis na página de conteúdos.",
    linkExterno: { rotulo: "Ver ferramentas disponíveis", href: "conteudos/" },
    paraQuem: ["Estudantes de medicina", "Residentes", "Médicos em atualização"],
    entregas: ["Aulas em vídeo", "Casos clínicos interativos", "Banco de questões e flashcards", "Calculadoras e scores"],
    processo: [],
    precos: [],
    faq: []
  }
];
