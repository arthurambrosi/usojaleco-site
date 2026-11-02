/*
 * Uso Jaleco — script único do site.
 * Monta topo, rodapé e as seções que vêm dos arquivos em assets/data/.
 * Cada página declara <body data-pagina="..."> e elementos [data-render="..."].
 */
(function () {
  "use strict";

  var UJ = window.UJ || {};
  var C = UJ.config || {};
  var TODOS_SERVICOS = UJ.servicos || [];
  var SERV = TODOS_SERVICOS.filter(function(s) { return ["apresentacoes", "curriculo", "sites", "identidade-visual"].indexOf(s.id) >= 0; });
  var PORT = UJ.portfolio || [];
  var FERR = UJ.ferramentas || [];
  var doc = document;
  var raiz = doc.documentElement.getAttribute("data-raiz") || "";
  var pagina = doc.body.getAttribute("data-pagina") || "";

  // Em produção (GitHub Pages) as pastas abrem sozinhas; fora dela (arquivo
  // local, prévias) acrescentamos index.html aos links de pasta.
  var explicito = location.protocol === "file:" ||
    !/(usojaleco\.com\.br|github\.io|localhost|127\.0\.0\.1)$/.test(location.hostname);

  function u(caminho) {
    var p = raiz + (caminho || "");
    if (explicito) {
      var partes = p.split(/([?#].*)/);
      var base = partes[0], resto = partes[1] || "";
      if (base === "" || /\/$/.test(base)) base += "index.html";
      p = base + resto;
    }
    return p;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function zap(texto) { return "https://wa.me/" + C.whatsapp + (texto ? "?text=" + encodeURIComponent(texto) : ""); }
  function linkServico(s) { return u("servicos/" + s.id + "/"); }
  function img(nome, pequeno) { return u("assets/img/portfolio/" + nome + (pequeno ? "-sm" : "") + ".webp"); }
  function servicoPorId(id) { for (var i = 0; i < TODOS_SERVICOS.length; i++) if (TODOS_SERVICOS[i].id === id) return TODOS_SERVICOS[i]; return null; }

  // ---------- Ícones (traço 1.6, 24x24) ----------
  var P = {
    apresentacao: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 12l3-3 2 2 4-4"/>',
    biblioteca: '<rect x="3" y="5" width="13" height="9" rx="1"/><path d="M8 18h11a1 1 0 0 0 1-1V9"/>',
    curriculo: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
    site: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
    identidade: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.5-1 1-2-.6-1.2.2-2.5 1.6-2.5H17a3.5 3.5 0 0 0 3.5-3.5"/><circle cx="8" cy="11" r="1"/><circle cx="11.5" cy="7.5" r="1"/><circle cx="16" cy="9" r="1"/>',
    ciencia: '<path d="M9 3h6M10 3v6L4.8 18.2A1.9 1.9 0 0 0 6.5 21h11a1.9 1.9 0 0 0 1.7-2.8L14 9V3"/><path d="M7.5 15h9"/>',
    conteudo: '<rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="12" r="3.5"/><path d="M16.5 6.5h.01"/>',
    educacao: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/>',
    seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    voltar: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    baixo: '<path d="M6 9l6 6 6-6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    pausa: '<path d="M9 6v12M15 6v12"/>',
    tocar: '<path d="M8 5l11 7-11 7z"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 7l9 6 9-6"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><path d="M16.8 7.2h.01"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8.6 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/>'
  };
  function ico(n, cls) {
    return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || "") + "</svg>";
  }
  UJ.ico = ico;

  function seloStatus(s) {
    return s.status === "em-breve" ? '<span class="selo breve">Em breve</span>' : "";
  }

  // ---------- Topo ----------
  function montarTopo() {
    var alvo = $("[data-topo]"); if (!alvo) return;
    var contato = zap('Olá! Vim pelo Uso Jaleco e quero saber mais sobre os serviços.');
    var links = [['Compre','loja/'],['Serviços','servicos/'],['Sobre','sobre/']];
    function itens(classe) { return links.map(function(item) { return '<a class="' + classe + '" href="' + u(item[1]) + '">' + item[0] + '</a>'; }).join(''); }
    alvo.outerHTML = '<a class="pular" href="#conteudo">Pular para o conteúdo</a><header class="topo"><div class="cont"><a class="marca" href="' + u('') + '" aria-label="Uso Jaleco, página inicial">uso<b>jaleco</b><i>.</i></a><nav class="nav" aria-label="Principal">' + itens('') + '</nav><a class="btn btn-tinta btn-orc" href="' + contato + '" target="_blank" rel="noopener">Fale conosco ↗</a><button class="btn-menu" type="button" aria-expanded="false" aria-controls="gaveta" aria-label="Abrir menu">' + ico('menu') + '</button></div></header><nav class="gaveta" id="gaveta" aria-label="Menu móvel">' + itens('g-grande') + '<a class="g-grande" href="' + u('menu/') + '">Todos os links</a><a class="btn btn-tinta" href="' + contato + '" target="_blank" rel="noopener">Fale conosco ↗</a></nav>';
    var bm = $('.btn-menu');
    function fecharMobile() { doc.body.classList.remove('menu-aberto'); bm.setAttribute('aria-expanded','false'); bm.setAttribute('aria-label','Abrir menu'); }
    bm.addEventListener('click',function() { var aberto=doc.body.classList.toggle('menu-aberto'); bm.setAttribute('aria-expanded',String(aberto)); bm.setAttribute('aria-label',aberto?'Fechar menu':'Abrir menu'); });
    doc.addEventListener('keydown',function(e) { if(e.key==='Escape') { $$('.menu-serv').forEach(function(ms){ms.removeAttribute('data-aberto');$('button',ms).setAttribute('aria-expanded','false');});fecharMobile(); } });
  }
  function montarRodape() {
    var alvo = $('[data-rodape]'); if(!alvo) return;
    alvo.outerHTML = '<footer class="rodape rodape-simples"><div class="cont"><div class="footer-row"><div><a class="marca" href="' + u('') + '">uso<b>jaleco</b><i>.</i></a><p>Clareza para as suas ideias.<br>Cuidado com a sua trajetória.</p></div><nav aria-label="Rodapé"><a href="' + u('loja/') + '">Compre</a><a href="' + u('servicos/') + '">Serviços</a><a href="' + u('menu/') + '">Todos os links</a><a href="' + u('sobre/') + '">Sobre</a></nav><div><a href="mailto:' + C.email + '">' + C.email + '</a><br><a href="https://instagram.com/' + C.instagram + '" target="_blank" rel="noopener">@' + C.instagram + '</a></div></div><div class="rodape-base"><span>© ' + new Date().getFullYear() + ' Uso Jaleco</span><a href="' + u('privacidade/') + '">Privacidade e contato</a><span>Não realizamos atendimento médico.</span></div></div></footer>';
  }

  // ---------- Tela de projeção (home) ----------
  function renderTela(el) {
    var lista = PORT.slice();
    var i = 0, timer = null, tocando = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var dur = 5200;
    el.innerHTML =
      '<div class="tela-quadro">' + lista.map(function (p, k) {
        return '<img src="' + img(p.img, false) + '" alt="Capa da apresentação ' + esc(p.titulo) + '"' + (k === 0 ? ' class="ativo"' : ' loading="lazy"') + ">";
      }).join("") + "</div>" +
      '<div class="tela-legenda"><div class="tela-num" aria-hidden="true"></div><div class="tela-info" aria-live="polite"></div>' +
      '<div class="tela-ctrl"><button type="button" data-a="ant" aria-label="Slide anterior">' + ico("voltar") + '</button>' +
      '<button type="button" data-a="pausa" aria-label="Pausar">' + ico("pausa") + '</button>' +
      '<button type="button" data-a="prox" aria-label="Próximo slide">' + ico("seta") + "</button></div></div>" +
      '<div class="tela-barra"><i></i></div>';
    var imgs = $$("img", el), num = $(".tela-num", el), info = $(".tela-info", el), barra = $(".tela-barra i", el), bp = $('[data-a="pausa"]', el);
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function mostrar(k) {
      i = (k + lista.length) % lista.length;
      imgs.forEach(function (im, j) { im.classList.toggle("ativo", j === i); });
      var p = lista[i];
      num.innerHTML = pad(i + 1) + " <span>/ " + pad(lista.length) + "</span>";
      info.innerHTML = "<strong>" + esc(p.titulo) + "</strong><span>" + esc(p.tipo) + ", " + esc(p.contexto) + "</span>";
      animarBarra();
    }
    function animarBarra() {
      barra.style.transition = "none"; barra.style.width = "0";
      if (!tocando) return;
      void barra.offsetWidth;
      barra.style.transition = "width " + dur + "ms linear"; barra.style.width = "100%";
    }
    function agendar() { clearInterval(timer); if (tocando) timer = setInterval(function () { mostrar(i + 1); }, dur); }
    function setTocando(v) { tocando = v; bp.innerHTML = ico(v ? "pausa" : "tocar"); bp.setAttribute("aria-label", v ? "Pausar" : "Reproduzir"); agendar(); animarBarra(); }
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var a = b.getAttribute("data-a");
      if (a === "prox") { mostrar(i + 1); agendar(); }
      if (a === "ant") { mostrar(i - 1); agendar(); }
      if (a === "pausa") setTocando(!tocando);
    });
    doc.addEventListener("visibilitychange", function () { if (doc.hidden) clearInterval(timer); else agendar(); });
    mostrar(0); setTocando(tocando);
  }

  // ---------- Blocos reutilizáveis ----------
  var R = {};

  R.faixa = function (el) {
    el.innerHTML = '<div class="cont"><p>Trabalhos já apresentados em</p><ul>' +
      (C.apresentadoEm || []).map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></div>";
  };

  R.numeros = function (el) {
    el.innerHTML = (C.numeros || []).map(function (n) { return "<div><strong>" + esc(n.valor) + "</strong><span>" + esc(n.texto) + "</span></div>"; }).join("");
  };

  R.servicos = function (el) {
    var dest = SERV.filter(function (s) { return s.destaque; })[0];
    var resto = SERV.filter(function (s) { return s !== dest; });
    var capa = PORT.filter(function (p) { return p.destaque; })[1] || PORT[0];
    var html = "";
    if (dest) {
      html += '<a class="serv-destaque" href="' + linkServico(dest) + '"><div class="sd-texto">' +
        '<h3 class="titulo-sec">' + esc(dest.nome) + '</h3><p class="lead">' + esc(dest.descricao) + "</p>" +
        '<span class="link-seta">Conhecer o serviço ' + ico("seta") + "</span></div>" +
        '<div class="sd-img"><img src="' + img(capa.img, false) + '" alt="" loading="lazy"></div></a>';
    }
    html += '<ul class="serv-lista">' + resto.map(function (s) {
      return '<li><a href="' + linkServico(s) + '"><span class="ico">' + ico(s.icone) + "</span><h3>" + esc(s.nome) + seloStatus(s) + "</h3><p>" + esc(s.resumo) + "</p>" + ico("seta", "seta") + "</a></li>";
    }).join("") + "</ul>";
    el.innerHTML = html;
  };

  function peca(p, k) {
    return '<figure class="peca"><button type="button" data-k="' + k + '" aria-label="Ampliar ' + esc(p.titulo) + '">' +
      '<div class="moldura"><img src="' + img(p.img, true) + '" alt="Capa da apresentação ' + esc(p.titulo) + '" loading="lazy" width="720" height="405"></div></button>' +
      "<figcaption><strong>" + esc(p.titulo) + "</strong><span>" + esc(p.tipo) + "</span></figcaption></figure>";
  }

  R["portfolio-destaque"] = function (el) {
    var lista = PORT.filter(function (p) { return p.destaque; }).slice(0, 5);
    el.classList.add("grade-port", "mosaico");
    el.innerHTML = lista.map(peca).join("");
    ligarProjetor(el, lista);
  };

  R.portfolio = function (el) {
    var tipos = [];
    PORT.forEach(function (p) { if (tipos.indexOf(p.tipo) < 0) tipos.push(p.tipo); });
    var filtro = "Todos";
    var cont = function (t) { return t === "Todos" ? PORT.length : PORT.filter(function (p) { return p.tipo === t; }).length; };
    el.innerHTML = '<div class="filtros" role="group" aria-label="Filtrar por tipo">' + ["Todos"].concat(tipos).map(function (t) {
      return '<button type="button" aria-pressed="' + (t === filtro) + '" data-f="' + esc(t) + '">' + esc(t) + "<span>" + cont(t) + "</span></button>";
    }).join("") + '</div><div class="grade-port" aria-live="polite"></div>';
    var grade = $(".grade-port", el), atual = [];
    function desenhar() {
      atual = PORT.filter(function (p) { return filtro === "Todos" || p.tipo === filtro; });
      grade.innerHTML = atual.map(peca).join("");
    }
    $(".filtros", el).addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      filtro = b.getAttribute("data-f");
      $$(".filtros button", el).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      desenhar();
    });
    desenhar();
    ligarProjetor(grade, function () { return atual; });
  };

  // ---------- Projetor (lightbox) ----------
  var projetor = null;
  function ligarProjetor(grade, fonte) {
    grade.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-k]"); if (!b) return;
      abrirProjetor(typeof fonte === "function" ? fonte() : fonte, +b.getAttribute("data-k"), b);
    });
  }
  function abrirProjetor(lista, k, origem) {
    if (!projetor) {
      projetor = doc.createElement("div");
      projetor.className = "projetor";
      projetor.setAttribute("role", "dialog");
      projetor.setAttribute("aria-modal", "true");
      projetor.setAttribute("aria-label", "Visualização do trabalho");
      projetor.innerHTML = '<div class="projetor-topo"><p></p><button type="button" data-a="fechar" aria-label="Fechar">' + ico("fechar") + "</button></div>" +
        '<div class="projetor-palco"><button type="button" class="ant" data-a="ant" aria-label="Anterior">' + ico("voltar") + '</button><img alt=""><button type="button" data-a="prox" aria-label="Próximo">' + ico("seta") + "</button></div>";
      doc.body.appendChild(projetor);
    }
    var i = k;
    function mostrar() {
      var p = lista[i];
      $("img", projetor).src = img(p.img, false);
      $("img", projetor).alt = "Capa da apresentação " + p.titulo;
      $("p", projetor).innerHTML = esc(p.titulo) + "<span>" + esc(p.area) + ", " + esc(p.tipo) + ", " + esc(p.contexto) + " (" + (i + 1) + " de " + lista.length + ")</span>";
    }
    function fechar() { projetor.removeAttribute("data-aberto"); doc.removeEventListener("keydown", tecla); projetor.onclick = null; doc.body.style.overflow = ""; if (origem) origem.focus(); }
    function tecla(e) {
      if (e.key === "Escape") fechar();
      if (e.key === "ArrowRight") { i = (i + 1) % lista.length; mostrar(); }
      if (e.key === "ArrowLeft") { i = (i - 1 + lista.length) % lista.length; mostrar(); }
    }
    projetor.onclick = function (e) {
      var b = e.target.closest("button");
      if (!b) { if (e.target === projetor || e.target.classList.contains("projetor-palco")) fechar(); return; }
      var a = b.getAttribute("data-a");
      if (a === "fechar") fechar();
      if (a === "prox") { i = (i + 1) % lista.length; mostrar(); }
      if (a === "ant") { i = (i - 1 + lista.length) % lista.length; mostrar(); }
    };
    doc.addEventListener("keydown", tecla);
    mostrar();
    projetor.setAttribute("data-aberto", "");
    doc.body.style.overflow = "hidden";
    $('[data-a="fechar"]', projetor).focus();
  }

  R["ferramentas-mini"] = function (el) {
    var lista = FERR.filter(function (f) { return f.acesso === "livre"; }).slice(0, 6);
    el.innerHTML = lista.map(function (f) {
      return '<a href="' + u(f.href) + '"><strong>' + esc(f.nome) + "</strong><p>" + esc(f.texto) + "</p></a>";
    }).join("");
  };

  R.ferramentas = function (el) {
    var grupos = [];
    FERR.forEach(function (f) { if (grupos.indexOf(f.grupo) < 0) grupos.push(f.grupo); });
    el.innerHTML = grupos.map(function (g) {
      return '<section class="ferr-grupo"><h3>' + esc(g) + '</h3><div class="ferr-itens">' + FERR.filter(function (f) { return f.grupo === g; }).map(function (f) {
        var selo = f.acesso === "membros" ? '<span class="selo membros">Com login</span>' : f.acesso === "em-breve" ? '<span class="selo breve">Em breve</span>' : "";
        var corpo = "<strong>" + esc(f.nome) + selo + "</strong><p>" + esc(f.texto) + "</p>";
        return f.href ? '<a href="' + u(f.href) + '">' + corpo + "</a>" : '<div class="indisp">' + corpo + "</div>";
      }).join("") + "</div></section>";
    }).join("");
  };

  R["servicos-todos"] = function (el) {
    el.innerHTML = '<ul class="serv-lista">' + SERV.map(function (s) {
      return '<li><a href="' + linkServico(s) + '"><span class="ico">' + ico(s.icone) + "</span><h3>" + esc(s.nome) + seloStatus(s) + "</h3><p>" + esc(s.resumo) + "</p>" + ico("seta", "seta") + "</a></li>";
    }).join("") + "</ul>";
  };

  R.pagamento = function (el) {
    el.innerHTML = (C.pagamento || []).map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("");
  };

  R.contatos = function (el) {
    el.innerHTML =
      '<a href="' + zap("Olá! Vim pelo site do Uso Jaleco.") + '" target="_blank" rel="noopener"><span class="ico">' + ico("whatsapp") + "</span><strong>WhatsApp</strong><span>Resposta mais rápida, para alinhar o briefing</span></a>" +
      '<a href="mailto:' + esc(C.email) + '"><span class="ico">' + ico("email") + "</span><strong>" + esc(C.email) + "</strong><span>Para enviar artigos, dados e arquivos</span></a>" +
      '<a href="https://instagram.com/' + esc(C.instagram) + '" target="_blank" rel="noopener"><span class="ico">' + ico("instagram") + "</span><strong>@" + esc(C.instagram) + "</strong><span>Bastidores, trabalhos novos e dicas</span></a>";
  };

  // ---------- Página de um serviço ----------
  R.servico = function (el) {
    var id = doc.body.getAttribute("data-servico") || new URLSearchParams(location.search).get("s");
    var s = servicoPorId(id);
    if (!s) {
      el.innerHTML = '<section class="cab-pag escuro"><div class="cont"><h1 class="titulo-palco">Serviço não encontrado</h1><p class="lead">O endereço pode ter mudado. Veja a lista completa de serviços.</p><div class="acoes" style="margin-top:28px"><a class="btn btn-laranja" href="' + u("servicos/") + '">Ver serviços</a></div></div></section>';
      return;
    }
    doc.title = s.nome + " | Uso Jaleco";
    var orc = zap("Olá! Quero um orçamento de " + s.nome + ".");
    var h = '<section class="cab-pag escuro palco"><div class="cont"><p class="trilha"><a href="' + u("servicos/") + '">Serviços</a> / ' + esc(s.curto || s.nome) + "</p>" +
      '<h1 class="titulo-palco">' + esc(s.nome) + "</h1>" + (s.status === "em-breve" ? '<p style="margin:0 0 20px"><span class="selo breve">Em breve</span></p>' : "") +
      '<p class="lead">' + esc(s.descricao) + '</p><div class="acoes">' +
      (s.status !== "em-breve" ? '<a class="btn btn-laranja" href="' + orc + '">Pedir orçamento</a>' : "") +
      (s.linkExterno ? '<a class="btn btn-linha" href="' + u(s.linkExterno.href) + '">' + esc(s.linkExterno.rotulo) + "</a>" : "") +
      "</div></div></section>";

    if ((s.entregas && s.entregas.length) || (s.paraQuem && s.paraQuem.length)) {
      h += '<section class="sec"><div class="cont colunas">' +
        (s.entregas && s.entregas.length ? '<div><h2 class="titulo-peq">O que está incluído</h2><ul class="lista-check">' + s.entregas.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" : "") +
        (s.paraQuem && s.paraQuem.length ? '<div><h2 class="titulo-peq">Para quem é</h2><ul class="lista-check">' + s.paraQuem.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" : "") +
        "</div></section>";
    }
    if (s.precos && s.precos.length) {
      h += '<section class="sec branco" id="valores"><div class="cont colunas"><div><h2 class="titulo-sec">Valores</h2><p class="nota" style="margin-top:16px">Valores de referência. A proposta final considera prazo e volume do material.</p></div>' +
        '<table class="tabela-precos"><tbody>' + s.precos.map(function (p) {
          return "<tr><td><strong>" + esc(p.item) + "</strong>" + (p.obs ? '<span class="o">' + esc(p.obs) + "</span>" : "") + '</td><td class="v">' + esc(p.valor) + "</td></tr>";
        }).join("") + "</tbody></table></div></section>";
    }
    if (s.processo && s.processo.length) {
      h += '<section class="sec escuro"><div class="cont"><div class="cab-sec"><h2 class="titulo-sec">Como funciona</h2></div>' +
        '<ol class="passos" style="--n:' + s.processo.length + '">' + s.processo.map(function (p) { return "<li><h3>" + esc(p.titulo) + "</h3><p>" + esc(p.texto) + "</p></li>"; }).join("") + "</ol></div></section>";
    }
    if (s.portfolio) {
      h += '<section class="sec"><div class="cont"><div class="cab-sec"><h2 class="titulo-sec">Trabalhos recentes</h2><a class="link-seta" href="' + u("portfolio/") + '">Ver o portfólio completo ' + ico("seta") + '</a></div><div data-render="portfolio-destaque"></div></div></section>';
    }
    if (s.faq && s.faq.length) {
      h += '<section class="sec' + (s.portfolio ? " branco" : "") + '"><div class="cont"><div class="cab-sec"><h2 class="titulo-sec">Perguntas frequentes</h2></div><div class="faq">' +
        s.faq.map(function (f) { return "<details><summary>" + esc(f.p) + "</summary><p>" + esc(f.r) + "</p></details>"; }).join("") + "</div></div></section>";
    }
    el.innerHTML = h;
    $$("[data-render]", el).forEach(renderizar);
    var mt = doc.querySelector('meta[name="description"]');
    if (mt && !mt.getAttribute("content")) mt.setAttribute("content", s.resumo);
  };

  // ---------- Formulário de orçamento ----------
  R.orcamento = function (form) {
    var pre = new URLSearchParams(location.search).get("s");
    var chips = $("[data-chips]", form);
    chips.innerHTML = SERV.filter(function (s) { return s.status !== "em-breve"; }).map(function (s) {
      return '<label class="chip"><input type="checkbox" name="servicos" value="' + esc(s.nome) + '"' + (s.id === pre ? " checked" : "") + "><span>" + esc(s.curto || s.nome) + "</span></label>";
    }).join("") + '<label class="chip"><input type="checkbox" name="servicos" value="Outro"><span>Outro</span></label>';

    var msg = $(".form-msg", form);
    function valor(n) { var e = form.elements[n]; return e ? String(e.value || "").trim() : ""; }
    function validar() {
      var ok = true;
      ["nome", "contato"].forEach(function (n) {
        var c = form.elements[n].closest(".campo");
        if (!valor(n)) { c.setAttribute("data-invalido", ""); ok = false; } else c.removeAttribute("data-invalido");
      });
      var marcados = $$('input[name="servicos"]:checked', form);
      var cs = chips.closest(".campo");
      if (!marcados.length) { cs.setAttribute("data-invalido", ""); ok = false; } else cs.removeAttribute("data-invalido");
      return ok;
    }
    function texto() {
      var servs = $$('input[name="servicos"]:checked', form).map(function (i) { return i.value; }).join(", ");
      var linhas = [
        "Olá! Quero um orçamento pelo site do Uso Jaleco.",
        "",
        "Nome: " + valor("nome"),
        "Contato: " + valor("contato"),
        valor("perfil") ? "Perfil: " + valor("perfil") : "",
        "Serviço: " + servs,
        valor("evento") ? "Evento ou finalidade: " + valor("evento") : "",
        valor("data") ? "Data do evento ou prazo: " + valor("data").split("-").reverse().join("/") : "",
        valor("detalhes") ? "Detalhes: " + valor("detalhes") : ""
      ];
      return linhas.filter(function (l, k) { return l !== "" || k === 1; }).join("\n");
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validar()) { msg.className = "form-msg falha"; msg.textContent = "Preencha nome, contato e pelo menos um serviço."; var p = $("[data-invalido]", form); if (p) { var f = $("input,select", p); if (f) f.focus(); } return; }
      var via = (e.submitter && e.submitter.getAttribute("data-via")) || "whatsapp";
      if (via === "email") {
        location.href = "mailto:" + C.email + "?subject=" + encodeURIComponent("Orçamento: " + valor("nome")) + "&body=" + encodeURIComponent(texto());
        msg.className = "form-msg ok"; msg.textContent = "Abrimos seu aplicativo de e-mail com o pedido preenchido.";
        return;
      }
      if (C.formEndpoint) {
        fetch(C.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ mensagem: texto() }) }).catch(function () {});
      }
      window.open(zap(texto()), "_blank", "noopener");
      msg.className = "form-msg ok"; msg.textContent = "Pedido pronto no WhatsApp. É só tocar em enviar.";
    });
  };

  function renderizar(el) {
    var n = el.getAttribute("data-render");
    if (n === "tela") return renderTela(el);
    if (R[n]) R[n](el);
  }

  // ---------- Início ----------
  // servicos/?s=<id> abre a página do serviço mesmo sem pasta própria
  if (pagina === "servicos" && new URLSearchParams(location.search).get("s")) {
    var m = $("main"); if (m) m.innerHTML = '<div data-render="servico"></div>';
    pagina = "servico";
  }
  montarTopo();
  montarRodape();
  $$("[data-render]").forEach(renderizar);
  $$("a[data-zap]").forEach(function (a) { a.href = zap(a.getAttribute("data-zap")); a.target = "_blank"; a.rel = "noopener"; });
  $$("a[data-email]").forEach(function (a) { a.href = "mailto:" + C.email; a.textContent = a.textContent || C.email; });
  $$('a[href]').forEach(function(a) {
    var h=a.getAttribute('href') || '';
    if (/^(https?:|mailto:|tel:|#)/.test(h)) return;
    if (/(^|\/)orcamento\//.test(h)) { a.href=zap('Olá! Quero um orçamento pelo site do Uso Jaleco.'); a.target='_blank'; a.rel='noopener'; }
  });
  if (explicito) {
    $$('main a[href]').forEach(function (a) {
      var h = a.getAttribute("href");
      if (!/^(https?:|mailto:|tel:|#)/.test(h) && (h === "" || /\/([?#].*)?$/.test(h)) && h.indexOf("index.html") < 0) {
        a.setAttribute("href", h.replace(/\/([?#].*)?$/, "/index.html$1"));
      }
    });
  }

  // Medição compartilhada; somente no domínio oficial.
  var analytics = doc.createElement("script");
  analytics.src = u("analytics.js");
  analytics.defer = true;
  doc.head.appendChild(analytics);
})();
